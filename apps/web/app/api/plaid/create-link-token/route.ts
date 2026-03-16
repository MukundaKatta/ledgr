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

    const plaid = new PlaidLinkClient({
      clientId: process.env.PLAID_CLIENT_ID!,
      secret: process.env.PLAID_SECRET!,
      env: (process.env.PLAID_ENV as 'sandbox' | 'development' | 'production') || 'sandbox',
    });

    const linkToken = await plaid.createLinkToken(
      user.id,
      process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/oauth` : undefined
    );

    return NextResponse.json({ link_token: linkToken });
  } catch (error) {
    console.error('Create link token error:', error);
    return NextResponse.json(
      { error: 'Failed to create link token' },
      { status: 500 }
    );
  }
}
