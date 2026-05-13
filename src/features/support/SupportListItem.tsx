import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows, typography } from '@/theme';

type IconProps = { size: number; color: string };

type Props = {
  title: string;
  Icon: ComponentType<IconProps>;
  onPress: () => void;
};

const AVATAR_SIZE = 60;
const FAB_SIZE = 36;
const GRADIENT_START = { x: 1, y: 0 };
const GRADIENT_END = { x: 0, y: 1 };

export function SupportListItem({ title, Icon, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <LinearGradient
        colors={colors.brand.headerGradient}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={styles.avatar}
      >
        <Icon size={24} color="#ffffff" />
      </LinearGradient>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.fabShadow}>
        <LinearGradient
          colors={colors.brand.headerGradient}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={styles.fab}
        >
          <MessageCircle size={18} color="#ffffff" />
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyBold,
    color: colors.text.primary,
    flex: 1,
  },
  fabShadow: {
    borderRadius: FAB_SIZE / 2,
    ...shadows.glow,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
