import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MoreHorizontal, Search } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '@/theme';

type Props = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onSearchPress?: () => void;
  onMorePress?: () => void;
};

const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0.5 };

export function GradientHeader({
  title,
  showBack = true,
  onBack,
  onSearchPress,
  onMorePress,
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
          {showBack && (
            <Pressable
              hitSlop={12}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft color="#fff" size={28} />
            </Pressable>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.rightCluster}>
          {onSearchPress && (
            <Pressable
              hitSlop={8}
              onPress={onSearchPress}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <Search color="#fff" size={28} />
            </Pressable>
          )}
          {onMorePress && (
            <Pressable
              hitSlop={8}
              onPress={onMorePress}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <MoreHorizontal color="#fff" size={28} />
            </Pressable>
          )}
        </View>
      </View>
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
    color: '#ffffff',
    flexShrink: 1,
  },
});
