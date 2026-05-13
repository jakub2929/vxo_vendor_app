import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { colors, radius, spacing, typography } from '@/theme';

export type Trade = 'hvac' | 'plumbing' | 'handyman' | 'electrical';

const OPTIONS: { value: Trade; label: string }[] = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'handyman', label: 'Handyman' },
  { value: 'electrical', label: 'Electrical' },
];

type Props = {
  visible: boolean;
  selected: Trade[];
  onClose: () => void;
  onChange: (next: Trade[]) => void;
};

export function TradeServicesPicker({ visible, selected, onClose, onChange }: Props) {
  const toggle = (value: Trade) => {
    onChange(
      selected.includes(value) ? selected.filter((t) => t !== value) : [...selected, value],
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Trade & Services</Text>
      <View style={styles.list}>
        {OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => toggle(opt.value)}
            >
              <Text style={[styles.label, isSelected && styles.labelSelected]}>{opt.label}</Text>
              {isSelected ? <Check size={20} color={colors.brand.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable style={styles.doneBtn} onPress={onClose}>
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </BottomSheet>
  );
}

export function tradesToLabel(trades: Trade[]): string {
  return trades
    .map((t) => OPTIONS.find((o) => o.value === t)?.label ?? t)
    .join(', ');
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    height: 56,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surface.mutedAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowSelected: {
    backgroundColor: colors.brand.surfaceTint,
  },
  label: {
    ...typography.bodySmall,
    color: colors.text.primary,
  },
  labelSelected: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    color: colors.brand.primary,
  },
  doneBtn: {
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  doneText: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.2,
    color: colors.surface.base,
  },
});
