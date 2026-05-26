// Mutable in-memory store that backs the Job Chat detail screen when
// USE_MOCKS is on. Wraps mockJobs + mockJobMessages so the chat can mutate
// status (Accept → 'accepted', Reject → 'cancelled', Get Directions →
// 'en_route') and append new vendor bubbles without touching Supabase.
//
// Real-data parity: every mutating function here corresponds to a single
// Supabase write in the non-mock branch of useJobChat. Keeping the API
// narrow (`setJobStatus`, `appendMessage`) makes that swap mechanical.
//
// Invalidation: we import the shared QueryClient and invalidate the
// relevant ['chat', ...] keys directly on every mutation. This is simpler
// than a separate subscribe/emit channel and avoids stale-data risk when
// the same screen reads from multiple cache slices.
import type {
  ChatAttachment,
  ChatMessage,
  Invoice,
  InvoiceItem,
  Job,
} from '@/features/chat/types';
import { mockInvoices } from '@/lib/mockInvoices';
import { mockJobs, MOCK_VENDOR_ID, type MockJob } from '@/lib/mockJobs';
import { mockJobMessages } from '@/lib/mockJobMessages';
import { queryClient } from '@/lib/queryClient';

// Deep-clone the seed data so mutations don't leak back into the immutable
// fixture arrays — those are reused by Home, Jobs list, summary queries.
// We store MockJob (Job + assigned_vendor_id + mock_pm_id) so mutators can
// still see the mock-only association fields.
const jobsMap = new Map<string, MockJob>(
  mockJobs.map((j) => [j.id, { ...j }]),
);

const messagesMap = new Map<string, ChatMessage[]>(
  Object.entries(mockJobMessages).map(([id, msgs]) => [id, [...msgs]]),
);

export function getMockJob(jobId: string): Job | null {
  return jobsMap.get(jobId) ?? null;
}

export function getMockMessages(jobId: string): ChatMessage[] {
  // Always return a fresh array reference so React Query's
  // structural-sharing equality treats the result as changed when we
  // invalidate. Mutating the stored array in place would otherwise
  // produce equal refs and no re-render.
  return [...(messagesMap.get(jobId) ?? [])];
}

// Phase 5: mutates the per-vendor `job_status` field — that's what the chat
// screen's action card row keys off of. The request-wide `status` column is
// left alone (it's typically driven by Ryan's backend, not by individual
// vendor actions).
export function setMockJobStatus(jobId: string, status: string): void {
  const current = jobsMap.get(jobId);
  if (!current) return;
  jobsMap.set(jobId, {
    ...current,
    job_status: status,
  });
  void queryClient.invalidateQueries({ queryKey: ['chat', 'job', jobId] });
  // Jobs list / Home recent jobs read from mockJobs directly (not from this
  // mutable map), so their queries are intentionally NOT invalidated here.
  // The Accept/Reject mutation is a chat-screen-only visual concern in mock
  // mode; full demo of "status changes propagate to Home" would require
  // wiring mockJobs to also read from jobsMap — out of scope for this task.
}

export function setMockCheckinTime(jobId: string, iso: string): void {
  const current = jobsMap.get(jobId);
  if (!current) return;
  jobsMap.set(jobId, { ...current, checkin_time: iso });
  void queryClient.invalidateQueries({ queryKey: ['chat', 'job', jobId] });
}

type AppendInput = Pick<ChatMessage, 'sender' | 'content'> & {
  id?: string;
  created_at?: string;
  attachment?: ChatAttachment;
};

