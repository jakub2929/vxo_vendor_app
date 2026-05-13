import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import { Button, Header, Screen, SocialButton } from '@/components';
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

        <View style={styles.socialGroup}>
          <SocialButton
            variant="facebook"
            label="Continue with Facebook"
            onPress={() => console.log('Facebook placeholder tapped')}
          />
          <SocialButton
            variant="google"
            label="Continue with Google"
            onPress={() => console.log('Google placeholder tapped')}
          />
          <SocialButton
            variant="apple"
            label="Continue with Apple"
            onPress={() => console.log('Apple placeholder tapped')}
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button onPress={() => router.push('/(public)/login' as any)}>
          Sign in with Email
        </Button>

        <View style={styles.bottomSpacer} />

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
    marginBottom: spacing.lg,
  },
  socialGroup: {
    gap: spacing.md,
  },
  dividerRow: {
    marginVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider.soft,
  },
  dividerText: {
    ...typography.body,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    color: colors.text.tertiary,
  },
  bottomSpacer: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
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
