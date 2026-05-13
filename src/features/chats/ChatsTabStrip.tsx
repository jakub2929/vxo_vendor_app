import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ChatsTab = 'chats' | 'status';

type Props = {
  active: ChatsTab;
  onChange: (tab: ChatsTab) => void;
};

// Tab strip sits inside the blue gradient header. Per Figma node
// I4:10157;1130:20166 — "Jobs" (active: white text + 4pt white underline)
// and "Home" (inactive: #E0E0E0 text, no underline). No badge on this frame.
export function ChatsTabStrip({ active, onChange }: Props) {
  return (
    <View style={styles.container}>
      <TabButton
        label="Jobs"
        isActive={active === 'chats'}
        onPress={() => onChange('chats')}
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
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={label}
    >
      <Text style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
        {label}
      </Text>
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
