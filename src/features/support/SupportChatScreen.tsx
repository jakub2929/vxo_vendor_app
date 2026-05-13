import { router } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientHeader } from '@/components/GradientHeader';
import { useVendor } from '@/hooks/useVendor';
import { colors, typography } from '@/theme';
import { useSupportThread, type SupportMessage, type ThreadType } from './useSupportThread';

const TITLES: Record<ThreadType, string> = {
  current_job: 'Current Job Support',
  general: 'General Q & A',
};

const WELCOME_TEXT = 'How can VXO help you today?';

type Props = {
  threadType: ThreadType;
};

export function SupportChatScreen({ threadType }: Props) {
  const { vendor } = useVendor();
  const { messages, loading, sending, sendMessage } = useSupportThread(
    vendor?.id,
    threadType,
  );
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const data = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = async () => {
    const text = draft;
    if (!text.trim()) return;
    setDraft('');
    await sendMessage(text);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/support');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <GradientHeader title={TITLES[threadType]} onBack={handleBack} />
        <View style={styles.flex}>
          {messages.length === 0 && !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.systemBubble}>
                <Text style={styles.systemText}>{WELCOME_TEXT}</Text>
              </View>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={data}
              inverted
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message..."
            placeholderTextColor={colors.text.placeholder}
            multiline
            editable={!sending}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            style={({ pressed }) => [
              styles.sendButton,
              (!draft.trim() || sending) && styles.sendDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: SupportMessage }) {
  if (message.sender === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemTextInline}>{message.message}</Text>
      </View>
    );
  }
  const isVendor = message.sender === 'vendor';
  return (
    <View style={[styles.bubbleRow, isVendor ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View
        style={[
          styles.bubble,
          isVendor ? styles.bubbleVendor : styles.bubbleSupport,
        ]}
      >
        <Text style={isVendor ? styles.bubbleTextVendor : styles.bubbleTextSupport}>
          {message.message}
        </Text>
      </View>
    </View>
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
  systemBubble: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    maxWidth: '85%',
  },
  systemText: {
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
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: 3,
  },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleVendor: {
    backgroundColor: colors.brand.primary,
    borderBottomRightRadius: 4,
  },
  bubbleSupport: {
    backgroundColor: colors.surface.muted,
    borderBottomLeftRadius: 4,
  },
  bubbleTextVendor: {
    ...typography.body,
    color: '#ffffff',
  },
  bubbleTextSupport: {
    ...typography.body,
    color: colors.text.primary,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider.soft,
    backgroundColor: colors.surface.base,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.surface.muted,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
  pressed: { opacity: 0.85 },
});
