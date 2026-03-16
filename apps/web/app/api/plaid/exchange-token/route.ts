import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { PlaidLinkClient } from '@ledgr/banking/plaid-client';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { public_token, organization_id, institution, accounts } = body;

    if (!public_token || !organization_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user has access to organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const plaid = new PlaidLinkClient({
      clientId: process.env.PLAID_CLIENT_ID!,
      secret: process.env.PLAID_SECRET!,
      env: (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') || 'sandbox',
    });

    // Exchange public token
    const { accessToken, itemId } = await plaid.exchangePublicToken(public_token);

    // Get account details
    const plaidAccounts = await plaid.getAccounts(accessToken);

    // Save accounts to database
    const accountsToInsert = plaidAccounts
      .filter((pa) => {
        if (accounts && accounts.length > 0) {
          return accounts.some((a: any) => a.id === pa.accountId);
        }
        return true;
      })
      .map((pa) => ({
        organization_id,
        plaid_item_id: itemId,
        plaid_access_token: accessToken,
        plaid_account_id: pa.accountId,
        plaid_institution_id: institution?.institution_id || null,
        institution_name: institution?.name || 'Unknown Institution',
        account_name: pa.officialName || pa.name,
        account_type: mapAccountType(pa.type),
        account_subtype: pa.subtype,
        mask: pa.mask,
        current_balance: pa.balances.current || 0,
        available_balance: pa.balances.available,
        credit_limit: pa.balances.limit,
        is_active: true,
      }));

    const { error: insertError } = await supabase
      .from('bank_accounts')
      .insert(accountsToInsert);

    if (insertError) {
      console.error('Failed to save accounts:', insertError);
      return NextResponse.json({ error: 'Failed to save accounts' }, { status: 500 });
    }

    // Trigger initial transaction sync
    try {
      const { data: savedAccounts } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('plaid_item_id', itemId)
        .eq('organization_id', organization_id);

      for (const account of savedAccounts || []) {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id,
            bank_account_id: account.id,
          }),
        });
      }
    } catch (syncError) {
      console.warn('Initial sync failed (will retry later):', syncError);
    }

    return NextResponse.json({ success: true, accounts_linked: accountsToInsert.length });
  } catch (error) {
    console.error('Exchange token error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}

function mapAccountType(plaidType: string): string {
  const mapping: Record<string, string> = {
    depository: 'checking',
    credit: 'credit',
    loan: 'loan',
    investment: 'investment',
  };
  return mapping[plaidType] || 'other';
}
