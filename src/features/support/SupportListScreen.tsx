import { router, useFocusEffect } from 'expo-router';
import { UserPlus, Users } from 'lucide-react-native';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientHeader } from '@/components/GradientHeader';
import { useVendor } from '@/hooks/useVendor';
import { colors } from '@/theme';
import { SupportListItem } from './SupportListItem';
import { useSupportSummary } from './useSupportSummary';
import type {
  SupportMessage,
  ThreadType,
} from './useSupportThread';

const PREVIEW_MAX = 80;

function previewFor(msg: SupportMessage | null): string | undefined {
  if (!msg) return undefined;
  const body =
    msg.message.length > PREVIEW_MAX
      ? `${msg.message.slice(0, PREVIEW_MAX - 1)}…`
      : msg.message;
  return msg.sender === 'vendor' ? `You: ${body}` : body;
}

export function SupportListScreen() {
  const { vendor } = useVendor();
  const { summaries, refresh } = useSupportSummary(vendor?.id);

  // SecureStore is async — re-read on every focus so opening a thread (which
  // writes lastOpenedAt) clears the badge when we navigate back here.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const open = (threadType: ThreadType) =>
    router.push(`/(tabs)/support/${threadType}`);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <GradientHeader
          title="VXO Support"
          onBack={handleBack}
          onMorePress={() => console.log('[SupportList] more pressed')}
        />
        <View style={styles.list}>
          <SupportListItem
            title="Current Job Support"
            Icon={Users}
            onPress={() => open('current_job')}
            preview={previewFor(summaries.current_job.lastMessage)}
            unreadCount={summaries.current_job.unreadCount}
          />
          <SupportListItem
            title="General Q & A"
            Icon={UserPlus}
            onPress={() => open('general')}
            preview={previewFor(summaries.general.lastMessage)}
            unreadCount={summaries.general.unreadCount}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.base },
  container: { flex: 1, backgroundColor: colors.surface.base },
  list: {
    paddingTop: 24,
    gap: 24,
  },
});
