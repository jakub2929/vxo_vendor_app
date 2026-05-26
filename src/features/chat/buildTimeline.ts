// Pure function: given a Job + its messages, produce the flat list of
// TimelineItems the FlatList renders. Info cards + action card row + system
// markers are derived from job.* — NOT rows in job_messages. See types.ts
// for the model.
//
// Order (top → bottom):
//   1. Info card: Location
//   2. Info card: job number / trade / description / NTE / notes
//   3. SLA banner row (only when priority suggests a tight clock —
//      'High' or 'Medium')
//   4. Info card: Emergency SLA (only when priority === 'High')
//   5. Date separator "Today" (or formatted calendar day)
//   6. Bubbles (in created_at order), with extra date separators inserted
//      when the calendar day changes
//   7. System marker: "On site Nm" — derived from job.checkin_time,
//      inserted at the position matching that timestamp
//   8. System marker: "Check Out h:mm" — derived from job.checkout_time
//   9. Action card row (per job_status), OR footer marker for completed/
//      cancelled terminal states
//
// Phase 5: action/footer decisions key off the per-vendor request_vendors.
// job_status, which we expose on Job as `job_status`. The high-level
// vendor_requests.status is NOT used here — it's a request-wide rollup
// owned by the dispatcher backend, while the action card is about THIS
// vendor's lifecycle. Status enum values: pending | in_progress |
// on_the_way | arrived | working | completed | cancelled.
import { formatJobNumber } from '@/utils/formatters';
import type {
  ActionCardSpec,
  ChatMessage,
  ClientEmbed,
  Invoice,
  InvoiceItem,
  Job,
  TimelineItem,
} from './types';

export function actionsForStatus(status: string | null): ActionCardSpec[] {
  switch (status) {
    case 'pending':
      return [{ kind: 'accept' }, { kind: 'reject' }];
    case 'in_progress':
      return [
        { kind: 'get_directions' },
        { kind: 'manual_arrival' },
        { kind: 'invoice_client' },
        { kind: 'send_quote' },
        { kind: 'questions' },
      ];
    case 'on_the_way':
      return [
        { kind: 'get_directions', highlighted: true },
        { kind: 'manual_arrival' },
        { kind: 'invoice_client' },
        { kind: 'send_quote' },
        { kind: 'questions' },
      ];
    case 'arrived':
    case 'working':
      return [
        { kind: 'invoice_client' },
        { kind: 'send_quote' },
        { kind: 'questions' },
        { kind: 'complete_job' },
      ];
    case 'completed':
    case 'cancelled':
      // Terminal — footer marker handles these states, no action row.
      return [];
    default:
      return [];
  }
}

function footerForStatus(
  status: string | null,
): { text: string; tone: 'success' | 'danger' } | null {
  if (status === 'completed') {
    return { text: 'Job complete', tone: 'success' };
  }
  if (status === 'cancelled') {
    return { text: 'Job cancelled', tone: 'danger' };
  }
  return null;
}

