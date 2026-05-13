import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Welcome } from '@/components/Welcome';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Welcome onGetStarted={() => router.push('/(public)/lets-you-in')} />
      {__DEV__ ? (
        <Pressable
          style={[styles.devPill, { top: insets.top + 8 }]}
          onPress={() => router.push('/_debug')}
        >
          <Text style={styles.devPillText}>🚧 Debug</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  devPill: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  devPillText: {
    color: '#1F2937',
    fontWeight: '700',
    fontSize: 12,
  },
});
