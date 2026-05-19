import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue } from 'react-native';
import { colors } from '@/theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: object;
};

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.divider.soft,
          opacity,
        },
        style,
      ]}
    />
  );
}

type SkeletonTextProps = {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  lastLineWidth?: DimensionValue;
};

export function SkeletonText({
  lines = 1,
  lineHeight = 14,
  gap = 8,
  lastLineWidth = '70%',
}: SkeletonTextProps) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
        />
      ))}
    </View>
  );
}

type SkeletonCardProps = {
  height?: number;
  borderRadius?: number;
};

export function SkeletonCard({
  height = 64,
  borderRadius = 12,
}: SkeletonCardProps) {
  return <Skeleton height={height} borderRadius={borderRadius} />;
}

// Pre-composed row used by the Home tab — avatar circle + two stacked bars,
// matching HomeJobRow's outer dimensions so the swap from skeleton → data
// doesn't snap. Lifted from the original inline implementation in HomeTab.
export function SkeletonRow() {
  return (
    <View style={rowStyles.card}>
      <Skeleton width={75} height={75} borderRadius={1000} />
      <View style={rowStyles.content}>
        <Skeleton height={18} borderRadius={4} />
        <Skeleton height={8} borderRadius={1000} />
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: colors.surface.base,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.base,
  },
  content: {
    flex: 1,
    gap: 8,
  },
});
