import type { Database } from '@/types/database';
import { supabase } from './supabase';

type Vendor = Database['public']['Tables']['vendor_profiles']['Row'];

let cachedVendor: Vendor | null = null;
let inFlight: Promise<Vendor | null> | null = null;

// Module-level subscriber list. useVendor (and any other consumer) registers
// here so it re-renders when the cache is mutated by realtime / form submit
// without forcing a remount. Mirrors the lock-change subscriber pattern in
// pinStore.ts.
type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  for (const l of listeners) l();
}
export function subscribeVendorChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function getVendor(forceRefresh = false): Promise<Vendor | null> {
  if (cachedVendor && !forceRefresh) return cachedVendor;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      if (error) {
        console.warn('[vendorCache] fetch failed', error);
        return null;
      }
      cachedVendor = data;
      notify();
      return data;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function clearVendorCache() {
  cachedVendor = null;
  notify();
}

export function getCachedVendor(): Vendor | null {
  return cachedVendor;
}

// Allow callers (e.g. the Active/OOO toggle) to mutate cache locally without
// roundtripping through Supabase.
export function setCachedVendor(vendor: Vendor | null) {
  cachedVendor = vendor;
  notify();
}

// Force a re-fetch and broadcast. Used after FillProfile submit (so AuthGate
// sees the new `pending` status instead of stale null) and from
// useVendorRealtime (so a remote UPDATE flows through to the banner).
export async function refreshVendorCache(): Promise<Vendor | null> {
  return getVendor(true);
}
