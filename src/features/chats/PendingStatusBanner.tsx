import { LinearGradient } from 'expo-linear-gradient';
import { Clock } from 'lucide-react-native';
import { StyleSheet, Text } from 'react-native';
import { colors } from '@/theme';

const GRADIENT_COLORS = ['#FFF4E0', '#FFE5BF'] as const;

export function PendingStatusBanner() {
  return (
    <LinearGradient
      colors={GRADIENT_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.container}
    >
      <Clock size={18} color={colors.accent.orange} />
      <Text style={styles.text} numberOfLines={2}>
        Application under review — you&apos;ll get a notification when your
        account is approved.
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider.base,
  },
  text: {
    flex: 1,
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.primary,
  },
});
