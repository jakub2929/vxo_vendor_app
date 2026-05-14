// Variant D search screen — two-section result list (Jobs / Messages) for the
// active vendor. Pushed as a sibling of /learn-more, /settings, /job/[id], so
// it sits outside (tabs) and gets a back arrow + no tab bar for free.
//
// State machine driven by the trimmed debounced query length:
//   < MIN_QUERY_LENGTH chars → hint card ("type to search…")
//   >= MIN_QUERY_LENGTH chars, fetching, no prior data → skeleton rows
//   >= MIN_QUERY_LENGTH chars, fetched, zero hits          → no-results card
//   >= MIN_QUERY_LENGTH chars, hits                        → sections
//
// Tapping any row pushes /job/[id]. Message rows TODO: scroll to the matched
// message — deferred polish, see onPress handler.
import { useRouter } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GradientHeader } from '@/components/GradientHeader';
import type { ChatSender } from '@/features/chat/types';
import {
  formatRowTimestamp,
  tradeLabel,
} from '@/features/chats/jobStatusMeta';
import { useVendor } from '@/hooks/useVendor';
import { colors } from '@/theme';
import type { Database } from '@/types/database';
import {
  MIN_QUERY_LENGTH,
  type MessageSearchHit,
  useSearchResults,
} from './useSearchResults';

type Job = Database['public']['Tables']['jobs']['Row'];

const DEBOUNCE_MS = 300;

export function SearchScreen() {
  const router = useRouter();
  const { vendor } = useVendor();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, DEBOUNCE_MS);
  const inputRef = useRef<TextInput>(null);

  const { data, isLoading, isFetching, isError } = useSearchResults(
    vendor?.id,
    debounced,
  );

  // Auto-focus on mount. Tiny delay lets the push animation settle so the
  // keyboard slides in alongside the screen rather than fighting it.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const trimmed = debounced.trim();
  const queryActive = trimmed.length >= MIN_QUERY_LENGTH;
  const jobs = data?.jobs ?? [];
  const messages = data?.messages ?? [];
  const hasResults = jobs.length > 0 || messages.length > 0;
  // isLoading fires only on the first fetch for a given queryKey. Once we
  // have prior data (placeholderData), `isFetching` stays true between
  // debounced keystrokes — don't show the skeleton then, keep prior list up.
  const showSkeleton = queryActive && isLoading;
  const showNoResults =
    queryActive && !isLoading && !isFetching && !hasResults && !isError;
  const showHint = !queryActive;

  const handleJobPress = (jobId: string) => {
    router.push(`/job/${jobId}`);
  };

  const handleMessagePress = (hit: MessageSearchHit) => {
    // TODO: scroll to specific message — deferred polish. Today we just
    // open the job thread; the matched message will be in the timeline but
    // the user may need to scroll manually.
    router.push(`/job/${hit.job.id}`);
  };

  return (
    <View style={styles.root}>
      <GradientHeader title="Search" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inputRow}>
          <Search color={colors.text.tertiary} size={20} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search jobs and messages"
            placeholderTextColor={colors.text.placeholder}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search input"
          />
          {query.length > 0 && (
            <Pressable
              hitSlop={12}
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X color={colors.text.tertiary} size={20} />
            </Pressable>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {showHint && (
            <EmptyMessage
              title="Type to search"
              body="Search across your jobs and messages. Job#, address, trade, client name, or any word from a chat."
            />
          )}

          {showSkeleton && <Skeleton />}

          {isError && queryActive && !isFetching && (
            <EmptyMessage
              title="Couldn't search"
              body="Something went wrong. Check your connection and try again."
            />
          )}

          {showNoResults && (
            <EmptyMessage
              title="Nothing matches that"
              body={`Try a different Job#, address, or message text. We searched for "${trimmed}".`}
            />
          )}

          {queryActive && hasResults && (
            <>
              {jobs.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Jobs ({jobs.length})</Text>
                  {jobs.map((job) => (
                    <JobResultRow
                      key={job.id}
                      job={job}
                      onPress={() => handleJobPress(job.id)}
                    />
                  ))}
                </View>
              )}
              {messages.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>
                    Messages ({messages.length})
                  </Text>
                  {messages.map((hit) => (
                    <MessageResultRow
                      key={hit.message.id}
                      hit={hit}
                      onPress={() => handleMessagePress(hit)}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

function JobResultRow({ job, onPress }: { job: Job; onPress: () => void }) {
  const shortId = job.id.slice(0, 8);
  const trade = tradeLabel(job.trade);
  const subtitleParts = [job.address, job.client_name].filter(
    (s): s is string => !!s && s.length > 0,
  );
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Job ${shortId} ${trade}`}
    >
      <Text style={styles.rowTitle} numberOfLines={1}>
        Job# {shortId} — {trade}
      </Text>
      {subtitleParts.length > 0 && (
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {subtitleParts.join(' · ')}
        </Text>
      )}
    </Pressable>
  );
}

function MessageResultRow({
  hit,
  onPress,
}: {
  hit: MessageSearchHit;
  onPress: () => void;
}) {
  const shortId = hit.job.id.slice(0, 8);
  const trade = tradeLabel(hit.job.trade);
  const timestamp = formatRowTimestamp(hit.message.created_at);
  const senderLabel = formatSenderLabel(hit.message.sender);
  const snippet = senderLabel
    ? `${senderLabel}: ${hit.message.content}`
    : hit.message.content;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Message in job ${shortId} ${trade}`}
    >
      <Text style={styles.rowTitle} numberOfLines={2}>
        {snippet}
      </Text>
      <View style={styles.messageMetaRow}>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          Job# {shortId} · {trade}
        </Text>
        {timestamp.length > 0 && (
          <Text style={styles.rowTimestamp}>{timestamp}</Text>
        )}
      </View>
    </Pressable>
  );
}

function formatSenderLabel(sender: ChatSender): string {
  switch (sender) {
    case 'vendor':
      return 'You';
    case 'client':
      return 'Client';
    case 'alfred':
      return 'Alfred';
    case 'admin':
      return 'Admin';
    case 'system':
      return 'System';
  }
}

function EmptyMessage({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function Skeleton() {
  return (
    <View style={styles.section}>
      <View style={skel.headerBar} />
      <View style={skel.row} />
      <View style={skel.row} />
      <View style={skel.row} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  flex: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 24,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface.muted,
    borderRadius: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.primary,
    padding: 0,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 24,
    gap: 24,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 22.4,
    letterSpacing: 0.2,
    color: colors.text.bodyAlt,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.surface.mutedAlt,
    borderWidth: 1,
    borderColor: colors.divider.soft,
    gap: 6,
  },
  rowPressed: {
    backgroundColor: colors.surface.muted,
  },
  rowTitle: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 21,
    color: colors.text.primary,
  },
  rowSubtitle: {
    flex: 1,
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18.2,
    color: colors.text.bodyAlt,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTimestamp: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 18.2,
    color: colors.text.tertiary,
  },
  emptyWrap: {
    paddingTop: 24,
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: 'Urbanist-Bold',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 25.2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'Urbanist-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 19.6,
    letterSpacing: 0.2,
    color: colors.text.bodyAlt,
    textAlign: 'center',
  },
});

const skel = StyleSheet.create({
  headerBar: {
    width: 100,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.divider.soft,
  },
  row: {
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.divider.soft,
  },
});
