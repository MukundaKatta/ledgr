'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartData {
  month: string;
  income: number;
  expenses: number;
  net: number;
  isForecast: boolean;
}

export function ForecastChart({ data }: { data: ChartData[] }) {
  const formatY = (value: number) => {
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
  };

  // Split data into actual and forecast for different styling
  const actualData = data.filter((d) => !d.isForecast);
  const forecastStart = actualData.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Income vs Expenses</CardTitle>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Solid bars = Actual</span>
          <span>Faded bars = Projected</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
              {forecastStart > 0 && forecastStart < data.length && (
                <ReferenceLine
                  x={data[forecastStart]?.month}
                  stroke="#9ca3af"
                  strokeDasharray="3 3"
                  label={{ value: 'Forecast', position: 'top', fill: '#9ca3af', fontSize: 11 }}
                />
              )}
              <Bar
                dataKey="income"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                name="Income"
                opacity={0.85}
              />
              <Bar
                dataKey="expenses"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                name="Expenses"
                opacity={0.85}
              />
              <Line
                type="monotone"
                dataKey="net"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                name="Net Cash Flow"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
