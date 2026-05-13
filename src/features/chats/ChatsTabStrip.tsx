import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ChatsTab = 'chats' | 'status';

type Props = {
  active: ChatsTab;
  onChange: (tab: ChatsTab) => void;
  /** Count badge next to the "Jobs" label (Figma node 4:10443 shows "5").
   *  Pass 0 / undefined to hide the badge. */
  jobsCount?: number;
};

// Tab strip sits inside the blue gradient header. Active variant gets white
// text + 4pt white underline; inactive gets #E0E0E0 text. The "Jobs" tab on
// Figma 4:10443 shows a count badge — small white pill with brand-blue text.
export function ChatsTabStrip({ active, onChange, jobsCount }: Props) {
  return (
    <View style={styles.container}>
      <TabButton
        label="Jobs"
        isActive={active === 'chats'}
        onPress={() => onChange('chats')}
        badgeCount={jobsCount}
      />
      <TabButton
        label="Home"
        isActive={active === 'status'}
        onPress={() => onChange('status')}
      />
    </View>
  );
}

function TabButton({
  label,
  isActive,
  onPress,
  badgeCount,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  badgeCount?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={
        badgeCount && badgeCount > 0
          ? `${label}, ${badgeCount} active`
          : label
      }
    >
      <View style={styles.labelRow}>
        <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
          {label}
        </Text>
        {badgeCount != null && badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount}</Text>
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
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 1000,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.2,
    color: '#246BFD',
  },
  label: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelInactive: {
    color: '#E0E0E0',
  },
  underline: {
    height: 4,
    width: '100%',
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: '#ffffff',
  },
});
