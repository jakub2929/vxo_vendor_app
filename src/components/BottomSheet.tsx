import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  // iOS-only: fires after the slide-down animation completes. Use when the
  // next action (e.g. presenting a native picker) requires the host view
  // controller to be settled. Android: Modal dismiss is effectively instant
  // and onDismiss isn't invoked; callers needing parity detect close
  // themselves (useEffect on `visible` going false).
  onDismissed?: () => void;
  children: ReactNode;
};

export function BottomSheet({ visible, onClose, onDismissed, children }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismissed}
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface.base,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    shadowColor: '#04060f',
    shadowOpacity: 0.05,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
});
