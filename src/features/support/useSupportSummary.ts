// Aggregate snapshot for the Support landing list: last message + unread
// count for each thread (current_job + general). Drives the preview text and
// the badge on SupportListItem.
//
// Unread is computed client-side: any non-vendor message whose created_at is
// later than the locally-stored lastOpenedAt (see lib/supportReadState.ts).
// No `read_at` column on the schema (Phase 0 decision deferred it).
//
// Realtime: subscribes to all support_messages inserts for this vendor and
// folds them into the appropriate thread's list. Coarser than useSupportThread
// (no thread_type filter at the channel level — we want both).
import { useCallback, useEffect, useState } from 'react';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { getMockSupportMessages } from '@/lib/mockSupportState';
import { supabase } from '@/lib/supabase';
import { getLastOpenedAt } from '@/lib/supportReadState';
import type { Database } from '@/types/database';
import type {
  SupportMessage,
  ThreadType,
} from '@/features/support/useSupportThread';

type SupportRow = Database['public']['Tables']['support_messages']['Row'];

export type ThreadSummary = {
  lastMessage: SupportMessage | null;
  unreadCount: number;
};

const THREAD_TYPES: ThreadType[] = ['current_job', 'general'];

function narrow(row: SupportRow): SupportMessage {
  return {
    ...row,
    sender: row.sender as SupportMessage['sender'],
    thread_type: row.thread_type as ThreadType,
  };
}

function emptySummaries(): Record<ThreadType, ThreadSummary> {
  return {
    current_job: { lastMessage: null, unreadCount: 0 },
    general: { lastMessage: null, unreadCount: 0 },
  };
}

function buildSummaries(
  byThread: Record<ThreadType, SupportMessage[]>,
  lastOpened: Record<ThreadType, string | null>,
): Record<ThreadType, ThreadSummary> {
  const out = emptySummaries();
  for (const t of THREAD_TYPES) {
    const msgs = byThread[t];
    if (msgs.length === 0) continue;
    const last = msgs[msgs.length - 1];
    const cutoff = lastOpened[t];
    // Only 'support' messages drive the badge — 'system' rows are
    // informational (status updates, welcome prompts) and shouldn't pull
    // the vendor's attention the same way a real reply does.
    const unread = msgs.filter(
      (m) =>
        m.sender === 'support' &&
        (cutoff == null || m.created_at > cutoff),
    ).length;
    out[t] = { lastMessage: last, unreadCount: unread };
  }
  return out;
}

export function useSupportSummary(vendorId: string | undefined) {
  const [byThread, setByThread] = useState<Record<ThreadType, SupportMessage[]>>(
    () => ({ current_job: [], general: [] }),
  );
  const [lastOpened, setLastOpened] = useState<
    Record<ThreadType, string | null>
  >(() => ({ current_job: null, general: null }));
  const [loading, setLoading] = useState(true);

  const refreshLastOpened = useCallback(async () => {
    const [cj, gn] = await Promise.all([
      getLastOpenedAt('current_job'),
      getLastOpenedAt('general'),
    ]);
    setLastOpened({ current_job: cj, general: gn });
  }, []);

  useEffect(() => {
    void refreshLastOpened();
  }, [refreshLastOpened]);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    if (USE_MOCKS) {
      setByThread({
        current_job: getMockSupportMessages('current_job'),
        general: getMockSupportMessages('general'),
      });
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void supabase
      .from('support_messages')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: true })
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          console.warn('[useSupportSummary] fetch error', res.error);
        }
        const grouped: Record<ThreadType, SupportMessage[]> = {
          current_job: [],
          general: [],
        };
        for (const row of res.data ?? []) {
          const msg = narrow(row);
          if (msg.thread_type in grouped) {
            grouped[msg.thread_type].push(msg);
          }
        }
        setByThread(grouped);
        setLoading(false);
      });

    const channel = supabase
      .channel(`support-summary:${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          const incoming = narrow(payload.new as SupportRow);
          if (!THREAD_TYPES.includes(incoming.thread_type)) return;
          setByThread((prev) => {
            const list = prev[incoming.thread_type];
            if (list.some((m) => m.id === incoming.id)) return prev;
            return {
              ...prev,
              [incoming.thread_type]: [...list, incoming],
            };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [vendorId]);

  const summaries = buildSummaries(byThread, lastOpened);

  return {
    summaries,
    loading,
    // Caller invokes from useFocusEffect to pick up SecureStore changes after
    // a thread was opened (which writes lastOpenedAt).
    refresh: refreshLastOpened,
  };
}
