import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { refreshVendorCache } from '@/lib/vendorCache';

// Subscribe to UPDATEs of the vendor's own row so the in-app state (e.g. the
// PendingStatusBanner, Active/OOO badge, profile fields) refreshes within a
// second of an admin flipping `vendors.status` in Supabase Studio — no
// force-quit required.
//
// Channel naming: `vendor:${vendorId}` — distinct from `chat:${jobId}` and
// `jobs-list:${vendorId}` so the Realtime server multiplexes cleanly.
//
// Requires the `vendor_profiles` table to be in the `supabase_realtime`
// publication. See supabase/schema/add-vendors-to-realtime.sql — staged for
// Ryan to apply in prod. RLS already covers the SELECT permission (vendor_own
// policy in 003_rls_policies.sql).
export function useVendorRealtime(vendorId: string | null | undefined) {
  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor:${vendorId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vendor_profiles',
          filter: `id=eq.${vendorId}`,
        },
        () => {
          void refreshVendorCache();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [vendorId]);
}
