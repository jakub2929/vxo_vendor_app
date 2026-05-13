import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { AppState } from 'react-native';
import type { Database } from '@/types/database';

let SecureStore: any;
try {
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

// Platform-aware storage adapter
const StorageAdapter = {
  getItem: async (key: string) => {
    try {
      if (Platform.OS === 'web' || !SecureStore) {
        // Web fallback
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      }
      // Native: use SecureStore
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(`Storage.getItem("${key}") error:`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web' || !SecureStore) {
        // Web fallback
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
        }
        return;
      }
      // Native: use SecureStore
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn(`Storage.setItem("${key}") error:`, error);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web' || !SecureStore) {
        // Web fallback
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
        return;
      }
      // Native: use SecureStore
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`Storage.removeItem("${key}") error:`, error);
    }
  },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: StorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
