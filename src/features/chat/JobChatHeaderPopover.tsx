// Header "more" popover for the Job Chat detail screen. Lists two items:
//   - Attachments (no-op until photo gallery / receipt store is wired)
//   - Support       (no-op until the "open VXO support thread for this job"
//                    deep-link is decided)
//
// Both targets are intentional TODOs. The Figma frame doesn't ship the
// popover panel explicitly but the "more" dots clearly drive somewhere; this
// is the obvious shape and parallels the MoreMenu used on the Jobs screen.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Paperclip, LifeBuoy } from 'lucide-react-native';
import { colors, shadows, typography } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectAttachments: () => void;
  onSelectSupport: () => void;
};

export function JobChatHeaderPopover({
  visible,
  onClose,
  onSelectAttachments,
  onSelectSupport,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.panel}>
          <PopoverItem
            label="Attachments"
            icon={<Paperclip size={20} color={colors.text.primary} />}
            onPress={() => {
              onClose();
              onSelectAttachments();
            }}
          />
          <View style={styles.divider} />
          <PopoverItem
            label="Support"
            icon={<LifeBuoy size={20} color={colors.text.primary} />}
            onPress={() => {
              onClose();
              onSelectSupport();
            }}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

function PopoverItem({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text style={styles.itemText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 96,
    paddingHorizontal: 12,
  },
  panel: {
    minWidth: 200,
    borderRadius: 16,
    backgroundColor: colors.surface.base,
    paddingVertical: 8,
    ...shadows.cardHigh,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemPressed: {
    backgroundColor: colors.surface.muted,
  },
  itemText: {
    ...typography.body,
    color: colors.text.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider.soft,
    marginHorizontal: 8,
  },
});
