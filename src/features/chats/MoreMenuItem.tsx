import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

type Props = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
};

export function MoreMenuItem({ icon, label, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
    >
      <View style={styles.iconBox}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowPressed: {
    opacity: 0.6,
  },
  iconBox: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 14,
    color: colors.text.primary,
    letterSpacing: 0.2,
  },
});
