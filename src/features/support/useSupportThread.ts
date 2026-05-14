import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { USE_MOCKS } from '@/features/home/useHomeData';
import {
  appendMockSupportMessage,
  getMockSupportMessages,
} from '@/lib/mockSupportState';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type ThreadType = 'current_job' | 'general';

// Row shape comes straight from the generated Database type. `sender` and
// `thread_type` are `string` at the DB layer (CHECK constraints in the
// migration enforce the union); narrow them here so call sites get a real
// discriminated union.
type SupportRow = Database['public']['Tables']['support_messages']['Row'];

export type SupportMessage = Omit<SupportRow, 'sender' | 'thread_type'> & {
  sender: 'vendor' | 'support' | 'system';
  thread_type: ThreadType;
};

function narrow(row: SupportRow): SupportMessage {
  return {
    ...row,
    sender: row.sender as SupportMessage['sender'],
    thread_type: row.thread_type as ThreadType,
  };
}

const OPTIMISTIC_ID_PREFIX = 'optimistic-';

function isOptimistic(id: string): boolean {
  return id.startsWith(OPTIMISTIC_ID_PREFIX);
}

export function useSupportThread(
  vendorId: string | undefined,
  threadType: ThreadType,
) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    if (USE_MOCKS) {
      setMessages(getMockSupportMessages(threadType));
      setLoading(false);
      // No realtime in mock mode; appendMockSupportMessage updates state via
      // the explicit replacement step in sendMessage.
      return () => {
        cancelled = true;
      };
    }

    void supabase
      .from('support_messages')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('thread_type', threadType)
      .order('created_at', { ascending: true })
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          console.warn('[useSupportThread] fetch error', res.error);
        }
        setMessages((res.data ?? []).map(narrow));
        setLoading(false);
      });

    const channel = supabase
      .channel(`support:${vendorId}:${threadType}`)
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
          if (incoming.thread_type !== threadType) return;
          setMessages((prev) => {
            // Already present (real id) — skip.
            if (prev.some((m) => m.id === incoming.id)) return prev;
            // Race: realtime echo for our own optimistic insert may arrive
            // before .insert().select() returns. Replace the optimistic row
            // in place so we never show a duplicate.
            if (incoming.sender === 'vendor') {
              const idx = prev.findIndex(
                (m) =>
                  isOptimistic(m.id) &&
                  m.message === incoming.message &&
                  m.sender === 'vendor',
              );
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = incoming;
                return next;
              }
            }
            return [...prev, incoming];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [vendorId, threadType]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!vendorId || !trimmed || sending) return;
      setSending(true);

      const tempId = `${OPTIMISTIC_ID_PREFIX}${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const optimistic: SupportMessage = {
        id: tempId,
        vendor_id: vendorId,
        thread_type: threadType,
        sender: 'vendor',
        message: trimmed,
        job_id: null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      if (USE_MOCKS) {
        const real = appendMockSupportMessage(threadType, {
          sender: 'vendor',
          message: trimmed,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? real : m)),
        );
        setSending(false);
        return;
      }

      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          vendor_id: vendorId,
          thread_type: threadType,
          sender: 'vendor',
          message: trimmed,
        })
        .select()
        .single();
      setSending(false);

      if (error || !data) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        Alert.alert(
          "Couldn't send",
          error?.message ?? 'Try again in a moment.',
        );
        return;
      }
      // Replace temp with the canonical row. The realtime echo (if it
      // arrives later) dedupes by id against the same row.
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? narrow(data) : m)),
      );
    },
    [vendorId, threadType, sending],
  );

  return { messages, loading, sending, sendMessage };
}
