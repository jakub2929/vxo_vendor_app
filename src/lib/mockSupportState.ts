// In-memory store for the Support chat threads when USE_MOCKS is on. Mirrors
// the shape of mockChatState.ts but scoped by ThreadType, not job_id — there's
// one mock vendor in mock mode and the two threads (current_job / general)
// are addressed directly by their type.
//
// Seed data sets the conversational tone for each thread so the empty state
// is exercised in just one (general) — current_job ships with a couple of
// support replies so the unread badge + last-message preview have something
// to render against in dev.
import type {
  SupportMessage,
  ThreadType,
} from '@/features/support/useSupportThread';

const MOCK_VENDOR_ID = '00000000-0000-0000-0000-000000000001';

const currentJobSeed: SupportMessage[] = [
  {
    id: 'support-cj-001',
    vendor_id: MOCK_VENDOR_ID,
    thread_type: 'current_job',
    sender: 'system',
    message: 'How can VXO help you with your current job?',
    job_id: null,
    created_at: '2026-05-12T09:00:00Z',
  },
  {
    id: 'support-cj-002',
    vendor_id: MOCK_VENDOR_ID,
    thread_type: 'current_job',
    sender: 'vendor',
    message: 'The breaker panel access is behind a locked door — client not answering.',
    job_id: null,
    created_at: '2026-05-12T09:05:00Z',
  },
  {
    id: 'support-cj-003',
    vendor_id: MOCK_VENDOR_ID,
    thread_type: 'current_job',
    sender: 'support',
    message:
      "We reached the property manager. They're sending a key in ~15 min. Stay on site.",
    job_id: null,
    created_at: '2026-05-12T09:09:00Z',
  },
];

const generalSeed: SupportMessage[] = [];

const messagesMap = new Map<ThreadType, SupportMessage[]>([
  ['current_job', [...currentJobSeed]],
  ['general', [...generalSeed]],
]);

export function getMockSupportMessages(
  threadType: ThreadType,
): SupportMessage[] {
  // Fresh array reference each call so consumers using identity checks
  // (React Query, useState selectors) treat updates as changed.
  return [...(messagesMap.get(threadType) ?? [])];
}

export function getMockSupportLatest(
  threadType: ThreadType,
): SupportMessage | null {
  const msgs = messagesMap.get(threadType);
  if (!msgs || msgs.length === 0) return null;
  return msgs[msgs.length - 1];
}

type AppendInput = {
  id?: string;
  sender: SupportMessage['sender'];
  message: string;
  created_at?: string;
};

export function appendMockSupportMessage(
  threadType: ThreadType,
  input: AppendInput,
): SupportMessage {
  const full: SupportMessage = {
    id:
      input.id ??
      `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    vendor_id: MOCK_VENDOR_ID,
    thread_type: threadType,
    sender: input.sender,
    message: input.message,
    job_id: null,
    created_at: input.created_at ?? new Date().toISOString(),
  };
  const existing = messagesMap.get(threadType) ?? [];
  messagesMap.set(threadType, [...existing, full]);
  return full;
}
