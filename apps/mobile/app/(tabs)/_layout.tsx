import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: 'D',
    Transactions: 'T',
    Scan: 'S',
    Invoices: 'I',
    More: 'M',
  };
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: focused ? '#4f46e5' : '#e5e7eb',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: focused ? '#fff' : '#6b7280', fontWeight: '600', fontSize: 12 }}>
        {icons[name] || '?'}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#6b7280',
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="Dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ focused }) => <TabIcon name="Transactions" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused }) => <TabIcon name="Scan" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          tabBarIcon: ({ focused }) => <TabIcon name="Invoices" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => <TabIcon name="More" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
