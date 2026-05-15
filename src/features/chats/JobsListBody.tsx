import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { colors } from '@/theme';
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
};

export function JobsListBody({
  vendorId,
  emptyState,
  onRowPress,
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
    </View>
  );
}

function RowGap() {
  return <View style={styles.rowGap} />;
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
    paddingBottom: 24,
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
