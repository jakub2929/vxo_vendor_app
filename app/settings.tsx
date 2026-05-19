import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { GradientHeader } from '@/components/GradientHeader';
import {
  type BiometricCapability,
  getBiometricCapability,
  promptBiometric,
} from '@/lib/biometric';
import {
  clearAllAuth,
  clearBiometricEnabled,
  clearUnlockedSession,
  isBiometricEnabled,
  isPinConfigured,
  markBiometricEnabled,
} from '@/lib/pinStore';
import { colors } from '@/theme';

// Minimal Settings screen. Reachable from the More menu's Settings entry.
// Header uses the shared back+title gradient pattern (Figma 4:10127), same
// shell as Profile and Support detail screens.
//
// Rows today:
//   - Biometric toggle — conditional on PIN configured + device capable.
//     Phase 2 addition; hidden entirely on devices without biometric.
//   - Reset PIN — same wipe surface as the 5-fail lockout.
//   - About — version + build number from expo-application (read at runtime,
//     so EAS remote-versioned builds report the actual installed version, not
//     a stale string from app.json).

export default function SettingsScreen() {
  const router = useRouter();

  // Three pieces of state drive whether/how the biometric row renders:
  //   - capability: result of the OS probe (Face ID / Touch ID / unsupported)
  //   - pinConfigured: the row stays hidden until a PIN is set, since
  //     biometric requires PIN as prerequisite
  //   - biometricOn: the in-app toggle state, mirrored to SecureStore
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [pinConfigured, setPinConfigured] = useState<boolean | null>(null);
  const [biometricOn, setBiometricOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  // Refresh state on mount. We do NOT subscribe to changes — if the user
  // toggles biometric off here and navigates back to Jobs, then re-enters
  // Settings, the screen remounts and re-reads. That's fine for this UI.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cap, hasPin, enabled] = await Promise.all([
        getBiometricCapability(),
        isPinConfigured(),
        isBiometricEnabled(),
      ]);
      if (cancelled) return;
      setCapability(cap);
      setPinConfigured(hasPin);
      setBiometricOn(enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showBiometricRow =
    capability?.supported === true && pinConfigured === true && biometricOn !== null;

  const handleBiometricToggle = async (nextValue: boolean) => {
    if (!capability?.supported || busy) return;
    setBusy(true);
    try {
      if (nextValue) {
        // Enabling: require a successful authenticateAsync to prove the user
        // can actually use biometric on this device. Prevents enabling a
        // stale flag when, e.g., Face ID was disabled at the OS level after
        // capability probe returned supported but auth no longer works.
        const result = await promptBiometric(
          `Enable ${capability.humanName} for VXO`,
        );
        if (!result.success) {
          // Don't change UI state — toggle remains off. Surface a soft
          // message only for failure paths, not user-cancelled.
          if (result.reason !== 'cancelled') {
            Alert.alert(
              `Couldn't enable ${capability.humanName}`,
              'Please try again, or use PIN to unlock VXO.',
            );
          }
          return;
        }
        await markBiometricEnabled();
        setBiometricOn(true);
      } else {
        // Disabling: just clear the flag. No auth challenge required —
        // toggling biometric OFF is a downgrade in security, not an upgrade,
        // so we accept it freely. The PIN remains as the unlock method.
        await clearBiometricEnabled();
        setBiometricOn(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResetPin = () => {
    Alert.alert(
      'Reset PIN?',
      "This removes your current PIN. You'll set up a new one immediately.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            // Same wipe surface as 5-fail lockout, by design — one helper, one
            // source of truth. The lockout path calls signOut() (which also
            // clears the Supabase session); here we keep the session, since
            // the user is doing an in-app reset, not authenticating again.
            // clearAllAuth wipes biometric.enabled + biometric.offered along
            // with PIN keys, so the user goes through the full setup-pin →
            // setup-biometric flow again on next launch.
            await clearAllAuth();
            clearUnlockedSession();
            router.replace('/(authed-no-tabs)/setup-pin');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <GradientHeader title="Settings" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Security</Text>

        {showBiometricRow ? (
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.cardTitle}>{capability.humanName}</Text>
                <Text style={styles.cardBody}>
                  Unlock VXO with {capability.humanName} instead of typing your PIN.
                </Text>
              </View>
              <Switch
                value={biometricOn === true}
                onValueChange={handleBiometricToggle}
                disabled={busy}
                trackColor={{ false: colors.divider.base, true: colors.brand.primary }}
              />
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={handleResetPin}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          accessibilityRole="button"
          accessibilityLabel="Reset PIN"
        >
          <Text style={styles.cardTitle}>Reset PIN</Text>
          <Text style={styles.cardBody}>
            Remove your PIN and set up a new one. You&apos;ll be asked to create a PIN the
            next time you open the app.
          </Text>
        </Pressable>

        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Version</Text>
          <Text style={styles.cardBody}>
            {Application.nativeApplicationVersion ?? 'unknown'}
            {Application.nativeBuildVersion
              ? ` (${Application.nativeBuildVersion})`
              : ''}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 24,
    gap: 24,
  },
  sectionTitle: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.bodyAlt,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface.mutedAlt,
    borderWidth: 2,
    borderColor: colors.surface.muted,
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  cardPressed: {
    opacity: 0.7,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toggleText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.primary,
  },
  cardBody: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.bodyAlt,
  },
});
