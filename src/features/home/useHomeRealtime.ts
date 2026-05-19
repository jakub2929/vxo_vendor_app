import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { USE_MOCKS } from './useHomeData';

// Subscribe to *job* changes for this vendor and invalidate the Home tab
// queries on any change. Invoice events used to live here too, but moved to
// useInvoicesRealtime (Phase 3 Track B) so a single hook owns the invoice
// event story (toasts + both ['home'] and ['earnings'] invalidations).
// useJobsRealtime is a separate hook with a different channel name and
// invalidation key (['jobs']) — both can coexist because they invalidate
// different query trees.
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
          table: 'jobs',
          filter: `assigned_vendor_id=eq.${vendorId}`,
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
