import { useCallback, useEffect, useState } from 'react';
import {
  getCachedVendor,
  getVendor,
  subscribeVendorChange,
  type Vendor,
} from '@/lib/vendorCache';

export function useVendor() {
  const [vendor, setVendor] = useState<Vendor | null>(getCachedVendor());
  const [loading, setLoading] = useState(vendor === null);

  useEffect(() => {
    let cancelled = false;
    getVendor().then((v) => {
      if (!cancelled) {
        setVendor(v);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-render whenever the module-level cache mutates — from FillProfile
  // submit, the OOO toggle, refreshVendorCache(), or useVendorRealtime
  // reacting to a Supabase UPDATE.
  useEffect(() => {
    return subscribeVendorChange(() => {
      setVendor(getCachedVendor());
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const v = await getVendor(true);
    setVendor(v);
    setLoading(false);
  }, []);

  return { vendor, loading, refresh };
}
