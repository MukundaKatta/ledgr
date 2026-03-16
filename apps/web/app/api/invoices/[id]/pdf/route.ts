import { NextResponse } from 'next/server';
import { createSupabaseServer, createSupabaseServiceRole } from '@/lib/supabase/server';
import { InvoiceGenerator } from '@ledgr/invoicing/generator';

export async function GET(
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

    // Verify access
    const { data: invoice } = await supabase
      .from('invoices')
      .select('organization_id, invoice_number')
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

    const generator = new InvoiceGenerator(supabase);
    const pdfBuffer = await generator.generatePDF(invoiceId);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoice.invoice_number}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
