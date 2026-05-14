import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { AppState } from 'react-native';
import {
  clearLastBackgrounded,
  clearUnlockedSession,
  isInactivityExpired,
  markBackgrounded,
} from './pinStore';
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

// Side concerns layered onto the AppState listener:
//   1. Supabase auto-refresh — start when active, stop otherwise. Pre-existing.
//   2. Phase 3 inactivity gate — write a timestamp on every non-active
//      transition; on returning to active, check elapsed and re-lock if past
//      INACTIVITY_TIMEOUT_MS. clearUnlockedSession notifies AuthGate via the
//      pinStore subscriber, which re-runs the routing effect and lands the
//      user on /unlock. We then wipe the timestamp so the *next* foreground
//      doesn't double-lock.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
    void (async () => {
      if (await isInactivityExpired()) {
        clearUnlockedSession();
      }
      // Always clear after a foreground check, expired or not — the timestamp
      // describes "when we last backgrounded", and we're no longer in that
      // state. Leaving stale values around would re-lock a user who, e.g.,
      // crashed in the foreground and reopened — the timestamp would still
      // point at the previous bg.
      await clearLastBackgrounded();
    })();
  } else {
    supabase.auth.stopAutoRefresh();
    void markBackgrounded();
  }
});
