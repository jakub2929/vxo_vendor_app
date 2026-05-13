import type { Database } from '@/types/database';

type Job = Database['public']['Tables']['jobs']['Row'];

export type RowAccentColor = 'danger' | 'secondary' | 'success' | 'primary';

export type RowMetadata = {
  subtitleText: string;
  subtitleColor: RowAccentColor;
  topLabel?: string;
  topLabelColor?: RowAccentColor;
  rightCircleColor: RowAccentColor;
  rightCircleNumber?: number;
};

// TODO: real ETA / distance / time-until-arrival need geolocation + Maps SDK.
// For v1 we ship stub strings that mirror the Figma copy on node 4:10139 rows.
export function getRowMetadata(job: Job): RowMetadata {
  switch (job.status) {
    case 'dispatched':
      return {
        topLabel: job.eta_label ?? '4 Hour - 2.5 Miles Away',
        topLabelColor: 'danger',
        subtitleText: 'Check in here when you are on',
        subtitleColor: 'secondary',
        rightCircleColor: 'danger',
        rightCircleNumber: 1,
      };
    case 'accepted':
    case 'assigned':
      return {
        topLabel: job.eta_label ?? '24 Hour - .5 miles away',
        topLabelColor: 'danger',
        subtitleText: 'Tech is arriving in 1-3 Hours',
        subtitleColor: 'secondary',
        rightCircleColor: 'primary',
      };
    case 'en_route':
      return {
        topLabel: 'En route',
        topLabelColor: 'danger',
        subtitleText: 'Check in here when you arrive',
        subtitleColor: 'secondary',
        rightCircleColor: 'primary',
      };
    case 'on_site':
    case 'in_progress':
      return {
        topLabel: 'This Week',
        topLabelColor: 'danger',
        subtitleText: 'You Confirmed Tuesday 10AM',
        subtitleColor: 'secondary',
        rightCircleColor: 'primary',
      };
    case 'completed':
      return {
        topLabel: 'Completed',
        topLabelColor: 'success',
        subtitleText: 'Invoice Sent',
        subtitleColor: 'secondary',
        rightCircleColor: 'secondary',
      };
    case 'invoiced':
      return {
        topLabel: 'Completed',
        topLabelColor: 'success',
        subtitleText: 'Invoice Pending Approval',
        subtitleColor: 'secondary',
        rightCircleColor: 'secondary',
      };
    case 'paid':
      return {
        topLabel: 'Completed',
        topLabelColor: 'success',
        subtitleText: 'Invoice Paid',
        subtitleColor: 'secondary',
        rightCircleColor: 'secondary',
      };
    default:
      return {
        subtitleText: job.description ?? 'Tap to view',
        subtitleColor: 'secondary',
        rightCircleColor: 'secondary',
      };
  }
}

export function workOrderLabel(jobId: string): string {
  // jobs.id is a uuid — pull the first segment, uppercase, for a WO#-style
  // display value. TODO: replace with a real job_number column once dispatch
  // assigns one.
  const short = jobId.split('-')[0]?.slice(0, 5) ?? jobId.slice(0, 5);
  return short.toUpperCase();
}

export function formatJobTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
