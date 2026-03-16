import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ledgr/supabase';

export interface ScheduleCLineItem {
  line: string;
  label: string;
  amount: number;
  transactionCount: number;
}

export interface ScheduleCData {
  taxYear: number;
  grossReceipts: number;           // Line 1
  returns: number;                  // Line 2
  costOfGoodsSold: number;          // Line 4
  grossIncome: number;              // Line 5
  otherIncome: number;              // Line 6
  grossProfit: number;              // Line 7
  expenses: ScheduleCLineItem[];    // Lines 8-27
  totalExpenses: number;            // Line 28
  tentativeProfit: number;          // Line 29
  homeOfficeDeduction: number;      // Line 30
  netProfit: number;                // Line 31
}

export const SCHEDULE_C_LINES: Record<string, { line: string; label: string }> = {
  schedule_c_line_1: { line: '1', label: 'Gross receipts or sales' },
  schedule_c_line_2: { line: '2', label: 'Returns and allowances' },
  schedule_c_line_4: { line: '4', label: 'Cost of goods sold' },
  schedule_c_line_6: { line: '6', label: 'Other income' },
  schedule_c_line_8: { line: '8', label: 'Advertising' },
  schedule_c_line_9: { line: '9', label: 'Car and truck expenses' },
  schedule_c_line_10: { line: '10', label: 'Commissions and fees' },
  schedule_c_line_11: { line: '11', label: 'Contract labor' },
  schedule_c_line_12: { line: '12', label: 'Depletion' },
  schedule_c_line_13: { line: '13', label: 'Depreciation and section 179' },
  schedule_c_line_14: { line: '14', label: 'Employee benefit programs' },
  schedule_c_line_15: { line: '15', label: 'Insurance (other than health)' },
  schedule_c_line_16a: { line: '16a', label: 'Interest on business mortgage' },
  schedule_c_line_16b: { line: '16b', label: 'Interest (other)' },
  schedule_c_line_17: { line: '17', label: 'Legal and professional services' },
  schedule_c_line_18: { line: '18', label: 'Office expense' },
  schedule_c_line_19: { line: '19', label: 'Pension and profit-sharing plans' },
  schedule_c_line_20a: { line: '20a', label: 'Rent - vehicles, machinery, equipment' },
  schedule_c_line_20b: { line: '20b', label: 'Rent - other business property' },
  schedule_c_line_21: { line: '21', label: 'Repairs and maintenance' },
  schedule_c_line_22: { line: '22', label: 'Supplies' },
  schedule_c_line_23: { line: '23', label: 'Taxes and licenses' },
  schedule_c_line_24a: { line: '24a', label: 'Travel' },
  schedule_c_line_24b: { line: '24b', label: 'Deductible meals' },
  schedule_c_line_25: { line: '25', label: 'Utilities' },
  schedule_c_line_26: { line: '26', label: 'Wages' },
  schedule_c_line_27a: { line: '27a', label: 'Other expenses' },
  schedule_c_line_30: { line: '30', label: 'Business use of home' },
};

export class ScheduleCCalculator {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  async calculate(organizationId: string, taxYear: number): Promise<ScheduleCData> {
    // Get all transactions with their categories for the tax year
    const { data: transactions } = await this.supabase
      .from('transactions')
      .select(`
        id, amount, category_id, is_tax_deductible,
        categories:category_id (id, name, type, tax_schedule_line, is_tax_deductible)
      `)
      .eq('organization_id', organizationId)
      .eq('is_excluded', false)
      .gte('date', `${taxYear}-01-01`)
      .lte('date', `${taxYear}-12-31`);

    if (!transactions) {
      return this.emptyScheduleC(taxYear);
    }

    // Calculate gross receipts (Line 1) - all income
    let grossReceipts = 0;
    let otherIncome = 0;

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      const cat = tx.categories as unknown as { type: string; tax_schedule_line: string | null } | null;

      if (amount > 0 && cat?.type === 'income') {
        if (cat.tax_schedule_line === 'schedule_c_line_6') {
          otherIncome += amount;
        } else {
          grossReceipts += amount;
        }
      }
    }

    // Calculate expenses grouped by Schedule C line
    const expensesByLine = new Map<string, { amount: number; count: number }>();

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      const cat = tx.categories as unknown as {
        type: string;
        tax_schedule_line: string | null;
        is_tax_deductible: boolean;
      } | null;

      if (amount < 0 && cat?.is_tax_deductible && cat.tax_schedule_line) {
        const line = cat.tax_schedule_line;
        const existing = expensesByLine.get(line) || { amount: 0, count: 0 };
        existing.amount += Math.abs(amount);
        existing.count += 1;
        expensesByLine.set(line, existing);
      }
    }

    // Build expense line items
    const expenses: ScheduleCLineItem[] = [];
    let totalExpenses = 0;
    let homeOfficeDeduction = 0;

    for (const [lineKey, data] of expensesByLine) {
      const lineInfo = SCHEDULE_C_LINES[lineKey];
      if (!lineInfo) continue;

      const amount = Math.round(data.amount * 100) / 100;

      if (lineKey === 'schedule_c_line_30') {
        homeOfficeDeduction = amount;
        continue;
      }

      // Meals are 50% deductible
      const deductibleAmount = lineKey === 'schedule_c_line_24b'
        ? Math.round(amount * 0.5 * 100) / 100
        : amount;

      expenses.push({
        line: lineInfo.line,
        label: lineInfo.label,
        amount: deductibleAmount,
        transactionCount: data.count,
      });

      totalExpenses += deductibleAmount;
    }

    expenses.sort((a, b) => {
      const lineA = parseFloat(a.line) || 99;
      const lineB = parseFloat(b.line) || 99;
      return lineA - lineB;
    });

    const grossIncome = grossReceipts + otherIncome;
    const tentativeProfit = grossIncome - totalExpenses;
    const netProfit = tentativeProfit - homeOfficeDeduction;

    return {
      taxYear,
      grossReceipts: Math.round(grossReceipts * 100) / 100,
      returns: 0,
      costOfGoodsSold: 0,
      grossIncome: Math.round(grossIncome * 100) / 100,
      otherIncome: Math.round(otherIncome * 100) / 100,
      grossProfit: Math.round(grossReceipts * 100) / 100,
      expenses,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      tentativeProfit: Math.round(tentativeProfit * 100) / 100,
      homeOfficeDeduction: Math.round(homeOfficeDeduction * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
    };
  }

  private emptyScheduleC(taxYear: number): ScheduleCData {
    return {
      taxYear,
      grossReceipts: 0,
      returns: 0,
      costOfGoodsSold: 0,
      grossIncome: 0,
      otherIncome: 0,
      grossProfit: 0,
      expenses: [],
      totalExpenses: 0,
      tentativeProfit: 0,
      homeOfficeDeduction: 0,
      netProfit: 0,
    };
  }
}
