import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { colors } from '@/theme';
import { ChatFabIcon } from './ChatFabIcon';
import { JobRow } from './JobRow';
import { useJobsList } from './useJobsList';
import { useJobsRealtime } from './useJobsRealtime';

type Props = {
  vendorId: string | null | undefined;
  /** Rendered when the vendor has zero active jobs. Pass the existing
   *  <JobsWelcome /> so the empty state copy stays in ChatsScreen. */
  emptyState: ReactNode;
  /** Tap a row → job thread detail. Pending route #20 — see ChatsScreen. */
  onRowPress?: (jobId: string) => void;
  /** Tap the FAB — Figma shows a chat icon, no destination wired yet. */
  onFabPress?: () => void;
};

export function JobsListBody({
  vendorId,
  emptyState,
  onRowPress,
  onFabPress,
}: Props) {
  const qc = useQueryClient();
  const { data, isLoading } = useJobsList(vendorId);
  useJobsRealtime(vendorId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: ['jobs'] });
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  if (isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    );
  }

  const jobs = data ?? [];
  if (jobs.length === 0) {
    return (
      <FlatList
        data={[0]}
        keyExtractor={(i) => String(i)}
        renderItem={() => <>{emptyState}</>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.emptyContent}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        renderItem={({ item }) => (
          <JobRow job={item} onPress={() => onRowPress?.(item.id)} />
        )}
        ItemSeparatorComponent={RowGap}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />
      <Fab onPress={onFabPress} />
    </View>
  );
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

// FAB — Figma node 4:10454. 60×60 round, brand-blue gradient (we approximate
// with a flat brand.primary fill — gradient on a small element is hard to
// distinguish visually and avoids pulling in expo-linear-gradient here),
// blue glow shadow.
function Fab({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      accessibilityRole="button"
      accessibilityLabel="Open chat"
      hitSlop={8}
    >
      <ChatFabIcon size={24} color="#FFFFFF" />
    </Pressable>
  );
}

function SkeletonRow() {
  return (
    <View style={skel.row}>
      <View style={skel.avatar} />
      <View style={skel.content}>
        <View style={skel.titleBar} />
        <View style={skel.headlineBar} />
        <View style={skel.subtitleBar} />
      </View>
      <View style={skel.timestampBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24 + 60 + 24, // leave room for the FAB
  },
  rowGap: {
    height: 24,
  },
  emptyContent: {
    flexGrow: 1,
  },
  skeletonWrap: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    // Figma drop-shadow [4px 8px 12px #246BFD40] — RN takes shadow color
    // without alpha plus a 0.25 opacity to match the 40 hex suffix.
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 4, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
  },
});

const skel = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 1000,
    backgroundColor: colors.divider.soft,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  titleBar: {
    width: '70%',
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.divider.soft,
  },
  headlineBar: {
    width: '50%',
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.divider.soft,
  },
  subtitleBar: {
    width: '85%',
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.divider.soft,
  },
  timestampBar: {
    width: 36,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.divider.soft,
  },
});
