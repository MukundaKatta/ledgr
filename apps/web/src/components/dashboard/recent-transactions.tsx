import { createSupabaseServer } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

export async function RecentTransactions({ orgId }: { orgId: string }) {
  const supabase = await createSupabaseServer();

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id, date, description, merchant_name, amount, type,
      categorization_source, pending,
      categories:category_id (name, color)
    `)
    .eq('organization_id', orgId)
    .eq('is_excluded', false)
    .order('date', { ascending: false })
    .limit(10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Recent Transactions</CardTitle>
        <Link href="/transactions" className="text-sm text-indigo-600 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(transactions || []).map((tx) => {
              const category = tx.categories as unknown as { name: string; color: string } | null;
              const isIncome = Number(tx.amount) > 0;
              return (
                <TableRow key={tx.id}>
                  <TableCell className="text-gray-500 text-sm">
                    {formatDate(tx.date)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{tx.merchant_name || tx.description}</div>
                    {tx.merchant_name && tx.description !== tx.merchant_name && (
                      <div className="text-xs text-gray-400 truncate max-w-[200px]">{tx.description}</div>
                    )}
                    {tx.pending && <Badge variant="outline" className="text-xs ml-2">Pending</Badge>}
                  </TableCell>
                  <TableCell>
                    {category ? (
                      <Badge variant="secondary" className="text-xs">
                        {category.name}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600">
                        Uncategorized
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${isIncome ? 'text-green-600' : 'text-gray-900'}`}>
                    {isIncome ? '+' : ''}{formatCurrency(Number(tx.amount))}
                  </TableCell>
                </TableRow>
              );
            })}
            {(!transactions || transactions.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  No transactions yet. Connect a bank account to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
