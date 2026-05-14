import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from 'lucide-react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, typography } from '@/theme';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /**
   * Auto-dismiss after this many ms. Pass null to require an explicit tap.
   * Default 2500.
   */
  autoDismissMs?: number | null;
};

// Mirrors Figma `Theme=Light Modal` (instance 4:10189 inside 4:10176). White
// 48px-radius card, gradient-blue avatar disc with 9 satellite dots, the
// "Congratulations!" copy, and the 60×60 spinner SVG. Particles are static
// (per Figma); the spinner SVG rotates continuously with Reanimated.
//
// One-off `#7CA6FE` here is Figma `Primary/300` — used only for these
// particles, not in any other screen. Inline rather than add a theme token.
const PARTICLE_COLOR = '#7CA6FE';

// Particle offsets are copied from the Figma Group `I4:10189;435:6033`
// (positions are ml/mt within the 196×196 hero container).
const PARTICLES: { size: number; left: number; top: number }[] = [
  { size: 20, left: 10, top: 0 },
  { size: 5, left: 104, top: 2 },
  { size: 15, left: 171, top: 20 },
  { size: 2, left: 0, top: 74 },
  { size: 5, left: 168, top: 108 },
  { size: 10, left: 5, top: 128 },
  { size: 5, left: 163, top: 158 },
  { size: 7, left: 59, top: 173 },
  { size: 2, left: 121, top: 170 },
];

function Spinner() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(rotation);
    };
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // 8 dots at 45° intervals around a 60×60 box. Varying sizes give the
  // perceived motion direction.
  const dots = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4 - Math.PI / 2; // start at 12 o'clock
    const radius = 22;
    const size = 10 - i * 0.9; // 10 → 3.7px
    const center = 30 - size / 2;
    return {
      key: i,
      size,
      left: center + Math.cos(angle) * radius,
      top: center + Math.sin(angle) * radius,
    };
  });

  return (
    <Animated.View style={[styles.spinner, animatedStyle]}>
      {dots.map((d) => (
        <View
          key={d.key}
          style={{
            position: 'absolute',
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            borderRadius: d.size / 2,
            backgroundColor: colors.brand.primary,
          }}
        />
      ))}
    </Animated.View>
  );
}

export function CongratsModal({ visible, onDismiss, autoDismissMs = 2500 }: Props) {
  useEffect(() => {
    if (!visible || autoDismissMs == null) return;
    const id = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(id);
  }, [visible, autoDismissMs, onDismiss]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        style={styles.backdrop}
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
        onPress={onDismiss}
      >
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.hero}>
            {PARTICLES.map((p, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  backgroundColor: PARTICLE_COLOR,
                }}
              />
            ))}
            <LinearGradient
              colors={colors.brand.headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <User size={59} color={colors.surface.base} strokeWidth={2} />
            </LinearGradient>
          </View>

          <View style={styles.copy}>
            <Text style={styles.title} allowFontScaling={false}>
              Congratulations!
            </Text>
            <Text style={styles.body}>
              Your account is ready. Set a PIN to keep your jobs private.
            </Text>
          </View>

          <Spinner />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const HERO_SIZE = 196;
const AVATAR_SIZE = 141;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: 340,
    backgroundColor: colors.surface.base,
    borderRadius: 48,
    paddingTop: 40,
    paddingHorizontal: 32,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 32,
  },
  hero: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    position: 'relative',
  },
  avatar: {
    position: 'absolute',
    left: 25,
    top: 20,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copy: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.brand.primary,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  spinner: {
    width: 60,
    height: 60,
  },
});
