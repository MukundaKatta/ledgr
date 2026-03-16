import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CashFlowChart } from '@/components/dashboard/cash-flow-chart';
import { RecentTransactions } from '@/components/dashboard/recent-transactions';
import { InsightsPanel } from '@/components/dashboard/insights-panel';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
} from 'lucide-react';

export default async function OverviewPage() {
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

  // Get current year date range
  const year = new Date().getFullYear();
  const startOfYear = `${year}-01-01`;
  const today = new Date().toISOString().split('T')[0];

  // Fetch metrics in parallel
  const [incomeResult, expenseResult, invoiceResult, accountResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount')
      .eq('organization_id', orgId)
      .eq('is_excluded', false)
      .gte('date', startOfYear)
      .lte('date', today)
      .gt('amount', 0),
    supabase
      .from('transactions')
      .select('amount')
      .eq('organization_id', orgId)
      .eq('is_excluded', false)
      .gte('date', startOfYear)
      .lte('date', today)
      .lt('amount', 0),
    supabase
      .from('invoices')
      .select('amount_due')
      .eq('organization_id', orgId)
      .in('status', ['sent', 'viewed', 'partial', 'overdue'])
      .gt('amount_due', 0),
    supabase
      .from('bank_accounts')
      .select('current_balance')
      .eq('organization_id', orgId)
      .eq('is_active', true),
  ]);

  const totalIncome = (incomeResult.data || []).reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = Math.abs((expenseResult.data || []).reduce((s, t) => s + Number(t.amount), 0));
  const outstandingInvoices = (invoiceResult.data || []).reduce((s, i) => s + Number(i.amount_due), 0);
  const totalBalance = (accountResult.data || []).reduce((s, a) => s + Number(a.current_balance), 0);

  const netIncome = totalIncome - totalExpenses;

  // Fetch monthly data for chart
  const { data: monthlyTx } = await supabase
    .from('transactions')
    .select('date, amount')
    .eq('organization_id', orgId)
    .eq('is_excluded', false)
    .gte('date', startOfYear)
    .lte('date', today)
    .order('date');

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    const monthTxs = (monthlyTx || []).filter((t) => t.date.startsWith(`${year}-${month}`));
    const income = monthTxs.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
    const expenses = Math.abs(monthTxs.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0));
    return {
      month: new Date(year, i).toLocaleString('en', { month: 'short' }),
      income: Math.round(income),
      expenses: Math.round(expenses),
      net: Math.round(income - expenses),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Your financial overview for {year}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Cash Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-gray-500 mt-1">Across all linked accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">YTD Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-gray-500 mt-1">Net: {formatCurrency(netIncome)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">YTD Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {totalIncome > 0 ? `${((totalExpenses / totalIncome) * 100).toFixed(0)}% of income` : 'No income yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Outstanding</CardTitle>
            <Receipt className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(outstandingInvoices)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {invoiceResult.data?.length || 0} unpaid invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CashFlowChart data={monthlyData} />
        </div>
        <div>
          <InsightsPanel orgId={orgId} />
        </div>
      </div>

      <RecentTransactions orgId={orgId} />
    </div>
  );
}
