import type { Database } from '@/types/database';
import { supabase } from './supabase';

type Vendor = Database['public']['Tables']['vendors']['Row'];

let cachedVendor: Vendor | null = null;
let inFlight: Promise<Vendor | null> | null = null;

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
        .from('vendors')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      if (error) {
        console.warn('[vendorCache] fetch failed', error);
        return null;
      }
      cachedVendor = data;
      return data;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function clearVendorCache() {
  cachedVendor = null;
}

export function getCachedVendor(): Vendor | null {
  return cachedVendor;
}

// Allow callers (e.g. the Active/OOO toggle) to mutate cache locally without
// roundtripping through Supabase.
export function setCachedVendor(vendor: Vendor | null) {
  cachedVendor = vendor;
}
