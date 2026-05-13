import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme';

type Props = {
  total: number;
  active: number;
};

export function PaginationDots({ total, active }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.divider.base,
  },
  dotActive: {
    width: 32,
    backgroundColor: colors.brand.primary,
  },
});
