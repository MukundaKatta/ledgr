import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  status: string;
  total: number;
  amount_due: number;
  due_date: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280' },
  sent: { bg: '#dbeafe', text: '#1d4ed8' },
  viewed: { bg: '#e0e7ff', text: '#4338ca' },
  paid: { bg: '#dcfce7', text: '#15803d' },
  partial: { bg: '#fef9c3', text: '#a16207' },
  overdue: { bg: '#fee2e2', text: '#dc2626' },
  canceled: { bg: '#f3f4f6', text: '#9ca3af' },
  void: { bg: '#f3f4f6', text: '#9ca3af' },
};

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInvoices = useCallback(async () => {
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

      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, client_name, status, total, amount_due, due_date')
        .eq('organization_id', membership.organization_id)
        .order('created_at', { ascending: false })
        .limit(50);

      setInvoices(
        (data || []).map((inv) => ({
          ...inv,
          total: Number(inv.total),
          amount_due: Number(inv.amount_due),
        }))
      );
    } catch (error) {
      console.error('Fetch invoices error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  function renderInvoice({ item }: { item: Invoice }) {
    const colors = statusColors[item.status] || statusColors.draft;
    return (
      <View
        style={{
          backgroundColor: '#fff',
          marginHorizontal: 16,
          marginVertical: 4,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: '#e5e7eb',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#4f46e5' }}>
            #{item.invoice_number}
          </Text>
          <View style={{ backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>
              {item.status}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, fontWeight: '500', color: '#111827', marginBottom: 4 }}>
          {item.client_name}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>
            Due: {formatDate(item.due_date)}
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
              {formatCurrency(item.total)}
            </Text>
            {item.amount_due > 0 && item.amount_due !== item.total && (
              <Text style={{ fontSize: 12, color: '#d97706' }}>
                Due: {formatCurrency(item.amount_due)}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList
        data={invoices}
        renderItem={renderInvoice}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchInvoices(); }}
          />
        }
        ListEmptyComponent={
          <View style={{ padding: 48, alignItems: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>No invoices yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
