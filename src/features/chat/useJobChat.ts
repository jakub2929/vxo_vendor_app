// Data hooks for the Job Chat detail screen (Figma node 4:10092).
//
// USE_MOCKS branch reads from src/lib/mockChatState.ts (a mutable map seeded
// from mockJobs + mockJobMessages). Real branch hits Supabase:
//   - vendor_requests (joined with request_vendors for per-vendor status and
//     profiles for client display info) for the job record
//   - job_messages (keyed by request_id) for the thread
//   - insert into job_messages for sending
//
// Query keys are namespaced under ['chat', ...] so they invalidate
// independently of the Home / Jobs caches. mockChatState invalidates these
// directly on mutation — no separate subscribe channel.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { USE_MOCKS } from '@/features/home/useHomeData';
import {
  appendMockMessage,
  getMockJob,
  getMockMessages,
  listMockInvoicesWithItemsForJob,
} from '@/lib/mockChatState';
import { supabase } from '@/lib/supabase';
import { getCachedVendor } from '@/lib/vendorCache';
import type {
  ChatMessage,
  ChatSender,
  Invoice,
  InvoiceItem,
  Job,
} from '@/features/chat/types';

export function useJob(jobId: string | null | undefined) {
  return useQuery<Job | null>({
    queryKey: ['chat', 'job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      if (USE_MOCKS) {
        return getMockJob(jobId as string);
      }
      // Pull vendor from the cached vendor (set on sign-in by useVendor).
      // We need it to filter request_vendors to THIS vendor's row so the
      // chat surfaces the right per-vendor job_status. If the vendor isn't
      // cached yet, fall back to selecting any request_vendors row for the
      // request — better partial render than throwing.
      const vendor = getCachedVendor();
      const { data, error } = await supabase
        .from('vendor_requests')
        .select(
          `*,
           request_vendors!inner(job_status, va_confirmed_time, va_confirmed_job_acceptance, vendor_id),
           client:profiles!client_id(first_name, last_name, phone, email)`,
        )
        .eq('id', jobId as string)
        .single();
      if (error) throw error;
      if (!data) return null;

      // Normalize the embedded relations into the synthetic Job shape.
      const rvRaw = (data as { request_vendors: unknown }).request_vendors;
      const rvArr = Array.isArray(rvRaw)
        ? (rvRaw as Array<{ vendor_id: string; job_status: string | null }>)
        : rvRaw
          ? [rvRaw as { vendor_id: string; job_status: string | null }]
          : [];
      const myRv = vendor?.id
        ? rvArr.find((r) => r.vendor_id === vendor.id) ?? rvArr[0]
        : rvArr[0];
      const clientRaw = (data as { client: unknown }).client;
      const client = Array.isArray(clientRaw) ? clientRaw[0] : clientRaw;
      const { request_vendors: _rv, client: _client, ...rest } = data as Record<
        string,
        unknown
      > & { request_vendors: unknown; client: unknown };
      void _rv;
      void _client;
      return {
        ...(rest as unknown as Omit<Job, 'job_status' | 'client'>),
        job_status: myRv?.job_status ?? null,
        client: (client as Job['client']) ?? null,
      };
    },
  });
}

export function useJobMessages(jobId: string | null | undefined) {
  return useQuery<ChatMessage[]>({
    queryKey: ['chat', 'messages', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      if (USE_MOCKS) {
        return getMockMessages(jobId as string);
      }
      // Phase 5: job_messages now keyed by request_id, body in `message`.
      const { data, error } = await supabase
        .from('job_messages')
        .select('id, request_id, sender, message, created_at')
        .eq('request_id', jobId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // DB column is `sender: string`; narrow to ChatSender at the boundary.
      return (data ?? []).map((row) => ({
        id: row.id,
        request_id: row.request_id ?? (jobId as string),
        sender: row.sender as ChatSender,
        content: row.message,
        created_at: row.created_at ?? '',
      }));
    },
  });
}

// Invoice + its line items as a unit. The timeline renders one card per
// invoice; fetching them together keeps the chat read path to a single
// embedded select (or one mock-store call).
export type InvoiceWithItems = { invoice: Invoice; items: InvoiceItem[] };

export function useJobInvoices(jobId: string | null | undefined) {
  return useQuery<InvoiceWithItems[]>({
    queryKey: ['chat', 'invoices', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      if (USE_MOCKS) {
        return listMockInvoicesWithItemsForJob(jobId as string);
      }
      // Embedded select via the invoice_items_invoice_id_fkey relationship.
      // Returns rows shaped { ...invoice, invoice_items: InvoiceItem[] }.
      const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('job_id', jobId as string)
        .order('sent_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        // Strip the embedded relation off the invoice shape so the rest of
        // the code sees a clean Invoice.
        const { invoice_items, ...invoice } = row as Invoice & {
          invoice_items: InvoiceItem[];
        };
        const items = [...(invoice_items ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        return { invoice: invoice as Invoice, items };
      });
    },
  });
}

type SendArgs = { content: string; sender?: ChatSender };

export function useSendMessage(jobId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, sender = 'vendor' }: SendArgs) => {
      if (!jobId) throw new Error('useSendMessage: jobId is required');
      if (USE_MOCKS) {
        return appendMockMessage(jobId, { sender, content });
      }
      // Phase 5: insert against request_id + message columns.
      const { data, error } = await supabase
        .from('job_messages')
        .insert({ request_id: jobId, sender, message: content })
        .select('id, request_id, sender, message, created_at')
        .single();
      if (error) throw error;
      return {
        id: data.id,
        request_id: data.request_id ?? jobId,
        sender: data.sender as ChatSender,
        content: data.message,
        created_at: data.created_at ?? '',
      } satisfies ChatMessage;
    },
    onSuccess: () => {
      // mockChatState already invalidates; this is the real-branch path.
      if (!USE_MOCKS) {
        void qc.invalidateQueries({ queryKey: ['chat', 'messages', jobId] });
      }
    },
  });
}