function calendarDayKey(iso: string): string {
  // YYYY-MM-DD in local time. Matches what the date separator label is
  // computed from, so two messages with different keys get separated.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  if (calendarDayKey(iso) === calendarDayKey(today.toISOString())) {
    return 'Today';
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (calendarDayKey(iso) === calendarDayKey(yesterday.toISOString())) {
    return 'Yesterday';
  }
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeOfDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Match the Figma copy "Check Out 9:41" — no leading zero on hour, 12h.
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}${ampm === 'PM' ? 'PM' : 'AM'}`;
}

// Reference point for the on-site duration: checkout_time if the vendor has
// already checked out (matches Figma's "On site 35 minutes" for a completed
// visit), otherwise the current clock. Capped at 8h so demo fixtures with
// historical checkin_time values (e.g. Marcus, anchored to 2026-05-09) don't
// render absurd "On site 5760 minutes" strings.
function minutesOnSite(
  checkinIso: string,
  checkoutIso: string | null,
): number | null {
  const start = new Date(checkinIso).getTime();
  if (Number.isNaN(start)) return null;
  const end = checkoutIso ? new Date(checkoutIso).getTime() : Date.now();
  if (Number.isNaN(end) || end < start) return null;
  const minutes = Math.round((end - start) / 60_000);
  if (minutes > 480) return null;
  return minutes;
}

function onSiteMarkerText(
  checkinIso: string,
  checkoutIso: string | null,
): string {
  const m = minutesOnSite(checkinIso, checkoutIso);
  return m == null ? 'On site' : `On site ${m} minutes`;
}

export function buildTimeline(
  job: Job,
  messages: ChatMessage[],
  invoiceCards: { invoice: Invoice; items: InvoiceItem[] }[] = [],
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // --- Header cards ---
  items.push({
    kind: 'info_card_location',
    id: 'card-location',
    address: job.location ?? '',
    timestamp: job.created_at ? formatTimeOfDay(job.created_at) : null,
    // Distance is injected by JobChatScreen via post-process — buildTimeline
    // is pure and has no access to GPS. See callsite for the override.
    distance: null,
    customerFirstName: firstNameOfClient(job.client),
  });

  items.push({
    kind: 'info_card_wo',
    id: 'card-wo',
    shortId: formatJobNumber(job.id),
    trade: prettyTrade(job.service_type),
    description: job.description ?? '',
    timing: job.eta_label ?? null,
    nte: null, // schema has no NTE column today; show null until backend lands
    notes: null,
    // dispatch_fee was dropped in the Phase 5 rename — show null until the
    // replacement column lands.
    dispatchFee: null,
    timestamp: job.created_at ? formatTimeOfDay(job.created_at) : null,
  });

  if (job.priority === 'High' || job.priority === 'Medium') {
    items.push({
      kind: 'sla_banner',
      id: 'sla-banner',
      text: slaBannerText(job),
    });
  }

  if (job.priority === 'High' && job.eta_datetime) {
    items.push({
      kind: 'info_card_sla',
      id: 'card-sla',
      acceptBy: formatTimeOfDay(job.eta_datetime),
      onSiteBy: formatTimeOfDay(job.eta_datetime),
    });
  }

  // --- Messages + invoice cards with date separators + on-site / check-out markers ---
  // Unified chronological event stream so invoice cards interleave with
  // bubbles by timestamp (sent_at preferred, falling back to created_at).
  type Event =
    | { iso: string; kind: 'message'; message: ChatMessage }
    | {
        iso: string;
        kind: 'invoice';
        invoice: Invoice;
        items: InvoiceItem[];
      };

  const events: Event[] = [
    ...messages.map((m) => ({
      iso: m.created_at ?? '',
      kind: 'message' as const,
      message: m,
    })),
    ...invoiceCards.map((c) => ({
      iso:
        c.invoice.sent_at ??
        c.invoice.created_at ??
        new Date().toISOString(),
      kind: 'invoice' as const,
      invoice: c.invoice,
      items: c.items,
    })),
  ].sort((a, b) => a.iso.localeCompare(b.iso));

  let checkinInserted = !job.checkin_time;
  let checkoutInserted = !job.checkout_time;
  let lastDayKey = '';

  const firstEventIso = events[0]?.iso;
  const leadIso = firstEventIso ?? job.created_at ?? new Date().toISOString();
  items.push({
    kind: 'date_separator',
    id: `sep-${calendarDayKey(leadIso)}`,
    label: dateLabel(leadIso),
  });
  lastDayKey = calendarDayKey(leadIso);

  for (const e of events) {
    const eventId = e.kind === 'message' ? e.message.id : e.invoice.id;
    const dayKey = calendarDayKey(e.iso);
    if (dayKey && dayKey !== lastDayKey) {
      items.push({
        kind: 'date_separator',
        id: `sep-${dayKey}-${eventId}`,
        label: dateLabel(e.iso),
      });
      lastDayKey = dayKey;
    }

    if (
      !checkinInserted &&
      job.checkin_time &&
      e.iso >= job.checkin_time
    ) {
      items.push({
        kind: 'system_marker',
        id: 'marker-onsite',
        text: onSiteMarkerText(job.checkin_time, job.checkout_time),
      });
      checkinInserted = true;
    }

    if (
      !checkoutInserted &&
      job.checkout_time &&
      e.iso >= job.checkout_time
    ) {
      items.push({
        kind: 'system_marker',
        id: 'marker-checkout',
        text: `Check Out ${formatTimeOfDay(job.checkout_time)}`,
      });
      checkoutInserted = true;
    }

    if (e.kind === 'message') {
      items.push({ kind: 'bubble', id: `bubble-${e.message.id}`, message: e.message });
    } else {
      items.push({
        kind: 'invoice_card',
        id: `invoice-${e.invoice.id}`,
        invoice: e.invoice,
        items: e.items,
      });
    }
  }

  // Markers that fall AFTER the last message (e.g. job is arrived with no
  // messages yet after check-in) still need to render.
  if (!checkinInserted && job.checkin_time) {
    items.push({
      kind: 'system_marker',
      id: 'marker-onsite',
      text: onSiteMarkerText(job.checkin_time, job.checkout_time),
    });
  }
  if (!checkoutInserted && job.checkout_time) {
    items.push({
      kind: 'system_marker',
      id: 'marker-checkout',
      text: `Check Out ${formatTimeOfDay(job.checkout_time)}`,
    });
  }

  // --- Invoice status confirmation marker ---
  // While job_status === 'completed' AND an invoice exists, splice in a
  // system-marker confirmation for the latest invoice's settlement state.
  // Derived purely from the latest non-quote invoice's status. Spliced in
  // right after its InvoiceCard so the read order is card → confirmation.
  if (job.job_status === 'completed') {
    const latest = latestNonQuoteInvoice(invoiceCards);
    if (latest) {
      const text = invoiceStatusMarkerText(latest.status);
      if (text) {
        const cardId = `invoice-${latest.id}`;
        const cardIdx = items.findIndex(
          (it) => it.kind === 'invoice_card' && it.id === cardId,
        );
        if (cardIdx >= 0) {
          items.splice(cardIdx + 1, 0, {
            kind: 'system_marker',
            id: `marker-invoice-status-${latest.id}`,
            text,
          });
        }
      }
    }
  }

  // --- Footer: action card row OR terminal-state footer marker ---
  const footer = footerForStatus(job.job_status);
  if (footer) {
    items.push({
      kind: 'footer_marker',
      id: 'footer',
      text: footer.text,
      tone: footer.tone,
    });
  } else {
    const actions = actionsForStatus(job.job_status);
    if (actions.length > 0) {
      items.push({ kind: 'action_card_row', id: 'actions', actions });
    }
  }

  return items;
}

// The chat surface only shows the customer's first name — full identity
// stays out of the vendor UI per the privacy contract.
export function firstNameOfClient(client: ClientEmbed | null): string | null {
  if (!client) return null;
  const first = (client.first_name ?? '').trim();
  return first.length > 0 ? first : null;
}

// Backwards-compatible helper kept for the few callsites that still pass a
// pre-joined string (search results, etc).
export function firstNameOf(name: string | null): string | null {
  if (!name) return null;
  const first = name.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

// Derive a display "Full Name" from an embedded client. Returns null when
// both name parts are missing.
export function fullNameOfClient(client: ClientEmbed | null): string | null {
  if (!client) return null;
  const joined = [client.first_name, client.last_name]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join(' ')
    .trim();
  return joined.length > 0 ? joined : null;
}

function prettyTrade(slug: string): string {
  // Inverse of the trade slugs used in mockJobs / Supabase. Title-case with
  // the few special cases ('hvac' → 'HVAC') the rest of the app uses.
  if (slug === 'hvac') return 'HVAC';
  return slug
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

// Pick the invoice (kind !== 'quote') most likely to represent the job's
// current invoicing state — latest by sent_at, falling back to created_at.
// Returns null if the job has only quotes or no invoices at all.
function latestNonQuoteInvoice(
  invoiceCards: { invoice: Invoice; items: InvoiceItem[] }[],
): Invoice | null {
  let best: Invoice | null = null;
  let bestKey = '';
  for (const { invoice } of invoiceCards) {
    if (invoice.kind === 'quote') continue;
    const key = invoice.sent_at ?? invoice.created_at ?? '';
    if (best === null || key.localeCompare(bestKey) > 0) {
      best = invoice;
      bestKey = key;
    }
  }
  return best;
}

// Maps invoice.status → textual confirmation shown as a system marker.
// Returns null for statuses that get no marker.
function invoiceStatusMarkerText(status: string): string | null {
  switch (status) {
    case 'sent':
    case 'viewed':
      return 'Invoice sent — awaiting client approval';
    case 'approved':
      return 'Invoice approved by client';
    case 'paid':
      return 'Payment received ✓';
    case 'rejected':
      return 'Invoice declined by client';
    default:
      return null;
  }
}

function slaBannerText(job: Job): string {
  // Figma shows "4 Hour - 2.5 Miles Away". The hour figure is a function
  // of priority; distance comes from GPS (not available in this pure
  // builder, so we use eta_label as a hint when present).
  const hour = job.priority === 'High' ? '2 Hour' : '4 Hour';
  if (job.eta_label) return `${hour} - ${job.eta_label}`;
  return hour;
}
