import { createServiceClient } from '../../src/client';
import type { Tables } from '../../src/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY!;

interface CategorizationResult {
  transaction_id: string;
  category_id: string;
  confidence: number;
  is_tax_deductible: boolean;
}

export async function categorizeBatch(organizationId: string): Promise<CategorizationResult[]> {
  const supabase = createServiceClient(supabaseUrl, supabaseServiceKey);

  // 1. Fetch uncategorized transactions
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, description, original_description, merchant_name, amount, type, date')
    .eq('organization_id', organizationId)
    .eq('categorization_source', 'uncategorized')
    .eq('is_excluded', false)
    .order('date', { ascending: false })
    .limit(100);

  if (txError || !transactions?.length) {
    return [];
  }

  // 2. Fetch available categories
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, type, is_tax_deductible, tax_schedule_line')
    .eq('organization_id', organizationId)
    .order('sort_order');

  if (!categories?.length) {
    return [];
  }

  // 3. Fetch user-defined categorization rules and apply them first
  const { data: rules } = await supabase
    .from('categorization_rules')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  const ruleMatched: CategorizationResult[] = [];
  const needsAI: typeof transactions = [];

  for (const tx of transactions) {
    const matchedRule = rules?.find((rule) => {
      const field = rule.match_field === 'merchant_name' ? tx.merchant_name : tx.description;
      if (!field) return false;
      const value = field.toLowerCase();
      const matchVal = rule.match_value.toLowerCase();

      switch (rule.match_type) {
        case 'contains': return value.includes(matchVal);
        case 'starts_with': return value.startsWith(matchVal);
        case 'ends_with': return value.endsWith(matchVal);
        case 'exact': return value === matchVal;
        case 'regex': return new RegExp(rule.match_value, 'i').test(field);
        default: return false;
      }
    });

    if (matchedRule) {
      const category = categories.find((c) => c.id === matchedRule.category_id);
      ruleMatched.push({
        transaction_id: tx.id,
        category_id: matchedRule.category_id,
        confidence: 1.0,
        is_tax_deductible: category?.is_tax_deductible ?? false,
      });
    } else {
      needsAI.push(tx);
    }
  }

  // 4. Apply rule-matched categorizations
  for (const result of ruleMatched) {
    await supabase
      .from('transactions')
      .update({
        category_id: result.category_id,
        categorization_source: 'rule',
        categorization_confidence: result.confidence,
        is_tax_deductible: result.is_tax_deductible,
      })
      .eq('id', result.transaction_id);
  }

  // 5. Use Claude for remaining uncategorized transactions
  if (needsAI.length === 0) {
    return ruleMatched;
  }

  const categoryList = categories.map((c) => `${c.id}|${c.name}|${c.type}|${c.is_tax_deductible}`).join('\n');

  const transactionList = needsAI.map((t) =>
    `${t.id}|${t.description}|${t.merchant_name || 'N/A'}|${t.amount}|${t.type}|${t.date}`
  ).join('\n');

  const prompt = `You are a financial transaction categorizer for a small business. Categorize each transaction into the most appropriate category.

Available categories (id|name|type|is_tax_deductible):
${categoryList}

Transactions to categorize (id|description|merchant|amount|type|date):
${transactionList}

For each transaction, respond with a JSON array of objects with these fields:
- transaction_id: the transaction ID
- category_id: the best matching category ID
- confidence: your confidence level from 0.0 to 1.0
- is_tax_deductible: whether this appears to be a legitimate business tax deduction (boolean)

Consider:
- Negative amounts are expenses, positive are income
- Match merchant names and descriptions to appropriate business expense categories
- Common patterns: AWS/Google Cloud -> Software & Subscriptions, Uber/Lyft -> Travel, restaurants -> Meals
- Be conservative with tax deductibility - only mark as deductible if clearly business-related

Respond ONLY with the JSON array, no explanation.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    console.error('Claude API error:', await response.text());
    return ruleMatched;
  }

  const aiResponse = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const responseText = aiResponse.content[0]?.text || '[]';
  let aiResults: CategorizationResult[];

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    aiResults = JSON.parse(jsonMatch?.[0] || '[]');
  } catch {
    console.error('Failed to parse AI response:', responseText);
    return ruleMatched;
  }

  // 6. Apply AI categorizations
  for (const result of aiResults) {
    const category = categories.find((c) => c.id === result.category_id);
    if (!category) continue;

    await supabase
      .from('transactions')
      .update({
        category_id: result.category_id,
        categorization_source: 'ai',
        categorization_confidence: Math.min(Math.max(result.confidence, 0), 1),
        is_tax_deductible: result.is_tax_deductible && category.is_tax_deductible,
      })
      .eq('id', result.transaction_id)
      .eq('organization_id', organizationId);
  }

  return [...ruleMatched, ...aiResults];
}
