import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { colors, typography } from '@/theme';

export default function ProfileScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={typography.h3}>Profile</Text>
        <Text style={[typography.body, styles.subtitle]}>Coming soon</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  subtitle: { color: colors.text.secondary, marginTop: 8 },
});
