import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { formatCurrency, getDateRangeForPeriod } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfitLossReport } from '@/components/reports/profit-loss';
import { ExpenseBreakdown } from '@/components/reports/expense-breakdown';

export default async function ReportsPage() {
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

  const { start, end } = getDateRangeForPeriod('ytd');

  // Fetch transactions with categories for reports
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id, date, amount, type, is_tax_deductible,
      categories:category_id (id, name, type, color, tax_schedule_line)
    `)
    .eq('organization_id', orgId)
    .eq('is_excluded', false)
    .gte('date', start)
    .lte('date', end)
    .order('date');

  // Calculate P&L
  const income: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of transactions || []) {
    const amount = Number(tx.amount);
    const cat = tx.categories as unknown as { name: string; type: string; color: string } | null;
    const catName = cat?.name || 'Uncategorized';

    if (amount > 0) {
      income[catName] = (income[catName] || 0) + amount;
      totalIncome += amount;
    } else {
      const absAmount = Math.abs(amount);
      expenses[catName] = (expenses[catName] || 0) + absAmount;
      totalExpenses += absAmount;
    }
  }

  const netIncome = totalIncome - totalExpenses;

  const incomeRows = Object.entries(income)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({ name, amount }));

  const expenseRows = Object.entries(expenses)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({ name, amount }));

  const expenseChartData = expenseRows.map((row) => ({
    name: row.name.length > 20 ? row.name.slice(0, 20) + '...' : row.name,
    value: Math.round(row.amount),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
        <p className="text-gray-500">Year-to-date performance ({start} to {end})</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Net Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(netIncome)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {totalIncome > 0 ? `${((netIncome / totalIncome) * 100).toFixed(1)}% margin` : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pl">
        <TabsList>
          <TabsTrigger value="pl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="expenses">Expense Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="pl" className="mt-4">
          <ProfitLossReport
            incomeRows={incomeRows}
            expenseRows={expenseRows}
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            netIncome={netIncome}
          />
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <ExpenseBreakdown data={expenseChartData} total={totalExpenses} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
