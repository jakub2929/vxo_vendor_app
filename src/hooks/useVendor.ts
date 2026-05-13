import { useCallback, useEffect, useState } from 'react';
import { getCachedVendor, getVendor } from '@/lib/vendorCache';
import type { Database } from '@/types/database';

type Vendor = Database['public']['Tables']['vendors']['Row'];

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

  const refresh = useCallback(async () => {
    setLoading(true);
    const v = await getVendor(true);
    setVendor(v);
    setLoading(false);
  }, []);

  return { vendor, loading, refresh };
}
