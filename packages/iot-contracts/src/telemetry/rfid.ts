import { z } from 'zod';
import { MessageIdSchema, ObservedAtSchema } from './shared.js';

/** The RFID UID is credential-like data and must not be exposed in realtime events. */
export const RfidTelemetrySchema = z
  .object({
    messageId: MessageIdSchema,
    rfidUid: z.string().min(1).max(128).regex(/^[A-Fa-f0-9]+$/, 'RFID UIDs must be hexadecimal.'),
    observedAt: ObservedAtSchema,
  })
  .strict();

export type RfidTelemetry = z.infer<typeof RfidTelemetrySchema>;
