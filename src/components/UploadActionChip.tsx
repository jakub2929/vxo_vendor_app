import { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import { colors, typography } from '@/theme';

type Props = {
  label: string;
  color: string;
  Icon: ComponentType<LucideProps>;
  onPress: () => void;
};

export function UploadActionChip({ label, color, Icon, onPress }: Props) {
  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      <View style={[styles.circle, { backgroundColor: color }]}>
        <Icon size={32} color={colors.surface.base} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.body,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.2,
    color: '#424242',
    textAlign: 'center',
  },
});
