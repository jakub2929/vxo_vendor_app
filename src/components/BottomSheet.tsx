import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  // Fires after the close animation finishes. AttachmentBottomSheet uses
  // this to defer a native picker until the sheet's host view is settled
  // (the "Different document picking in progress" guard). Previously
  // implemented via Modal.onDismiss (iOS-only); now driven by our own
  // animation completion so it works on both platforms.
  onDismissed?: () => void;
  // When true (default), fades in a 35% black scrim across the full screen
  // while the sheet slides up. Pass `false` to leave the host screen fully
  // visible. Tap-outside-to-dismiss is preserved either way.
  dimBackdrop?: boolean;
  children: ReactNode;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
// Backdrop fades faster than the sheet slides so the dim "lands" while the
// sheet is still on its way up — focuses attention on the appearing sheet.
const BACKDROP_FADE_MS = 200;
const SHEET_SLIDE_MS = 250;

export function BottomSheet({
  visible,
  onClose,
  onDismissed,
  dimBackdrop = true,
  children,
}: Props) {
  // Modal stays mounted through the close animation so the sheet doesn't
  // pop out abruptly — we unmount only after the slide-down finishes.
  const [modalVisible, setModalVisible] = useState(false);

  // Latest-value refs so the animation completion callback reads current
  // state without being a useEffect dep (which would re-run the animation).
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);
  const onDismissedRef = useRef(onDismissed);
  useEffect(() => {
    onDismissedRef.current = onDismissed;
  }, [onDismissed]);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      // Mount the Modal first so the Animated.Views exist; initial values
      // (opacity 0, translateY = SCREEN_HEIGHT) keep both off-screen until
      // the parallel timing runs — no flash of on-screen content.
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: BACKDROP_FADE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: SHEET_SLIDE_MS,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: BACKDROP_FADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: SHEET_SLIDE_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      // If the caller re-opened the sheet while it was closing, the open
      // effect has already restarted the animation — don't unmount.
      if (!finished || visibleRef.current) return;
      setModalVisible(false);
      // onDismissed fires from the modal-unmount effect below — not here —
      // so the callback runs AFTER React commits the unmount render. Firing
      // it inside this .start() callback would invoke onDismissed while the
      // Modal is still mounted natively, which breaks iOS picker
      // presentation (UIDocumentPickerViewController / UIImagePickerController
      // can't present over an active Modal — the AttachmentBottomSheet
      // deferred-flush guard depends on this contract).
    });
  }, [visible, backdropOpacity, sheetTranslateY]);

  // Fire onDismissed one frame after the Modal has actually unmounted. The
  // extra rAF gives iOS UIKit time to fully tear down the host VC before
  // anything that runs from onDismissed (typically a native picker) tries
  // to present. Mirrors the rAF pattern AttachmentBottomSheet has on
  // Android, just promoted into the shared sheet so it works on both
  // platforms uniformly.
  const prevModalVisibleRef = useRef(false);
  useEffect(() => {
    if (prevModalVisibleRef.current && !modalVisible) {
      const raf = requestAnimationFrame(() => {
        // iOS UIDocumentPickerViewController briefly holds its internal
        // "presented" lock after dismiss; expo-document-picker's next
        // getDocumentAsync rejects with "Different document picking in
        // progress" if called within that window. A single rAF (~16ms) is
        // not always enough — 100ms is comfortably past UIKit teardown and
        // well under perceptible launch latency for the next picker.
        setTimeout(
          () => {
            onDismissedRef.current?.();
          },
          Platform.OS === 'ios' ? 100 : 0,
        );
      });
      prevModalVisibleRef.current = modalVisible;
      return () => cancelAnimationFrame(raf);
    }
    prevModalVisibleRef.current = modalVisible;
  }, [modalVisible]);

  return (
    <Modal
      visible={modalVisible}
      transparent
      // We drive the slide + fade ourselves — Modal's built-in slide would
      // animate the entire content tree (including the backdrop) up from
      // the bottom, which makes the dim appear to "slide in" rather than
      // fade across the full screen.
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.fill} onPress={onClose}>
        {dimBackdrop && (
          <Animated.View
            pointerEvents="none"
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          />
        )}
        <Animated.View
          style={{ transform: [{ translateY: sheetTranslateY }] }}
        >
          <Pressable style={styles.sheet} onPress={() => undefined}>
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
