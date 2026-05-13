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
import type { ChatAttachment, ChatMessage, Job } from '@/features/chat/types';
import { mockJobs } from '@/lib/mockJobs';
import { mockJobMessages } from '@/lib/mockJobMessages';
import { queryClient } from '@/lib/queryClient';

// Deep-clone the seed data so mutations don't leak back into the immutable
// fixture arrays — those are reused by Home, Jobs list, summary queries.
const jobsMap = new Map<string, Job>(
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

export function setMockJobStatus(jobId: string, status: Job['status']): void {
  const current = jobsMap.get(jobId);
  if (!current) return;
  jobsMap.set(jobId, {
    ...current,
    status,
    updated_at: new Date().toISOString(),
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
    job_id: jobId,
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
