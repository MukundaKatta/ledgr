import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { Plus, FileText, DollarSign, Clock, AlertTriangle } from 'lucide-react';

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

export default async function InvoicesPage() {
  const supabase = await createSupabaseServer();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) redirect('/auth/signup');
  const orgId = membership.organization_id;

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  // Calculate summary metrics
  const outstanding = (invoices || [])
    .filter((i) => ['sent', 'viewed', 'partial', 'overdue'].includes(i.status))
    .reduce((s, i) => s + Number(i.amount_due), 0);

  const overdueAmount = (invoices || [])
    .filter((i) => i.status === 'overdue')
    .reduce((s, i) => s + Number(i.amount_due), 0);

  const paidThisMonth = (invoices || [])
    .filter((i) => {
      if (i.status !== 'paid' || !i.paid_at) return false;
      const paidDate = new Date(i.paid_at);
      const now = new Date();
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    })
    .reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500">{invoices?.length || 0} total invoices</p>
        </div>
        <Link href="/invoices/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(outstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(overdueAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Collected This Month</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(paidThisMonth)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoices || []).map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:underline">
                      #{inv.invoice_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{inv.client_name}</div>
                    {inv.client_company && (
                      <div className="text-xs text-gray-400">{inv.client_company}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[inv.status] || statusColors.draft}`}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(inv.issue_date)}</TableCell>
                  <TableCell className="text-sm text-gray-500">{formatDate(inv.due_date)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(Number(inv.total))}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${Number(inv.amount_due) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatCurrency(Number(inv.amount_due))}
                  </TableCell>
                </TableRow>
              ))}
              {(!invoices || invoices.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No invoices yet. Create your first invoice to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
