import { createServiceClient } from '../../src/client';
import type { Database } from '../../src/types';
import { PlaidClient } from '../../src/plaid-sync';

interface SyncRequest {
  organization_id: string;
  bank_account_id: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const plaidClientId = process.env.PLAID_CLIENT_ID!;
const plaidSecret = process.env.PLAID_SECRET!;
const plaidEnv = (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') || 'sandbox';

export async function syncTransactions(req: SyncRequest): Promise<{ added: number; modified: number; removed: number }> {
  const supabase = createServiceClient(supabaseUrl, supabaseServiceKey);

  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('id', req.bank_account_id)
    .eq('organization_id', req.organization_id)
    .single();

  if (accountError || !account) {
    throw new Error(`Bank account not found: ${accountError?.message}`);
  }

  if (!account.plaid_access_token) {
    throw new Error('No Plaid access token for this account');
  }

  const plaid = new PlaidClient(plaidClientId, plaidSecret, plaidEnv);

  const syncResult = await plaid.transactionsSync(
    account.plaid_access_token,
    account.sync_cursor || undefined
  );

  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;

  // Process added transactions
  if (syncResult.added.length > 0) {
    const transactionsToInsert = syncResult.added.map((t) => ({
      organization_id: req.organization_id,
      bank_account_id: req.bank_account_id,
      plaid_transaction_id: t.transaction_id,
      date: t.date,
      amount: -t.amount, // Plaid uses opposite sign convention
      description: t.name,
      original_description: t.original_description || t.name,
      merchant_name: t.merchant_name || null,
      pending: t.pending,
      type: (t.amount < 0 ? 'credit' : 'debit') as 'credit' | 'debit',
      categorization_source: 'uncategorized' as const,
      tax_year: new Date(t.date).getFullYear(),
      metadata: {
        plaid_category: t.personal_finance_category,
        plaid_payment_channel: t.payment_channel,
        plaid_location: t.location,
      },
    }));

    const { error: insertError } = await supabase
      .from('transactions')
      .upsert(transactionsToInsert, { onConflict: 'plaid_transaction_id' });

    if (insertError) {
      console.error('Error inserting transactions:', insertError);
    } else {
      addedCount = transactionsToInsert.length;
    }
  }

  // Process modified transactions
  for (const t of syncResult.modified) {
    const { error } = await supabase
      .from('transactions')
      .update({
        date: t.date,
        amount: -t.amount,
        description: t.name,
        merchant_name: t.merchant_name || null,
        pending: t.pending,
      })
      .eq('plaid_transaction_id', t.transaction_id)
      .eq('organization_id', req.organization_id);

    if (!error) modifiedCount++;
  }

  // Process removed transactions
  if (syncResult.removed.length > 0) {
    const removedIds = syncResult.removed.map((t) => t.transaction_id);
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('plaid_transaction_id', removedIds)
      .eq('organization_id', req.organization_id);

    if (!error) removedCount = removedIds.length;
  }

  // Update sync cursor and balance
  await supabase
    .from('bank_accounts')
    .update({
      sync_cursor: syncResult.next_cursor,
      last_synced_at: new Date().toISOString(),
      current_balance: syncResult.accounts?.[0]?.balances?.current ?? account.current_balance,
      available_balance: syncResult.accounts?.[0]?.balances?.available ?? account.available_balance,
    })
    .eq('id', req.bank_account_id);

  return { added: addedCount, modified: modifiedCount, removed: removedCount };
}
