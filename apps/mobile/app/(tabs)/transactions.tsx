import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Transaction {
  id: string;
  date: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  category_name: string | null;
  categorization_source: string;
}

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const fetchTransactions = useCallback(async () => {
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

      let query = supabase
        .from('transactions')
        .select(`
          id, date, description, merchant_name, amount,
          categorization_source,
          categories:category_id (name)
        `)
        .eq('organization_id', membership.organization_id)
        .eq('is_excluded', false)
        .order('date', { ascending: false })
        .limit(100);

      if (search.length >= 2) {
        query = query.or(`description.ilike.%${search}%,merchant_name.ilike.%${search}%`);
      }

      const { data } = await query;

      setTransactions(
        (data || []).map((t: any) => ({
          id: t.id,
          date: t.date,
          description: t.description,
          merchant_name: t.merchant_name,
          amount: Number(t.amount),
          category_name: t.categories?.name || null,
          categorization_source: t.categorization_source,
        }))
      );
    } catch (error) {
      console.error('Fetch transactions error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  function renderTransaction({ item }: { item: Transaction }) {
    const isIncome = item.amount > 0;
    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: '#f3f4f6',
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#111827' }} numberOfLines={1}>
            {item.merchant_name || item.description}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>{formatDate(item.date)}</Text>
            {item.category_name ? (
              <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, color: '#6b7280' }}>{item.category_name}</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, color: '#92400e' }}>Uncategorized</Text>
              </View>
            )}
          </View>
        </View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: isIncome ? '#16a34a' : '#111827',
          }}
        >
          {isIncome ? '+' : ''}{formatCurrency(item.amount)}
        </Text>
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
      <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions..."
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
          }}
        />
      </View>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchTransactions(); }}
          />
        }
        ListEmptyComponent={
          <View style={{ padding: 48, alignItems: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>No transactions found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
