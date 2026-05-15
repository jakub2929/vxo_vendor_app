// Job Chat detail screen (Figma node 4:10092). Mounts at /job/[id].
//
// Composition (top → bottom):
//   - JobChatHeader (gradient, back arrow, "Job# <shortId>", call, more)
//   - FlatList of TimelineItems (info cards → bubbles → action row)
//   - JobChatComposer (sticky, KeyboardAvoidingView padded)
//
// Action-card tap handling lives here so the screen can drive both the
// status mutation (Accept/Reject/Get Directions) AND the bubble that
// accompanies it. Invoice / Quote / Questions are intentional TODOs:
// they route into screens that don't exist yet.
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AttachmentBottomSheet,
  type AttachmentSource,
} from '@/components/AttachmentBottomSheet';
import { USE_MOCKS } from '@/features/home/useHomeData';
import { useVendorLocation } from '@/hooks/useVendorLocation';
import { formatDistance, haversineMiles } from '@/lib/geo';
import {
  appendMockAttachment,
  appendMockMessage,
  setMockCheckinTime,
  setMockJobStatus,
} from '@/lib/mockChatState';
import { supabase } from '@/lib/supabase';
import { colors, typography } from '@/theme';
import { actionsForStatus, buildTimeline } from './buildTimeline';
import { JobChatComposer } from './JobChatComposer';
import { JobChatHeader } from './JobChatHeader';
import { JobChatHeaderPopover } from './JobChatHeaderPopover';
import { renderTimelineItem } from './JobChatTimelineItems';
import type { ActionCardSpec, Job, TimelineItem } from './types';
import {
  useJob,
  useJobInvoices,
  useJobMessages,
  useSendMessage,
} from './useJobChat';
import { useJobChatRealtime } from './useJobChatRealtime';

type Props = {
  jobId: string;
};

// Hand off navigation to the OS Maps app. Prefer GPS coordinates when the
// job has them; fall back to the address string. Silently no-ops when both
// are missing. Linking rejection is swallowed because the caller has
// already committed to its own success path (status transition, etc).
function openMapsForJob(job: Job) {
  const url =
    job.location_lat != null && job.location_lng != null
      ? Platform.select({
          ios: `maps:?daddr=${job.location_lat},${job.location_lng}`,
          android: `geo:${job.location_lat},${job.location_lng}?q=${job.location_lat},${job.location_lng}`,
        })
      : job.address
        ? Platform.select({
            ios: `maps:?daddr=${encodeURIComponent(job.address)}`,
            android: `geo:0,0?q=${encodeURIComponent(job.address)}`,
          })
        : null;

  if (url) {
    Linking.openURL(url).catch(() => {});
  }
}

