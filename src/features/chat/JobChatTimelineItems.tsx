// Renderer primitives for the Job Chat timeline. One component per
// TimelineItem `kind`. All visual constants come from Figma node 4:10092 —
// see Phase 0 discovery notes for the per-element mapping.
//
// Bubble corner radii (asymmetric, from Figma):
//   - Incoming (grey, left):  tl=8,  tr=20, br=20, bl=20  → top-left tail
//   - Outgoing (blue, right): tl=20, tr=20, br=8,  bl=20  → bottom-right tail
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCheck, FileText } from 'lucide-react-native';
import { formatDistance } from '@/lib/geo';
import { colors, shadows, typography } from '@/theme';
import type {
  ActionCardSpec,
  ChatMessage,
  Invoice,
  InvoiceItem,
  TimelineItem,
} from './types';

// ---------- Date separator ("Today" pill) ----------

export function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.dateSepRow}>
      <View style={styles.dateSepPill}>
        <Text style={styles.dateSepText}>{label}</Text>
      </View>
    </View>
  );
}

// ---------- SLA red banner ("4 Hour - 2.5 Miles Away") ----------

export function SLABanner({ text }: { text: string }) {
  return (
    <View style={styles.slaBannerRow}>
      <Text style={styles.slaBannerText}>{text}</Text>
    </View>
  );
}

// ---------- Info cards (Location / WO / SLA) ----------
//
// All three share the grey-card chrome (#F5F5F5 bg, asymmetric radius like
// an incoming bubble, padding 16/24). Only the body differs.

