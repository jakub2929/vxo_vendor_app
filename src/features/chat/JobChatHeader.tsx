// Job Chat detail header (Figma node 4:10094 — "Categories=Chat Header").
//
// Same gradient + safe-area shape as ChatsHeader, but the right cluster is
// (call, more-circle) instead of (search, more-circle), and the left cluster
// is (back arrow, formatJobNumber(id)). The "more" button opens the
// JobChatHeaderPopover.
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MoreHorizontal, Phone } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '@/theme';

type Props = {
  title: string;
  onBack: () => void;
  onCallPress?: () => void;
  onMorePress?: () => void;
};

const GRADIENT_START = { x: 0.913, y: 0.783 };
const GRADIENT_END = { x: 0.087, y: 0.217 };

export function JobChatHeader({ title, onBack, onCallPress, onMorePress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={colors.brand.headerGradient}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.container, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.row}>
        <View style={styles.leftCluster}>
          <Pressable
            hitSlop={12}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#FFFFFF" size={28} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.rightCluster}>
          <Pressable
            hitSlop={8}
            onPress={onCallPress}
            accessibilityRole="button"
            accessibilityLabel="Contact project manager"
          >
            <Phone color="#FFFFFF" size={28} fill="#FFFFFF" />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={onMorePress}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <MoreHorizontal color="#FFFFFF" size={28} />
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  row: {
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
  title: {
    ...typography.h3,
    color: '#FFFFFF',
    flexShrink: 1,
  },
});
