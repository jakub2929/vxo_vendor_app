// Dev-only mock jobs covering the active vendor lifecycle. Consumed by the
// Home tab and (eventually) the Jobs tab when __DEV__ is true. Real Supabase
// is bypassed entirely in dev to keep simulator runs offline-friendly.
//
// Phase 5: shape aligned with the synthetic Job type from
// src/features/chat/types.ts — i.e. vendor_requests Row + job_status
// (per-vendor lifecycle, was jobs.status) + embedded client profile (was
// client_name / client_email columns). Status values mapped per the
// Phase 5 enum spec (offered/accepted/en_route/on_site → pending/in_progress/
// on_the_way/arrived; declined → cancelled). Priority remap: standard/
// priority/emergency → Low/Medium/High.
//
// Dates are anchored to May 2026 (demo period). If you're seeing zero on the
// "This Month" summary, refresh these to the current month.
import type { Job } from '@/features/chat/types';

export const MOCK_VENDOR_ID = 'a0000000-0000-4000-8000-000000000001';

// PM (project manager) mock data. Phase 5 removed pm_id from the schema;
// these are retained as a separate map so the PM contact card can render
// the same hand-curated copy in mock mode. Each mockJob is assigned a PM in
// a rotation immediately after the array definition. The lookup is keyed by
// mock_pm_id, an out-of-band field carried alongside the Job shape (we cast
// through Job & { mock_pm_id?: string | null } in the PM card lookup).
export type MockPM = {
  id: string;
  name: string;
  phone: string;
  email: string;
  jobs_completed: number;
  member_since: string;
  contact_subtitle: string;
  avatar_url: string | null;
  // Opaque secondary count rendered next to email in the PM card per Figma
  // 4:10064. Source unknown (teams? responses?) — pending Ryan clarification.
  email_secondary_count: number;
};

const PM_TYLER = 'b0000000-0000-4000-8000-000000000001';
const PM_RYAN = 'b0000000-0000-4000-8000-000000000002';
const PM_MARIA = 'b0000000-0000-4000-8000-000000000003';

export const mockPMs: Record<string, MockPM> = {
  [PM_TYLER]: {
    id: PM_TYLER,
    name: 'Tyler Stack',
    phone: '+1-300-555-0136',
    email: 'tstack@vxoservices.com',
    jobs_completed: 269,
    member_since: 'December 12, 2024',
    contact_subtitle: 'Always available, just contact me 😊',
    avatar_url: null,
    email_secondary_count: 8,
  },
  [PM_RYAN]: {
    id: PM_RYAN,
    name: 'Ryan Porcaro',
    phone: '+1-300-555-0142',
    email: 'rporcaro@vxoservices.com',
    jobs_completed: 412,
    member_since: 'March 4, 2024',
    contact_subtitle: 'Ping me anytime, day or night',
    avatar_url: null,
    email_secondary_count: 12,
  },
  [PM_MARIA]: {
    id: PM_MARIA,
    name: 'Maria Alvarez',
    phone: '+1-300-555-0179',
    email: 'malvarez@vxoservices.com',
    jobs_completed: 187,
    member_since: 'August 21, 2025',
    contact_subtitle: 'Happy to help — text first, please',
    avatar_url: null,
    email_secondary_count: 5,
  },
};

const PM_ROTATION = [PM_TYLER, PM_RYAN, PM_MARIA];
const pmFor = (i: number) => PM_ROTATION[i % PM_ROTATION.length];

// Mock jobs carry an extra `assigned_vendor_id` field for filter convenience
// in mock-mode helpers (useVendorJobsCompleted, etc) and a `mock_pm_id` for
// the PM card lookup. Neither is part of the real vendor_requests shape;
// downstream code reading the typed Job ignores them.
export type MockJob = Job & {
  assigned_vendor_id: string;
  mock_pm_id: string | null;
};

function client(
  first: string,
  last: string,
  email: string,
  phone: string | null = null,
): Job['client'] {
  return { first_name: first, last_name: last, email, phone };
}