export function appendMockMessage(
  jobId: string,
  msg: AppendInput,
): ChatMessage {
  const full: ChatMessage = {
    id: msg.id ?? `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    request_id: jobId,
    sender: msg.sender,
    content: msg.content,
    created_at: msg.created_at ?? new Date().toISOString(),
    ...(msg.attachment ? { attachment: msg.attachment } : {}),
  };
  const existing = messagesMap.get(jobId) ?? [];
  messagesMap.set(jobId, [...existing, full]);
  void queryClient.invalidateQueries({ queryKey: ['chat', 'messages', jobId] });
  return full;
}

// Convenience wrapper for the attachment flow: builds a vendor message
// whose body labels the attachment kind and stashes the picker result on
// the optional `attachment` field. Renderer (Bubble) picks the right
// presentation from there.
export function appendMockAttachment(
  jobId: string,
  attachment: ChatAttachment,
): ChatMessage {
  const fallback =
    attachment.kind === 'image' ? 'Photo' : (attachment.filename ?? 'Document');
  return appendMockMessage(jobId, {
    sender: 'vendor',
    content: fallback,
    attachment,
  });
}

// =============================================================================
// Invoices — mock parity for the send_invoice RPC.
// =============================================================================
// Two stores: invoicesMap keyed by invoice id, and invoiceItemsByInvoice keyed
// by invoice id → InvoiceItem[]. Seed invoices come from mockInvoices.ts —
// their items are derived from the legacy `line_items` JSONB (each `label`
// becomes a description, array index becomes sort_order) so the new
// invoice_items shape is consistent across mock + real data paths.

type InvoiceWithItems = { invoice: Invoice; items: InvoiceItem[] };

function itemsFromLegacyLineItems(
  invoice: Invoice,
): InvoiceItem[] {
  const arr = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  return arr
    .filter(
      (li): li is { label: string; amount: number } =>
        !!li &&
        typeof li === 'object' &&
        typeof (li as Record<string, unknown>).label === 'string' &&
        typeof (li as Record<string, unknown>).amount === 'number',
    )
    .map((li, idx) => ({
      id: `mock-item-${invoice.id}-${idx}`,
      invoice_id: invoice.id,
      description: li.label,
      amount: li.amount,
      sort_order: idx,
      created_at: invoice.created_at,
    }));
}

const invoicesMap = new Map<string, Invoice>(
  mockInvoices.map((inv) => [inv.id, { ...inv }]),
);

const invoiceItemsByInvoice = new Map<string, InvoiceItem[]>(
  mockInvoices.map((inv) => [inv.id, itemsFromLegacyLineItems(inv)]),
);

export function listMockInvoicesWithItemsForJob(
  jobId: string,
): InvoiceWithItems[] {
  const result: InvoiceWithItems[] = [];
  for (const inv of invoicesMap.values()) {
    if (inv.job_id !== jobId) continue;
    result.push({
      invoice: inv,
      items: invoiceItemsByInvoice.get(inv.id) ?? [],
    });
  }
  return result;
}

export function appendMockInvoice(
  jobId: string,
  items: { description: string; amount: number }[],
  notes: string | null,
): InvoiceWithItems {
  const job = jobsMap.get(jobId);
  if (!job) {
    throw new Error(`appendMockInvoice: unknown jobId ${jobId}`);
  }
  const nowIso = new Date().toISOString();
  const invoiceId = `mock-inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const total = items.reduce((acc, it) => acc + it.amount, 0);

  const invoice: Invoice = {
    id: invoiceId,
    job_id: jobId,
    vendor_id: job.assigned_vendor_id ?? MOCK_VENDOR_ID,
    kind: 'invoice',
    labor: null,
    parts: null,
    diagnostic_fee: null,
    total,
    // line_items kept for backward compat with anything reading the legacy
    // JSONB shape (Home summary totals, etc).
    line_items: items.map((it) => ({ label: it.description, amount: it.amount })),
    notes,
    description: null,
    status: 'sent',
    sent_at: nowIso,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    valid_until: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const fullItems: InvoiceItem[] = items.map((it, idx) => ({
    id: `mock-item-${invoiceId}-${idx}`,
    invoice_id: invoiceId,
    description: it.description,
    amount: it.amount,
    sort_order: idx,
    created_at: nowIso,
  }));

  invoicesMap.set(invoiceId, invoice);
  invoiceItemsByInvoice.set(invoiceId, fullItems);

  void queryClient.invalidateQueries({ queryKey: ['chat', 'invoices', jobId] });

  return { invoice, items: fullItems };
}

// Mock parity for the send_quote RPC. Same shape as appendMockInvoice except
// kind='quote' and an optional valid_until computed from expires_in_days
// (0 → null, otherwise NOW + days).
export function appendMockQuote(
  jobId: string,
  items: { description: string; amount: number }[],
  notes: string | null,
  expiresInDays: number,
): InvoiceWithItems {
  const job = jobsMap.get(jobId);
  if (!job) {
    throw new Error(`appendMockQuote: unknown jobId ${jobId}`);
  }
  const nowIso = new Date().toISOString();
  const quoteId = `mock-quote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const total = items.reduce((acc, it) => acc + it.amount, 0);

  const validUntil =
    expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
      : null;

  const quote: Invoice = {
    id: quoteId,
    job_id: jobId,
    vendor_id: job.assigned_vendor_id ?? MOCK_VENDOR_ID,
    kind: 'quote',
    labor: null,
    parts: null,
    diagnostic_fee: null,
    total,
    line_items: items.map((it) => ({ label: it.description, amount: it.amount })),
    notes,
    description: null,
    status: 'sent',
    sent_at: nowIso,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    valid_until: validUntil,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const fullItems: InvoiceItem[] = items.map((it, idx) => ({
    id: `mock-item-${quoteId}-${idx}`,
    invoice_id: quoteId,
    description: it.description,
    amount: it.amount,
    sort_order: idx,
    created_at: nowIso,
  }));

  invoicesMap.set(quoteId, quote);
  invoiceItemsByInvoice.set(quoteId, fullItems);

  void queryClient.invalidateQueries({ queryKey: ['chat', 'invoices', jobId] });

  return { invoice: quote, items: fullItems };
}
