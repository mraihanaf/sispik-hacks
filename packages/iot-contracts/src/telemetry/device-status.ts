import { z } from 'zod';
import { MessageIdSchema, ObservedAtSchema } from './shared.js';

export const DeviceStatusSchema = z
  .object({
    messageId: MessageIdSchema,
    status: z.enum(['online', 'offline', 'maintenance']),
    observedAt: ObservedAtSchema.optional(),
    batteryPercent: z.number().finite().min(0).max(100).optional(),
    signalStrength: z.number().finite().int().min(-200).max(0).optional(),
  })
  .strict();

export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;
