import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Button, Header, Screen } from '@/components';
import { OTPInput } from '@/features/auth/OTPInput';
import { signOut } from '@/lib/auth';
import {
  type BiometricCapability,
  getBiometricCapability,
  promptBiometric,
} from '@/lib/biometric';
import {
  MAX_FAILED_ATTEMPTS,
  clearBiometricEnabled,
  getFailedAttempts,
  incFailedAttempts,
  isBiometricEnabled,
  markUnlocked,
  resetFailedAttempts,
  verifyPin,
} from '@/lib/pinStore';
import { colors, spacing, typography } from '@/theme';

const PIN_LENGTH = 4;

export default function UnlockScreen() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Capability is resolved once on mount; null = still resolving, never
  // re-queried for the lifetime of this screen.
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [biometricArmed, setBiometricArmed] = useState(false);
  // Guard: auto-prompt only on the first mount. If the user cancels and we
  // later re-render for any reason, we don't want the prompt to re-fire — that
  // would make Cancel feel broken.
  const autoPromptFired = useRef(false);

  const verify = useCallback(async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyPin(pin);
      if (ok) {
        await resetFailedAttempts();
        markUnlocked();
        router.replace('/(tabs)');
        return;
      }
      const attempts = await incFailedAttempts();
      const remaining = MAX_FAILED_ATTEMPTS - attempts;
      if (remaining <= 0) {
        // signOut wipes the Supabase session + SecureStore. AuthGate detects
        // the SIGNED_OUT event and — because this screen lives in
        // (authed-no-tabs), not (public) — its `!session && !inPublic` rule
        // redirects to /(public)/welcome automatically. No explicit nav here.
        await signOut();
        return;
      }
      setValue('');
      setError(
        `Incorrect PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} left.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify PIN.');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (value.length !== PIN_LENGTH || busy) return;
    void verify(value);
  }, [busy, value, verify]);

  const handleForgot = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // AuthGate handles the redirect to welcome via the SIGNED_OUT listener
      // (see lockout-branch comment above).
      await signOut();
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const handleComplete = useCallback(
    (next: string) => {
      void verify(next);
    },
    [verify],
  );

  // Trigger the OS biometric sheet. Called both auto on mount (if armed) and
  // from the "Use [Type]" retry button. On success we shortcut the PIN entry
  // entirely — same end state as a correct PIN: reset counter, mark unlocked,
  // route to (tabs).
  const promptBiometricUnlock = useCallback(async () => {
    if (!capability?.supported || busy) return;
    setBusy(true);
    setError(null);
    const result = await promptBiometric(`Unlock VXO with ${capability.humanName}`);
    if (result.success) {
      await resetFailedAttempts();
      markUnlocked();
      router.replace('/(tabs)');
      return;
    }
    // On user cancel ('cancelled') we silently fall through to PIN entry —
    // the PIN pad is already visible underneath, so no extra UI change.
    // On 'lockout' / 'unavailable' / 'error' we also fall through and let the
    // user enter their PIN. The capability mount-effect above already
    // auto-clears `biometric.enabled` if the OS revoked permission, so this
    // path is rare.
    setBusy(false);
  }, [busy, capability]);

  // Persistent counter survives kills — show remaining attempts on mount so a
  // user who failed 3 times then force-quit doesn't think they have 5 fresh.
  // Also handles the edge case where the app was killed at exactly the lockout
  // threshold: signOut never fired, but the counter says we're already locked.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const attempts = await getFailedAttempts();
      if (cancelled) return;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        // AuthGate redirects via the SIGNED_OUT listener.
        await signOut();
        return;
      }
      if (attempts > 0) {
        const remaining = MAX_FAILED_ATTEMPTS - attempts;
        setError(
          `${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} left before sign-out.`,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Biometric capability + OS-level revocation check on mount.
  // - If the stored flag says enabled but the OS now says no hardware / not
  //   enrolled (user disabled Face ID for VXO in iOS Settings, factory reset
  //   the phone, etc.), silently clear the flag so Settings shows reality and
  //   the user can re-enable cleanly. Fall through to PIN-only.
  // - If the flag is enabled AND capability still works, "arm" the auto-prompt
  //   so the next render fires it. We split arming from triggering so the
  //   prompt doesn't fire before the screen has had a chance to render the PIN
  //   pad underneath — a cancelled prompt should leave the user looking at
  //   the pad, not a blank screen.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [enabled, cap] = await Promise.all([
        isBiometricEnabled(),
        getBiometricCapability(),
      ]);
      if (cancelled) return;
      setCapability(cap);
      if (!enabled) return;
      if (!cap.supported) {
        // OS-level revocation. Auto-clear the stale flag.
        await clearBiometricEnabled();
        return;
      }
      setBiometricArmed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fire the auto-prompt exactly once after arming. The guard ref ensures a
  // cancelled prompt doesn't keep re-prompting on every re-render.
  useEffect(() => {
    if (!biometricArmed || autoPromptFired.current) return;
    autoPromptFired.current = true;
    void promptBiometricUnlock();
  }, [biometricArmed, promptBiometricUnlock]);

  const biometricButtonLabel =
    capability?.supported ? `Use ${capability.humanName}` : null;

  return (
    <Screen noPadding>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Header title="Enter Your PIN" showBackButton={false} />

          <View style={styles.middle}>
            <Text style={styles.subtitle}>Enter your 4-digit PIN to unlock VXO.</Text>

            <OTPInput
              value={value}
              onChange={setValue}
              length={PIN_LENGTH}
              boxWidth={83}
              boxGap={16}
              mask
              onComplete={handleComplete}
            />

            {biometricButtonLabel ? (
              <Pressable
                onPress={() => void promptBiometricUnlock()}
                hitSlop={8}
                disabled={busy}
              >
                <Text style={styles.biometricLink}>{biometricButtonLabel}</Text>
              </Pressable>
            ) : null}

            <Pressable onPress={handleForgot} hitSlop={8} disabled={busy}>
              <Text style={styles.forgotLink}>Forgot PIN?</Text>
            </Pressable>
          </View>

          <View style={styles.buttonWrap}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button
              onPress={handleSubmit}
              disabled={value.length !== PIN_LENGTH || busy}
              loading={busy}
            >
              Unlock
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const SECTION_GAP = 48;
const BUTTON_GAP = 48;

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  middle: {
    marginTop: spacing.xxl + spacing.md,
    gap: SECTION_GAP,
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: colors.text.primary,
    textAlign: 'center',
    width: '100%',
  },
  forgotLink: {
    ...typography.body,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    color: colors.brand.primary,
    textAlign: 'center',
  },
  biometricLink: {
    ...typography.body,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
    fontSize: 18,
    color: colors.brand.primary,
    textAlign: 'center',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.danger,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  buttonWrap: {
    marginTop: BUTTON_GAP,
  },
});
