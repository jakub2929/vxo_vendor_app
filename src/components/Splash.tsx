import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { VXOWordmark } from './VXOWordmark';

type Circle = {
  size: number;
  top: DimensionValue;
  left: DimensionValue;
  opacity: number;
};

// Hardcoded decorative confetti — positions/sizes traced from
// assets/figma-refs/1-light-splash-screen.png. Centered cluster around the
// wordmark (which lives at ~50% vertical), avoiding a ~140pt-tall safe band
// in the middle so the circles never overlap the logo.
const CIRCLES: readonly Circle[] = [
  { size: 56, top: '32%', left: '11%', opacity: 0.55 },
  { size: 14, top: '24%', left: '37%', opacity: 0.5 },
  { size: 16, top: '27%', left: '70%', opacity: 0.5 },
  { size: 46, top: '34%', left: '83%', opacity: 0.55 },
  { size: 10, top: '38%', left: '21%', opacity: 0.55 },
  { size: 9, top: '45%', left: '90%', opacity: 0.55 },
  { size: 10, top: '46%', left: '8%', opacity: 0.5 },
  { size: 18, top: '54%', left: '90%', opacity: 0.55 },
  { size: 32, top: '58%', left: '8%', opacity: 0.55 },
  { size: 10, top: '58%', left: '45%', opacity: 0.5 },
  { size: 48, top: '62%', left: '70%', opacity: 0.55 },
  { size: 14, top: '66%', left: '30%', opacity: 0.5 },
] as const;

export function Splash() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {CIRCLES.map((c, i) => (
        <View
          key={i}
          style={[
            styles.circle,
            {
              width: c.size,
              height: c.size,
              top: c.top,
              left: c.left,
              opacity: c.opacity,
            },
          ]}
        />
      ))}

      <View style={styles.center} pointerEvents="none">
        <VXOWordmark width={320} />
      </View>

      <View style={styles.spinner}>
        <ActivityIndicator size="small" color={colors.brand.primary} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  circle: {
    position: 'absolute',
    backgroundColor: colors.brand.primary,
    borderRadius: 999,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 80,
    alignItems: 'center',
  },
});
