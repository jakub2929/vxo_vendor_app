// Seeded mock chat threads for the Job Chat detail screen (Figma node 4:10092).
//
// Three jobs from mockJobs are seeded, covering the active vendor lifecycle:
//   - Sarah Mitchell / dispatched / snow_removal → empty thread (renders
//     info cards + SLA banner + Accept/Reject only).
//   - Marcus Webb / on_site / electrical → mid-flow with mixed vendor /
//     alfred / system bubbles around a "checked in" pivot.
//   - Hannah Chen / paid / plumbing → full historical thread, ends with the
//     "Job complete" footer.
//
// All other mockJobs route to the same scaffold with messages = [] — the
// renderer shows a soft empty state instead of crashing.
//
// Note on `sender`: the DB column is `string`, but the renderer uses a tight
// union (ChatSender). These seeds use the union values directly; the real-
// data path casts at the boundary in useJobChat.ts.
import type { ChatMessage } from '@/features/chat/types';

const SARAH_ID = 'a3f8c2d1-0001-4000-8000-000000000001';
const MARCUS_ID = 'd1a4b6c2-0004-4000-8000-000000000004';
const DANIEL_ID = 'f2b59d1e-0006-4000-8000-000000000006';
const HANNAH_ID = '14a7e3c9-0007-4000-8000-000000000007';

// Marcus checked in at 14:20Z; weave timestamps around that pivot so the
// "On site 35 minutes" system marker (rendered from jobs.checkin_time)
// reads correctly. All messages are within the job's created..updated window.
const marcus: ChatMessage[] = [
  {
    id: 'msg-marcus-001',
    job_id: MARCUS_ID,
    sender: 'alfred',
    content:
      "Hi Marcus — Riverbend Rd bathroom GFCI won't reset. Client is home and waiting.",
    created_at: '2026-05-09T13:05:00Z',
  },
  {
    id: 'msg-marcus-002',
    job_id: MARCUS_ID,
    sender: 'vendor',
    content: 'On my way. ETA 25 min.',
    created_at: '2026-05-09T13:35:00Z',
  },
  {
    id: 'msg-marcus-003',
    job_id: MARCUS_ID,
    sender: 'alfred',
    content:
      'Get Directions. Client has been notified you are on the way. Click here to cancel.',
    created_at: '2026-05-09T13:36:00Z',
  },
  {
    id: 'msg-marcus-004',
    job_id: MARCUS_ID,
    sender: 'vendor',
    content: 'Arrived on site.',
    created_at: '2026-05-09T14:20:00Z',
  },
  {
    id: 'msg-marcus-005',
    job_id: MARCUS_ID,
    sender: 'client',
    content: 'Thanks! The breaker panel is in the garage.',
    created_at: '2026-05-09T14:25:00Z',
  },
  {
    id: 'msg-marcus-006',
    job_id: MARCUS_ID,
    sender: 'alfred',
    content:
      "‼️ Marcus's credit card is on file to be charged when you are completed. Make sure to send Quote or Invoice through here.",
    created_at: '2026-05-09T14:55:00Z',
  },
];

// Hannah's thread is the full happy path — accepted, en route, on site,
// invoice sent, paid. Ends with a system row that the renderer pairs with
// a "Job complete" footer marker (derived from jobs.status === 'paid').
const hannah: ChatMessage[] = [
  {
    id: 'msg-hannah-001',
    job_id: HANNAH_ID,
    sender: 'alfred',
    content:
      '50gal natural gas hot water tank replacement at 514 Belgravia Rd. Client onsite.',
    created_at: '2026-05-12T09:05:00Z',
  },
  {
    id: 'msg-hannah-002',
    job_id: HANNAH_ID,
    sender: 'vendor',
    content: 'Accepted. Heading out within the hour.',
    created_at: '2026-05-12T09:30:00Z',
  },
  {
    id: 'msg-hannah-003',
    job_id: HANNAH_ID,
    sender: 'vendor',
    content: 'En route — 15 min away.',
    created_at: '2026-05-12T10:45:00Z',
  },
  {
    id: 'msg-hannah-004',
    job_id: HANNAH_ID,
    sender: 'vendor',
    content: 'On site, starting the swap.',
    created_at: '2026-05-12T11:00:00Z',
  },
  {
    id: 'msg-hannah-005',
    job_id: HANNAH_ID,
    sender: 'vendor',
    content: 'Tank installed and tested. Invoice incoming.',
    created_at: '2026-05-12T15:25:00Z',
  },
  {
    id: 'msg-hannah-006',
    job_id: HANNAH_ID,
    sender: 'system',
    content: 'Invoice sent — $2,200.00',
    created_at: '2026-05-12T15:30:00Z',
  },
  {
    id: 'msg-hannah-007',
    job_id: HANNAH_ID,
    sender: 'client',
    content: 'Looks great, just paid. Thanks Hannah!',
    created_at: '2026-05-12T18:15:00Z',
  },
  {
    id: 'msg-hannah-008',
    job_id: HANNAH_ID,
    sender: 'system',
    content: 'Payment received — $2,200.00',
    created_at: '2026-05-12T18:20:00Z',
  },
];

// Sarah is dispatched but not yet accepted — empty thread by design.
// The renderer shows info cards + SLA banner + Accept/Reject only.
const sarah: ChatMessage[] = [];

// Daniel is invoiced — the 4th seeded thread covers the full end-to-end
// composite from Figma 4:10457. checkin_time = 10:25Z and checkout_time =
// 11:00Z so the derived "On site 35 minutes" / "Check Out 11:00AM" markers
// land between the right messages. Copy is taken verbatim from the Figma,
// including the source-side typos ("Cleint has bene notified") so the
// visual diff matches.
const daniel: ChatMessage[] = [
  {
    id: 'msg-daniel-001',
    job_id: DANIEL_ID,
    sender: 'vendor',
    content: 'You Accepted. Need to Reject. Press Here.',
    created_at: '2026-05-05T09:45:00Z',
  },
  {
    id: 'msg-daniel-002',
    job_id: DANIEL_ID,
    sender: 'vendor',
    content:
      'Get Directions. Cleint has bene notified you are on the way. Click here to cancel.',
    created_at: '2026-05-05T10:00:00Z',
  },
  // <-- buildTimeline injects "On site 35 minutes" here, derived from
  //     checkin_time/checkout_time on the job row.
  {
    id: 'msg-daniel-003',
    job_id: DANIEL_ID,
    sender: 'alfred',
    content:
      "‼️ John's credit card is on file to be charged when you are completed. Make sure to send Quote or Invoice through here. Connect you bank Here",
    created_at: '2026-05-05T10:35:00Z',
  },
  // <-- buildTimeline injects "Check Out 11:00AM" here.
  {
    id: 'msg-daniel-004',
    job_id: DANIEL_ID,
    sender: 'vendor',
    content:
      'You selected Invoice. If you need to go back to Quote press Here',
    created_at: '2026-05-05T11:05:00Z',
  },
  {
    id: 'msg-daniel-005',
    job_id: DANIEL_ID,
    sender: 'alfred',
    content: 'We ask 3 quick questions to build an invoice for you.',
    created_at: '2026-05-05T11:06:00Z',
  },
];

export const mockJobMessages: Record<string, ChatMessage[]> = {
  [SARAH_ID]: sarah,
  [MARCUS_ID]: marcus,
  [DANIEL_ID]: daniel,
  [HANNAH_ID]: hannah,
};
