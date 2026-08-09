import { z } from 'zod';
import { MessageIdSchema, ObservedAtSchema } from './shared.js';

export const RfidDecisionOutcomeSchema = z.enum([
  'ROUTE_STARTED',
  'ROUTE_COMPLETED',
  'REJECTED_UNKNOWN_DRIVER',
  'REJECTED_SUSPENDED_DRIVER',
  'REJECTED_UNVERIFIED_DRIVER',
  'REJECTED_NO_ACTIVE_ROUTE',
  'REJECTED_PENDING_STOPS',
]);

export const RfidAccessDecisionSchema = z
  .object({
    messageId: MessageIdSchema,
    accepted: z.boolean(),
    outcome: RfidDecisionOutcomeSchema,
    observedAt: ObservedAtSchema,
    expiresAtEpochMs: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    const acceptedOutcome = value.outcome === 'ROUTE_STARTED' || value.outcome === 'ROUTE_COMPLETED';
    if (value.accepted !== acceptedOutcome) context.addIssue({ code: 'custom', path: ['accepted'], message: 'Acceptance must match the RFID decision outcome.' });
  });

export type RfidAccessDecision = z.infer<typeof RfidAccessDecisionSchema>;
