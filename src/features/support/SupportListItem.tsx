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
  preview?: string;
  unreadCount?: number;
};

const AVATAR_SIZE = 60;
const FAB_SIZE = 36;
const GRADIENT_START = { x: 1, y: 0 };
const GRADIENT_END = { x: 0, y: 1 };

export function SupportListItem({
  title,
  Icon,
  onPress,
  preview,
  unreadCount = 0,
}: Props) {
  const hasUnread = unreadCount > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        hasUnread ? `${title} — ${unreadCount} unread` : title
      }
    >
      <LinearGradient
        colors={colors.brand.headerGradient}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={styles.avatar}
      >
        <Icon size={24} color="#ffffff" />
      </LinearGradient>
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {preview ? (
          <Text
            style={[styles.preview, hasUnread && styles.previewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
        ) : null}
      </View>
      {hasUnread ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : String(unreadCount)}
          </Text>
        </View>
      ) : (
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
      )}
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
  textCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text.primary,
  },
  preview: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  previewUnread: {
    color: colors.text.primary,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
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
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 14,
  },
});
