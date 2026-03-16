import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ForecastChart } from '@/components/forecast/forecast-chart';
import { TrendingUp, TrendingDown, AlertTriangle, Target } from 'lucide-react';

export default async function ForecastPage() {
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

  // Get last 6 months of data for forecasting
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().split('T')[0];

  const { data: transactions } = await supabase
    .from('transactions')
    .select('date, amount')
    .eq('organization_id', orgId)
    .eq('is_excluded', false)
    .gte('date', startDate)
    .order('date');

  // Group by month
  const monthlyData = new Map<string, { income: number; expenses: number }>();

  for (const tx of transactions || []) {
    const monthKey = tx.date.slice(0, 7); // YYYY-MM
    const existing = monthlyData.get(monthKey) || { income: 0, expenses: 0 };
    const amount = Number(tx.amount);
    if (amount > 0) {
      existing.income += amount;
    } else {
      existing.expenses += Math.abs(amount);
    }
    monthlyData.set(monthKey, existing);
  }

  // Calculate averages for forecasting
  const months = Array.from(monthlyData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const recentMonths = months.slice(-3);

  const avgIncome = recentMonths.length > 0
    ? recentMonths.reduce((s, [_, d]) => s + d.income, 0) / recentMonths.length
    : 0;
  const avgExpenses = recentMonths.length > 0
    ? recentMonths.reduce((s, [_, d]) => s + d.expenses, 0) / recentMonths.length
    : 0;

  // Calculate trend (simple linear regression on net cash flow)
  const netValues = months.map(([_, d]) => d.income - d.expenses);
  let trend = 0;
  if (netValues.length >= 2) {
    const n = netValues.length;
    const xMean = (n - 1) / 2;
    const yMean = netValues.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (netValues[i] - yMean);
      den += (i - xMean) * (i - xMean);
    }
    trend = den !== 0 ? num / den : 0;
  }

  // Build forecast data (historical + 3 months projected)
  const chartData: Array<{
    month: string;
    income: number;
    expenses: number;
    net: number;
    isForecast: boolean;
  }> = [];

  for (const [monthKey, data] of months) {
    const date = new Date(monthKey + '-01');
    chartData.push({
      month: date.toLocaleString('en', { month: 'short', year: '2-digit' }),
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      net: Math.round(data.income - data.expenses),
      isForecast: false,
    });
  }

  // Generate 3-month forecast
  const lastMonth = months.length > 0 ? new Date(months[months.length - 1][0] + '-01') : new Date();
  for (let i = 1; i <= 3; i++) {
    const forecastDate = new Date(lastMonth);
    forecastDate.setMonth(forecastDate.getMonth() + i);
    const forecastIncome = Math.max(0, avgIncome + trend * i * 0.3);
    const forecastExpenses = Math.max(0, avgExpenses + Math.abs(trend) * i * 0.1);
    chartData.push({
      month: forecastDate.toLocaleString('en', { month: 'short', year: '2-digit' }),
      income: Math.round(forecastIncome),
      expenses: Math.round(forecastExpenses),
      net: Math.round(forecastIncome - forecastExpenses),
      isForecast: true,
    });
  }

  // Get upcoming invoice payments
  const { data: upcomingInvoices } = await supabase
    .from('invoices')
    .select('amount_due, due_date, client_name')
    .eq('organization_id', orgId)
    .in('status', ['sent', 'viewed', 'partial', 'overdue'])
    .gt('amount_due', 0)
    .order('due_date')
    .limit(5);

  // Cash balance
  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('current_balance')
    .eq('organization_id', orgId)
    .eq('is_active', true);

  const currentBalance = (accounts || []).reduce((s, a) => s + Number(a.current_balance), 0);
  const projectedBalance30 = currentBalance + avgIncome - avgExpenses;
  const projectedBalance90 = currentBalance + (avgIncome - avgExpenses) * 3;

  const isHealthy = projectedBalance90 > 0 && trend >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cash Flow Forecast</h1>
        <p className="text-gray-500">AI-powered predictions based on your financial patterns</p>
      </div>

      {/* Projection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Current Balance</CardTitle>
            <Target className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentBalance)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">30-Day Projection</CardTitle>
            {projectedBalance30 >= currentBalance ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${projectedBalance30 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(projectedBalance30)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">90-Day Projection</CardTitle>
            {projectedBalance90 >= currentBalance ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${projectedBalance90 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(projectedBalance90)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Trend</CardTitle>
            {trend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-lg font-bold ${isHealthy ? 'text-green-600' : 'text-amber-600'}`}>
              {isHealthy ? 'Healthy' : 'Needs Attention'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {trend >= 0 ? '+' : ''}{formatCurrency(trend)}/mo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Chart */}
      <ForecastChart data={chartData} />

      {/* Expected Receivables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expected Receivables</CardTitle>
          <CardDescription>Outstanding invoices that may affect your cash flow</CardDescription>
        </CardHeader>
        <CardContent>
          {(upcomingInvoices || []).length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No outstanding invoices.</p>
          ) : (
            <div className="space-y-3">
              {(upcomingInvoices || []).map((inv, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="text-sm font-medium">{inv.client_name}</div>
                    <div className="text-xs text-gray-500">Due: {inv.due_date}</div>
                  </div>
                  <div className="text-sm font-bold text-green-600">
                    +{formatCurrency(Number(inv.amount_due))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
