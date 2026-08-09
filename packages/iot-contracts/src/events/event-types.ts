export const RealtimeEventTypes = [
  'site.updated',
  'vehicle.location.updated',
  'alert.created',
  'route.updated',
  'device.status.updated',
  'collection.completed',
  'route.completed',
  'driver.assignment.updated',
] as const;

export type RealtimeEventType = (typeof RealtimeEventTypes)[number];
