import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '@ledgr/supabase';

export interface CategorizationResult {
  transactionId: string;
  categoryId: string;
  confidence: number;
  isTaxDeductible: boolean;
  source: 'rule' | 'ai';
}

interface CategoryInfo {
  id: string;
  name: string;
  type: string;
  is_tax_deductible: boolean;
  tax_schedule_line: string | null;
}

interface RuleInfo {
  id: string;
  category_id: string;
  match_field: string;
  match_type: string;
  match_value: string;
  priority: number;
}

export class TransactionCategorizer {
  private supabase: SupabaseClient<Database>;
  private anthropicApiKey: string;

  constructor(supabase: SupabaseClient<Database>, anthropicApiKey: string) {
    this.supabase = supabase;
    this.anthropicApiKey = anthropicApiKey;
  }

  async categorizeTransaction(
    transaction: Tables<'transactions'>,
    organizationId: string
  ): Promise<CategorizationResult | null> {
    const results = await this.categorizeBatch([transaction], organizationId);
    return results[0] || null;
  }

  async categorizeBatch(
    transactions: Array<Pick<Tables<'transactions'>, 'id' | 'description' | 'original_description' | 'merchant_name' | 'amount' | 'type' | 'date'>>,
    organizationId: string
  ): Promise<CategorizationResult[]> {
    if (transactions.length === 0) return [];

    const [categories, rules] = await Promise.all([
      this.fetchCategories(organizationId),
      this.fetchRules(organizationId),
    ]);

    if (categories.length === 0) return [];

    const results: CategorizationResult[] = [];
    const needsAI: typeof transactions = [];

    // Phase 1: Apply user-defined rules
    for (const tx of transactions) {
      const ruleMatch = this.applyRules(tx, rules, categories);
      if (ruleMatch) {
        results.push(ruleMatch);
      } else {
        needsAI.push(tx);
      }
    }

    // Phase 2: AI categorization for remaining
    if (needsAI.length > 0) {
      const aiResults = await this.aiCategorize(needsAI, categories);
      results.push(...aiResults);
    }

    return results;
  }

  private async fetchCategories(organizationId: string): Promise<CategoryInfo[]> {
    const { data } = await this.supabase
      .from('categories')
      .select('id, name, type, is_tax_deductible, tax_schedule_line')
      .eq('organization_id', organizationId)
      .order('sort_order');

    return data || [];
  }

  private async fetchRules(organizationId: string): Promise<RuleInfo[]> {
    const { data } = await this.supabase
      .from('categorization_rules')
      .select('id, category_id, match_field, match_type, match_value, priority')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    return data || [];
  }

  private applyRules(
    tx: Pick<Tables<'transactions'>, 'id' | 'description' | 'merchant_name' | 'amount'>,
    rules: RuleInfo[],
    categories: CategoryInfo[]
  ): CategorizationResult | null {
    for (const rule of rules) {
      const fieldValue =
        rule.match_field === 'merchant_name'
          ? tx.merchant_name
          : rule.match_field === 'amount'
            ? String(tx.amount)
            : tx.description;

      if (!fieldValue) continue;

      const normalizedValue = fieldValue.toLowerCase();
      const normalizedMatch = rule.match_value.toLowerCase();
      let matches = false;

      switch (rule.match_type) {
        case 'contains':
          matches = normalizedValue.includes(normalizedMatch);
          break;
        case 'starts_with':
          matches = normalizedValue.startsWith(normalizedMatch);
          break;
        case 'ends_with':
          matches = normalizedValue.endsWith(normalizedMatch);
          break;
        case 'exact':
          matches = normalizedValue === normalizedMatch;
          break;
        case 'regex':
          try {
            matches = new RegExp(rule.match_value, 'i').test(fieldValue);
          } catch {
            matches = false;
          }
          break;
      }

      if (matches) {
        const category = categories.find((c) => c.id === rule.category_id);
        return {
          transactionId: tx.id,
          categoryId: rule.category_id,
          confidence: 1.0,
          isTaxDeductible: category?.is_tax_deductible ?? false,
          source: 'rule',
        };
      }
    }

    return null;
  }

  private async aiCategorize(
    transactions: Array<Pick<Tables<'transactions'>, 'id' | 'description' | 'original_description' | 'merchant_name' | 'amount' | 'type' | 'date'>>,
    categories: CategoryInfo[]
  ): Promise<CategorizationResult[]> {
    const categoryList = categories
      .map((c) => `- ID: ${c.id} | Name: ${c.name} | Type: ${c.type} | Tax Deductible: ${c.is_tax_deductible}`)
      .join('\n');

    const txList = transactions
      .map((t) => ({
        id: t.id,
        description: t.description,
        original: t.original_description,
        merchant: t.merchant_name,
        amount: t.amount,
        type: t.type,
        date: t.date,
      }));

    const prompt = `You are a bookkeeper AI. Categorize these business transactions into the most appropriate category.

CATEGORIES:
${categoryList}

TRANSACTIONS:
${JSON.stringify(txList, null, 2)}

Rules:
1. Negative amounts are expenses, positive amounts are income
2. Match based on merchant name, description patterns, and amount context
3. Be conservative with tax deductibility - only if clearly business-related
4. Common mappings: cloud services -> Software & Subscriptions, rideshare -> Travel, food/dining -> Meals (50%), office supplies -> Office Expenses

Return a JSON array with objects containing:
- transaction_id (string)
- category_id (string - must be from the provided list)
- confidence (number 0.0-1.0)
- is_tax_deductible (boolean)

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
        console.error('AI categorization failed:', response.statusText);
        return this.fallbackCategorize(transactions, categories);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text: string }>;
      };

      const text = data.content[0]?.text || '[]';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch?.[0] || '[]') as Array<{
        transaction_id: string;
        category_id: string;
        confidence: number;
        is_tax_deductible: boolean;
      }>;

      return parsed.map((r) => ({
        transactionId: r.transaction_id,
        categoryId: r.category_id,
        confidence: Math.min(Math.max(r.confidence, 0), 1),
        isTaxDeductible: r.is_tax_deductible,
        source: 'ai' as const,
      }));
    } catch (error) {
      console.error('AI categorization error:', error);
      return this.fallbackCategorize(transactions, categories);
    }
  }

  private fallbackCategorize(
    transactions: Array<Pick<Tables<'transactions'>, 'id' | 'amount'>>,
    categories: CategoryInfo[]
  ): CategorizationResult[] {
    const uncategorizedExpense = categories.find(
      (c) => c.name === 'Uncategorized Expense' && c.type === 'expense'
    );
    const otherIncome = categories.find(
      (c) => c.name === 'Other Income' && c.type === 'income'
    );

    return transactions.map((tx) => ({
      transactionId: tx.id,
      categoryId:
        tx.amount < 0
          ? uncategorizedExpense?.id || categories[0]?.id || ''
          : otherIncome?.id || categories[0]?.id || '',
      confidence: 0.1,
      isTaxDeductible: false,
      source: 'ai' as const,
    }));
  }
}
