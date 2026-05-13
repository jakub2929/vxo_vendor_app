import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// TODO: After running the SQL migration (see prompt / commit message), regenerate
// database.ts via:
//   npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts
// Until then, the support_messages table type won't exist and we cast through
// `any`. Replace SupportMessage with:
//   Database['public']['Tables']['support_messages']['Row']
export type ThreadType = 'current_job' | 'general';

export type SupportMessage = {
  id: string;
  vendor_id: string;
  thread_type: ThreadType;
  sender: 'vendor' | 'support' | 'system';
  message: string;
  job_id: string | null;
  created_at: string;
};

// Untyped Supabase client view — support_messages isn't in the generated
// Database type yet. Remove this cast after running gen types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

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

    void sb
      .from('support_messages')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('thread_type', threadType)
      .order('created_at', { ascending: true })
      .then((res: { data: SupportMessage[] | null; error: unknown }) => {
        if (cancelled) return;
        if (res.error) {
          console.warn('[useSupportThread] fetch error', res.error);
        }
        setMessages(res.data ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`support:${vendorId}:${threadType}`)
      .on(
        // realtime postgres_changes payload — typed loosely until db.ts regen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload: { new: SupportMessage }) => {
          const msg = payload.new;
          if (msg.thread_type !== threadType) return;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
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
      const { error } = await sb.from('support_messages').insert({
        vendor_id: vendorId,
        thread_type: threadType,
        sender: 'vendor',
        message: trimmed,
      });
      setSending(false);
      // TODO: real VXO support reply comes through Alfred bot or an admin
      // manually inserting a row with sender='support'. No fake reply here.
      if (error) console.warn('[useSupportThread] send error', error);
    },
    [vendorId, threadType, sending],
  );

  return { messages, loading, sending, sendMessage };
}
