import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Upload } from 'lucide-react-native';
import { colors, radius, typography } from '@/theme';

type Props = {
  label: string;
  fileName?: string;
  onPress: () => void;
};

// Mirrors Figma nodes 4:10214 (Upload COI) and 4:10215 (Upload W-9): same 56h
// pill as text fields, placeholder text on the left, upload icon on the right.
export function UploadField({ label, fileName, onPress }: Props) {
  const hasFile = Boolean(fileName);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text
        style={[styles.label, hasFile && styles.labelFilled]}
        numberOfLines={1}
      >
        {hasFile ? fileName : label}
      </Text>
      <Upload size={20} color={hasFile ? colors.brand.primary : colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 56,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    backgroundColor: colors.surface.mutedAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
  labelFilled: {
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    color: colors.text.primary,
  },
});
