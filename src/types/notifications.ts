// Phase 4: notification preference event types + labels.
//
// The set of keys here MUST match the JSONB default in
// supabase/schema/add-vendor-notification-prefs.sql. If a key is added or
// renamed, update both files in the same change.

export type NotificationEventType =
  | 'new_job'
  | 'client_message'
  | 'invoice_paid'
  | 'quote_accepted'
  | 'invoice_overdue'
  | 'account_status';

export type NotificationPrefs = Record<NotificationEventType, boolean>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  new_job: true,
  client_message: true,
  invoice_paid: true,
  quote_accepted: true,
  invoice_overdue: true,
  account_status: true,
};

export const EVENT_LABELS: Record<
  NotificationEventType,
  { title: string; description: string }
> = {
  new_job: {
    title: 'New job offers',
    description:
      'Get notified when a new work order matches your area and trades.',
  },
  client_message: {
    title: 'Client messages',
    description: 'Get notified when a client sends a message in chat.',
  },
  invoice_paid: {
    title: 'Payments received',
    description: 'Get notified when an invoice is marked as paid.',
  },
  quote_accepted: {
    title: 'Quote accepted',
    description: 'Get notified when a client accepts your quote.',
  },
  invoice_overdue: {
    title: 'Invoice overdue',
    description: 'Get notified when an invoice passes its due date.',
  },
  account_status: {
    title: 'Account updates',
    description:
      'Get notified about important account changes (approval, suspension, etc.).',
  },
};

// Display order for the settings screen. Kept separate from EVENT_LABELS so
// the source of truth for "which events exist" stays in the labels record
// (a missing entry there will throw at render time, surfacing the gap
// rather than silently dropping a toggle).
export const NOTIFICATION_EVENT_ORDER: readonly NotificationEventType[] = [
  'new_job',
  'client_message',
  'invoice_paid',
  'quote_accepted',
  'invoice_overdue',
  'account_status',
];

/**
 * Coerce a Json-typed `notification_prefs` cell from the DB into a strongly
 * typed NotificationPrefs, filling in any missing keys with default-ON.
 * Returns the defaults unchanged if the cell is null/undefined or not an
 * object (defensive against pre-migration rows or hand-edited cells).
 */
export function readNotificationPrefs(
  raw: unknown,
): NotificationPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
  const obj = raw as Record<string, unknown>;
  const out: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const key of NOTIFICATION_EVENT_ORDER) {
    if (typeof obj[key] === 'boolean') {
      out[key] = obj[key] as boolean;
    }
  }
  return out;
}
