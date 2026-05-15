import { z } from 'zod';

// Contract for push payloads sent by the Alfred backend (Ryan's Next.js route,
// not yet built). The vendor app validates incoming `notification.request
// .content.data` against this schema before acting — invalid payloads are
// dropped silently to avoid crashing the OS push handler.
//
// Event reference: VXO_AI Mobile App API Reference (Matěj's doc).

const urgencySchema = z.enum(['standard', 'priority', 'emergency']);

export const pushPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('new_job'),
    job_id: z.string().uuid(),
    trade: z.string(),
    urgency: urgencySchema,
    address: z.string(),
  }),
  z.object({
    type: z.literal('account_approved'),
  }),
  z.object({
    type: z.literal('client_message'),
    job_id: z.string().uuid(),
    preview: z.string().max(120),
  }),
  z.object({
    type: z.literal('invoice_approved'),
    job_id: z.string().uuid(),
    invoice_id: z.string().uuid(),
    total: z.number(),
  }),
  z.object({
    type: z.literal('payment_received'),
    job_id: z.string().uuid(),
    invoice_id: z.string().uuid(),
    total: z.number(),
  }),
]);

export type PushPayload = z.infer<typeof pushPayloadSchema>;
export type PushPayloadType = PushPayload['type'];

// Never throws — push handlers run on the OS thread and an uncaught error
// would crash the foreground/tap pipeline. Callers receive null and bail.
export function parsePushPayload(raw: unknown): PushPayload | null {
  const result = pushPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
