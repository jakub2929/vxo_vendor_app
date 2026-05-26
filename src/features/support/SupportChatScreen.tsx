// Support chat detail screen. Reuses the Job Chat Bubble + Composer so visual
// language stays consistent across the two chat surfaces. SupportMessage rows
// are adapted to ChatMessage at the render boundary — the underlying tables
// have different shapes (vendor_id vs job_id, message vs content, plus a
// 'support' sender that we map to 'admin' for the bubble's incoming style).
//
// System rows (e.g. the welcome line) are rendered as a centered italic
// caption rather than as a grey bubble, mirroring what Slack/Intercom do for
// non-conversational notices. The Bubble component handles its own 'system'
// case but treats it as just-another-incoming-bubble, which feels too noisy
// for a support thread that's mostly two-party.
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientHeader } from '@/components/GradientHeader';
import { JobChatComposer } from '@/features/chat/JobChatComposer';
import { Bubble } from '@/features/chat/JobChatTimelineItems';
import type { ChatMessage, ChatSender } from '@/features/chat/types';
import { useVendor } from '@/hooks/useVendor';
import { markThreadOpened } from '@/lib/supportReadState';
import { colors, typography } from '@/theme';
import {
  useSupportThread,
  type SupportMessage,
  type ThreadType,
} from './useSupportThread';

const TITLES: Record<ThreadType, string> = {
  current_job: 'Current Job Support',
  general: 'General Q & A',
};

const WELCOME_TEXT = 'How can VXO help you today?';

// Map support sender → ChatSender. 'support' has no equivalent in the Job
// Chat union, so we render it as 'admin' (also an incoming grey bubble).
function senderForBubble(sender: SupportMessage['sender']): ChatSender {
  switch (sender) {
    case 'vendor':
      return 'vendor';
    case 'support':
      return 'admin';
    case 'system':
      return 'system';
  }
}

function toChatMessage(msg: SupportMessage): ChatMessage {
  return {
    id: msg.id,
    // Bubble doesn't read request_id; satisfy the required type with a
    // stable sentinel rather than threading a nullable string everywhere.
    request_id: msg.job_id ?? 'support',
    sender: senderForBubble(msg.sender),
    content: msg.message,
    created_at: msg.created_at,
  };
}

type Props = {
  threadType: ThreadType;
};

export function SupportChatScreen({ threadType }: Props) {
  const { vendor } = useVendor();
  const { messages, loading, sending, sendMessage } = useSupportThread(
    vendor?.id,
    threadType,
  );
  const listRef = useRef<FlatList<SupportMessage>>(null);

  // Stamp lastOpenedAt as soon as the screen mounts and again whenever new
  // messages arrive while it's open — the latter prevents unread badges from
  // re-appearing when the vendor stays on the screen and an admin replies.
  useEffect(() => {
    void markThreadOpened(threadType);
  }, [threadType, messages.length]);

  // Inverted FlatList wants newest-first; messages are stored oldest-first.
  const data = useMemo(() => [...messages].reverse(), [messages]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/support');
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <GradientHeader title={TITLES[threadType]} onBack={handleBack} />
        <View style={styles.flex}>
          {isEmpty ? (
            <View style={styles.emptyContainer}>
              <View style={styles.welcomePill}>
                <Text style={styles.welcomeText}>{WELCOME_TEXT}</Text>
              </View>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={data}
              inverted
              keyExtractor={(m) => m.id}
              renderItem={({ item }) =>
                item.sender === 'system' ? (
                  <View style={styles.systemRow}>
                    <Text style={styles.systemTextInline}>{item.message}</Text>
                  </View>
                ) : (
                  <Bubble message={toChatMessage(item)} />
                )
              }
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
        <JobChatComposer disabled={sending} onSend={sendMessage} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.base },
  flex: { flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 24,
  },
  welcomePill: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '85%',
  },
  welcomeText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  systemRow: {
    alignItems: 'center',
    marginVertical: 6,
  },
  systemTextInline: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 6,
  },
});
