import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import { Button, Header, Screen } from '@/components';
import { letsYouInIllustrationXml } from '@/assets/lets-you-in-illustration';
import { colors, spacing, typography } from '@/theme';

const ILLUSTRATION_WIDTH = 237;
const ILLUSTRATION_HEIGHT = 200;

export default function LetsYouInScreen() {
  const router = useRouter();

  return (
    <Screen noPadding>
      <View style={styles.container}>
        <Header />

        <View style={styles.illustration}>
          <SvgXml
            xml={letsYouInIllustrationXml}
            width={ILLUSTRATION_WIDTH}
            height={ILLUSTRATION_HEIGHT}
          />
        </View>

        <Text style={styles.title}>Let&apos;s you in</Text>

        <View style={styles.bottomSpacer} />

        <Button onPress={() => router.push('/(public)/login' as any)}>
          Sign in with Email
        </Button>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don&apos;t have an account?</Text>
          <Pressable
            onPress={() => router.push('/(public)/sign-up' as any)}
            hitSlop={8}
          >
            <Text style={styles.footerLink}>Sign up</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xxl,
  },
  illustration: {
    width: '100%',
    height: ILLUSTRATION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  bottomSpacer: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
  footerLink: {
    ...typography.bodySmall,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    color: colors.brand.primary,
  },
});
