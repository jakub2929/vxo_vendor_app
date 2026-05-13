import { Redirect, useLocalSearchParams } from 'expo-router';
import { JobChatScreen } from '@/features/chat/JobChatScreen';

export default function JobDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <Redirect href="/(tabs)" />;
  return <JobChatScreen jobId={id} />;
}
