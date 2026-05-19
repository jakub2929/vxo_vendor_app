import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChatsHeader } from '@/features/chats/ChatsHeader';
import { ChatsTabStrip } from '@/features/chats/ChatsTabStrip';
import { colors } from '@/theme';
import { LearnMoreInfoCard } from './LearnMoreInfoCard';

// 1:1 implementation of Figma node 4:10017 ("Learn More VXO Oppertuities").
//
// Header reuses ChatsHeader with `onBack` set (back arrow inserted left of
// the mascot — see ChatsHeader.tsx prop comment) and a non-interactive
// Jobs/Home tab strip with Home selected. Figma's frame omits the back
// arrow entirely; we add it for Android parity + UX safety (signed off).
//
// Last card has two inline links: support@vxoai.com → mailto, and
// "message us anytime through the app" → /(tabs)/support/general.
export function LearnMoreScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <ChatsHeader
        onBack={() => router.back()}
        tabs={
          <ChatsTabStrip
            active="home"
            // Decorative on detail screens — tapping a tab here would be
            // confusing UX. Figma has no prototype links on the strip.
            onChange={() => {}}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <LearnMoreInfoCard title="More Jobs. Better Clients.">
          <Text style={styles.body}>
            VXO sends you real local jobs the moment they come in. No bidding,
            no cold calls — just work in your area matched to your trade.
          </Text>
        </LearnMoreInfoCard>

        <LearnMoreInfoCard title="5 Stars Unlocks More">
          <Text style={styles.body}>
            Complete 10 jobs with a 5-star rating and you&apos;ll get access
            to exclusive opportunities — priority dispatch, larger commercial
            jobs, and premium clients that request verified vendors only.
          </Text>
        </LearnMoreInfoCard>

        <LearnMoreInfoCard title="Verified Vendor Badge">
          <Text style={styles.body}>
            Upload your COI and W-9 to become a Verified VXO Vendor.
            Verification is required for any job over $500 and all commercial
            accounts.
          </Text>
        </LearnMoreInfoCard>

        <LearnMoreInfoCard title="Getting Paid">
          <Text style={styles.body}>Fast, Automatic Payouts</Text>
          <Text style={styles.body}>
            Clients pay through VXO. You receive your payout within 24 hours
            of job completion — directly to your bank account. No chasing
            invoices.
          </Text>
        </LearnMoreInfoCard>

        <LearnMoreInfoCard title="Questions? We're here.">
          <Text style={styles.body}>
            Email:{' '}
            <Text
              style={styles.link}
              onPress={() => {
                void Linking.openURL('mailto:support@vxoai.com');
              }}
              accessibilityRole="link"
            >
              support@vxoai.com
            </Text>
          </Text>
          <Text style={styles.body}>
            Or{' '}
            <Text
              style={styles.link}
              onPress={() => router.push('/(tabs)/support/general')}
              accessibilityRole="link"
            >
              message us anytime through the app
            </Text>
            .
          </Text>
        </LearnMoreInfoCard>
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
  body: {
    fontFamily: 'Urbanist-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.bodyAlt,
  },
  link: {
    color: colors.brand.primary,
    fontFamily: 'Urbanist-SemiBold',
    fontWeight: '600',
  },
});
