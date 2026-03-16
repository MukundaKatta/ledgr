import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ledgr/supabase';

export interface SuggestedDeduction {
  category: string;
  description: string;
  amount: number;
  scheduleLine: string | null;
  transactionIds: string[];
  evidenceNotes: string;
  confidence: number;
}

export class DeductionFinder {
  private supabase: SupabaseClient<Database>;
  private anthropicApiKey: string;

  constructor(supabase: SupabaseClient<Database>, anthropicApiKey: string) {
    this.supabase = supabase;
    this.anthropicApiKey = anthropicApiKey;
  }

  /**
   * Analyze transactions for the given tax year and suggest deductions
   * the user might be missing.
   */
  async findDeductions(organizationId: string, taxYear: number): Promise<SuggestedDeduction[]> {
    // Get all expense transactions for the year
    const { data: transactions } = await this.supabase
      .from('transactions')
      .select(`
        id, date, amount, description, merchant_name, category_id,
        is_tax_deductible, categorization_source
      `)
      .eq('organization_id', organizationId)
      .eq('is_excluded', false)
      .gte('date', `${taxYear}-01-01`)
      .lte('date', `${taxYear}-12-31`)
      .lt('amount', 0)
      .order('amount');

    if (!transactions?.length) return [];

    // Get categories
    const { data: categories } = await this.supabase
      .from('categories')
      .select('id, name, type, is_tax_deductible, tax_schedule_line')
      .eq('organization_id', organizationId);

    const categoryMap = new Map((categories || []).map((c) => [c.id, c]));

    // Get existing deductions to avoid duplicates
    const { data: existingDeductions } = await this.supabase
      .from('tax_deductions')
      .select('transaction_ids')
      .eq('organization_id', organizationId)
      .eq('tax_year', taxYear)
      .in('status', ['confirmed', 'suggested']);

    const existingTxIds = new Set(
      (existingDeductions || []).flatMap((d) => d.transaction_ids || [])
    );

    // Identify uncategorized or non-deductible transactions that might be deductible
    const potentiallyMissed = transactions.filter((tx) => {
      if (existingTxIds.has(tx.id)) return false;
      if (tx.is_tax_deductible) return false; // Already marked
      return true;
    });

    if (potentiallyMissed.length === 0) {
      // Still aggregate already-deductible transactions into deduction summaries
      return this.aggregateConfirmedDeductions(transactions, categoryMap);
    }

    // Use AI to find potential deductions among non-deductible transactions
    const aiSuggestions = await this.aiAnalyzeDeductions(potentiallyMissed, categories || []);
    const aggregated = this.aggregateConfirmedDeductions(transactions, categoryMap);

    return [...aggregated, ...aiSuggestions];
  }

  private aggregateConfirmedDeductions(
    transactions: Array<{ id: string; amount: number; category_id: string | null; is_tax_deductible: boolean }>,
    categoryMap: Map<string, { name: string; tax_schedule_line: string | null }>
  ): SuggestedDeduction[] {
    const deductible = transactions.filter((tx) => tx.is_tax_deductible && tx.category_id);

    // Group by category
    const grouped = new Map<string, { amount: number; txIds: string[]; scheduleLine: string | null; categoryName: string }>();

    for (const tx of deductible) {
      const cat = categoryMap.get(tx.category_id!);
      if (!cat) continue;
      const key = tx.category_id!;
      const existing = grouped.get(key) || {
        amount: 0,
        txIds: [],
        scheduleLine: cat.tax_schedule_line,
        categoryName: cat.name,
      };
      existing.amount += Math.abs(Number(tx.amount));
      existing.txIds.push(tx.id);
      grouped.set(key, existing);
    }

    return Array.from(grouped.entries()).map(([_, data]) => ({
      category: data.categoryName,
      description: `${data.categoryName}: ${data.txIds.length} transactions totaling $${data.amount.toFixed(2)}`,
      amount: Math.round(data.amount * 100) / 100,
      scheduleLine: data.scheduleLine,
      transactionIds: data.txIds,
      evidenceNotes: `Automatically aggregated from ${data.txIds.length} categorized transactions`,
      confidence: 1.0,
    }));
  }

