import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextInput } from '@/components/TextInput';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const DEFAULT_DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL ?? 'dev@vxo.local';

type TestResult = {
  name: string;
  status: 'pending' | 'pass' | 'fail';
  summary: string;
  raw: string;
  expected: string;
};

const RAW_LIMIT = 500;

function stringifyRaw(value: unknown): string {
  try {
    const text = JSON.stringify(value, null, 2) ?? '';
    if (text.length <= RAW_LIMIT) return text;
    return `${text.slice(0, RAW_LIMIT)}...`;
  } catch (error) {
    return `Unable to stringify response: ${String(error)}`;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export default function DebugSmokeTestScreen() {
  const insets = useSafeAreaInsets();
  const [devEmail, setDevEmail] = useState(DEFAULT_DEV_EMAIL);
  const [devPassword, setDevPassword] = useState('');
  const [devLoading, setDevLoading] = useState(false);

  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: devEmail.trim().toLowerCase(),
        password: devPassword,
      });
      if (error) {
        Alert.alert('Login failed', error.message);
        return;
      }
      Alert.alert('Signed in', JSON.stringify(data.user?.email));
    } finally {
      setDevLoading(false);
    }
  };

  const handleDevSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }
    Alert.alert('Signed out');
  };

  const [results, setResults] = useState<TestResult[]>([
    {
      name: 'Test 1: Unauthenticated SELECT on vendors',
      status: 'pending',
      summary: 'Waiting to run',
      raw: '',
      expected: 'RLS blocks unauthenticated reads -> empty array, no error',
    },
    {
      name: 'Test 2: Unauthenticated SELECT on jobs',
      status: 'pending',
      summary: 'Waiting to run',
      raw: '',
      expected: 'RLS blocks unauthenticated reads -> empty array, no error',
    },
    {
      name: 'Test 3: Realtime subscription handshake',
      status: 'pending',
      summary: 'Waiting to run',
      raw: '',
      expected: 'Realtime channel connects with status SUBSCRIBED',
    },
    {
      name: 'Test 4: Storage bucket reachable',
      status: 'pending',
      summary: 'Waiting to run',
      raw: '',
      expected: "Bucket 'job-photos' exists (RLS may block listing - that's OK)",
    },
  ]);

  useEffect(() => {
    let cancelled = false;

    const updateResult = (index: number, next: Omit<TestResult, 'name' | 'expected'>) => {
      setResults((current) => {
        const clone = [...current];
        clone[index] = {
          ...clone[index],
          ...next,
        };
        return clone;
      });
    };

    const runTestsSequentially = async () => {
      updateResult(0, { status: 'pending', summary: 'Running...', raw: '' });
      try {
        const { data, error } = await supabase.from('vendors').select('id, email, status');
        const pass = error === null && Array.isArray(data) && data.length === 0;
        updateResult(0, {
          status: pass ? 'pass' : 'fail',
          summary: pass
            ? 'Got empty array and no error as expected'
            : `Unexpected result: error=${error?.message ?? 'null'}, rows=${Array.isArray(data) ? data.length : 'not-array'}`,
          raw: stringifyRaw({ data, error }),
        });
      } catch (error) {
        updateResult(0, {
          status: 'fail',
          summary: `Exception: ${getErrorMessage(error)}`,
          raw: stringifyRaw({ error: getErrorMessage(error) }),
        });
      }

      if (cancelled) return;

      updateResult(1, { status: 'pending', summary: 'Running...', raw: '' });
      try {
        const { data, error } = await supabase.from('jobs').select('id, status');
        const pass = error === null && Array.isArray(data) && data.length === 0;
        updateResult(1, {
          status: pass ? 'pass' : 'fail',
          summary: pass
            ? 'Got empty array and no error as expected'
            : `Unexpected result: error=${error?.message ?? 'null'}, rows=${Array.isArray(data) ? data.length : 'not-array'}`,
          raw: stringifyRaw({ data, error }),
        });
      } catch (error) {
        updateResult(1, {
          status: 'fail',
          summary: `Exception: ${getErrorMessage(error)}`,
          raw: stringifyRaw({ error: getErrorMessage(error) }),
        });
      }

      if (cancelled) return;

      updateResult(2, { status: 'pending', summary: 'Running...', raw: '' });
      let channel: ReturnType<typeof supabase.channel> | null = null;
      try {
        let callbackFired = false;
        let channelStatus = 'TIMED_OUT';

        channel = supabase
          .channel('smoke-test')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {})
          .subscribe((status) => {
            callbackFired = true;
            channelStatus = status;
          });

        await new Promise<void>((resolve) => {
          const startedAt = Date.now();
          const timer = setInterval(() => {
            if (callbackFired) {
              clearInterval(timer);
              resolve();
              return;
            }
            if (Date.now() - startedAt >= 5000) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });

        const pass = callbackFired && channelStatus === 'SUBSCRIBED';
        updateResult(2, {
          status: pass ? 'pass' : 'fail',
          summary: pass
            ? 'Realtime handshake succeeded with SUBSCRIBED'
            : callbackFired
              ? `Realtime status was ${channelStatus}`
              : 'Realtime subscribe callback did not fire within 5 seconds',
          raw: stringifyRaw({ status: callbackFired ? channelStatus : 'TIMED_OUT_NO_CALLBACK' }),
        });
      } catch (error) {
        updateResult(2, {
          status: 'fail',
          summary: `Exception: ${getErrorMessage(error)}`,
          raw: stringifyRaw({ error: getErrorMessage(error) }),
        });
      } finally {
        if (channel) {
          await supabase.removeChannel(channel);
        }
      }

      if (cancelled) return;

      updateResult(3, { status: 'pending', summary: 'Running...', raw: '' });
      try {
        const { data, error } = await supabase.storage.from('job-photos').list('', { limit: 1 });
        const message = (error?.message ?? '').toLowerCase();
        const notFound = message.includes('bucket not found') || message.includes('not_found');
        const pass = error === null || !notFound;

        updateResult(3, {
          status: pass ? 'pass' : 'fail',
          summary:
            error === null
              ? 'Bucket list call succeeded'
              : pass
                ? `Bucket exists, listing blocked or limited: ${error.message}`
                : `Bucket missing: ${error.message}`,
          raw: stringifyRaw({ data, error }),
        });
      } catch (error) {
        updateResult(3, {
          status: 'fail',
          summary: `Exception: ${getErrorMessage(error)}`,
          raw: stringifyRaw({ error: getErrorMessage(error) }),
        });
      }
    };

    void runTestsSequentially();

    return () => {
      cancelled = true;
    };
  }, []);

  const failedCount = results.filter((result) => result.status === 'fail').length;
  const allFinished = results.every((result) => result.status !== 'pending');
  const allPassed = allFinished && failedCount === 0;

  const urlPreview = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'missing').slice(0, 40);
  const anonKeySummary = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'present' : 'missing';
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'missing';

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Pressable
        style={styles.backButton}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(public)/welcome');
          }
        }}
      >
        <Text style={styles.backButtonText}>← Zpět do aplikace</Text>
      </Pressable>

      <View style={styles.devBox}>
        <Text style={styles.devBanner}>DEV ONLY — remove before production</Text>
        <Text style={styles.devHint}>
          Bypass for Supabase OTP rate limit. Requires a pre-created auto-confirmed user in
          Supabase. Override email via EXPO_PUBLIC_DEV_EMAIL.
        </Text>
        <TextInput
          value={devEmail}
          onChangeText={setDevEmail}
          placeholder="dev@vxo.local"
          keyboardType="email-address"
        />
        <TextInput
          value={devPassword}
          onChangeText={setDevPassword}
          placeholder="Dev password"
        />
        <PrimaryButton
          label="🚧 Dev login (password)"
          onPress={handleDevLogin}
          loading={devLoading}
        />
        <PrimaryButton label="Sign out" onPress={handleDevSignOut} />
        <PrimaryButton
          label="🔍 Diagnostic: INSERT vendors row"
          onPress={async () => {
            const { data: userRes } = await supabase.auth.getUser();
            const user = userRes.user;
            if (!user?.email) {
              Alert.alert('No session', 'Sign in first via the dev login button.');
              return;
            }
            const { data, error } = await supabase
              .from('vendors')
              .insert({
                email: user.email,
                name: 'TEST DEBUG ' + Date.now(),
                business: 'Test Inc',
                trades: ['hvac'],
                status: 'pending',
              })
              .select()
              .single();
            Alert.alert(
              error ? 'INSERT FAILED' : 'INSERT OK',
              JSON.stringify({ data, error }, null, 2).slice(0, 800),
            );
          }}
        />
      </View>

      <Text style={styles.title}>Smoke Test Debug</Text>

      <View style={[styles.banner, allPassed ? styles.bannerPass : styles.bannerFail]}>
        <Text style={styles.bannerText}>{allPassed ? 'All passed' : `${failedCount} failed`}</Text>
      </View>

      <View style={styles.envBox}>
        <Text style={styles.envLine}>SUPABASE_URL: {urlPreview}</Text>
        <Text style={styles.envLine}>SUPABASE_ANON_KEY: {anonKeySummary}</Text>
        <Text style={styles.envLine}>APP_ENV: {appEnv}</Text>
      </View>

      {results.map((result) => (
        <View key={result.name} style={styles.row}>
          <Text style={styles.testName}>{result.name}</Text>
          <View style={styles.statusRow}>
            {result.status === 'pending' && result.summary === 'Running...' ? (
              <ActivityIndicator size="small" />
            ) : null}
            <Text style={styles.summary}>
              {result.status === 'pass'
                ? '✅ PASS'
                : result.status === 'fail'
                  ? '❌ FAIL'
                  : result.summary === 'Running...'
                    ? 'Running'
                    : 'Pending'}: {result.summary}
            </Text>
          </View>
          <Text style={styles.raw}>{result.raw || 'No response yet'}</Text>
          <Text style={styles.expected}>Expected: {result.expected}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  devBox: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    gap: 10,
  },
  devBanner: {
    color: '#92400E',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  devHint: {
    color: '#78350F',
    fontSize: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  backButtonText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  banner: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerPass: {
    backgroundColor: '#15803D',
  },
  bannerFail: {
    backgroundColor: '#B91C1C',
  },
  bannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  envBox: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#F9FAFB',
  },
  envLine: {
    color: '#1F2937',
    fontSize: 13,
    marginBottom: 4,
  },
  row: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  testName: {
    fontWeight: '700',
    color: '#111827',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summary: {
    flexShrink: 1,
    color: '#111827',
  },
  raw: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#374151',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 8,
  },
  expected: {
    color: '#4B5563',
    fontSize: 12,
  },
});
