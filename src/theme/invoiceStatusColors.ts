// Invoice / quote status color tables — single source of truth for
// JobChatTimelineItems (chat bubbles), EarningsCard (earnings tab pills),
// and HomeJobRow (recent-jobs amount color).
//
// Three tables intentionally — they encode three different palettes:
//   - INVOICE_STATUS_BADGE: invoice bubble in chat + invoice pill in earnings.
//     Darker grays (#424242) for terminal states, red badge for "Declined".
//   - QUOTE_STATUS_BADGE: quote bubble + quote pill. "Pending" while waiting
//     (orange), "Accepted ✓" green once client accepts.
//   - INVOICE_AMOUNT_COLOR: just the amount-text color on the HomeJobRow.
//     Softer gray (#9E9E9E) for terminal states because the amount is the
//     dominant element on a row — a darker color would shout.
//
// If the design system later collapses these to a single palette, this file
// is the one place to change.
import type { InvoiceStatus } from '@/features/home/useHomeData';

export type BadgeStyle = { label: string; bg: string; fg: string };

export const INVOICE_STATUS_BADGE: Record<string, BadgeStyle> = {
  draft:     { label: 'Draft',     bg: '#E0E0E0', fg: '#424242' },
  sent:      { label: 'Sent',      bg: '#E3F2FD', fg: '#1565C0' },
  viewed:    { label: 'Viewed',    bg: '#E3F2FD', fg: '#1565C0' },
  approved:  { label: 'Approved',  bg: '#E8F5E9', fg: '#2E7D32' },
  paid:      { label: 'Paid ✓',    bg: '#E8F5E9', fg: '#2E7D32' },
  overdue:   { label: 'Overdue',   bg: '#FFEBEE', fg: '#C62828' },
  rejected:  { label: 'Declined',  bg: '#FFEBEE', fg: '#C62828' },
  cancelled: { label: 'Cancelled', bg: '#E0E0E0', fg: '#424242' },
};

export const QUOTE_STATUS_BADGE: Record<string, BadgeStyle> = {
  draft:     { label: 'Draft',      bg: '#E0E0E0', fg: '#424242' },
  sent:      { label: 'Pending',    bg: '#FFF3E0', fg: '#E65100' },
  viewed:    { label: 'Pending',    bg: '#FFF3E0', fg: '#E65100' },
  accepted:  { label: 'Accepted ✓', bg: '#E8F5E9', fg: '#2E7D32' },
  approved:  { label: 'Accepted ✓', bg: '#E8F5E9', fg: '#2E7D32' },
  rejected:  { label: 'Declined',   bg: '#FFEBEE', fg: '#C62828' },
  expired:   { label: 'Expired',    bg: '#E0E0E0', fg: '#424242' },
  cancelled: { label: 'Cancelled',  bg: '#E0E0E0', fg: '#424242' },
};

// Per Ryan's call (Phase 3):
//   green   — money received or invoice commitment ('paid', 'approved')
//   blue    — in flight / agreed but no money yet ('sent', 'viewed', 'accepted')
//   red     — actionable, needs vendor follow-up ('overdue')
//   gray    — terminal or pre-send, no action ('draft', 'rejected',
//             'cancelled', 'expired')
export const INVOICE_AMOUNT_COLOR: Record<InvoiceStatus, string> = {
  paid: '#2E7D32',
  approved: '#2E7D32',
  sent: '#1565C0',
  viewed: '#1565C0',
  accepted: '#1565C0',
  overdue: '#C62828',
  draft: '#9E9E9E',
  rejected: '#9E9E9E',
  cancelled: '#9E9E9E',
  expired: '#9E9E9E',
};
