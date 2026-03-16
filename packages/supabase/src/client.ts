import { createClient as supabaseCreateClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function createClient(supabaseUrl: string, supabaseAnonKey: string, options?: { accessToken?: string }) {
  return supabaseCreateClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: options?.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {},
    },
  });
}

export function createServiceClient(supabaseUrl: string, serviceRoleKey: string) {
  return supabaseCreateClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
