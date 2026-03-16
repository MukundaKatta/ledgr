import { NextResponse } from 'next/server';
import { createSupabaseServer, createSupabaseServiceRole } from '@/lib/supabase/server';
import { InvoiceSender } from '@ledgr/invoicing/sender';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const authSupabase = await createSupabaseServer();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServiceRole();

    // Verify invoice access
    const { data: invoice } = await supabase
      .from('invoices')
      .select('organization_id')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const { data: membership } = await authSupabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', invoice.organization_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sender = new InvoiceSender(
      supabase,
      process.env.SENDGRID_API_KEY!,
      process.env.SENDGRID_FROM_EMAIL || 'invoices@ledgr.app'
    );

    const result = await sender.sendInvoice(invoiceId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('Send invoice error:', error);
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 });
  }
}
