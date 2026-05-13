import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { supabase } from '@/lib/supabase';

// Realtime subscription for the Jobs list. Mirrors useHomeRealtime in shape
// but invalidates the ['jobs'] prefix (not ['home']). A separate channel
// from Home is fine: only one of the two top-strip tabs is mounted at a
// time, so we never have both subscriptions live concurrently. Bypassed
// when USE_MOCKS is on — mocks are static.
export function useJobsRealtime(vendorId: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!vendorId) return;
    if (USE_MOCKS) return;

    const invalidate = () =>
      qc.invalidateQueries({ queryKey: ['jobs'] });

    const channel = supabase
      .channel(`jobs-list:${vendorId}`)
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
