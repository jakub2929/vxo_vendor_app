import { colors } from '@/theme';
import type { JobStatus } from '@/features/home/useHomeData';

// Per Figma node 4:10443 ("Home Page Open Work Orders"):
//   - Row 1 (HVAC, fresh dispatch):     headline red, blue avatar dot, "Check in here when you are on"
//   - Row 2 (Plumbing, in-progress):    headline red, grey avatar dot,  "Tech is arriving in 1 -3 Hours"
//   - Row 3 (Plumbing, scheduled):      headline red ("This Week"),     "You Confirmed Tuesday 10AM."
//   - Row 4 (Plumbing, completed):      headline green ("Completed"),   "Invoice Sent"
//   - Row 5 (Plumbing, paid):           headline green ("Completed"),   "Invoice Paid"
//
// Mapped to our 7 active job statuses + cancelled. Where the Figma examples
// don't cover a status, copy is extrapolated — flag for Ryan if any reads
// wrong. Distance/ETA composition lives in JobRow; this file only provides
// the static parts.
export type DotVariant = 'online' | 'offline';

export type JobStatusMeta = {
  /** Color for the colored status line (red for active/urgent, green for done). */
  headlineColor: string;
  /**
   * If non-null, render this literal text as the headline and skip the
   * eta/distance composition. Used for terminal states (Completed) where
   * a count or distance would be irrelevant.
   */
  literalHeadline: string | null;
  /** Grey subtitle below the headline. Empty string = subtitle row hidden. */
  subtitle: string;
  /**
   * Status dot under the avatar. 'online' = blue (#246BFD), the fresh-dispatch
   * indicator; 'offline' = grey (#BDBDBD), used for every later state.
   */
  dotVariant: DotVariant;
};

// Figma's `text-[red]` literal renders as #FF0000, not the theme's danger
// token (#E31D1C). Keep parity with Figma; can swap to colors.status.danger
// later if brand asks.
const FIGMA_RED = '#FF0000';

export function jobStatusMeta(status: JobStatus): JobStatusMeta {
  switch (status) {
    case 'new':
    case 'dispatched':
      return {
        headlineColor: FIGMA_RED,
        literalHeadline: null,
        subtitle: 'Check in here when you are on',
        dotVariant: 'online',
      };
    case 'accepted':
      return {
        headlineColor: FIGMA_RED,
        literalHeadline: null,
        subtitle: 'Tech is arriving in 1 -3 Hours',
        dotVariant: 'offline',
      };
    case 'en_route':
      return {
        headlineColor: colors.accent.orange,
        literalHeadline: 'En route',
        subtitle: 'You Confirmed your route — on the way',
        dotVariant: 'offline',
      };
    case 'on_site':
      return {
        headlineColor: colors.status.success,
        literalHeadline: 'On site',
        subtitle: 'Check out when work is complete',
        dotVariant: 'offline',
      };
    case 'complete':
      return {
        headlineColor: colors.status.success,
        literalHeadline: 'Work complete',
        subtitle: 'Generate quote or invoice',
        dotVariant: 'offline',
      };
    case 'invoiced':
      return {
        headlineColor: colors.status.success,
        literalHeadline: 'Completed',
        subtitle: 'Invoice Sent',
        dotVariant: 'offline',
      };
    case 'paid':
      return {
        headlineColor: colors.status.success,
        literalHeadline: 'Completed',
        subtitle: 'Invoice Paid',
        dotVariant: 'offline',
      };
    case 'closed':
      return {
        headlineColor: colors.text.tertiary,
        literalHeadline: 'Closed',
        subtitle: '',
        dotVariant: 'offline',
      };
    case 'cancelled':
      return {
        headlineColor: colors.text.tertiary,
        literalHeadline: 'Cancelled',
        subtitle: '',
        dotVariant: 'offline',
      };
  }
}

const TRADE_OVERRIDES: Record<string, string> = {
  hvac: 'HVAC',
};

export function tradeLabel(trade: string): string {
  if (TRADE_OVERRIDES[trade]) return TRADE_OVERRIDES[trade];
  return trade
    .split('_')
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

// Figma timestamps render as "20.00" / "18:39" — using colon form for
// universality. Today → HH:mm. Yesterday → "Yesterday". Within last week →
// short weekday. Older → "M/D".
export function formatRowTimestamp(iso: string): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const now = new Date();
  const sameDay =
    t.getFullYear() === now.getFullYear() &&
    t.getMonth() === now.getMonth() &&
    t.getDate() === now.getDate();
  if (sameDay) {
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    t.getFullYear() === yesterday.getFullYear() &&
    t.getMonth() === yesterday.getMonth() &&
    t.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';
  const diffDays = Math.floor((now.getTime() - t.getTime()) / 86_400_000);
  if (diffDays >= 0 && diffDays < 7) {
    return t.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return `${t.getMonth() + 1}/${t.getDate()}`;
}
