import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { ArrowLeft, Send, Download, FileText } from 'lucide-react';
import { InvoiceActions } from '@/components/invoices/invoice-actions';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-indigo-100 text-indigo-800',
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  overdue: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-500',
  void: 'bg-gray-100 text-gray-500',
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !invoice) notFound();

  // Verify access
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', invoice.organization_id)
    .single();

  if (!membership) notFound();

  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order');

  const { data: payments } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', id)
    .order('payment_date', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">#{invoice.invoice_number}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[invoice.status]}`}>
                {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
              </span>
            </div>
            <p className="text-gray-500">{invoice.client_name}</p>
          </div>
        </div>
        <InvoiceActions invoiceId={id} status={invoice.status} />
      </div>

      {/* Invoice Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-xl font-bold">{formatCurrency(Number(invoice.total))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-gray-500">Paid</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(Number(invoice.amount_paid))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-gray-500">Due</div>
            <div className="text-xl font-bold text-amber-600">{formatCurrency(Number(invoice.amount_due))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-gray-500">Due Date</div>
            <div className="text-xl font-bold">{formatDate(invoice.due_date)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Client & Dates */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Bill To</div>
              <div className="text-sm">
                <div className="font-medium">{invoice.client_name}</div>
                {invoice.client_company && <div className="text-gray-500">{invoice.client_company}</div>}
                {invoice.client_address && <div className="text-gray-500">{invoice.client_address}</div>}
                {invoice.client_email && <div className="text-gray-500">{invoice.client_email}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm space-y-1">
                <div><span className="text-gray-500">Issued:</span> <span className="font-medium">{formatDate(invoice.issue_date)}</span></div>
                <div><span className="text-gray-500">Due:</span> <span className="font-medium">{formatDate(invoice.due_date)}</span></div>
                {invoice.sent_at && <div><span className="text-gray-500">Sent:</span> <span className="font-medium">{formatDate(invoice.sent_at)}</span></div>}
                {invoice.paid_at && <div><span className="text-gray-500">Paid:</span> <span className="font-medium text-green-600">{formatDate(invoice.paid_at)}</span></div>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lineItems || []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell className="text-center">{Number(item.quantity)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(item.unit_price))}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(Number(item.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-6 py-4 border-t space-y-2 max-w-xs ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(Number(invoice.subtotal))}</span>
            </div>
            {Number(invoice.tax_rate) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax ({(Number(invoice.tax_rate) * 100).toFixed(1)}%)</span>
                <span>{formatCurrency(Number(invoice.tax_amount))}</span>
              </div>
            )}
            {Number(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="text-red-600">-{formatCurrency(Number(invoice.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t pt-2">
              <span>Total</span>
              <span className="text-indigo-600">{formatCurrency(Number(invoice.total))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      {(payments || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments || []).map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.payment_date)}</TableCell>
                    <TableCell className="capitalize">{(payment.payment_method || '').replace('_', ' ')}</TableCell>
                    <TableCell className="text-gray-500">{payment.reference || '-'}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      +{formatCurrency(Number(payment.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {(invoice.notes || invoice.terms) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {invoice.notes && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</div>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Terms</div>
                <p className="text-sm text-gray-600">{invoice.terms}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
