import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FillProfile } from '@/components/FillProfile';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

export default function FillProfileScreen() {
  const router = useRouter();
  const { submitted } = useLocalSearchParams<{ submitted?: string }>();
  const [email, setEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? undefined);
    });
  }, []);

  // Only expose a back affordance when there is somewhere to go — AuthGate
  // arrives here via router.replace(), which leaves an empty navigation stack.
  const canGoBack = router.canGoBack();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <FillProfile
          initialEmail={email}
          initiallySubmitted={submitted === '1'}
          onBack={canGoBack ? () => router.back() : undefined}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.base },
  flex: { flex: 1 },
});
