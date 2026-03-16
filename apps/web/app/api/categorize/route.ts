import { NextResponse } from 'next/server';
import { createSupabaseServer, createSupabaseServiceRole } from '@/lib/supabase/server';
import { TransactionCategorizer } from '@ledgr/banking/categorizer';

export async function POST(request: Request) {
  try {
    const authSupabase = await createSupabaseServer();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organization_id } = body;

    // Verify membership
    const { data: membership } = await authSupabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createSupabaseServiceRole();
    const categorizer = new TransactionCategorizer(supabase, process.env.ANTHROPIC_API_KEY!);

    // Get uncategorized transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, description, original_description, merchant_name, amount, type, date')
      .eq('organization_id', organization_id)
      .eq('categorization_source', 'uncategorized')
      .eq('is_excluded', false)
      .order('date', { ascending: false })
      .limit(100);

    if (!transactions?.length) {
      return NextResponse.json({ categorized: 0, message: 'No uncategorized transactions' });
    }

    const results = await categorizer.categorizeBatch(transactions, organization_id);

    // Apply categorizations
    let applied = 0;
    for (const result of results) {
      const { error } = await supabase
        .from('transactions')
        .update({
          category_id: result.categoryId,
          categorization_source: result.source,
          categorization_confidence: result.confidence,
          is_tax_deductible: result.isTaxDeductible,
        })
        .eq('id', result.transactionId)
        .eq('organization_id', organization_id);

      if (!error) applied++;
    }

    return NextResponse.json({ categorized: applied, total: results.length });
  } catch (error) {
    console.error('Categorization error:', error);
    return NextResponse.json({ error: 'Categorization failed' }, { status: 500 });
  }
}
