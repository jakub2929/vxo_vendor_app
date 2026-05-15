// Dev-only mock invoices keyed to mockJobs.ts by job_id. Totals are tuned so
// the Home tab summary lands on the Figma example numbers:
//   Invoices Sent  = $1,000 + $2,000 = $3,000
//   Completed (paid) = $2,200 + $1,800 + $1,000 = $5,000  (3 jobs)
//
// Not every mock job has an invoice — dispatched/accepted/en_route are
// pre-invoice, cancelled was killed before billing. The on_site job has a
// draft (excluded from both totals — drafts are vendor-private until 'sent').
import type { Database } from '@/types/database';
import { MOCK_VENDOR_ID } from './mockJobs';

type Invoice = Database['public']['Tables']['invoices']['Row'];

export const mockInvoices: Invoice[] = [
  // on_site → draft (not yet submitted)
  {
    id: 'inv-d1a4b6c2-draft',
    job_id: 'd1a4b6c2-0004-4000-8000-000000000004',
    vendor_id: MOCK_VENDOR_ID,
    kind: 'invoice',
    labor: 350,
    parts: 50,
    diagnostic_fee: 0,
    total: 400,
    line_items: [
      { label: 'Diagnose GFCI circuit + replace receptacle', amount: 350 },
      { label: 'GFCI 20A part', amount: 50 },
    ],
    notes: null,
    description: 'Bathroom GFCI replacement',
    status: 'draft',
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    valid_until: null,
    created_at: '2026-05-09T14:30:00Z',
    updated_at: '2026-05-09T14:30:00Z',
  },
  // complete → sent
  {
    id: 'inv-e8c30f5a-sent',
    job_id: 'e8c30f5a-0005-4000-8000-000000000005',
    vendor_id: MOCK_VENDOR_ID,
    kind: 'invoice',
    labor: 700,
    parts: 300,
    diagnostic_fee: 0,
    total: 1000,
    line_items: [
      { label: 'Deck board replacement (2 boards, sand, stain)', amount: 700 },
      { label: 'Cedar deck boards + stain', amount: 300 },
    ],
    notes: null,
    description: 'Deck repair',
    status: 'sent',
    sent_at: '2026-05-07T14:00:00Z',
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    valid_until: null,
    created_at: '2026-05-07T14:00:00Z',
    updated_at: '2026-05-07T14:00:00Z',
  },
  // invoiced → sent
  {
    id: 'inv-f2b59d1e-sent',
    job_id: 'f2b59d1e-0006-4000-8000-000000000006',
    vendor_id: MOCK_VENDOR_ID,
    kind: 'invoice',
    labor: 1700,
    parts: 300,
    diagnostic_fee: 0,
    total: 2000,
    line_items: [
      { label: 'Furnace tune-up + humidifier service', amount: 1700 },
      { label: 'Humidifier filter, gas valve gasket', amount: 300 },
    ],
    notes: null,
    description: 'Annual HVAC service',
    status: 'sent',
    sent_at: '2026-05-05T12:00:00Z',
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    valid_until: null,
    created_at: '2026-05-05T12:00:00Z',
    updated_at: '2026-05-05T12:00:00Z',
  },
  // paid → paid (most recent — Job 7)
  {
    id: 'inv-14a7e3c9-paid',
    job_id: '14a7e3c9-0007-4000-8000-000000000007',
    vendor_id: MOCK_VENDOR_ID,
    kind: 'invoice',
    labor: 800,
    parts: 1400,
    diagnostic_fee: 0,
    total: 2200,
    line_items: [
      { label: 'Hot water tank install + haulaway', amount: 800 },
      { label: 'Bradford White 50gal NG tank + venting', amount: 1400 },
    ],
    notes: 'Paid via Stripe',
    description: 'Hot water tank replacement',
    status: 'paid',
    sent_at: '2026-05-12T16:00:00Z',
    viewed_at: '2026-05-12T17:00:00Z',
    paid_at: '2026-05-12T18:15:00Z',
    overdue_at: null,
    valid_until: null,
    created_at: '2026-05-12T16:00:00Z',
    updated_at: '2026-05-12T18:15:00Z',
  },
  // paid → paid (Job 9)
  {
    id: 'inv-3c842b71-paid',
    job_id: '3c842b71-0009-4000-8000-000000000009',
    vendor_id: MOCK_VENDOR_ID,
    kind: 'invoice',
    labor: 1500,
    parts: 300,
    diagnostic_fee: 0,
    total: 1800,
    line_items: [
      { label: 'Pendant lights install + dimmer wiring', amount: 1500 },
      { label: 'Dimmer switch + wire nuts', amount: 300 },
    ],
    notes: 'Paid via Stripe',
    description: 'Dining room lighting',
    status: 'paid',
    sent_at: '2026-05-08T17:00:00Z',
    viewed_at: '2026-05-08T18:00:00Z',
    paid_at: '2026-05-08T18:45:00Z',
    overdue_at: null,
    valid_until: null,
    created_at: '2026-05-08T17:00:00Z',
    updated_at: '2026-05-08T18:45:00Z',
  },
  // paid → paid (Job 10)
  {
    id: 'inv-4e1d9a35-paid',
    job_id: '4e1d9a35-0010-4000-8000-000000000010',
    vendor_id: MOCK_VENDOR_ID,
    kind: 'invoice',
    labor: 900,
    parts: 100,
    diagnostic_fee: 0,
    total: 1000,
    line_items: [
      { label: 'TV mount install + cable conceal', amount: 900 },
      { label: 'Mount hardware + cable raceway', amount: 100 },
    ],
    notes: 'Paid via Stripe',
    description: 'TV wall mount',
    status: 'paid',
    sent_at: '2026-05-02T16:00:00Z',
    viewed_at: '2026-05-02T16:30:00Z',
    paid_at: '2026-05-02T17:15:00Z',
    overdue_at: null,
    valid_until: null,
    created_at: '2026-05-02T16:00:00Z',
    updated_at: '2026-05-02T17:15:00Z',
  },
];
