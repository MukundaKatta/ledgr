'use client';

import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { ChevronLeft, ChevronRight, Sparkles, Receipt } from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  description: string;
  original_description: string | null;
  merchant_name: string | null;
  amount: number;
  type: string;
  pending: boolean;
  categorization_source: string;
  categorization_confidence: number | null;
  is_tax_deductible: boolean;
  notes: string | null;
  receipt_url: string | null;
  categories: { id: string; name: string; color: string; type: string } | null;
  bank_accounts: { id: string; account_name: string; institution_name: string } | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Props {
  transactions: Transaction[];
  categories: Category[];
  totalCount: number;
  currentPage: number;
  perPage: number;
  orgId: string;
}

export function TransactionsTable({
  transactions,
  categories,
  totalCount,
  currentPage,
  perPage,
  orgId,
}: Props) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const totalPages = Math.ceil(totalCount / perPage);

  async function updateCategory(transactionId: string, categoryId: string) {
    const category = categories.find((c) => c.id === categoryId);

    await supabase
      .from('transactions')
      .update({
        category_id: categoryId,
        categorization_source: 'manual',
        categorization_confidence: 1.0,
        is_tax_deductible: category?.type === 'expense',
      })
      .eq('id', transactionId);

    router.refresh();
  }

  const sourceLabel: Record<string, { label: string; color: string }> = {
    manual: { label: 'Manual', color: 'text-blue-600' },
    ai: { label: 'AI', color: 'text-purple-600' },
    rule: { label: 'Rule', color: 'text-green-600' },
    uncategorized: { label: 'Needs Review', color: 'text-amber-600' },
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="w-[200px]">Category</TableHead>
            <TableHead className="w-[80px]">Source</TableHead>
            <TableHead className="text-right w-[120px]">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const isIncome = Number(tx.amount) > 0;
            const source = sourceLabel[tx.categorization_source] || sourceLabel.uncategorized;
            return (
              <TableRow key={tx.id}>
                <TableCell className="text-sm text-gray-500">{formatDate(tx.date)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium text-sm">
                        {tx.merchant_name || tx.description}
                      </div>
                      {tx.merchant_name && tx.description !== tx.merchant_name && (
                        <div className="text-xs text-gray-400 truncate max-w-[250px]">
                          {tx.description}
                        </div>
                      )}
                    </div>
                    {tx.pending && <Badge variant="outline" className="text-xs">Pending</Badge>}
                    {tx.is_tax_deductible && (
                      <Badge variant="success" className="text-xs">Tax</Badge>
                    )}
                    {tx.receipt_url && <Receipt className="h-3 w-3 text-gray-400" />}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-gray-500">
                  {tx.bank_accounts?.institution_name || '-'}
                </TableCell>
                <TableCell>
                  <Select
                    value={tx.categories?.id || 'uncategorized'}
                    onValueChange={(v) => {
                      if (v !== 'uncategorized') updateCategory(tx.id, v);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncategorized" disabled>
                        Select category...
                      </SelectItem>
                      {categories
                        .filter((c) => (isIncome ? c.type === 'income' : c.type !== 'income'))
                        .map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium ${source.color} flex items-center gap-1`}>
                    {tx.categorization_source === 'ai' && <Sparkles className="h-3 w-3" />}
                    {source.label}
                  </span>
                </TableCell>
                <TableCell className={`text-right font-medium ${isIncome ? 'text-green-600' : 'text-gray-900'}`}>
                  {isIncome ? '+' : ''}{formatCurrency(Number(tx.amount))}
                </TableCell>
              </TableRow>
            );
          })}
          {transactions.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                No transactions found. Connect a bank account to sync transactions.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-gray-500">
            Showing {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, totalCount)} of {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => router.push(`/transactions?page=${currentPage - 1}`)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => router.push(`/transactions?page=${currentPage + 1}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
