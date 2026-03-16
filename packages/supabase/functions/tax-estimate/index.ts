import { createServiceClient } from '../../src/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface QuarterDates {
  quarter: number;
  start: string;
  end: string;
  dueDate: string;
}

function getQuarterDates(year: number): QuarterDates[] {
  return [
    { quarter: 1, start: `${year}-01-01`, end: `${year}-03-31`, dueDate: `${year}-04-15` },
    { quarter: 2, start: `${year}-04-01`, end: `${year}-06-30`, dueDate: `${year}-06-15` },
    { quarter: 3, start: `${year}-07-01`, end: `${year}-09-30`, dueDate: `${year}-09-15` },
    { quarter: 4, start: `${year}-10-01`, end: `${year}-12-31`, dueDate: `${year + 1}-01-15` },
  ];
}

// 2025 Federal tax brackets (single filer) - approximated for estimation
const FEDERAL_BRACKETS_SINGLE = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];

const FEDERAL_BRACKETS_MFJ = [
  { min: 0, max: 23850, rate: 0.10 },
  { min: 23850, max: 96950, rate: 0.12 },
  { min: 96950, max: 206700, rate: 0.22 },
  { min: 206700, max: 394600, rate: 0.24 },
  { min: 394600, max: 501050, rate: 0.32 },
  { min: 501050, max: 751600, rate: 0.35 },
  { min: 751600, max: Infinity, rate: 0.37 },
];

const SE_TAX_RATE = 0.153; // 15.3% (12.4% SS + 2.9% Medicare)
const SE_INCOME_FACTOR = 0.9235; // 92.35% of net earnings subject to SE tax
const SS_WAGE_BASE = 168600; // 2025 Social Security wage base
const STANDARD_DEDUCTION_SINGLE = 15000;
const STANDARD_DEDUCTION_MFJ = 30000;
const QBI_DEDUCTION_RATE = 0.20; // 20% Qualified Business Income deduction

function calculateFederalTax(taxableIncome: number, filingStatus: string): number {
  if (taxableIncome <= 0) return 0;

  const brackets = filingStatus === 'married_filing_jointly' ? FEDERAL_BRACKETS_MFJ : FEDERAL_BRACKETS_SINGLE;
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  return Math.round(tax * 100) / 100;
}

function calculateSelfEmploymentTax(netIncome: number): {
  selfEmploymentTax: number;
  deductibleHalf: number;
} {
  if (netIncome <= 0) return { selfEmploymentTax: 0, deductibleHalf: 0 };

  const seEarnings = netIncome * SE_INCOME_FACTOR;
  const ssTax = Math.min(seEarnings, SS_WAGE_BASE) * 0.124;
  const medicareTax = seEarnings * 0.029;
  const additionalMedicare = Math.max(0, seEarnings - 200000) * 0.009;

  const selfEmploymentTax = Math.round((ssTax + medicareTax + additionalMedicare) * 100) / 100;
  const deductibleHalf = Math.round(selfEmploymentTax * 0.5 * 100) / 100;

  return { selfEmploymentTax, deductibleHalf };
}

