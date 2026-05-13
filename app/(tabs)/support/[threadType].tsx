import { Redirect, useLocalSearchParams } from 'expo-router';
import { SupportChatScreen } from '@/features/support/SupportChatScreen';
import type { ThreadType } from '@/features/support/useSupportThread';

const VALID: ThreadType[] = ['current_job', 'general'];

export default function SupportThreadScreen() {
  const { threadType } = useLocalSearchParams<{ threadType: string }>();

  if (!threadType || !VALID.includes(threadType as ThreadType)) {
    return <Redirect href="/(tabs)/support" />;
  }

  return <SupportChatScreen threadType={threadType as ThreadType} />;
}
