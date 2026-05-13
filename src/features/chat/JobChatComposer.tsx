// Chat composer (Figma node 4:10105 — "Theme=Light, Component=Chat Form").
//
// Layout: [grey input pill with smile / placeholder / paperclip / camera]
// + circular gradient send button. Voice icon in the Figma sits *inside* the
// send button when the input is empty — we keep it as a single send-action
// button. When the input is empty the icon is a Mic (voice memo TODO); when
// there's text it switches to a paper-plane Send.
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Mic, Paperclip, Send, Smile } from 'lucide-react-native';
import { colors, shadows, typography } from '@/theme';

type Props = {
  disabled?: boolean;
  onSend: (text: string) => void;
  onAttachPress?: () => void;
};

const GRADIENT_START = { x: 0.913, y: 0.783 };
const GRADIENT_END = { x: 0.087, y: 0.217 };

export function JobChatComposer({ disabled, onSend, onAttachPress }: Props) {
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim();
  const hasText = trimmed.length > 0;

  const handlePress = () => {
    if (!hasText || disabled) return;
    onSend(trimmed);
    setDraft('');
  };

  return (
    <View style={styles.row}>
      <View style={styles.inputPill}>
        <Pressable
          hitSlop={8}
          // TODO: emoji picker
          onPress={() => undefined}
          accessibilityRole="button"
          accessibilityLabel="Emoji picker"
        >
          <Smile size={20} color={colors.text.tertiary} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message ..."
          placeholderTextColor={colors.text.tertiary}
          editable={!disabled}
          multiline
        />
        <Pressable
          hitSlop={8}
          onPress={onAttachPress}
          accessibilityRole="button"
          accessibilityLabel="Attach file"
        >
          <Paperclip size={20} color={colors.text.tertiary} />
        </Pressable>
        <Pressable
          hitSlop={8}
          // TODO: open camera
          onPress={() => undefined}
          accessibilityRole="button"
          accessibilityLabel="Open camera"
        >
          <Camera size={20} color={colors.text.tertiary} />
        </Pressable>
      </View>
      <Pressable
        onPress={handlePress}
        disabled={!hasText || !!disabled}
        style={({ pressed }) => [
          styles.sendButtonWrap,
          pressed && styles.sendPressed,
          !hasText && styles.sendDimmed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={hasText ? 'Send message' : 'Voice message'}
      >
        <LinearGradient
          colors={colors.brand.headerGradient}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={styles.sendButton}
        >
          {hasText ? (
            <Send size={24} color="#FFFFFF" />
          ) : (
            // TODO: voice memo capture
            <Mic size={24} color="#FFFFFF" />
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: colors.surface.base,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    backgroundColor: colors.surface.mutedAlt,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.text.primary,
    maxHeight: 100,
    padding: 0,
  },
  sendButtonWrap: {
    borderRadius: 100,
    ...shadows.glow,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPressed: { opacity: 0.9 },
  sendDimmed: { opacity: 0.92 },
});
