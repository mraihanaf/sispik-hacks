import { z } from 'zod';
import { MessageIdSchema, ObservedAtSchema } from './shared.js';

/** Raw capacity-sensor telemetry. Device identity is derived from the MQTT topic. */
export const CapacityTelemetrySchema = z
  .object({
    messageId: MessageIdSchema,
    distanceCm: z.number().finite().min(0).max(10_000),
    batteryPercent: z.number().finite().min(0).max(100).optional(),
    signalStrength: z.number().finite().int().min(-200).max(0).optional(),
    observedAt: ObservedAtSchema,
  })
  .strict();

export type CapacityTelemetry = z.infer<typeof CapacityTelemetrySchema>;
