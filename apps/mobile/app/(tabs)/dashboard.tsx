import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

interface DashboardData {
  totalBalance: number;
  ytdIncome: number;
  ytdExpenses: number;
  outstandingInvoices: number;
  recentTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
  }>;
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership) return;
      const orgId = membership.organization_id;
      const year = new Date().getFullYear();
      const startOfYear = `${year}-01-01`;
      const today = new Date().toISOString().split('T')[0];

      const [accounts, income, expenses, invoices, recent] = await Promise.all([
        supabase
          .from('bank_accounts')
          .select('current_balance')
          .eq('organization_id', orgId)
          .eq('is_active', true),
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
          .from('transactions')
          .select('id, date, description, amount, merchant_name')
          .eq('organization_id', orgId)
          .eq('is_excluded', false)
          .order('date', { ascending: false })
          .limit(5),
      ]);

      setData({
        totalBalance: (accounts.data || []).reduce((s, a) => s + Number(a.current_balance), 0),
        ytdIncome: (income.data || []).reduce((s, t) => s + Number(t.amount), 0),
        ytdExpenses: Math.abs((expenses.data || []).reduce((s, t) => s + Number(t.amount), 0)),
        outstandingInvoices: (invoices.data || []).reduce((s, i) => s + Number(i.amount_due), 0),
        recentTransactions: (recent.data || []).map((t: any) => ({
          id: t.id,
          date: t.date,
          description: t.merchant_name || t.description,
          amount: Number(t.amount),
        })),
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
        }
      >
        {/* KPI Cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <MetricCard label="Cash Balance" value={formatCurrency(data?.totalBalance || 0)} color="#111827" />
          <MetricCard label="YTD Income" value={formatCurrency(data?.ytdIncome || 0)} color="#16a34a" />
          <MetricCard label="YTD Expenses" value={formatCurrency(data?.ytdExpenses || 0)} color="#dc2626" />
          <MetricCard label="Outstanding" value={formatCurrency(data?.outstandingInvoices || 0)} color="#d97706" />
        </View>

        {/* Recent Transactions */}
        <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>
            Recent Transactions
          </Text>
          {(data?.recentTransactions || []).length === 0 ? (
            <Text style={{ color: '#9ca3af', textAlign: 'center', paddingVertical: 24 }}>
              No transactions yet
            </Text>
          ) : (
            data?.recentTransactions.map((tx) => (
              <View
                key={tx.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f3f4f6',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }} numberOfLines={1}>
                    {tx.description}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>{tx.date}</Text>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: tx.amount > 0 ? '#16a34a' : '#111827',
                  }}
                >
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
      }}
    >
      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color }}>{value}</Text>
    </View>
  );
}
