// Realtime subscription for a single job's chat thread. Mirrors
// useHomeRealtime / useJobsRealtime in shape, but scoped to one job_id and
// only INSERT (we don't show edits or deletes in this UI).
//
// Bypassed when USE_MOCKS is on — mockChatState invalidates the same query
// key directly on append, so the subscription would only duplicate work.
// Mirroring USE_MOCKS exactly here means EXPO_PUBLIC_FORCE_REAL_DATA=1
// activates both the data fetch in useJobChat AND this subscription.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { supabase } from '@/lib/supabase';

export function useJobChatRealtime(jobId: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!jobId) return;
    if (USE_MOCKS) return;

    const channel = supabase
      .channel(`chat:${jobId}`)
      .on(
        // Loose cast — postgres_changes payload types lag the runtime contract.
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_messages',
          filter: `request_id=eq.${jobId}`,
        },
        () => {
          void qc.invalidateQueries({
            queryKey: ['chat', 'messages', jobId],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [jobId, qc]);
}
