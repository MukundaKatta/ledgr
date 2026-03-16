import { NextResponse } from 'next/server';
import { createSupabaseServiceRole } from '@/lib/supabase/server';
import { PlaidLinkClient } from '@ledgr/banking/plaid-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organization_id, bank_account_id } = body;

    if (!organization_id || !bank_account_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createSupabaseServiceRole();

    // Get bank account
    const { data: account, error: accountError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', bank_account_id)
      .eq('organization_id', organization_id)
      .single();

    if (accountError || !account || !account.plaid_access_token) {
      return NextResponse.json({ error: 'Account not found or not linked' }, { status: 404 });
    }

    const plaid = new PlaidLinkClient({
      clientId: process.env.PLAID_CLIENT_ID!,
      secret: process.env.PLAID_SECRET!,
      env: (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') || 'sandbox',
    });

    const syncResult = await plaid.syncTransactions(
      account.plaid_access_token,
      account.sync_cursor || undefined
    );

    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    // Insert new transactions
    if (syncResult.added.length > 0) {
      const txToInsert = syncResult.added.map((t) => ({
        organization_id,
        bank_account_id,
        plaid_transaction_id: t.transactionId,
        date: t.date,
        amount: -t.amount, // Plaid's sign convention is opposite
        description: t.name,
        original_description: t.originalDescription || t.name,
        merchant_name: t.merchantName,
        pending: t.pending,
        type: (t.amount < 0 ? 'credit' : 'debit') as 'credit' | 'debit',
        categorization_source: 'uncategorized' as const,
        tax_year: new Date(t.date).getFullYear(),
        metadata: {
          plaid_category: t.personalFinanceCategory,
          plaid_payment_channel: t.paymentChannel,
        },
      }));

      const { error } = await supabase
        .from('transactions')
        .upsert(txToInsert, { onConflict: 'plaid_transaction_id' });

      if (!error) addedCount = txToInsert.length;
    }

    // Update modified transactions
    for (const t of syncResult.modified) {
      const { error } = await supabase
        .from('transactions')
        .update({
          date: t.date,
          amount: -t.amount,
          description: t.name,
          merchant_name: t.merchantName,
          pending: t.pending,
        })
        .eq('plaid_transaction_id', t.transactionId)
        .eq('organization_id', organization_id);

      if (!error) modifiedCount++;
    }

    // Remove deleted transactions
    if (syncResult.removed.length > 0) {
      const ids = syncResult.removed.map((t) => t.transaction_id);
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('plaid_transaction_id', ids)
        .eq('organization_id', organization_id);

      if (!error) removedCount = ids.length;
    }

    // Update cursor and balance
    await supabase
      .from('bank_accounts')
      .update({
        sync_cursor: syncResult.nextCursor,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', bank_account_id);

    return NextResponse.json({
      success: true,
      added: addedCount,
      modified: modifiedCount,
      removed: removedCount,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