export async function calculateQuarterlyTaxEstimate(
  organizationId: string,
  taxYear: number,
  filingStatus: string = 'single',
  stateCode?: string
): Promise<void> {
  const supabase = createServiceClient(supabaseUrl, supabaseServiceKey);

  const quarters = getQuarterDates(taxYear);

  // Fetch organization info
  const { data: org } = await supabase
    .from('organizations')
    .select('business_type')
    .eq('id', organizationId)
    .single();

  // Calculate cumulative totals through each quarter
  for (const q of quarters) {
    // Get income for the year up to end of this quarter
    const { data: incomeData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('organization_id', organizationId)
      .eq('is_excluded', false)
      .gte('date', `${taxYear}-01-01`)
      .lte('date', q.end)
      .gt('amount', 0);

    const grossIncome = (incomeData || []).reduce((sum, t) => sum + Number(t.amount), 0);

    // Get expenses for the year up to end of this quarter
    const { data: expenseData } = await supabase
      .from('transactions')
      .select('amount')
      .eq('organization_id', organizationId)
      .eq('is_excluded', false)
      .eq('is_tax_deductible', true)
      .gte('date', `${taxYear}-01-01`)
      .lte('date', q.end)
      .lt('amount', 0);

    const totalExpenses = Math.abs((expenseData || []).reduce((sum, t) => sum + Number(t.amount), 0));
    const netIncome = grossIncome - totalExpenses;

    // Self-employment tax
    const { selfEmploymentTax, deductibleHalf } = calculateSelfEmploymentTax(netIncome);

    // QBI deduction (simplified - 20% of qualified business income)
    const qbiDeduction = Math.max(0, netIncome * QBI_DEDUCTION_RATE);

    // Standard deduction
    const standardDeduction =
      filingStatus === 'married_filing_jointly' ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE;

    // Taxable income
    const adjustedIncome = netIncome - deductibleHalf;
    const taxableIncome = Math.max(0, adjustedIncome - standardDeduction - qbiDeduction);

    // Federal income tax (annualized)
    const federalIncomeTax = calculateFederalTax(taxableIncome, filingStatus);

    // Simple state tax estimate (flat rate approximation)
    const stateRate = getStateRate(stateCode);
    const stateIncomeTax = Math.round(taxableIncome * stateRate * 100) / 100;

    // Total annual estimated tax
    const totalEstimatedTax = selfEmploymentTax + federalIncomeTax + stateIncomeTax;

    // Quarterly payment = total / 4 (using cumulative method for more accuracy)
    const quarterlyPaymentDue = Math.round((totalEstimatedTax / 4) * 100) / 100;

    await supabase
      .from('tax_estimates')
      .upsert({
        organization_id: organizationId,
        tax_year: taxYear,
        quarter: q.quarter,
        gross_income: Math.round(grossIncome * 100) / 100,
        total_expenses: Math.round(totalExpenses * 100) / 100,
        net_income: Math.round(netIncome * 100) / 100,
        self_employment_tax: selfEmploymentTax,
        federal_income_tax: federalIncomeTax,
        state_income_tax: stateIncomeTax,
        total_estimated_tax: totalEstimatedTax,
        quarterly_payment_due: quarterlyPaymentDue,
        due_date: q.dueDate,
        filing_status: filingStatus,
        state: stateCode || null,
        calculation_details: {
          gross_income: grossIncome,
          total_expenses: totalExpenses,
          net_income: netIncome,
          se_earnings: netIncome * SE_INCOME_FACTOR,
          se_tax: selfEmploymentTax,
          se_deduction: deductibleHalf,
          qbi_deduction: qbiDeduction,
          standard_deduction: standardDeduction,
          taxable_income: taxableIncome,
          federal_tax: federalIncomeTax,
          state_tax: stateIncomeTax,
          state_rate: stateRate,
          filing_status: filingStatus,
          business_type: org?.business_type || 'sole_proprietorship',
          calculation_date: new Date().toISOString(),
        },
      }, {
        onConflict: 'organization_id,tax_year,quarter',
      });
  }
}

function getStateRate(stateCode?: string): number {
  if (!stateCode) return 0;

  const stateRates: Record<string, number> = {
    AL: 0.05, AK: 0, AZ: 0.025, AR: 0.044, CA: 0.093,
    CO: 0.044, CT: 0.0699, DE: 0.066, FL: 0, GA: 0.0549,
    HI: 0.11, ID: 0.058, IL: 0.0495, IN: 0.0315, IA: 0.06,
    KS: 0.057, KY: 0.04, LA: 0.0425, ME: 0.0715, MD: 0.0575,
    MA: 0.05, MI: 0.0425, MN: 0.0985, MS: 0.05, MO: 0.048,
    MT: 0.0675, NE: 0.0664, NV: 0, NH: 0.05, NJ: 0.1075,
    NM: 0.059, NY: 0.109, NC: 0.0475, ND: 0.029, OH: 0.04,
    OK: 0.0475, OR: 0.099, PA: 0.0307, RI: 0.0599, SC: 0.065,
    SD: 0, TN: 0, TX: 0, UT: 0.0485, VT: 0.0875,
    VA: 0.0575, WA: 0, WV: 0.065, WI: 0.0765, WY: 0,
    DC: 0.1075,
  };

  return stateRates[stateCode.toUpperCase()] || 0;
}
