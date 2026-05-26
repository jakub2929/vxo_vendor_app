// Types for the Job Chat detail screen (Figma node 4:10092).
//
// Three layers:
//   1. ChatMessage — a row in `job_messages` (real Supabase table). Only
//      free-text bubbles + a small set of system markers persist as rows.
//   2. ActionCardSpec — which action card buttons to render. Derived
//      client-side from the vendor's per-job state, not stored.
//   3. TimelineItem — the FlatList renderer's flat item type. Mixes
//      info cards (derived from request fields), bubbles (from job_messages),
//      system markers, and action card rows.
//
// Phase 5: the underlying row is now `vendor_requests` (renamed from `jobs`).
// Action-card / list state lives on `request_vendors.job_status` (per-vendor
// M2M join), which we surface here as Job.job_status. The high-level request
// state (`vendor_requests.status`) is intentionally NOT exposed — UI cares
// about the per-vendor lifecycle, not the request-wide rollup.
import type { Database } from '@/types/database';

type RequestRow = Database['public']['Tables']['vendor_requests']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export type ClientEmbed = Pick<
  ProfileRow,
  'first_name' | 'last_name' | 'phone' | 'email'
>;

// Synthetic shape returned by useJob/useJobsList/etc. — the request row plus
// the per-vendor job_status pulled out of request_vendors, plus an embedded
// client profile for display. Consumers should treat job_status as the
// authoritative lifecycle state.
export type Job = RequestRow & {
  job_status: string | null;
  client: ClientEmbed | null;
};

export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row'];

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
  // request_id is the new primary FK on job_messages. The field is named
  // `request_id` to match the column; renderer code threads it as the
  // conversation key in place of the legacy job_id.
  request_id: string;
  sender: ChatSender;
  content: string;
  created_at: string;
  attachment?: ChatAttachment;
};

export type ActionCardSpec =
  | { kind: 'accept' }
  | { kind: 'reject' }
  | { kind: 'get_directions'; highlighted?: boolean }
  | { kind: 'manual_arrival' }
  | { kind: 'invoice_client' }
  | { kind: 'send_quote' }
  | { kind: 'questions' }
  | { kind: 'complete_job' };

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
      // unavailable or the job has no coordinates.
      distance: number | null;
      // First name only of the client. Privacy/contract: vendors see who the
      // customer is for personalization but not the full identity.
      customerFirstName: string | null;
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
      dispatchFee: number | null;
      timestamp: string | null;
    }
  | { kind: 'info_card_sla'; id: string; acceptBy: string; onSiteBy: string }
  | { kind: 'bubble'; id: string; message: ChatMessage }
  | { kind: 'system_marker'; id: string; text: string }
  | { kind: 'action_card_row'; id: string; actions: ActionCardSpec[] }
  | {
      kind: 'invoice_card';
      id: string;
      invoice: Invoice;
      items: InvoiceItem[];
    }
  | { kind: 'footer_marker'; id: string; text: string; tone: 'success' | 'danger' };