  private async aiAnalyzeDeductions(
    transactions: Array<{ id: string; description: string; merchant_name: string | null; amount: number; date: string }>,
    categories: Array<{ id: string; name: string; is_tax_deductible: boolean; tax_schedule_line: string | null }>
  ): Promise<SuggestedDeduction[]> {
    // Sample up to 200 transactions for AI analysis
    const sample = transactions.slice(0, 200);

    const prompt = `You are a tax advisor AI for a small business / sole proprietor. Analyze these business transactions and identify potential tax deductions that might be missed.

TRANSACTIONS (id|description|merchant|amount|date):
${sample.map((t) => `${t.id}|${t.description}|${t.merchant_name || 'N/A'}|${t.amount}|${t.date}`).join('\n')}

AVAILABLE DEDUCTION CATEGORIES:
${categories.filter((c) => c.is_tax_deductible).map((c) => `- ${c.name} (Schedule C: ${c.tax_schedule_line || 'Other'})`).join('\n')}

Look for:
1. Home office expenses (internet, phone, utilities with business use)
2. Vehicle/mileage deductions (gas, parking, tolls)
3. Professional development (courses, books, conferences)
4. Software/SaaS subscriptions used for business
5. Professional services (accounting, legal)
6. Business insurance
7. Marketing and advertising expenses
8. Travel expenses for business purposes
9. Meals with clients or during business travel (50% deductible)

Return a JSON array of suggested deductions:
[{
  "category": "string - deduction category name",
  "description": "string - explanation of why this is deductible",
  "transaction_ids": ["string array of relevant transaction IDs"],
  "total_amount": number (positive, sum of absolute values),
  "schedule_line": "string or null",
  "confidence": number 0.0-1.0,
  "evidence": "string - brief evidence/reasoning"
}]

Only suggest deductions with reasonable confidence (>0.5). Be conservative.
Return ONLY the JSON array.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        console.error('AI deduction analysis failed:', response.statusText);
        return [];
      }

      const data = await response.json() as {
        content: Array<{ type: string; text: string }>;
      };

      const text = data.content[0]?.text || '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch?.[0] || '[]') as Array<{
        category: string;
        description: string;
        transaction_ids: string[];
        total_amount: number;
        schedule_line: string | null;
        confidence: number;
        evidence: string;
      }>;

      return parsed
        .filter((d) => d.confidence >= 0.5)
        .map((d) => ({
          category: d.category,
          description: d.description,
          amount: Math.round(d.total_amount * 100) / 100,
          scheduleLine: d.schedule_line,
          transactionIds: d.transaction_ids,
          evidenceNotes: d.evidence,
          confidence: d.confidence,
        }));
    } catch (error) {
      console.error('AI deduction finder error:', error);
      return [];
    }
  }

  /**
   * Save AI-suggested deductions to the database for user review.
   */
  async saveSuggestions(
    organizationId: string,
    taxYear: number,
    suggestions: SuggestedDeduction[]
  ): Promise<void> {
    for (const suggestion of suggestions) {
      await this.supabase.from('tax_deductions').upsert({
        organization_id: organizationId,
        tax_year: taxYear,
        category: suggestion.category,
        description: suggestion.description,
        amount: suggestion.amount,
        schedule_line: suggestion.scheduleLine,
        source: suggestion.confidence >= 1.0 ? 'auto_detected' : 'ai_suggested',
        status: suggestion.confidence >= 0.9 ? 'confirmed' : 'suggested',
        transaction_ids: suggestion.transactionIds,
        evidence_notes: suggestion.evidenceNotes,
      });
    }
  }
}
