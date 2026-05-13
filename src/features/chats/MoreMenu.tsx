import { Settings, User, Users } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows } from '@/theme';
import { MoreMenuItem } from './MoreMenuItem';
import { StripeIcon } from './StripeIcon';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectContactVXO: () => void;
  onSelectProfile: () => void;
  onSelectStripe: () => void;
  onSelectSettings: () => void;
};

// Position values mirror Figma node 4:10154: card right-aligned 24pt from edge,
// vertically anchored just below the header's more-icon (~107pt absolute on
// the 428×926 reference frame). We compute the top from the safe-area inset so
// the card lands underneath the icon on every device.
const RIGHT_INSET = 16;

export function MoreMenu({
  visible,
  onClose,
  onSelectContactVXO,
  onSelectProfile,
  onSelectStripe,
  onSelectSettings,
}: Props) {
  const safeInsets = useSafeAreaInsets();
  // top bar (~8pt safe-area pad + 48pt row + 16pt bottom pad in ChatsHeader)
  // plus a small gap so the popover sits below the more icon.
  const topOffset = safeInsets.top + 8 + 48 + 8;

  const handle = (cb: () => void) => () => {
    onClose();
    cb();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
        <View
          style={[styles.card, { top: topOffset, right: RIGHT_INSET }]}
          // Stop taps inside the card from reaching the backdrop. View doesn't
          // intercept by default — pointerEvents="box-only" plus an onTouchEnd
          // no-op covers both web (DOM click bubbling) and native (RN touch
          // tree).
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <MoreMenuItem
            icon={<Users size={20} color={colors.text.primary} />}
            label="Contact VXO"
            onPress={handle(onSelectContactVXO)}
          />
          <View style={styles.divider} />
          <MoreMenuItem
            icon={<User size={20} color={colors.text.primary} />}
            label="Profile"
            onPress={handle(onSelectProfile)}
          />
          <View style={styles.divider} />
          <MoreMenuItem
            icon={<StripeIcon size={20} />}
            label="Stripe"
            onPress={handle(onSelectStripe)}
          />
          <View style={styles.divider} />
          <MoreMenuItem
            icon={<Settings size={20} color={colors.text.primary} />}
            label="Settings"
            onPress={handle(onSelectSettings)}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    // Figma shows no dim; keep it transparent. Using a near-zero rgba so the
    // overlay still captures taps reliably on every platform.
    backgroundColor: 'rgba(0,0,0,0.001)',
  },
  card: {
    position: 'absolute',
    width: 166,
    backgroundColor: colors.surface.base,
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 20,
    paddingRight: 28,
    gap: 4,
    ...shadows.cardHigh,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider.soft,
  },
});
