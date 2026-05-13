import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
};

// Mirrors Figma node 4:10320: 24px box with 3px brand-primary border, radius 8,
// gap 12 to label (Urbanist SemiBold 14 #212121).
export function Checkbox({ value, onValueChange, label }: Props) {
  return (
    <Pressable style={styles.row} onPress={() => onValueChange(!value)}>
      <View style={[styles.box, value && styles.boxChecked]}>
        {value ? <Check size={16} color={colors.surface.base} strokeWidth={2.5} /> : null}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.base,
  },
  boxChecked: {
    backgroundColor: colors.brand.primary,
  },
  label: {
    ...typography.bodySmall,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    color: colors.text.primary,
  },
});
