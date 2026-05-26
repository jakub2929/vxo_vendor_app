// Vendor invoice builder. Mounts at /job/[id]/invoice. Wired from the
// Job Chat "Invoice Client" action card.
//
// Submit path:
//   - mock mode → mockChatState.appendMockInvoice (writes to mutable mock
//     store, invalidates ['chat','invoices', jobId] query)
//   - real mode → supabase.rpc('send_invoice', { p_job_id, p_items, p_notes })
//
// MVP scope (see Prompt 2):
//   - Numeric inputs masked to 2 decimal places, no negatives
//   - At least one item required; every item needs description + amount > 0
//   - No edit / no draft persistence — drafts live only in this screen's
//     useState until Send (or back-without-send)
//   - No auto-system bubble after send — Alfred owns client-facing
//     notification, vendor app inserts only sender='vendor' rows
//
// Item editor + helpers live in src/features/chat/LineItemsInput.tsx — same
// component is reused by the quote builder.
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LineItemsInput,
  formatMoney,
  isItemValid,
  parseAmountSafe,
  type ItemDraft,
} from '@/features/chat/LineItemsInput';
import { firstNameOf } from '@/features/chat/buildTimeline';
import { useJob } from '@/features/chat/useJobChat';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { appendMockInvoice } from '@/lib/mockChatState';
import { supabase } from '@/lib/supabase';
import { colors, typography } from '@/theme';
import { formatJobNumber } from '@/utils/formatters';

const GRADIENT_START = { x: 0.913, y: 0.783 };
const GRADIENT_END = { x: 0.087, y: 0.217 };

export default function InvoiceBuilderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [items, setItems] = useState<ItemDraft[]>([
    { description: '', amount: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const { data: job } = useJob(id);

  if (!id) return <Redirect href="/(tabs)" />;

  const total = items.reduce((acc, it) => acc + parseAmountSafe(it.amount), 0);
  const allItemsValid = items.length > 0 && items.every(isItemValid);
  const canSend = allItemsValid && !sending;

  const onSend = async () => {
    if (!canSend) return;
    setSending(true);
    const payload = items.map((it) => ({
      description: it.description.trim(),
      amount: parseAmountSafe(it.amount),
    }));
    const cleanNotes = notes.trim().length > 0 ? notes.trim() : null;

    try {
      if (USE_MOCKS) {
        appendMockInvoice(id, payload, cleanNotes);
      } else {
        const { error } = await supabase.rpc('send_invoice', {
          p_job_id: id,
          // p_items typed as Json in our manual Functions entry; the array
          // shape here matches what the RPC reads via jsonb_array_elements.
          p_items: payload,
          p_notes: cleanNotes,
        });
        if (error) {
          Alert.alert("Couldn't send invoice", error.message);
          return;
        }
        await queryClient.invalidateQueries({
          queryKey: ['chat', 'invoices', id],
        });
      }
      router.back();
      Alert.alert('Invoice sent', 'The client has been notified.');
    } finally {
      setSending(false);
    }
  };

  const jobNumber = formatJobNumber(id);
  const clientFirstName = firstNameOf(job?.client?.first_name ?? null);
  const address = job?.location ?? null;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.brand.headerGradient}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#FFFFFF" size={28} />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Invoice — {jobNumber}
            </Text>
            {(clientFirstName || address) && (
              <Text
                style={styles.clientLine}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {clientFirstName ? `👤 ${clientFirstName}` : ''}
                {clientFirstName && address ? '  ·  ' : ''}
                {address ? `📍 ${address}` : ''}
              </Text>
            )}
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>Line Items</Text>
          <LineItemsInput items={items} onChange={setItems} />

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            Notes (optional)
          </Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything the client should see with the invoice"
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={3}
          />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(total)}</Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send invoice"
            style={({ pressed }) => [
              styles.sendBtn,
              !canSend && styles.sendBtnDisabled,
              pressed && canSend && styles.sendBtnPressed,
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sendBtnText}>Send Invoice</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  flex: { flex: 1 },

  header: { paddingBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
    minHeight: 48,
  },
  titleBlock: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  clientLine: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 4,
  },
  headerSpacer: { width: 28 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },

  sectionLabel: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: 12,
  },
  sectionLabelSpaced: { marginTop: 24 },

  notesInput: {
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface.muted,
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },

  totalRow: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider.soft,
    paddingTop: 16,
  },
  totalLabel: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 20,
    color: colors.text.primary,
  },
  totalValue: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 28,
    color: colors.text.primary,
  },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider.soft,
    backgroundColor: colors.surface.base,
  },
  sendBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.divider.base },
  sendBtnPressed: { opacity: 0.85 },
  sendBtnText: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    color: '#FFFFFF',
  },
});
