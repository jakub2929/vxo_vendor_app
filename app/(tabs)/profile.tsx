import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { colors } from '@/theme';

// GradientHeader inside ProfileScreen consumes the top inset itself, so we
// limit SafeAreaView to the bottom edge to avoid double padding.
export default function Profile() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ProfileScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.base },
});
