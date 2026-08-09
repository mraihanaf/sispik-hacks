import { z } from 'zod';
import { RealtimeEventTypes } from './event-types.js';
import { LatitudeSchema, LongitudeSchema, ObservedAtSchema } from '../telemetry/shared.js';

const EventIdSchema = z.string().min(1).max(128);
const EntityIdSchema = z.string().min(1).max(128);
const EventTimestampSchema = ObservedAtSchema;

const SiteUpdatedEventSchema = z.object({
  eventId: EventIdSchema,
  type: z.literal('site.updated'),
  timestamp: EventTimestampSchema,
  data: z
    .object({
      siteId: EntityIdSchema,
      capacityPercent: z.number().finite().min(0).max(100),
      estimatedWasteKg: z.number().finite().min(0),
      status: z.string().min(1).max(32),
      priorityScore: z.number().finite().min(0),
    })
    .strict(),
});

const VehicleLocationUpdatedEventSchema = z.object({
  eventId: EventIdSchema,
  type: z.literal('vehicle.location.updated'),
  timestamp: EventTimestampSchema,
  data: z
    .object({
      vehicleId: EntityIdSchema,
      latitude: LatitudeSchema,
      longitude: LongitudeSchema,
      speedKph: z.number().finite().min(0).max(500).optional(),
      heading: z.number().finite().min(0).lt(360).optional(),
    })
    .strict(),
});

const AlertCreatedEventSchema = z.object({
  eventId: EventIdSchema,
  type: z.literal('alert.created'),
  timestamp: EventTimestampSchema,
  data: z
    .object({
      alertId: EntityIdSchema,
      severity: z.string().min(1).max(32),
      category: z.string().min(1).max(64),
      entityId: EntityIdSchema,
      title: z.string().min(1).max(256),
    })
    .strict(),
});

const RouteUpdatedEventSchema = z.object({
  eventId: EventIdSchema,
  type: z.literal('route.updated'),
  timestamp: EventTimestampSchema,
  data: z.object({ routeId: EntityIdSchema, status: z.string().min(1).max(32) }).strict(),
});

const DeviceStatusUpdatedEventSchema = z.object({
  eventId: EventIdSchema,
  type: z.literal('device.status.updated'),
  timestamp: EventTimestampSchema,
  data: z.object({ deviceId: EntityIdSchema, status: z.string().min(1).max(32) }).strict(),
});

const CollectionCompletedEventSchema = z.object({
  eventId: EventIdSchema,
  type: z.literal('collection.completed'),
  timestamp: EventTimestampSchema,
  data: z.object({ collectionEventId: EntityIdSchema, routeId: EntityIdSchema, siteId: EntityIdSchema }).strict(),
});

const RouteCompletedEventSchema = z.object({
  eventId: EventIdSchema,
  type: z.literal('route.completed'),
  timestamp: EventTimestampSchema,
  data: z.object({ routeId: EntityIdSchema, vehicleId: EntityIdSchema }).strict(),
});

const DriverAssignmentUpdatedEventSchema = z.object({
  eventId: EventIdSchema,
  type: z.literal('driver.assignment.updated'),
  timestamp: EventTimestampSchema,
  data: z
    .object({ vehicleId: EntityIdSchema, driverId: EntityIdSchema, driverName: z.string().min(1).max(256) })
    .strict(),
});

export const RealtimeEventSchema = z.discriminatedUnion('type', [
  SiteUpdatedEventSchema,
  VehicleLocationUpdatedEventSchema,
  AlertCreatedEventSchema,
  RouteUpdatedEventSchema,
  DeviceStatusUpdatedEventSchema,
  CollectionCompletedEventSchema,
  RouteCompletedEventSchema,
  DriverAssignmentUpdatedEventSchema,
]);

export const RealtimeEventTypeSchema = z.enum(RealtimeEventTypes);

export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;
