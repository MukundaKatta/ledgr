import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
      >
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View
            style={{
              width: 56, height: 56, borderRadius: 16,
              backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>L</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>
            Welcome back
          </Text>
          <Text style={{ color: '#6b7280', marginTop: 4 }}>Sign in to Ledgr</Text>
        </View>

        {error ? (
          <View style={{ backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <Text style={{ color: '#dc2626', fontSize: 14 }}>{error}</Text>
          </View>
        ) : null}

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
              padding: 12, fontSize: 16, backgroundColor: '#fff',
            }}
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            style={{
              borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
              padding: 12, fontSize: 16, backgroundColor: '#fff',
            }}
          />
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={{
            backgroundColor: '#4f46e5', paddingVertical: 14, borderRadius: 8,
            alignItems: 'center', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
          <Text style={{ color: '#6b7280' }}>No account? </Text>
          <Link href="/auth/signup">
            <Text style={{ color: '#4f46e5', fontWeight: '600' }}>Sign up</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