function InfoCardShell({
  children,
  timestamp,
}: {
  children: React.ReactNode;
  timestamp?: string | null;
}) {
  return (
    <View style={styles.bubbleRowLeft}>
      <View style={[styles.bubble, styles.bubbleIncoming, styles.infoCard]}>
        <View style={styles.infoCardBody}>{children}</View>
        {timestamp ? (
          <Text style={styles.bubbleTimestampLeft}>{timestamp}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function InfoCardLocation({
  address,
  timestamp,
  distance,
  customerFirstName,
}: {
  address: string;
  timestamp: string | null;
  distance: number | null;
  customerFirstName: string | null;
}) {
  return (
    <InfoCardShell timestamp={timestamp}>
      <Text style={styles.infoCardLine}>
        <Text style={styles.infoCardTitle}>📍 Location</Text>
      </Text>
      {customerFirstName ? (
        <Text style={styles.infoCardLine}>👤 Customer {customerFirstName}</Text>
      ) : null}
      <Text style={styles.infoCardLine}>{address}</Text>
      {distance != null && (
        <Text style={styles.infoCardLine}>{formatDistance(distance)} away</Text>
      )}
    </InfoCardShell>
  );
}

export function InfoCardWO({
  shortId,
  trade,
  description,
  timing,
  nte,
  notes,
  dispatchFee,
  timestamp,
}: {
  shortId: string;
  trade: string;
  description: string;
  timing: string | null;
  nte: number | null;
  notes: string | null;
  dispatchFee: number | null;
  timestamp: string | null;
}) {
  return (
    <InfoCardShell timestamp={timestamp}>
      <Text style={styles.infoCardLine}>
        <Text style={styles.infoCardTitle}>🗒 {shortId}</Text>
      </Text>
      <Text style={styles.infoCardLine}>
        🗒 {trade}
        {description ? ` — ${description}` : ''}
      </Text>
      {timing ? <Text style={styles.infoCardLine}>⚡ {timing}</Text> : null}
      {nte != null ? (
        <Text style={styles.infoCardLine}>💰 NTE ${nte}</Text>
      ) : null}
      {dispatchFee != null ? (
        <Text style={styles.infoCardLine}>💵 Dispatch fee ${dispatchFee.toFixed(2)}</Text>
      ) : null}
      {notes ? <Text style={styles.infoCardLine}>🗓 {notes}</Text> : null}
    </InfoCardShell>
  );
}

export function InfoCardSLA({
  acceptBy,
  onSiteBy,
}: {
  acceptBy: string;
  onSiteBy: string;
}) {
  return (
    <InfoCardShell>
      <Text style={styles.infoCardLine}>
        <Text style={styles.infoCardTitle}>⚡ Emergency SLA</Text>
      </Text>
      <Text style={styles.infoCardLine}>Accept by {acceptBy}</Text>
      <Text style={styles.infoCardLine}>On site by {onSiteBy}</Text>
    </InfoCardShell>
  );
}

// ---------- Bubble (vendor right / others left) ----------

function timeOfDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function AttachmentBlock({
  attachment,
  isVendor,
}: {
  attachment: NonNullable<ChatMessage['attachment']>;
  isVendor: boolean;
}) {
  if (attachment.kind === 'image') {
    return (
      <Image
        source={{ uri: attachment.uri }}
        style={styles.attachmentImage}
        resizeMode="cover"
        accessibilityLabel="Attached photo"
      />
    );
  }
  // document
  return (
    <View style={styles.attachmentDoc}>
      <FileText
        size={20}
        color={isVendor ? '#FFFFFF' : colors.text.primary}
      />
      <Text
        style={isVendor ? styles.attachmentDocTextVendor : styles.attachmentDocText}
        numberOfLines={1}
      >
        {attachment.filename ?? 'Document'}
      </Text>
    </View>
  );
}

export function Bubble({ message }: { message: ChatMessage }) {
  if (message.sender === 'system') {
    return (
      <View style={styles.bubbleRowLeft}>
        <View style={[styles.bubble, styles.bubbleIncoming]}>
          <Text style={styles.bubbleTextIncoming}>{message.content}</Text>
        </View>
      </View>
    );
  }
  const isVendor = message.sender === 'vendor';
  const stamp = timeOfDay(message.created_at);
  const hasImage = message.attachment?.kind === 'image';
  // For image attachments we hide the placeholder "Photo" text body — the
  // image speaks for itself. Documents keep the filename row in addition to
  // the icon row, which carries the same filename — feel free to drop the
  // text body for documents too if the Figma is clearer that way.
  const showTextBody = !hasImage && message.content.length > 0;

  if (isVendor) {
    return (
      <View style={styles.bubbleRowRight}>
        <View
          style={[
            styles.bubble,
            styles.bubbleVendor,
            hasImage && styles.bubbleWithImage,
          ]}
        >
          {message.attachment ? (
            <AttachmentBlock attachment={message.attachment} isVendor />
          ) : null}
          {showTextBody ? (
            <Text style={styles.bubbleTextVendor}>{message.content}</Text>
          ) : null}
          <View style={styles.bubbleFooterRight}>
            <Text style={styles.bubbleTimestampRight}>{stamp}</Text>
            <CheckCheck size={16} color={colors.divider.base} />
          </View>
        </View>
      </View>
    );
  }
  // client / alfred / admin — incoming, left-aligned
  return (
    <View style={styles.bubbleRowLeft}>
      <View
        style={[
          styles.bubble,
          styles.bubbleIncoming,
          hasImage && styles.bubbleWithImage,
        ]}
      >
        {message.attachment ? (
          <AttachmentBlock attachment={message.attachment} isVendor={false} />
        ) : null}
        {showTextBody ? (
          <Text style={styles.bubbleTextIncoming}>{message.content}</Text>
        ) : null}
        <Text style={styles.bubbleTimestampLeft}>{stamp}</Text>
      </View>
    </View>
  );
}

// ---------- System marker ("On site 35 minutes" / "Check Out 9:41") ----------

export function SystemMarker({ text }: { text: string }) {
  return (
    <View style={styles.systemMarkerRow}>
      <Text style={styles.systemMarkerText}>{text}</Text>
    </View>
  );
}

// ---------- Footer marker (terminal state: "Job complete" / "Job cancelled") ----------

export function FooterMarker({
  text,
  tone,
}: {
  text: string;
  tone: 'success' | 'danger';
}) {
  return (
    <View style={styles.footerMarkerRow}>
      <Text
        style={[
          styles.footerMarkerText,
          {
            color:
              tone === 'success'
                ? colors.status.success
                : colors.status.dangerAlt,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

// ---------- Action card row (per-status buttons) ----------

const ACTION_LABEL: Record<ActionCardSpec['kind'], { icon: string; text: string }> = {
  accept: { icon: '✅', text: 'Accept' },
  reject: { icon: '❌', text: 'Reject' },
  get_directions: { icon: '📍', text: 'Get Directions' },
  manual_arrival: { icon: '📍', text: "I've arrived" },
  invoice_client: { icon: '💰', text: 'Invoice Client' },
  send_quote: { icon: '📋', text: 'Send Quote' },
  questions: { icon: '❓', text: 'Questions / Contact Client' },
  complete_job: { icon: '📸', text: 'Complete Job' },
};

type ActionHandler = (kind: ActionCardSpec['kind']) => void;

export function ActionCardRow({
  actions,
  onAction,
}: {
  actions: ActionCardSpec[];
  onAction: ActionHandler;
}) {
  const isAcceptReject =
    actions.length === 2 &&
    actions[0]?.kind === 'accept' &&
    actions[1]?.kind === 'reject';

  if (isAcceptReject) {
    return (
      <View style={styles.acceptRejectRow}>
        <Pressable
          onPress={() => onAction('accept')}
          style={({ pressed }) => [
            styles.actionCard,
            styles.acceptCard,
            pressed && styles.cardPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Accept job"
        >
          <Text style={styles.actionCardText}>
            {ACTION_LABEL.accept.icon} {ACTION_LABEL.accept.text}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onAction('reject')}
          style={({ pressed }) => [
            styles.actionCard,
            styles.rejectCard,
            pressed && styles.cardPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Reject job"
        >
          <Text style={styles.actionCardText}>
            {ACTION_LABEL.reject.icon} {ACTION_LABEL.reject.text}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.actionStack}>
      {actions.map((a) => {
        const meta = ACTION_LABEL[a.kind];
        const highlighted = 'highlighted' in a && a.highlighted;
        return (
          <Pressable
            key={a.kind}
            onPress={() => onAction(a.kind)}
            style={({ pressed }) => [
              styles.actionCard,
              styles.neutralCard,
              highlighted && styles.neutralCardHighlighted,
              pressed && styles.cardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={meta.text}
          >
            <Text
              style={[
                styles.actionCardText,
                highlighted && styles.actionCardTextHighlighted,
              ]}
            >
              {meta.icon}  {meta.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Invoice / Quote card ----------
//
// One card per invoice OR quote (both stored in the invoices table; kind
// branches presentation). Card always shows everything (total, status,
// items, notes, timestamp) — no tap-to-expand or separate detail screen.

type BadgeStyle = { label: string; bg: string; fg: string };

const INVOICE_STATUS_BADGE: Record<string, BadgeStyle> = {
  draft:     { label: 'Draft',     bg: '#E0E0E0', fg: '#424242' },
  sent:      { label: 'Sent',      bg: '#E3F2FD', fg: '#1565C0' },
  viewed:    { label: 'Viewed',    bg: '#E3F2FD', fg: '#1565C0' },
  approved:  { label: 'Approved',  bg: '#E8F5E9', fg: '#2E7D32' },
  paid:      { label: 'Paid ✓',    bg: '#E8F5E9', fg: '#2E7D32' },
  overdue:   { label: 'Overdue',   bg: '#FFEBEE', fg: '#C62828' },
  rejected:  { label: 'Declined',  bg: '#FFEBEE', fg: '#C62828' },
  cancelled: { label: 'Cancelled', bg: '#E0E0E0', fg: '#424242' },
};

// Quote uses yellow/orange "Pending" while waiting on the client; green
// "Accepted ✓" after they accept; gray "Expired" once valid_until passes.
const QUOTE_STATUS_BADGE: Record<string, BadgeStyle> = {
  draft:     { label: 'Draft',     bg: '#E0E0E0', fg: '#424242' },
  sent:      { label: 'Pending',   bg: '#FFF3E0', fg: '#E65100' },
  viewed:    { label: 'Pending',   bg: '#FFF3E0', fg: '#E65100' },
  accepted:  { label: 'Accepted ✓', bg: '#E8F5E9', fg: '#2E7D32' },
  approved:  { label: 'Accepted ✓', bg: '#E8F5E9', fg: '#2E7D32' },
  rejected:  { label: 'Declined',  bg: '#FFEBEE', fg: '#C62828' },
  expired:   { label: 'Expired',   bg: '#E0E0E0', fg: '#424242' },
  cancelled: { label: 'Cancelled', bg: '#E0E0E0', fg: '#424242' },
};

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function invoiceTimestamp(invoice: Invoice): string {
  const iso = invoice.sent_at ?? invoice.created_at;
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}${ampm}`;
}

function formatValidDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// For quotes, derive effective state: if valid_until is in the past and the
// stored status is still 'sent' or 'viewed', treat as 'expired' for badge +
// expiry-line presentation. Alfred can also set status='expired' explicitly;
// either path renders the same.
function quoteIsExpired(invoice: Invoice): boolean {
  if (!invoice.valid_until) return false;
  return new Date(invoice.valid_until).getTime() < Date.now();
}

export function InvoiceCard({
  invoice,
  items,
}: {
  invoice: Invoice;
  items: InvoiceItem[];
}) {
  const isQuote = invoice.kind === 'quote';

  let effectiveStatus = invoice.status;
  if (
    isQuote &&
    quoteIsExpired(invoice) &&
    (effectiveStatus === 'sent' || effectiveStatus === 'viewed')
  ) {
    effectiveStatus = 'expired';
  }

  const badgeTable = isQuote ? QUOTE_STATUS_BADGE : INVOICE_STATUS_BADGE;
  const badge =
    badgeTable[effectiveStatus] ?? badgeTable.sent ?? INVOICE_STATUS_BADGE.sent;

  const total = invoice.total ?? 0;
  const stamp = invoiceTimestamp(invoice);
  const itemCount = items.length;

  return (
    <View style={styles.bubbleRowLeft}>
      <View style={[styles.bubble, styles.bubbleIncoming, styles.invoiceCard]}>
        <View style={styles.invoiceHeader}>
          <Text style={styles.invoiceTotal}>{formatMoney(total)}</Text>
          <View style={[styles.invoiceBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.invoiceBadgeText, { color: badge.fg }]}>
              {badge.label}
            </Text>
          </View>
        </View>
        <Text style={styles.invoiceSubtitle}>
          {isQuote ? 'Quote' : 'Invoice'} • {itemCount}{' '}
          {itemCount === 1 ? 'item' : 'items'}
        </Text>

        <View style={styles.invoiceDivider} />

        <View style={styles.invoiceItemList}>
          {items.map((it) => (
            <View key={it.id} style={styles.invoiceItemRow}>
              <Text style={styles.invoiceItemDesc} numberOfLines={2}>
                {it.description}
              </Text>
              <Text style={styles.invoiceItemAmount}>
                {formatMoney(it.amount)}
              </Text>
            </View>
          ))}
        </View>

        {isQuote && invoice.valid_until ? (
          <Text style={styles.invoiceExpiry}>
            {effectiveStatus === 'expired'
              ? `Expired ${formatValidDate(invoice.valid_until)}`
              : `Valid until ${formatValidDate(invoice.valid_until)}`}
          </Text>
        ) : null}

        {invoice.notes ? (
          <>
            <View style={styles.invoiceDivider} />
            <Text style={styles.invoiceNotes}>{invoice.notes}</Text>
          </>
        ) : null}

        {stamp ? <Text style={styles.bubbleTimestampLeft}>{stamp}</Text> : null}
      </View>
    </View>
  );
}

// ---------- Top-level switch ----------

export function renderTimelineItem(
  item: TimelineItem,
  onAction: ActionHandler,
): React.ReactElement {
  switch (item.kind) {
    case 'date_separator':
      return <DateSeparator label={item.label} />;
    case 'sla_banner':
      return <SLABanner text={item.text} />;
    case 'info_card_location':
      return (
        <InfoCardLocation
          address={item.address}
          timestamp={item.timestamp}
          distance={item.distance}
          customerFirstName={item.customerFirstName}
        />
      );
    case 'info_card_wo':
      return (
        <InfoCardWO
          shortId={item.shortId}
          trade={item.trade}
          description={item.description}
          timing={item.timing}
          nte={item.nte}
          notes={item.notes}
          dispatchFee={item.dispatchFee}
          timestamp={item.timestamp}
        />
      );
    case 'info_card_sla':
      return <InfoCardSLA acceptBy={item.acceptBy} onSiteBy={item.onSiteBy} />;
    case 'bubble':
      return <Bubble message={item.message} />;
    case 'system_marker':
      return <SystemMarker text={item.text} />;
    case 'action_card_row':
      return <ActionCardRow actions={item.actions} onAction={onAction} />;
    case 'invoice_card':
      return <InvoiceCard invoice={item.invoice} items={item.items} />;
    case 'footer_marker':
      return <FooterMarker text={item.text} tone={item.tone} />;
  }
}

// ---------- Styles ----------

const BUBBLE_PADDING_V = 16;
const BUBBLE_PADDING_H = 24;
const BUBBLE_RADIUS = 20;
const BUBBLE_TAIL = 8;

const styles = StyleSheet.create({
  // Date separator pill
  dateSepRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dateSepPill: {
    backgroundColor: 'rgba(117,117,117,0.12)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateSepText: {
    ...typography.micro,
    color: colors.text.secondary,
  },

  // SLA banner
  slaBannerRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  slaBannerText: {
    ...typography.bodySmall,
    color: colors.status.dangerAlt,
    textAlign: 'center',
  },

  // Bubble row alignment
  bubbleRowLeft: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginVertical: 4,
  },
  bubbleRowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: 4,
  },

  // Bubble shell
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: BUBBLE_PADDING_H,
    paddingVertical: BUBBLE_PADDING_V,
  },
  bubbleIncoming: {
    backgroundColor: colors.surface.muted,
    borderTopLeftRadius: BUBBLE_TAIL,
    borderTopRightRadius: BUBBLE_RADIUS,
    borderBottomRightRadius: BUBBLE_RADIUS,
    borderBottomLeftRadius: BUBBLE_RADIUS,
  },
  bubbleVendor: {
    backgroundColor: colors.brand.primary,
    borderTopLeftRadius: BUBBLE_RADIUS,
    borderTopRightRadius: BUBBLE_RADIUS,
    borderBottomRightRadius: BUBBLE_TAIL,
    borderBottomLeftRadius: BUBBLE_RADIUS,
  },
  // When an image is attached we tighten the padding so the image dominates;
  // the timestamp footer still sits inside on its own row.
  bubbleWithImage: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
  },
  attachmentImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.divider.soft,
  },
  attachmentDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  attachmentDocText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flexShrink: 1,
  },
  attachmentDocTextVendor: {
    ...typography.bodySmall,
    color: '#FFFFFF',
    flexShrink: 1,
  },

  bubbleTextIncoming: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: colors.text.primary,
  },
  bubbleTextVendor: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },

  bubbleFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  bubbleTimestampRight: {
    ...typography.caption,
    color: colors.divider.base,
  },
  bubbleTimestampLeft: {
    ...typography.caption,
    color: colors.text.tertiary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },

  // Info card body — extends bubble; emoji-prefixed lines
  infoCard: {
    width: '90%',
  },
  infoCardBody: {
    gap: 4,
  },
  infoCardLine: {
    ...typography.bodyBold,
    color: colors.text.primary,
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
  },
  infoCardTitle: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
  },

  // System markers
  systemMarkerRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  systemMarkerText: {
    ...typography.bodySmall,
    color: colors.status.dangerAlt,
    textAlign: 'center',
  },

  // Footer marker (terminal-state)
  footerMarkerRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerMarkerText: {
    ...typography.bodyBold,
    textAlign: 'center',
  },

  // Invoice card
  invoiceCard: {
    width: '90%',
    gap: 8,
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  invoiceTotal: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 28,
    color: colors.text.primary,
  },
  invoiceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  invoiceBadgeText: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  invoiceSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: colors.divider.soft,
    marginVertical: 4,
  },
  invoiceItemList: {
    gap: 6,
  },
  invoiceItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  invoiceItemDesc: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flex: 1,
  },
  invoiceItemAmount: {
    ...typography.bodyBold,
    color: colors.text.primary,
    minWidth: 80,
    textAlign: 'right',
  },
  invoiceNotes: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  invoiceExpiry: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: 4,
  },

  // Action cards
  acceptRejectRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 8,
  },
  actionStack: {
    gap: 8,
    marginVertical: 8,
  },
  actionCard: {
    paddingHorizontal: BUBBLE_PADDING_H,
    paddingVertical: BUBBLE_PADDING_V,
    borderTopLeftRadius: BUBBLE_TAIL,
    borderTopRightRadius: BUBBLE_RADIUS,
    borderBottomRightRadius: BUBBLE_RADIUS,
    borderBottomLeftRadius: BUBBLE_RADIUS,
    minHeight: 51,
    justifyContent: 'center',
  },
  acceptCard: {
    backgroundColor: colors.status.acceptGreen,
    flex: 1,
  },
  rejectCard: {
    backgroundColor: colors.surface.muted,
    flex: 1,
  },
  neutralCard: {
    backgroundColor: colors.surface.muted,
  },
  neutralCardHighlighted: {
    backgroundColor: colors.brand.surfaceTint,
    ...shadows.cardLow,
  },
  cardPressed: { opacity: 0.85 },
  actionCardText: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: colors.text.primary,
  },
  actionCardTextHighlighted: {
    color: colors.brand.primary,
  },
});
