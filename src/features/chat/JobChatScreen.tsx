// Job Chat detail screen (Figma node 4:10092). Mounts at /job/[id].
//
// Composition (top → bottom):
//   - JobChatHeader (gradient, back arrow, "WO# <shortId>", call, more)
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
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { colors, typography } from '@/theme';
import { actionsForStatus, buildTimeline } from './buildTimeline';
import { JobChatComposer } from './JobChatComposer';
import { JobChatHeader } from './JobChatHeader';
import { JobChatHeaderPopover } from './JobChatHeaderPopover';
import { renderTimelineItem } from './JobChatTimelineItems';
import type { ActionCardSpec, TimelineItem } from './types';
import {
  useJob,
  useJobMessages,
  useSendMessage,
} from './useJobChat';
import { useJobChatRealtime } from './useJobChatRealtime';

type Props = {
  jobId: string;
};

export function JobChatScreen({ jobId }: Props) {
  const { data: job, isLoading: jobLoading } = useJob(jobId);
  const { data: messages = [], isLoading: messagesLoading } =
    useJobMessages(jobId);
  const sendMessage = useSendMessage(jobId);
  useJobChatRealtime(jobId);
  const { data: vendorCoords } = useVendorLocation();

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
    const base = buildTimeline(job, messages);
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
  }, [job, messages, distanceMi]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleAction = (kind: ActionCardSpec['kind']) => {
    if (!job) return;
    // In real mode the mutations live in screens-not-yet-built (Quote
    // builder, Invoice builder, etc). For now in mock mode we apply the
    // status transition + the canned bubble so the demo flow is visible.
    if (!USE_MOCKS) {
      // TODO(real-data): wire to backend transitions (Accept → API call to
      //   /jobs/:id/accept, Get Directions → /jobs/:id/start, etc).
      return;
    }
    switch (kind) {
      case 'accept':
        setMockJobStatus(job.id, 'accepted');
        appendMockMessage(job.id, {
          sender: 'vendor',
          content: 'You Accepted. Need to Reject. Press Here.',
        });
        break;
      case 'reject':
        setMockJobStatus(job.id, 'cancelled');
        appendMockMessage(job.id, {
          sender: 'system',
          content: 'Job declined. The dispatcher has been notified.',
        });
        break;
      case 'get_directions':
        setMockJobStatus(job.id, 'en_route');
        appendMockMessage(job.id, {
          sender: 'alfred',
          content:
            'Get Directions. Client has been notified you are on the way. Click here to cancel.',
        });
        break;
      case 'invoice_client':
        // TODO: route to Invoice builder screen.
        appendMockMessage(job.id, {
          sender: 'vendor',
          content:
            'You selected Invoice. If you need to go back to Quote press Here.',
        });
        break;
      case 'send_quote':
        // TODO: route to Quote builder screen.
        appendMockMessage(job.id, {
          sender: 'vendor',
          content: 'You selected Quote. The client will see it shortly.',
        });
        break;
      case 'questions':
        // TODO: route to Questions / Contact Client flow.
        appendMockMessage(job.id, {
          sender: 'alfred',
          content: 'We ask 3 quick questions to build an invoice for you.',
        });
        break;
      case 'view_invoice':
        // TODO: route to Invoice viewer.
        appendMockMessage(job.id, {
          sender: 'system',
          content: 'Opening invoice…',
        });
        break;
    }
    // Side-effect for the on_site marker: stamp checkin_time so the
    // timeline can render "On site Nm" once the vendor has arrived. The
    // builder reads jobs.checkin_time, so we need to set it explicitly.
    if (kind === 'get_directions') {
      // No-op — checkin happens on "Arrived on site", not on "Get
      // Directions". Left as a doc comment so future me doesn't move it.
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

  // No-op: simulate vendor manually marking on-site once they've actually
  // arrived. Exposed via the composer for demo purposes.
  const handleSend = (text: string) => {
    sendMessage.mutate({ content: text, sender: 'vendor' });
    // If the job is en_route and there's no checkin yet, advance to
    // on_site on the first vendor message (a reasonable demo heuristic).
    if (
      USE_MOCKS &&
      job &&
      job.status === 'en_route' &&
      !job.checkin_time
    ) {
      setMockCheckinTime(job.id, new Date().toISOString());
      setMockJobStatus(job.id, 'on_site');
    }
  };

  const title = job
    ? `WO# ${job.id.slice(0, 8).toUpperCase()}`
    : 'WO#';

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
          // TODO: deep-link to phone with client number
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
