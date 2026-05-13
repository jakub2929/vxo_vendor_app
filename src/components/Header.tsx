import { View, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';

type Props = {
  title?: string;
  showBackButton?: boolean;
};

// Mirrors Figma navbar component (e.g. node 4:10248 on the OTP screen):
// 28px back arrow + 12px gap + Urbanist Bold 24 #212121 title, total height 48
// with 12px vertical padding.
export function Header({ title, showBackButton = true }: Props) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {showBackButton && (
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={28} color={colors.text.primary} />
        </Pressable>
      )}
      {title && <Text style={styles.title}>{title}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: spacing.sm + spacing.xs,
  },
  backButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
  },
});
