import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { USE_MOCKS } from './useHomeData';

// Subscribe to *per-vendor* request changes and invalidate the Home tab
// queries on any change.
//
// Phase 5: subscribes to the request_vendors M2M table filtered by the
// current vendor_id. job_status / va_confirmed_* edits on that join row
// arrive here; underlying vendor_requests row edits do too, indirectly,
// since most lifecycle writes touch the join. Invoice events live in
// useInvoicesRealtime.
//
// USE_MOCKS bypass mirrors the other Realtime hooks so the Phase 3 smoke
// test (EXPO_PUBLIC_FORCE_REAL_DATA=1) activates fetches and subscriptions
// in lock step.
export function useHomeRealtime(vendorId: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!vendorId) return;
    if (USE_MOCKS) return;

    const channel = supabase
      .channel(`home:${vendorId}`)
      .on(
        // Loose cast — postgres_changes payload types lag the runtime contract.
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'request_vendors',
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['home'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [vendorId, qc]);
}
