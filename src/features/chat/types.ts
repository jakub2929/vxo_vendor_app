// Types for the Job Chat detail screen (Figma node 4:10092).
//
// Three layers:
//   1. ChatMessage — a row in `job_messages` (real Supabase table). Only
//      free-text bubbles + a small set of system markers persist as rows.
//   2. ActionCardSpec — which action card buttons to render. Derived
//      client-side from `jobs.status`, not stored.
//   3. TimelineItem — the FlatList renderer's flat item type. Mixes
//      info cards (derived from jobs.*), bubbles (from job_messages),
//      system markers, and action card rows.
import type { Database } from '@/types/database';

export type Job = Database['public']['Tables']['jobs']['Row'];

// Sender values used by the renderer. The DB column is `string` (unconstrained),
// so this is a client-side narrowing — cast at the data-layer boundary.
export type ChatSender = 'client' | 'vendor' | 'alfred' | 'admin' | 'system';

// Attachment metadata for mock-only image / document messages. The real
// `job_messages` table has no attachment columns yet — the real flow will
// instead upload to Supabase Storage and put the URL in `content` (or add
// columns). For now this lives on the in-memory mock shape only; the Bubble
// renderer reads it when present and falls back to text otherwise.
export type ChatAttachment =
  | { kind: 'image'; uri: string; filename?: string }
  | { kind: 'document'; uri: string; filename?: string };

export type ChatMessage = {
  id: string;
  job_id: string;
  sender: ChatSender;
  content: string;
  created_at: string;
  attachment?: ChatAttachment;
};

export type ActionCardSpec =
  | { kind: 'accept' }
  | { kind: 'reject' }
  | { kind: 'get_directions'; highlighted?: boolean }
  | { kind: 'invoice_client' }
  | { kind: 'send_quote' }
  | { kind: 'questions' }
  | { kind: 'view_invoice' };

export type TimelineItem =
  | { kind: 'date_separator'; id: string; label: string }
  | { kind: 'sla_banner'; id: string; text: string }
  | {
      kind: 'info_card_location';
      id: string;
      address: string;
      timestamp: string | null;
      // Straight-line miles from vendor GPS → job coords. Populated at render
      // time in JobChatScreen (buildTimeline stays pure), null when GPS is
      // unavailable or job has no coordinates.
      distance: number | null;
    }
  | {
      kind: 'info_card_wo';
      id: string;
      shortId: string;
      trade: string;
      description: string;
      timing: string | null;
      nte: number | null;
      notes: string | null;
      timestamp: string | null;
    }
  | { kind: 'info_card_sla'; id: string; acceptBy: string; onSiteBy: string }
  | { kind: 'bubble'; id: string; message: ChatMessage }
  | { kind: 'system_marker'; id: string; text: string }
  | { kind: 'action_card_row'; id: string; actions: ActionCardSpec[] }
  | { kind: 'footer_marker'; id: string; text: string; tone: 'success' | 'danger' };