export const mockJobs: MockJob[] = [
  {
    id: 'a3f8c2d1-0001-4000-8000-000000000001',
    client_id: 'c0000000-0001-4000-8000-000000000001',
    service_type: 'snow_removal',
    status: 'pending',
    job_status: 'pending',
    description: 'Driveway and walkway clearing — 6" overnight accumulation.',
    priority: 'Low',
    location: '128 Maple St, Edmonton AB',
    zipcode: 'T5K 2J9',
    client: client('Sarah', 'Mitchell', 'sarah.m@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    checkin_time: null,
    checkout_time: null,
    eta_label: 'Today, 4:00 PM',
    eta_datetime: '2026-05-12T22:00:00Z',
    completion_photo_ids: [],
    created_at: '2026-05-12T15:30:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
  {
    id: 'b7e91440-0002-4000-8000-000000000002',
    client_id: 'c0000000-0002-4000-8000-000000000002',
    service_type: 'plumbing',
    status: 'in_progress',
    job_status: 'in_progress',
    description: 'Leaking kitchen faucet — replace cartridge.',
    priority: 'Medium',
    location: '4220 Whyte Ave, Edmonton AB',
    zipcode: 'T6E 2A8',
    client: client('Jordan', 'Lee', 'jlee@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    checkin_time: null,
    checkout_time: null,
    eta_label: 'Tomorrow, 9:00 AM',
    eta_datetime: '2026-05-12T15:00:00Z',
    completion_photo_ids: [],
    created_at: '2026-05-11T18:45:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
  {
    id: 'c5d20a8f-0003-4000-8000-000000000003',
    client_id: 'c0000000-0003-4000-8000-000000000003',
    service_type: 'hvac',
    status: 'in_progress',
    job_status: 'on_the_way',
    description: 'No-heat call — furnace not igniting.',
    priority: 'High',
    location: '912 Jasper Ave, Edmonton AB',
    zipcode: 'T5K 1V3',
    client: client('Priya', 'Sharma', 'priya.s@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    checkin_time: null,
    checkout_time: null,
    eta_label: 'ETA 25 min',
    eta_datetime: '2026-05-10T17:30:00Z',
    completion_photo_ids: [],
    created_at: '2026-05-10T17:00:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
  // Edge case: vendor pre-drafting an invoice while on site — verifies 'draft' invoices don't leak into the Sent total.
  {
    id: 'd1a4b6c2-0004-4000-8000-000000000004',
    client_id: 'c0000000-0004-4000-8000-000000000004',
    service_type: 'electrical',
    status: 'in_progress',
    job_status: 'arrived',
    description: "GFCI outlet won't reset — bathroom circuit.",
    priority: 'Medium',
    location: '67 Riverbend Rd, Edmonton AB',
    zipcode: 'T6R 1H2',
    client: client('Marcus', 'Webb', 'mwebb@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    checkin_time: '2026-05-09T14:20:00Z',
    checkout_time: null,
    eta_label: 'On site',
    eta_datetime: '2026-05-09T14:00:00Z',
    completion_photo_ids: [],
    created_at: '2026-05-09T13:00:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
  {
    id: 'e8c30f5a-0005-4000-8000-000000000005',
    client_id: 'c0000000-0005-4000-8000-000000000005',
    service_type: 'handyman',
    status: 'completed',
    job_status: 'completed',
    description: 'Replaced two rotted deck boards, sanded and stained.',
    priority: 'Low',
    location: '231 Glenora Cres, Edmonton AB',
    zipcode: 'T5N 3W4',
    client: client('Anna', 'Kowalski', 'akowalski@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    checkin_time: '2026-05-07T10:00:00Z',
    checkout_time: '2026-05-07T13:30:00Z',
    eta_label: 'Completed',
    eta_datetime: '2026-05-07T10:00:00Z',
    completion_photo_ids: ['photo-deck-before', 'photo-deck-after'],
    created_at: '2026-05-07T08:15:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
  {
    id: 'f2b59d1e-0006-4000-8000-000000000006',
    client_id: 'c0000000-0006-4000-8000-000000000006',
    service_type: 'hvac',
    status: 'completed',
    job_status: 'completed',
    description: 'Annual furnace tune-up and humidifier filter replacement.',
    priority: 'Low',
    location: '888 Terwillegar Dr, Edmonton AB',
    zipcode: 'T6R 3K9',
    client: client('Daniel', 'Park', 'dpark@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    // checkin/checkout 35 minutes apart so buildTimeline renders the exact
    // "On site 35 minutes" marker from Figma 4:10457.
    checkin_time: '2026-05-05T10:25:00Z',
    checkout_time: '2026-05-05T11:00:00Z',
    eta_label: 'Invoice sent',
    eta_datetime: '2026-05-05T09:30:00Z',
    completion_photo_ids: ['photo-furnace-tag'],
    created_at: '2026-05-05T08:00:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
  {
    id: '14a7e3c9-0007-4000-8000-000000000007',
    client_id: 'c0000000-0007-4000-8000-000000000007',
    service_type: 'plumbing',
    status: 'completed',
    job_status: 'completed',
    description: 'Hot water tank replacement, 50gal natural gas.',
    priority: 'Medium',
    location: '514 Belgravia Rd, Edmonton AB',
    zipcode: 'T6G 1H3',
    client: client('Hannah', 'Chen', 'hchen@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    checkin_time: '2026-05-12T11:00:00Z',
    checkout_time: '2026-05-12T15:30:00Z',
    eta_label: 'Paid',
    eta_datetime: '2026-05-12T11:00:00Z',
    completion_photo_ids: ['photo-tank-before', 'photo-tank-after'],
    created_at: '2026-05-12T09:00:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
  {
    id: '29bf6042-0008-4000-8000-000000000008',
    client_id: 'c0000000-0008-4000-8000-000000000008',
    service_type: 'locksmith',
    status: 'completed',
    job_status: 'cancelled',
    description: 'Lockout call — customer found spare key before arrival.',
    priority: 'Medium',
    location: '7 Strathcona Pl, Edmonton AB',
    zipcode: 'T6E 0M7',
    client: client('Riley', "O'Brien", 'robrien@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    checkin_time: null,
    checkout_time: null,
    eta_label: 'Cancelled',
    eta_datetime: null,
    completion_photo_ids: [],
    created_at: '2026-05-03T20:15:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
  {
    id: '3c842b71-0009-4000-8000-000000000009',
    client_id: 'c0000000-0009-4000-8000-000000000009',
    service_type: 'electrical',
    status: 'completed',
    job_status: 'completed',
    description: 'Installed two pendant lights and dimmer in dining room.',
    priority: 'Low',
    location: '1602 Garneau Pl, Edmonton AB',
    zipcode: 'T6G 0Z3',
    client: client('Tomás', 'Rivera', 'trivera@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    checkin_time: '2026-05-08T13:00:00Z',
    checkout_time: '2026-05-08T16:15:00Z',
    eta_label: 'Paid',
    eta_datetime: '2026-05-08T13:00:00Z',
    completion_photo_ids: ['photo-pendants'],
    created_at: '2026-05-08T10:30:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
  {
    id: '4e1d9a35-0010-4000-8000-000000000010',
    client_id: 'c0000000-0010-4000-8000-000000000010',
    service_type: 'handyman',
    status: 'completed',
    job_status: 'completed',
    description: 'TV wall mount and cable concealment — 65" OLED.',
    priority: 'Low',
    location: '305 Windermere Way, Edmonton AB',
    zipcode: 'T6W 2N9',
    client: client('Yuki', 'Tanaka', 'ytanaka@example.com'),
    admin_notes: null,
    stripe_payment_id: null,
    checkin_time: '2026-05-02T14:00:00Z',
    checkout_time: '2026-05-02T15:45:00Z',
    eta_label: 'Paid',
    eta_datetime: '2026-05-02T14:00:00Z',
    completion_photo_ids: ['photo-mount'],
    created_at: '2026-05-02T11:00:00Z',
    assigned_vendor_id: MOCK_VENDOR_ID,
    mock_pm_id: null,
  },
];

// Assign a PM to each mock job by rotating through PM_ROTATION so different
// jobs surface different PMs. Real schema will populate a PM relationship
// via a separate table once Ryan's admin panel ships.
mockJobs.forEach((job, index) => {
  job.mock_pm_id = pmFor(index);
});
