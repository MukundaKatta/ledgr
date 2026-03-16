import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function MoreScreen() {
  const router = useRouter();

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  const menuItems = [
    { label: 'Cash Flow Forecast', description: 'AI-powered projections', onPress: () => {} },
    { label: 'Tax Estimates', description: 'Quarterly tax overview', onPress: () => {} },
    { label: 'Reports', description: 'P&L and expense breakdown', onPress: () => {} },
    { label: 'Settings', description: 'Account and preferences', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            onPress={item.onPress}
            style={{
              backgroundColor: '#fff',
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
              {item.label}
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              {item.description}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={{ marginTop: 24 }}>
          <TouchableOpacity
            onPress={handleSignOut}
            style={{
              backgroundColor: '#fff',
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#fecaca',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#dc2626' }}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>Ledgr v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