export function JobChatScreen({ jobId }: Props) {
  const { data: job, isLoading: jobLoading } = useJob(jobId);
  const { data: messages = [], isLoading: messagesLoading } =
    useJobMessages(jobId);
  const { data: invoiceCards = [] } = useJobInvoices(jobId);
  const sendMessage = useSendMessage(jobId);
  useJobChatRealtime(jobId);
  const { data: vendorCoords } = useVendorLocation();
  const queryClient = useQueryClient();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const pickerBusy = useRef(false);

  // Straight-line miles vendor → job. Null when GPS is unavailable (perm
  // denied, hook still loading) OR when the job has no coordinates. Same
  // shape as JobRow's composeHeadline — keeps buildTimeline pure.
  const distanceMi = useMemo<number | null>(() => {
    if (!job || !vendorCoords) return null;
    if (job.location_lat == null || job.location_lng == null) return null;
    return haversineMiles(vendorCoords, {
      lat: Number(job.location_lat),
      lng: Number(job.location_lng),
    });
  }, [job, vendorCoords]);

  const timeline = useMemo<TimelineItem[]>(() => {
    if (!job) return [];
    const base = buildTimeline(job, messages, invoiceCards);
    // Post-process: inject distance into the Location info card, and rewrite
    // the SLA banner text to include miles when GPS is available. Both
    // pieces of UI need the vendor coords, so we compose them here rather
    // than threading GPS through the pure builder.
    const slaHour = job.urgency === 'emergency' ? '2 Hour' : '4 Hour';
    const slaText =
      distanceMi != null
        ? `${slaHour} - ${formatDistance(distanceMi)} away`
        : slaHour;
    return base.map((item) => {
      if (item.kind === 'info_card_location') {
        return { ...item, distance: distanceMi };
      }
      if (item.kind === 'sla_banner') {
        return { ...item, text: slaText };
      }
      return item;
    });
  }, [job, messages, invoiceCards, distanceMi]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  // After an RPC succeeds we invalidate the open chat's job-row query (drives
  // the action card + status indicator) and the jobs-list prefix (so the
  // Jobs tab's row reflects the new status if the user backs out). Realtime
  // covers the latter too — invalidating is belt-and-suspenders.
  const invalidateAfterTransition = async () => {
    await queryClient.invalidateQueries({ queryKey: ['chat', 'job', jobId] });
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const handleAction = async (kind: ActionCardSpec['kind']) => {
    if (!job) return;

    switch (kind) {
      case 'accept':
        if (USE_MOCKS) {
          setMockJobStatus(job.id, 'accepted');
          appendMockMessage(job.id, {
            sender: 'vendor',
            content: 'You Accepted. Need to Reject. Press Here.',
          });
        } else {
          const { error } = await supabase.rpc('accept_job', {
            p_job_id: job.id,
          });
          if (error) {
            Alert.alert("Couldn't accept", error.message);
            return;
          }
          await invalidateAfterTransition();
        }
        break;

      case 'reject':
        if (USE_MOCKS) {
          setMockJobStatus(job.id, 'cancelled');
          appendMockMessage(job.id, {
            sender: 'system',
            content: 'Job declined. The dispatcher has been notified.',
          });
        } else {
          const { error } = await supabase.rpc('reject_job', {
            p_job_id: job.id,
          });
          if (error) {
            Alert.alert("Couldn't reject", error.message);
            return;
          }
          await invalidateAfterTransition();
        }
        break;

      case 'get_directions':
        // "Get Directions" is dual-purpose: first tap (status='accepted')
        // both transitions to en_route AND opens Maps; subsequent taps
        // while already en_route just re-open Maps. Vendor's real workflow
        // includes closing/reopening the Maps app mid-route — forcing them
        // back through a status flow to re-open directions would be
        // pointless friction.
        if (USE_MOCKS) {
          setMockJobStatus(job.id, 'en_route');
          appendMockMessage(job.id, {
            sender: 'alfred',
            content:
              'Get Directions. Client has been notified you are on the way. Click here to cancel.',
          });
        } else {
          if (job.status === 'accepted') {
            const { error } = await supabase.rpc('start_travel', {
              p_job_id: job.id,
            });
            if (error) {
              Alert.alert("Couldn't start travel", error.message);
              return;
            }
            await invalidateAfterTransition();
          }
          // Re-open Maps regardless of whether this was the first tap or a
          // re-tap during en_route.
          openMapsForJob(job);
        }
        break;

      case 'invoice_client':
        // Both modes route to the invoice builder. Builder picks its own
        // submit path (mock → appendMockInvoice, real → send_invoice RPC).
        router.push(`/job/${job.id}/invoice`);
        break;

      case 'send_quote':
        // Both modes route to the quote builder; builder picks its own
        // submit path (mock → appendMockQuote, real → send_quote RPC).
        router.push(`/job/${job.id}/quote`);
        break;

      case 'questions':
        // "Questions / Contact Client" routes to the PM contact card —
        // same destination as the header phone icon. Same in mock + real
        // so the demo flow exercises the real navigation target.
        router.push(`/job/${job.id}/pm-contact`);
        break;

      case 'view_invoice':
        // TODO: view invoice flow pending Invoice builder screen. Currently
        // unreachable — actionsForStatus() never returns 'view_invoice'.
        if (USE_MOCKS) {
          appendMockMessage(job.id, {
            sender: 'system',
            content: 'Opening invoice…',
          });
        }
        break;
    }
  };

  const handleAttachmentSelect = useCallback(
    async (source: AttachmentSource) => {
      // Sheet close is handled by AttachmentBottomSheet itself; by the time
      // this fires the modal has already finished its dismiss animation so
      // camera / document pickers can present cleanly.
      if (!job) return;

      // Real path: needs Supabase Storage upload. Keep the picker out of
      // the way and surface the gap honestly until the upload lands.
      if (!USE_MOCKS) {
        // TODO(real-data): upload to `job-photos` Storage bucket, then
        //   insert a job_messages row with the storage URL (or extend
        //   schema with an attachments column / table). See handoff.
        Alert.alert(
          'Attachments not yet supported',
          'Attachment uploads will be enabled once Storage is wired.',
        );
        return;
      }

      // JS-side lock: prevents a rapid double-tap from running two pickers
      // in parallel, which is what produces the native "Different document
      // picking in progress" error.
      if (pickerBusy.current) return;
      pickerBusy.current = true;
      try {
        if (source === 'document') {
          const res = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
          });
          if (res.canceled || !res.assets[0]) return;
          const a = res.assets[0];
          appendMockAttachment(job.id, {
            kind: 'document',
            uri: a.uri,
            filename: a.name,
          });
          return;
        }

        if (source === 'camera') {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert(
              'Camera permission needed',
              'Enable camera access in Settings to take a photo.',
            );
            return;
          }
          const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (res.canceled || !res.assets[0]) return;
          const a = res.assets[0];
          appendMockAttachment(job.id, {
            kind: 'image',
            uri: a.uri,
            filename: a.fileName ?? 'photo.jpg',
          });
          return;
        }

        // gallery
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Photo library permission needed',
            'Enable photos access in Settings to pick an image.',
          );
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
        if (res.canceled || !res.assets[0]) return;
        const a = res.assets[0];
        appendMockAttachment(job.id, {
          kind: 'image',
          uri: a.uri,
          filename: a.fileName ?? 'image.jpg',
        });
      } catch (err) {
        console.error('[picker]', err);
        Alert.alert(
          'Couldn\'t open the picker',
          'Please try again in a moment.',
        );
      } finally {
        pickerBusy.current = false;
      }
    },
    [job],
  );

  // First vendor message after en_route promotes the job to on_site. This
  // is a demo heuristic, not a geolocation-checked arrival flow — see the
  // proposal's "geolocation-based arrival" item for the proper version.
  const handleSend = async (text: string) => {
    if (!job) return;

    if (USE_MOCKS) {
      sendMessage.mutate({ content: text, sender: 'vendor' });
      if (job.status === 'en_route' && !job.checkin_time) {
        setMockCheckinTime(job.id, new Date().toISOString());
        setMockJobStatus(job.id, 'on_site');
      }
      return;
    }

    // Real mode: await the insert so we only attempt the on_site promotion
    // after the message has actually persisted. mutateAsync surfaces errors
    // via its own onError path; we just bail on rejection.
    try {
      await sendMessage.mutateAsync({ content: text, sender: 'vendor' });
    } catch {
      return;
    }
    if (job.status === 'en_route' && !job.checkin_time) {
      const { error } = await supabase.rpc('mark_on_site', {
        p_job_id: job.id,
      });
      if (error) {
        // Non-fatal: the message went through. Don't block the composer on
        // a failed transition — log and let the user retry from the UI.
        console.warn('[handleSend] mark_on_site failed:', error.message);
        return;
      }
      await invalidateAfterTransition();
    }
  };

  const title = job
    ? `Job# ${job.id.slice(0, 8).toUpperCase()}`
    : 'Job#';

  const showFallback =
    !jobLoading && !messagesLoading && job && messages.length === 0 &&
    actionsForStatus(job.status).length === 0 &&
    (job.status !== 'paid' && job.status !== 'closed' &&
     job.status !== 'cancelled');

  return (
    <View style={styles.root}>
      <JobChatHeader
        title={title}
        onBack={handleBack}
        onCallPress={() => {
          // Open the PM contact card. The PM (project manager) is the contact
          // for this ticket — clients are never surfaced as a call target.
          router.push(`/job/${jobId}/pm-contact`);
        }}
        onMorePress={() => setPopoverOpen(true)}
      />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {jobLoading || !job ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.brand.primary} />
            </View>
          ) : (
            <FlatList
              data={timeline}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.itemWrap}>
                  {renderTimelineItem(item, handleAction)}
                </View>
              )}
              ListEmptyComponent={
                showFallback ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>
                      Chat not seeded yet — TODO
                    </Text>
                    <Text style={styles.emptySubtext}>
                      This job has no message history. Once the vendor
                      flow lands, replies will appear here.
                    </Text>
                  </View>
                ) : null
              }
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          )}
          <JobChatComposer
            disabled={sendMessage.isPending || !job}
            onSend={handleSend}
            onAttachPress={() => setAttachmentSheetOpen(true)}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
      <JobChatHeaderPopover
        visible={popoverOpen}
        onClose={() => setPopoverOpen(false)}
        onSelectAttachments={() => {
          // TODO: open attachments screen
        }}
        onSelectSupport={() => {
          router.push('/(tabs)/support');
        }}
      />
      <AttachmentBottomSheet
        visible={attachmentSheetOpen}
        onClose={() => setAttachmentSheetOpen(false)}
        onSelect={handleAttachmentSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface.base },
  safe: { flex: 1, backgroundColor: colors.surface.base },
  flex: { flex: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 16,
  },
  itemWrap: {
    marginVertical: 4,
  },
  emptyWrap: {
    paddingVertical: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
});
