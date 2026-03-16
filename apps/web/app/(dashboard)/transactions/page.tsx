import { createSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TransactionsTable } from '@/components/transactions/transactions-table';
import { TransactionFilters } from '@/components/transactions/transaction-filters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PageProps {
  searchParams: Promise<{
    category?: string;
    type?: string;
    search?: string;
    start?: string;
    end?: string;
    page?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
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

  // Build query
  let query = supabase
    .from('transactions')
    .select(`
      id, date, description, original_description, merchant_name,
      amount, type, pending, categorization_source, categorization_confidence,
      is_tax_deductible, notes, receipt_url,
      categories:category_id (id, name, color, type),
      bank_accounts:bank_account_id (id, account_name, institution_name)
    `, { count: 'exact' })
    .eq('organization_id', orgId)
    .eq('is_excluded', false)
    .order('date', { ascending: false });

  if (params.category) {
    query = query.eq('category_id', params.category);
  }
  if (params.type === 'income') {
    query = query.gt('amount', 0);
  } else if (params.type === 'expense') {
    query = query.lt('amount', 0);
  }
  if (params.search) {
    query = query.or(`description.ilike.%${params.search}%,merchant_name.ilike.%${params.search}%`);
  }
  if (params.start) {
    query = query.gte('date', params.start);
  }
  if (params.end) {
    query = query.lte('date', params.end);
  }

  const page = parseInt(params.page || '1', 10);
  const perPage = 50;
  const from = (page - 1) * perPage;

  query = query.range(from, from + perPage - 1);

  const { data: transactions, count } = await query;

  // Get categories for filter
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, type')
    .eq('organization_id', orgId)
    .order('sort_order');

  // Uncategorized count
  const { count: uncategorizedCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('categorization_source', 'uncategorized')
    .eq('is_excluded', false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500">
            {count || 0} transactions{uncategorizedCount ? ` (${uncategorizedCount} uncategorized)` : ''}
          </p>
        </div>
      </div>

      <TransactionFilters categories={categories || []} />

      <Card>
        <CardContent className="p-0">
          <TransactionsTable
            transactions={transactions || []}
            categories={categories || []}
            totalCount={count || 0}
            currentPage={page}
            perPage={perPage}
            orgId={orgId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
