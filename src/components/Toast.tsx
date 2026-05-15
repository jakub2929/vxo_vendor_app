// Minimal in-app toast. Built rather than pulling in react-native-toast-message
// / sonner-native because we only need one slot, one variant, and the
// add-a-dependency cost > the ~120 LOC here.
//
// Usage:
//   <ToastHost /> mounted once at the root (app/_layout.tsx).
//   Anywhere: `showToast({ title, body })` → slides down, auto-dismisses
//   after AUTO_DISMISS_MS, or until the user taps the close button.
//
// Single global slot — no queue. If a second toast is emitted while one is
// visible, the new one replaces the old (the only current caller is the
// vendor-status transition, which can't fire faster than Realtime delivers
// rows, so the single-slot trade-off is fine for MVP).

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, X } from 'lucide-react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, typography } from '@/theme';

type ToastPayload = {
  title: string;
  body: string;
};

const AUTO_DISMISS_MS = 5000;
const SLIDE_IN_MS = 280;
const SLIDE_OUT_MS = 220;

type Listener = (payload: ToastPayload | null) => void;
const listeners = new Set<Listener>();

export function showToast(payload: ToastPayload) {
  for (const l of listeners) l(payload);
}

function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function ToastHost() {
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const insets = useSafeAreaInsets();
  // -100 (hidden above the screen) → 0 (visible). We translate by an amount
  // larger than the eventual height because we don't know the height until
  // after layout; -100 is plenty.
  const translateY = useSharedValue(-200);
  const opacity = useSharedValue(0);

  useEffect(() => {
    return subscribe((next) => setPayload(next));
  }, []);

  useEffect(() => {
    if (!payload) return;
    translateY.value = withTiming(0, {
      duration: SLIDE_IN_MS,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, { duration: SLIDE_IN_MS });

    const t = setTimeout(() => {
      dismiss();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(t);
    // payload identity is the trigger; functions are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const dismiss = () => {
    opacity.value = withTiming(0, { duration: SLIDE_OUT_MS });
    translateY.value = withTiming(
      -200,
      { duration: SLIDE_OUT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setPayload)(null);
      },
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!payload) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: insets.top + 8 }, animatedStyle]}
    >
      <View style={styles.card}>
        <CheckCircle size={24} color={colors.status.success} />
        <View style={styles.textCol}>
          <Text style={styles.title}>{payload.title}</Text>
          <Text style={styles.body}>{payload.body}</Text>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <X size={20} color={colors.text.secondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface.base,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.status.success,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodySmall,
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    color: colors.text.primary,
  },
  body: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
