// Note: This screen is labeled "Jobs / Home" in the UI per Figma. Internal naming
// ("chats", "ChatsScreen") is legacy; rename in a future cleanup if it bothers anyone.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadows } from '@/theme';
import { ChatsHeader } from './ChatsHeader';
import { ChatsTabStrip, type ChatsTab } from './ChatsTabStrip';
import { MoreMenu } from './MoreMenu';

// 1:1 implementation of Figma node 4:10155 (the "Jobs" tab empty / welcome
// state). The Home tab content is not specified by this Figma frame — left
// intentionally blank pending a dedicated design.
export function ChatsScreen() {
  const [activeTab, setActiveTab] = useState<ChatsTab>('chats');
  const [menuVisible, setMenuVisible] = useState(false);

  const handleContactVXO = () => {
    router.push('/(tabs)/support');
  };

  const handleProfile = () => {
    router.push('/(tabs)/profile');
  };

  const handleStripe = () => {
    // TODO: open Stripe Connect Express onboarding link in a WebView once the
    // backend endpoint to mint the account link is wired.
    console.log('[ChatsScreen] open Stripe');
  };

  const handleSettings = () => {
    console.log('[ChatsScreen] open settings');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <ChatsHeader
          onSearchPress={() => console.log('[ChatsScreen] search pressed')}
          onMorePress={() => setMenuVisible(true)}
          tabs={<ChatsTabStrip active={activeTab} onChange={setActiveTab} />}
        />
        {activeTab === 'chats' ? <JobsWelcome /> : <View style={styles.flex} />}
        <MoreMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onSelectContactVXO={handleContactVXO}
          onSelectProfile={handleProfile}
          onSelectStripe={handleStripe}
          onSelectSettings={handleSettings}
        />
      </View>
    </SafeAreaView>
  );
}

function JobsWelcome() {
  return (
    <View style={styles.bodyContainer}>
      <View style={styles.bodyInner}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Welcome! 👋</Text>
          <Text style={styles.subtitle}>
            VXO AI connects you with Local Companies and Homeowners who need your Help!
          </Text>
        </View>
        <Pressable
          onPress={() => console.log('[ChatsScreen] accept first work order')}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Accept First your first Work Order"
        >
          <Text style={styles.ctaText}>Accept First your first Work Order</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.base },
  container: { flex: 1, backgroundColor: colors.surface.base },
  flex: { flex: 1 },
  bodyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  bodyInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 60,
    paddingVertical: 60,
  },
  titleBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 40,
    lineHeight: 48,
    color: colors.brand.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 25.2,
    letterSpacing: 0.2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  cta: {
    width: '100%',
    backgroundColor: colors.brand.primary,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },
  ctaPressed: { opacity: 0.9 },
  ctaText: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: '#ffffff',
    textAlign: 'center',
  },
});
