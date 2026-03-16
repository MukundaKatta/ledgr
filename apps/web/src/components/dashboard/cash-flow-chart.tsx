'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export function CashFlowChart({ data }: { data: MonthlyData[] }) {
  const formatY = (value: number) => {
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cash Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tickFormatter={formatY} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString()}`,
                  name.charAt(0).toUpperCase() + name.slice(1),
                ]}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
              />
              <Legend />
              <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
