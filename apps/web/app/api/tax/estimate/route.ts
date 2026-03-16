import { NextResponse } from 'next/server';
import { createSupabaseServer, createSupabaseServiceRole } from '@/lib/supabase/server';
import { TaxEstimator } from '@ledgr/tax-engine/estimator';
import type { FilingStatus } from '@ledgr/supabase';

export async function POST(request: Request) {
  try {
    const authSupabase = await createSupabaseServer();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organization_id, tax_year, filing_status, state } = body;

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
    const estimator = new TaxEstimator(supabase);

    const result = await estimator.estimate(
      organization_id,
      tax_year || new Date().getFullYear(),
      (filing_status as FilingStatus) || 'single',
      state
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Tax estimate error:', error);
    return NextResponse.json({ error: 'Failed to calculate tax estimate' }, { status: 500 });
  }
}
