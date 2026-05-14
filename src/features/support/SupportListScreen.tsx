import { router } from 'expo-router';
import { UserPlus, Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientHeader } from '@/components/GradientHeader';
import { colors } from '@/theme';
import { SupportListItem } from './SupportListItem';

export function SupportListScreen() {
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

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
            onPress={() => router.push('/(tabs)/support/current_job')}
          />
          <SupportListItem
            title="General Q & A"
            Icon={UserPlus}
            onPress={() => router.push('/(tabs)/support/general')}
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
