import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export type ChatsTab = 'chats' | 'status';

type Props = {
  active: ChatsTab;
  chatsCount: number;
  onChange: (tab: ChatsTab) => void;
};

// Tabs sit inside the blue gradient ChatsHeader — see Figma node
// I4:10141;1130:20166. Active = white text + white circle badge with blue
// number inside; inactive = greyscale 300 (#E0E0E0). Underline is a full-width
// white bar 4pt tall.
export function ChatsTabStrip({ active, chatsCount, onChange }: Props) {
  return (
    <View style={styles.container}>
      <TabButton
        label="Chats"
        badgeCount={chatsCount}
        isActive={active === 'chats'}
        onPress={() => onChange('chats')}
      />
      <TabButton
        label="Status"
        isActive={active === 'status'}
        onPress={() => onChange('status')}
      />
    </View>
  );
}

function TabButton({
  label,
  badgeCount,
  isActive,
  onPress,
}: {
  label: string;
  badgeCount?: number;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={
        badgeCount !== undefined ? `${label}, ${badgeCount} new` : label
      }
    >
      <View style={styles.labelRow}>
        <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
          {label}
        </Text>
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </View>
      <View style={[styles.underline, isActive && styles.underlineActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 24,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  label: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: '#ffffff',
  },
  labelInactive: {
    color: '#E0E0E0',
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.brand.primary,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 13,
  },
  underline: {
    height: 4,
    width: '100%',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: '#ffffff',
  },
});
