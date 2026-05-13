import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { USE_MOCKS } from './useHomeData';

// Subscribe to invoice + job changes for this vendor and invalidate the Home
// tab queries on any change. When the data layer is on mocks the subscription
// is a no-op — Realtime is only meaningful against real Supabase. Critically,
// this bypass condition mirrors USE_MOCKS exactly so that the Phase 3 Realtime
// smoke test (EXPO_PUBLIC_FORCE_REAL_DATA=1) activates both data fetches AND
// the subscription. Don't duplicate the __DEV__ logic locally.
export function useHomeRealtime(vendorId: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!vendorId) return;
    if (USE_MOCKS) return;

    const invalidate = () =>
      qc.invalidateQueries({ queryKey: ['home'] });

    const channel = supabase
      .channel(`home:${vendorId}`)
      .on(
        // Loose cast — postgres_changes payload types lag the runtime contract.
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `vendor_id=eq.${vendorId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_vendor_id=eq.${vendorId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [vendorId, qc]);
}
