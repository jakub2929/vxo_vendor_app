// Dev-only mock jobs covering the active vendor lifecycle. Consumed by the
// Home tab and (eventually) the Jobs tab when __DEV__ is true. Real Supabase
// is bypassed entirely in dev to keep simulator runs offline-friendly.
//
// Lifecycle coverage: dispatched, accepted, en_route, on_site, complete,
// invoiced, paid, plus one cancelled. See mockInvoices.ts for matching rows.
//
// Dates are anchored to May 2026 (demo period). If you're seeing zero on the
// "This Month" summary, refresh these to the current month.
import type { Database } from '@/types/database';

type Job = Database['public']['Tables']['jobs']['Row'];

export const MOCK_VENDOR_ID = 'a0000000-0000-4000-8000-000000000001';

// PM (project manager) mock data, keyed by pm_id. Each mockJob has a pm_id FK
// into this map; the PM contact card screen looks the job's PM up here.
//
// TODO: real `project_managers` table + Supabase join pending Ryan's admin
// panel work. When that ships, replace this map with a query that selects
// jobs.pm_id → project_managers.* and the PM card will keep working with no
// UI churn.
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

export const mockJobs: Job[] = [
  {
    id: 'a3f8c2d1-0001-4000-8000-000000000001',
    trade: 'snow_removal',
    status: 'dispatched',
    description: 'Driveway and walkway clearing — 6" overnight accumulation.',
    urgency: 'standard',
    address: '128 Maple St, Edmonton AB',
    zip_code: 'T5K 2J9',
    location_lat: 53.5461,
    location_lng: -113.4938,
    client_name: 'Sarah Mitchell',
    client_email: 'sarah.m@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    checkin_time: null,
    checkout_time: null,
    eta_label: 'Today, 4:00 PM',
    eta_datetime: '2026-05-12T22:00:00Z',
    completion_photo_ids: [],
    dispatch_fee: 25,
    created_at: '2026-05-12T15:30:00Z',
    updated_at: '2026-05-12T15:30:00Z',
  },
  {
    id: 'b7e91440-0002-4000-8000-000000000002',
    trade: 'plumbing',
    status: 'accepted',
    description: 'Leaking kitchen faucet — replace cartridge.',
    urgency: 'priority',
    address: '4220 Whyte Ave, Edmonton AB',
    zip_code: 'T6E 2A8',
    location_lat: 53.5181,
    location_lng: -113.5022,
    client_name: 'Jordan Lee',
    client_email: 'jlee@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    checkin_time: null,
    checkout_time: null,
    eta_label: 'Tomorrow, 9:00 AM',
    eta_datetime: '2026-05-12T15:00:00Z',
    completion_photo_ids: [],
    dispatch_fee: 25,
    created_at: '2026-05-11T18:45:00Z',
    updated_at: '2026-05-11T19:10:00Z',
  },
  {
    id: 'c5d20a8f-0003-4000-8000-000000000003',
    trade: 'hvac',
    status: 'en_route',
    description: 'No-heat call — furnace not igniting.',
    urgency: 'emergency',
    address: '912 Jasper Ave, Edmonton AB',
    zip_code: 'T5K 1V3',
    location_lat: 53.5444,
    location_lng: -113.4909,
    client_name: 'Priya Sharma',
    client_email: 'priya.s@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    checkin_time: null,
    checkout_time: null,
    eta_label: 'ETA 25 min',
    eta_datetime: '2026-05-10T17:30:00Z',
    completion_photo_ids: [],
    dispatch_fee: 25,
    created_at: '2026-05-10T17:00:00Z',
    updated_at: '2026-05-10T17:05:00Z',
  },
  // Edge case: vendor pre-drafting an invoice while on site — verifies 'draft' invoices don't leak into the Sent total.
  {
    id: 'd1a4b6c2-0004-4000-8000-000000000004',
    trade: 'electrical',
    status: 'on_site',
    description: 'GFCI outlet won\'t reset — bathroom circuit.',
    urgency: 'priority',
    address: '67 Riverbend Rd, Edmonton AB',
    zip_code: 'T6R 1H2',
    location_lat: 53.4732,
    location_lng: -113.5588,
    client_name: 'Marcus Webb',
    client_email: 'mwebb@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    checkin_time: '2026-05-09T14:20:00Z',
    checkout_time: null,
    eta_label: 'On site',
    eta_datetime: '2026-05-09T14:00:00Z',
    completion_photo_ids: [],
    dispatch_fee: 25,
    created_at: '2026-05-09T13:00:00Z',
    updated_at: '2026-05-09T14:20:00Z',
  },
  {
    id: 'e8c30f5a-0005-4000-8000-000000000005',
    trade: 'handyman',
    status: 'complete',
    description: 'Replaced two rotted deck boards, sanded and stained.',
    urgency: 'standard',
    address: '231 Glenora Cres, Edmonton AB',
    zip_code: 'T5N 3W4',
    location_lat: 53.5495,
    location_lng: -113.5371,
    client_name: 'Anna Kowalski',
    client_email: 'akowalski@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    checkin_time: '2026-05-07T10:00:00Z',
    checkout_time: '2026-05-07T13:30:00Z',
    eta_label: 'Completed',
    eta_datetime: '2026-05-07T10:00:00Z',
    completion_photo_ids: ['photo-deck-before', 'photo-deck-after'],
    dispatch_fee: 25,
    created_at: '2026-05-07T08:15:00Z',
    updated_at: '2026-05-07T13:35:00Z',
  },
  {
    id: 'f2b59d1e-0006-4000-8000-000000000006',
    trade: 'hvac',
    status: 'invoiced',
    description: 'Annual furnace tune-up and humidifier filter replacement.',
    urgency: 'standard',
    address: '888 Terwillegar Dr, Edmonton AB',
    zip_code: 'T6R 3K9',
    location_lat: 53.4691,
    location_lng: -113.5852,
    client_name: 'Daniel Park',
    client_email: 'dpark@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    // checkin/checkout 35 minutes apart so buildTimeline renders the exact
    // "On site 35 minutes" marker from Figma 4:10457.
    checkin_time: '2026-05-05T10:25:00Z',
    checkout_time: '2026-05-05T11:00:00Z',
    eta_label: 'Invoice sent',
    eta_datetime: '2026-05-05T09:30:00Z',
    completion_photo_ids: ['photo-furnace-tag'],
    dispatch_fee: 25,
    created_at: '2026-05-05T08:00:00Z',
    updated_at: '2026-05-05T11:45:00Z',
  },
  {
    id: '14a7e3c9-0007-4000-8000-000000000007',
    trade: 'plumbing',
    status: 'paid',
    description: 'Hot water tank replacement, 50gal natural gas.',
    urgency: 'priority',
    address: '514 Belgravia Rd, Edmonton AB',
    zip_code: 'T6G 1H3',
    location_lat: 53.5121,
    location_lng: -113.5263,
    client_name: 'Hannah Chen',
    client_email: 'hchen@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    checkin_time: '2026-05-12T11:00:00Z',
    checkout_time: '2026-05-12T15:30:00Z',
    eta_label: 'Paid',
    eta_datetime: '2026-05-12T11:00:00Z',
    completion_photo_ids: ['photo-tank-before', 'photo-tank-after'],
    dispatch_fee: 25,
    created_at: '2026-05-12T09:00:00Z',
    updated_at: '2026-05-12T18:20:00Z',
  },
  {
    id: '29bf6042-0008-4000-8000-000000000008',
    trade: 'locksmith',
    status: 'cancelled',
    description: 'Lockout call — customer found spare key before arrival.',
    urgency: 'priority',
    address: '7 Strathcona Pl, Edmonton AB',
    zip_code: 'T6E 0M7',
    location_lat: 53.5223,
    location_lng: -113.4985,
    client_name: 'Riley O\'Brien',
    client_email: 'robrien@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    checkin_time: null,
    checkout_time: null,
    eta_label: 'Cancelled',
    eta_datetime: null,
    completion_photo_ids: [],
    dispatch_fee: null,
    created_at: '2026-05-03T20:15:00Z',
    updated_at: '2026-05-03T20:40:00Z',
  },
  {
    id: '3c842b71-0009-4000-8000-000000000009',
    trade: 'electrical',
    status: 'paid',
    description: 'Installed two pendant lights and dimmer in dining room.',
    urgency: 'standard',
    address: '1602 Garneau Pl, Edmonton AB',
    zip_code: 'T6G 0Z3',
    location_lat: 53.5253,
    location_lng: -113.5181,
    client_name: 'Tomás Rivera',
    client_email: 'trivera@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    checkin_time: '2026-05-08T13:00:00Z',
    checkout_time: '2026-05-08T16:15:00Z',
    eta_label: 'Paid',
    eta_datetime: '2026-05-08T13:00:00Z',
    completion_photo_ids: ['photo-pendants'],
    dispatch_fee: 25,
    created_at: '2026-05-08T10:30:00Z',
    updated_at: '2026-05-08T19:00:00Z',
  },
  {
    id: '4e1d9a35-0010-4000-8000-000000000010',
    trade: 'handyman',
    status: 'paid',
    description: 'TV wall mount and cable concealment — 65" OLED.',
    urgency: 'standard',
    address: '305 Windermere Way, Edmonton AB',
    zip_code: 'T6W 2N9',
    location_lat: 53.4429,
    location_lng: -113.5728,
    client_name: 'Yuki Tanaka',
    client_email: 'ytanaka@example.com',
    assigned_vendor_id: MOCK_VENDOR_ID,
    pm_id: null,
    checkin_time: '2026-05-02T14:00:00Z',
    checkout_time: '2026-05-02T15:45:00Z',
    eta_label: 'Paid',
    eta_datetime: '2026-05-02T14:00:00Z',
    completion_photo_ids: ['photo-mount'],
    dispatch_fee: 25,
    created_at: '2026-05-02T11:00:00Z',
    updated_at: '2026-05-02T17:30:00Z',
  },
];

// Assign a PM to each mock job by rotating through PM_ROTATION so different
// jobs surface different PMs. Real schema will populate jobs.pm_id directly.
mockJobs.forEach((job, index) => {
  job.pm_id = pmFor(index);
});
