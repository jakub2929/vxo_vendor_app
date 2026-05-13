import { LinearGradient } from 'expo-linear-gradient';
import { MoreHorizontal, Search } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VXOMascot } from '@/components/VXOMascot';
import { VXOWordmark } from '@/components/VXOWordmark';
import { colors } from '@/theme';
import type { Database } from '@/types/database';
import { StatusToggle } from './StatusToggle';

type Vendor = Database['public']['Tables']['vendors']['Row'];

type Props = {
  vendor: Vendor | null;
  onVendorChange: (next: Vendor) => void;
  onSearchPress?: () => void;
  onMorePress?: () => void;
  // Tab strip is rendered inside the gradient so it sits on the blue band per
  // Figma node 4:10141 (Home Header). Pass the <ChatsTabStrip /> here.
  tabs?: ReactNode;
};

// Header gradient + angle mirror Figma node I4:10129 (Chat Header component).
// Colors from DESIGN.md §2.1 / colors.brand.headerGradient.
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0.5 };

export function ChatsHeader({
  vendor,
  onVendorChange,
  onSearchPress,
  onMorePress,
  tabs,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={colors.brand.headerGradient}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.container, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.row}>
        <View style={styles.leftCluster}>
          <View style={styles.mascotCircle}>
            <VXOMascot size={26} color="#ffffff" />
          </View>
          <VXOWordmark width={70} tone="white" />
        </View>
        <View style={styles.rightCluster}>
          <StatusToggle vendor={vendor} onChange={onVendorChange} />
          <Pressable
            hitSlop={8}
            onPress={onSearchPress}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Search color="#fff" size={24} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={onMorePress}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <MoreHorizontal color="#fff" size={24} />
          </Pressable>
        </View>
      </View>
      {tabs && <View style={styles.tabsSlot}>{tabs}</View>}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingBottom: 16,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mascotCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tabsSlot: {
    // Negative horizontal margin lets the tabs span edge-to-edge of the header
    // while the icon row stays inset by paddingHorizontal:20.
    marginHorizontal: -20,
  },
});
