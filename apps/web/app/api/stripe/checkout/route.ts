import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServer } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organization_id, price_id } = body;

    // Verify membership
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organization_id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get or create Stripe customer
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name, email')
      .eq('id', organization_id)
      .single();

    let customerId = org?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org?.email || user.email || undefined,
        name: org?.name || undefined,
        metadata: { organization_id, user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organization_id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?billing=canceled`,
      subscription_data: {
        trial_period_days: 14,
        metadata: { organization_id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
