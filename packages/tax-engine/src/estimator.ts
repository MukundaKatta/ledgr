import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, FilingStatus } from '@ledgr/supabase';

export interface QuarterlyEstimate {
  quarter: number;
  grossIncome: number;
  totalExpenses: number;
  netIncome: number;
  selfEmploymentTax: number;
  federalIncomeTax: number;
  stateIncomeTax: number;
  totalEstimatedTax: number;
  quarterlyPaymentDue: number;
  dueDate: string;
  isPaid: boolean;
  paidAmount: number;
}

export interface TaxEstimateResult {
  taxYear: number;
  filingStatus: FilingStatus;
  annualGrossIncome: number;
  annualExpenses: number;
  annualNetIncome: number;
  selfEmploymentTax: number;
  federalIncomeTax: number;
  stateIncomeTax: number;
  totalAnnualTax: number;
  effectiveRate: number;
  quarters: QuarterlyEstimate[];
  totalPaid: number;
  totalRemaining: number;
}

// 2025 Federal tax brackets
const BRACKETS: Record<string, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ],
  married_filing_jointly: [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
    { min: 394600, max: 501050, rate: 0.32 },
    { min: 501050, max: 751600, rate: 0.35 },
    { min: 751600, max: Infinity, rate: 0.37 },
  ],
  married_filing_separately: [
    { min: 0, max: 11925, rate: 0.10 },
    { min: 11925, max: 48475, rate: 0.12 },
    { min: 48475, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250525, rate: 0.32 },
    { min: 250525, max: 375800, rate: 0.35 },
    { min: 375800, max: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { min: 0, max: 17000, rate: 0.10 },
    { min: 17000, max: 64850, rate: 0.12 },
    { min: 64850, max: 103350, rate: 0.22 },
    { min: 103350, max: 197300, rate: 0.24 },
    { min: 197300, max: 250500, rate: 0.32 },
    { min: 250500, max: 626350, rate: 0.35 },
    { min: 626350, max: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTIONS: Record<string, number> = {
  single: 15000,
  married_filing_jointly: 30000,
  married_filing_separately: 15000,
  head_of_household: 22500,
};

const SS_WAGE_BASE = 168600;
const SE_INCOME_FACTOR = 0.9235;
const QBI_RATE = 0.20;

// State tax rates (simplified flat rate approximations)
const STATE_RATES: Record<string, number> = {
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

function getQuarterDates(year: number) {
  return [
    { quarter: 1, start: `${year}-01-01`, end: `${year}-03-31`, dueDate: `${year}-04-15` },
    { quarter: 2, start: `${year}-04-01`, end: `${year}-06-30`, dueDate: `${year}-06-15` },
    { quarter: 3, start: `${year}-07-01`, end: `${year}-09-30`, dueDate: `${year}-09-15` },
    { quarter: 4, start: `${year}-10-01`, end: `${year}-12-31`, dueDate: `${year + 1}-01-15` },
  ];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calcFederalTax(taxableIncome: number, filingStatus: string): number {
  if (taxableIncome <= 0) return 0;
  const brackets = BRACKETS[filingStatus] || BRACKETS.single;
  let tax = 0;
  for (const b of brackets) {
    if (taxableIncome <= b.min) break;
    tax += (Math.min(taxableIncome, b.max) - b.min) * b.rate;
  }
  return round2(tax);
}

function calcSETax(netIncome: number): { seTax: number; deductibleHalf: number } {
  if (netIncome <= 0) return { seTax: 0, deductibleHalf: 0 };
  const seEarnings = netIncome * SE_INCOME_FACTOR;
  const ssTax = Math.min(seEarnings, SS_WAGE_BASE) * 0.124;
  const medicareTax = seEarnings * 0.029;
  const additionalMedicare = Math.max(0, seEarnings - 200000) * 0.009;
  const seTax = round2(ssTax + medicareTax + additionalMedicare);
  return { seTax, deductibleHalf: round2(seTax * 0.5) };
}

export class TaxEstimator {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  async estimate(
    organizationId: string,
    taxYear: number,
    filingStatus: FilingStatus = 'single',
    stateCode?: string
  ): Promise<TaxEstimateResult> {
    const quarters = getQuarterDates(taxYear);
    const quarterlyEstimates: QuarterlyEstimate[] = [];

    // Get existing payment status
    const { data: existingEstimates } = await this.supabase
      .from('tax_estimates')
      .select('quarter, is_paid, paid_amount')
      .eq('organization_id', organizationId)
      .eq('tax_year', taxYear);

    const paidMap = new Map(
      (existingEstimates || []).map((e) => [e.quarter, { isPaid: e.is_paid, paidAmount: Number(e.paid_amount) }])
    );

    let annualGrossIncome = 0;
    let annualExpenses = 0;

    for (const q of quarters) {
      // Get income for quarter
      const { data: incomeData } = await this.supabase
        .from('transactions')
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('is_excluded', false)
        .gte('date', q.start)
        .lte('date', q.end)
        .gt('amount', 0);

      const quarterIncome = (incomeData || []).reduce((sum, t) => sum + Number(t.amount), 0);

      // Get expenses for quarter
      const { data: expenseData } = await this.supabase
        .from('transactions')
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('is_excluded', false)
        .eq('is_tax_deductible', true)
        .gte('date', q.start)
        .lte('date', q.end)
        .lt('amount', 0);

      const quarterExpenses = Math.abs((expenseData || []).reduce((sum, t) => sum + Number(t.amount), 0));
      annualGrossIncome += quarterIncome;
      annualExpenses += quarterExpenses;

      const paid = paidMap.get(q.quarter);

      quarterlyEstimates.push({
        quarter: q.quarter,
        grossIncome: round2(quarterIncome),
        totalExpenses: round2(quarterExpenses),
        netIncome: round2(quarterIncome - quarterExpenses),
        selfEmploymentTax: 0,
        federalIncomeTax: 0,
        stateIncomeTax: 0,
        totalEstimatedTax: 0,
        quarterlyPaymentDue: 0,
        dueDate: q.dueDate,
        isPaid: paid?.isPaid ?? false,
        paidAmount: paid?.paidAmount ?? 0,
      });
    }

    // Calculate annual taxes
    const annualNetIncome = annualGrossIncome - annualExpenses;
    const { seTax, deductibleHalf } = calcSETax(annualNetIncome);
    const adjustedIncome = annualNetIncome - deductibleHalf;
    const standardDeduction = STANDARD_DEDUCTIONS[filingStatus] || STANDARD_DEDUCTIONS.single;
    const qbiDeduction = Math.max(0, annualNetIncome * QBI_RATE);
    const taxableIncome = Math.max(0, adjustedIncome - standardDeduction - qbiDeduction);

    const federalTax = calcFederalTax(taxableIncome, filingStatus);
    const stateRate = stateCode ? (STATE_RATES[stateCode.toUpperCase()] || 0) : 0;
    const stateTax = round2(taxableIncome * stateRate);
    const totalAnnualTax = seTax + federalTax + stateTax;
    const quarterlyPayment = round2(totalAnnualTax / 4);

    // Distribute to quarters
    for (const qe of quarterlyEstimates) {
      qe.selfEmploymentTax = round2(seTax / 4);
      qe.federalIncomeTax = round2(federalTax / 4);
      qe.stateIncomeTax = round2(stateTax / 4);
      qe.totalEstimatedTax = round2(totalAnnualTax / 4);
      qe.quarterlyPaymentDue = quarterlyPayment;
    }

    const totalPaid = quarterlyEstimates.reduce((sum, q) => sum + q.paidAmount, 0);

    // Persist estimates
    for (const qe of quarterlyEstimates) {
      await this.supabase
        .from('tax_estimates')
        .upsert({
          organization_id: organizationId,
          tax_year: taxYear,
          quarter: qe.quarter,
          gross_income: qe.grossIncome,
          total_expenses: qe.totalExpenses,
          net_income: qe.netIncome,
          self_employment_tax: qe.selfEmploymentTax,
          federal_income_tax: qe.federalIncomeTax,
          state_income_tax: qe.stateIncomeTax,
          total_estimated_tax: qe.totalEstimatedTax,
          quarterly_payment_due: qe.quarterlyPaymentDue,
          due_date: qe.dueDate,
          filing_status: filingStatus,
          state: stateCode || null,
          calculation_details: {
            annual_gross: annualGrossIncome,
            annual_expenses: annualExpenses,
            annual_net: annualNetIncome,
            se_tax: seTax,
            se_deduction: deductibleHalf,
            qbi_deduction: qbiDeduction,
            standard_deduction: standardDeduction,
            taxable_income: taxableIncome,
            federal_tax: federalTax,
            state_tax: stateTax,
            state_rate: stateRate,
          },
        }, { onConflict: 'organization_id,tax_year,quarter' });
    }

    return {
      taxYear,
      filingStatus,
      annualGrossIncome: round2(annualGrossIncome),
      annualExpenses: round2(annualExpenses),
      annualNetIncome: round2(annualNetIncome),
      selfEmploymentTax: seTax,
      federalIncomeTax: federalTax,
      stateIncomeTax: stateTax,
      totalAnnualTax: round2(totalAnnualTax),
      effectiveRate: annualNetIncome > 0 ? round2((totalAnnualTax / annualNetIncome) * 100) : 0,
      quarters: quarterlyEstimates,
      totalPaid: round2(totalPaid),
      totalRemaining: round2(totalAnnualTax - totalPaid),
    };
  }
}
