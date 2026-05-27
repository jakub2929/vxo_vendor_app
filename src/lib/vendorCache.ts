import type { Database } from '@/types/database';
import { supabase } from './supabase';

type VendorRow = Database['public']['Tables']['vendor_profiles']['Row'];

// Phase 5 hotfix: the cached Vendor object exposes the approval lifecycle
// state (profiles.status — pending / approved / suspended / rejected) as a
// denormalized field `approval_status`, alongside the vendor_profiles row
// itself. The legacy code read `vendor.status` for two distinct concerns
// (approval + availability); the column split means consumers must read
// `vendor.approval_status` (approval) OR `vendor.availability_status`
// (availability) explicitly. PostgREST doesn't have an inferable FK
// between vendor_profiles.user_id and profiles.id (they both reference
// auth.users.id but in different ways), so we fetch the two rows in
// parallel and merge here.
export type Vendor = VendorRow & {
  approval_status: string | null;
};

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

      // Parallel fetch: vendor_profiles by email + profiles by auth user id.
      // We need both before notifying subscribers so AuthGate doesn't read a
      // half-populated cache and bounce the user to the wrong route.
      const [vendorRes, profileRes] = await Promise.all([
        supabase
          .from('vendor_profiles')
          .select('*')
          .eq('email', user.email)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      if (vendorRes.error) {
        console.warn('[vendorCache] vendor fetch failed', vendorRes.error);
        return null;
      }
      if (profileRes.error) {
        // Profile lookup is best-effort — a missing profile row shouldn't
        // block the vendor from seeing their settings/profile screens.
        console.warn(
          '[vendorCache] profile status fetch failed',
          profileRes.error,
        );
      }

      if (!vendorRes.data) {
        cachedVendor = null;
        notify();
        return null;
      }

      const merged: Vendor = {
        ...vendorRes.data,
        approval_status: profileRes.data?.status ?? null,
      };
      cachedVendor = merged;
      notify();
      return merged;
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
// sees the new `pending` approval status instead of stale null) and from
// useVendorRealtime (so a remote UPDATE flows through to the banner).
export async function refreshVendorCache(): Promise<Vendor | null> {
  return getVendor(true);
}
