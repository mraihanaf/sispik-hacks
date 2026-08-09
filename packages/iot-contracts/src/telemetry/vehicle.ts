import { z } from 'zod';
import { LatitudeSchema, LongitudeSchema, MessageIdSchema, ObservedAtSchema } from './shared.js';

/** Raw GPS telemetry. Device identity is derived from the MQTT topic. */
export const VehicleTelemetrySchema = z
  .object({
    messageId: MessageIdSchema,
    latitude: LatitudeSchema,
    longitude: LongitudeSchema,
    speedKph: z.number().finite().min(0).max(500).optional(),
    heading: z.number().finite().min(0).lt(360).optional(),
    observedAt: ObservedAtSchema,
  })
  .strict();

export type VehicleTelemetry = z.infer<typeof VehicleTelemetrySchema>;
