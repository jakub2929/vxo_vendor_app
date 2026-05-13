import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconlyMoreCircle } from '@/components/IconlyMoreCircle';
import { IconlySearch } from '@/components/IconlySearch';
import { VXOMascot } from '@/components/VXOMascot';
import { colors } from '@/theme';

type Props = {
  onSearchPress?: () => void;
  onMorePress?: () => void;
  tabs?: ReactNode;
  // When provided, renders a back arrow to the left of the mascot. Used on
  // push detail screens (e.g. Learn More 4:10017) so the brand cluster stays
  // intact while gaining a tappable back affordance — Android has no
  // swipe-back and we want parity with JobChatHeader.
  onBack?: () => void;
};

// 1:1 implementation of the "Home Header" instance (4:10157) from Figma frame
// 4:10155. Vertical stack: [top safe-area] → logo row → tab strip, with gap 24
// between rows. Gradient -55.5° from #246BFD → #5089FF.
const GRADIENT_START = { x: 0.913, y: 0.783 };
const GRADIENT_END = { x: 0.087, y: 0.217 };

export function ChatsHeader({ onSearchPress, onMorePress, tabs, onBack }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={colors.brand.headerGradient}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.container, { paddingTop: insets.top + 24 }]}
    >
      <View style={styles.logoRow}>
        <View style={styles.leftCluster}>
          {onBack && (
            <Pressable
              hitSlop={12}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft color="#FFFFFF" size={28} />
            </Pressable>
          )}
          <VXOMascot size={32} color="#FFFFFF" />
          <Text style={styles.wordmark}>VXO</Text>
        </View>
        <View style={styles.rightCluster}>
          <Pressable
            hitSlop={8}
            onPress={onSearchPress}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <IconlySearch size={28} color="#FFFFFF" />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={onMorePress}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <IconlyMoreCircle size={28} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
      {tabs && <View style={styles.tabsSlot}>{tabs}</View>}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
    minHeight: 48,
  },
  leftCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  wordmark: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 28.8,
    color: '#FFFFFF',
  },
  tabsSlot: {
    // Tab strip already has its own px:24 — no extra horizontal padding here.
  },
});
