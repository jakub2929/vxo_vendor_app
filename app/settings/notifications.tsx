// Per-event push notification toggles. Reads + writes
// vendors.notification_prefs via useNotificationPrefs (see
// src/features/settings/useNotificationPrefs.ts). The "in-app toasts are
// unaffected" copy below is a real promise: useInvoicesRealtime,
// useVendorStatusToast, and the in-app Toast host fire from Supabase
// Realtime and don't consult this JSONB at all.

import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GradientHeader } from '@/components/GradientHeader';
import { useNotificationPrefs } from '@/features/settings/useNotificationPrefs';
import {
  EVENT_LABELS,
  NOTIFICATION_EVENT_ORDER,
  type NotificationEventType,
} from '@/types/notifications';
import { colors } from '@/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { prefs, togglePref } = useNotificationPrefs();

  const onToggle = (key: NotificationEventType, value: boolean) => {
    togglePref.mutate(
      { key, value },
      {
        onError: (err) => {
          Alert.alert(
            'Could not update',
            err instanceof Error ? err.message : 'Please try again.',
          );
        },
      },
    );
  };

  return (
    <View style={styles.root}>
      <GradientHeader title="Notifications" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Choose which events send a push notification to your device. In-app
          toasts are unaffected.
        </Text>

        {NOTIFICATION_EVENT_ORDER.map((key) => {
          const label = EVENT_LABELS[key];
          return (
            <View key={key} style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={styles.cardTitle}>{label.title}</Text>
                  <Text style={styles.cardBody}>{label.description}</Text>
                </View>
                <Switch
                  value={prefs[key]}
                  onValueChange={(value) => onToggle(key, value)}
                  disabled={togglePref.isPending}
                  trackColor={{
                    false: colors.divider.base,
                    true: colors.brand.primary,
                  }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={colors.divider.base}
                  accessibilityLabel={label.title}
                  accessibilityValue={{ text: prefs[key] ? 'on' : 'off' }}
                />
              </View>
            </View>
          );
        })}
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
    gap: 16,
  },
  intro: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.bodyAlt,
    marginBottom: 8,
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
