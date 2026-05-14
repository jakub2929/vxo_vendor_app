// Pure function: given a Job + its messages, produce the flat list of
// TimelineItems the FlatList renders. Info cards + action card row + system
// markers are derived from jobs.* — NOT rows in job_messages. See types.ts
// for the model.
//
// Order (top → bottom):
//   1. Info card: Location
//   2. Info card: Job# / trade / description / NTE / notes
//   3. SLA banner row (only when urgency suggests a tight clock —
//      'emergency' or 'priority')
//   4. Info card: Emergency SLA (only when urgency === 'emergency')
//   5. Date separator "Today" (or formatted calendar day)
//   6. Bubbles (in created_at order), with extra date separators inserted
//      when the calendar day changes
//   7. System marker: "On site Nm" — derived from jobs.checkin_time,
//      inserted at the position matching that timestamp
//   8. System marker: "Check Out h:mm" — derived from jobs.checkout_time
//   9. Action card row (per status), OR footer marker for paid/closed/cancelled
import type {
  ActionCardSpec,
  ChatMessage,
  Job,
  TimelineItem,
} from './types';

export function actionsForStatus(status: string): ActionCardSpec[] {
  switch (status) {
    case 'new':
    case 'dispatched':
      return [{ kind: 'accept' }, { kind: 'reject' }];
    case 'accepted':
      return [
        { kind: 'get_directions' },
        { kind: 'invoice_client' },
        { kind: 'send_quote' },
        { kind: 'questions' },
      ];
    case 'en_route':
      return [
        { kind: 'get_directions', highlighted: true },
        { kind: 'invoice_client' },
        { kind: 'send_quote' },
        { kind: 'questions' },
      ];
    case 'on_site':
      return [
        { kind: 'invoice_client' },
        { kind: 'send_quote' },
        { kind: 'questions' },
      ];
    case 'complete':
      return [
        { kind: 'invoice_client' },
        { kind: 'send_quote' },
        { kind: 'questions' },
      ];
    case 'invoiced':
      // No action row for `invoiced`: by the time the job hits this state
      // the vendor has already tapped "Invoice Client" and the chat thread
      // has transitioned into the invoice-intake conversation (the
      // "We ask 3 quick questions…" alfred reply). Reintroducing
      // View Invoice / Quote / Questions here would compete with that
      // ongoing flow. Matches Figma 4:10457, bottom of the composite.
      return [];
    default:
      return [];
  }
}

function footerForStatus(
  status: string,
): { text: string; tone: 'success' | 'danger' } | null {
  if (status === 'paid' || status === 'closed') {
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
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // --- Header cards ---
  items.push({
    kind: 'info_card_location',
    id: 'card-location',
    address: job.address,
    timestamp: job.created_at ? formatTimeOfDay(job.created_at) : null,
    // Distance is injected by JobChatScreen via post-process — buildTimeline
    // is pure and has no access to GPS. See callsite for the override.
    distance: null,
  });

  items.push({
    kind: 'info_card_wo',
    id: 'card-wo',
    shortId: job.id.slice(0, 8).toUpperCase(),
    trade: prettyTrade(job.trade),
    description: job.description ?? '',
    timing: job.eta_label ?? null,
    nte: null, // schema has no NTE column today; show null until backend lands
    notes: null,
    timestamp: job.created_at ? formatTimeOfDay(job.created_at) : null,
  });

  if (job.urgency === 'emergency' || job.urgency === 'priority') {
    items.push({
      kind: 'sla_banner',
      id: 'sla-banner',
      text: slaBannerText(job),
    });
  }

  if (job.urgency === 'emergency' && job.eta_datetime) {
    items.push({
      kind: 'info_card_sla',
      id: 'card-sla',
      acceptBy: formatTimeOfDay(job.eta_datetime),
      onSiteBy: formatTimeOfDay(job.eta_datetime),
    });
  }

  // --- Messages with date separators + on-site / check-out markers ---
  // Sort defensively in case the input isn't ordered.
  const sorted = [...messages].sort((a, b) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  );

  // Mark whether we've already inserted the synthetic markers, so they
  // appear once at the right position relative to the message timeline.
  let checkinInserted = !job.checkin_time;
  let checkoutInserted = !job.checkout_time;
  let lastDayKey = '';

  // Always lead with a "Today" / day-of-first-message separator (matches
  // the Figma "Today" pill near the top of the bubbles area).
  const firstMessageIso = sorted[0]?.created_at;
  const leadIso = firstMessageIso ?? job.created_at ?? new Date().toISOString();
  items.push({
    kind: 'date_separator',
    id: `sep-${calendarDayKey(leadIso)}`,
    label: dateLabel(leadIso),
  });
  lastDayKey = calendarDayKey(leadIso);

  for (const m of sorted) {
    const dayKey = calendarDayKey(m.created_at);
    if (dayKey && dayKey !== lastDayKey) {
      items.push({
        kind: 'date_separator',
        id: `sep-${dayKey}-${m.id}`,
        label: dateLabel(m.created_at),
      });
      lastDayKey = dayKey;
    }

    if (
      !checkinInserted &&
      job.checkin_time &&
      m.created_at >= job.checkin_time
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
      m.created_at >= job.checkout_time
    ) {
      items.push({
        kind: 'system_marker',
        id: 'marker-checkout',
        text: `Check Out ${formatTimeOfDay(job.checkout_time)}`,
      });
      checkoutInserted = true;
    }

    items.push({ kind: 'bubble', id: `bubble-${m.id}`, message: m });
  }

  // Markers that fall AFTER the last message (e.g. job is on_site with no
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

  // --- Footer: action card row OR terminal-state footer marker ---
  const footer = footerForStatus(job.status);
  if (footer) {
    items.push({
      kind: 'footer_marker',
      id: 'footer',
      text: footer.text,
      tone: footer.tone,
    });
  } else {
    const actions = actionsForStatus(job.status);
    if (actions.length > 0) {
      items.push({ kind: 'action_card_row', id: 'actions', actions });
    }
  }

  return items;
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

function slaBannerText(job: Job): string {
  // Figma shows "4 Hour - 2.5 Miles Away". The hour figure is a function
  // of urgency; distance comes from GPS (not available in this pure
  // builder, so we use eta_label as a hint when present).
  const hour = job.urgency === 'emergency' ? '2 Hour' : '4 Hour';
  if (job.eta_label) return `${hour} - ${job.eta_label}`;
  return hour;
}
