import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServiceRole } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createSupabaseServiceRole();

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const plan = mapPriceToplan(subscription.items.data[0]?.price?.id || '');
      const status = mapSubscriptionStatus(subscription.status);

      await supabase
        .from('organizations')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: status,
          subscription_plan: plan,
        })
        .eq('stripe_customer_id', customerId);

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await supabase
        .from('organizations')
        .update({
          subscription_status: 'canceled',
        })
        .eq('stripe_customer_id', customerId);

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      await supabase
        .from('organizations')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', customerId);

      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      await supabase
        .from('organizations')
        .update({ subscription_status: 'active' })
        .eq('stripe_customer_id', customerId);

      break;
    }
  }

  return NextResponse.json({ received: true });
}

function mapPriceToplan(priceId: string): 'starter' | 'professional' | 'business' {
  // Map Stripe price IDs to plan names
  const planMap: Record<string, 'starter' | 'professional' | 'business'> = {
    [process.env.STRIPE_STARTER_PRICE_ID || '']: 'starter',
    [process.env.STRIPE_PROFESSIONAL_PRICE_ID || '']: 'professional',
    [process.env.STRIPE_BUSINESS_PRICE_ID || '']: 'business',
  };
  return planMap[priceId] || 'starter';
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    unpaid: 'past_due',
    paused: 'past_due',
  };
  return statusMap[status] || 'incomplete';
}
