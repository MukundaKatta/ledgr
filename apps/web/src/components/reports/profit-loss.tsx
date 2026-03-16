import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Row {
  name: string;
  amount: number;
}

interface Props {
  incomeRows: Row[];
  expenseRows: Row[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export function ProfitLossReport({ incomeRows, expenseRows, totalIncome, totalExpenses, netIncome }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Profit & Loss Statement</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Income */}
          <div>
            <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">Revenue</h3>
            <div className="space-y-2">
              {incomeRows.map((row) => (
                <div key={row.name} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.name}</span>
                  <span className="font-medium">{formatCurrency(row.amount)}</span>
                </div>
              ))}
              {incomeRows.length === 0 && (
                <div className="text-sm text-gray-400">No income recorded</div>
              )}
            </div>
            <div className="flex justify-between text-sm font-bold mt-3 pt-2 border-t border-green-200">
              <span className="text-green-700">Total Revenue</span>
              <span className="text-green-700">{formatCurrency(totalIncome)}</span>
            </div>
          </div>

          {/* Expenses */}
          <div>
            <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-3">Expenses</h3>
            <div className="space-y-2">
              {expenseRows.map((row) => (
                <div key={row.name} className="flex justify-between text-sm">
                  <span className="text-gray-600">{row.name}</span>
                  <span className="font-medium">{formatCurrency(row.amount)}</span>
                </div>
              ))}
              {expenseRows.length === 0 && (
                <div className="text-sm text-gray-400">No expenses recorded</div>
              )}
            </div>
            <div className="flex justify-between text-sm font-bold mt-3 pt-2 border-t border-red-200">
              <span className="text-red-700">Total Expenses</span>
              <span className="text-red-700">{formatCurrency(totalExpenses)}</span>
            </div>
          </div>

          {/* Net Income */}
          <div className="flex justify-between text-lg font-bold pt-4 border-t-2 border-gray-900">
            <span>Net Income</span>
            <span className={netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatCurrency(netIncome)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
