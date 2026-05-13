// Data hooks for the Job Chat detail screen (Figma node 4:10092).
//
// USE_MOCKS branch reads from src/lib/mockChatState.ts (a mutable map seeded
// from mockJobs + mockJobMessages). Real branch hits Supabase: `jobs` for
// the job record, `job_messages` for the thread, insert for sending.
//
// Query keys are namespaced under ['chat', ...] so they invalidate
// independently of the Home / Jobs caches. mockChatState invalidates these
// directly on mutation — no separate subscribe channel.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { USE_MOCKS } from '@/features/home/useHomeData';
import {
  appendMockMessage,
  getMockJob,
  getMockMessages,
} from '@/lib/mockChatState';
import { supabase } from '@/lib/supabase';
import type {
  ChatMessage,
  ChatSender,
  Job,
} from '@/features/chat/types';

export function useJob(jobId: string | null | undefined) {
  return useQuery<Job | null>({
    queryKey: ['chat', 'job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      if (USE_MOCKS) {
        return getMockJob(jobId as string);
      }
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId as string)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useJobMessages(jobId: string | null | undefined) {
  return useQuery<ChatMessage[]>({
    queryKey: ['chat', 'messages', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      if (USE_MOCKS) {
        return getMockMessages(jobId as string);
      }
      const { data, error } = await supabase
        .from('job_messages')
        .select('*')
        .eq('job_id', jobId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // DB column is `sender: string`; narrow to ChatSender at the boundary.
      return (data ?? []).map((row) => ({
        id: row.id,
        job_id: row.job_id,
        sender: row.sender as ChatSender,
        content: row.content,
        created_at: row.created_at ?? '',
      }));
    },
  });
}

type SendArgs = { content: string; sender?: ChatSender };

export function useSendMessage(jobId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, sender = 'vendor' }: SendArgs) => {
      if (!jobId) throw new Error('useSendMessage: jobId is required');
      if (USE_MOCKS) {
        return appendMockMessage(jobId, { sender, content });
      }
      const { data, error } = await supabase
        .from('job_messages')
        .insert({ job_id: jobId, sender, content })
        .select('*')
        .single();
      if (error) throw error;
      return {
        id: data.id,
        job_id: data.job_id,
        sender: data.sender as ChatSender,
        content: data.content,
        created_at: data.created_at ?? '',
      } satisfies ChatMessage;
    },
    onSuccess: () => {
      // mockChatState already invalidates; this is the real-branch path.
      if (!USE_MOCKS) {
        void qc.invalidateQueries({ queryKey: ['chat', 'messages', jobId] });
      }
    },
  });
}
