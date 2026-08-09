import { DeviceIdSchema } from './telemetry/shared.js';

export const MQTT_TOPIC_PREFIX = 'sispik/v1' as const;

export const CAPACITY_TELEMETRY_SUBSCRIPTION = `${MQTT_TOPIC_PREFIX}/ingest/sites/+/telemetry` as const;
export const VEHICLE_TELEMETRY_SUBSCRIPTION = `${MQTT_TOPIC_PREFIX}/ingest/vehicles/+/telemetry` as const;
export const VEHICLE_RFID_SUBSCRIPTION = `${MQTT_TOPIC_PREFIX}/ingest/vehicles/+/rfid` as const;
export const DEVICE_STATUS_SUBSCRIPTION = `${MQTT_TOPIC_PREFIX}/ingest/devices/+/status` as const;
export const REALTIME_SUBSCRIPTION = `${MQTT_TOPIC_PREFIX}/realtime/#` as const;

function deviceSegment(deviceId: string) {
  return DeviceIdSchema.parse(deviceId);
}

export function capacityTelemetryTopic(deviceId: string) {
  return `${MQTT_TOPIC_PREFIX}/ingest/sites/${deviceSegment(deviceId)}/telemetry` as const;
}

export function vehicleTelemetryTopic(deviceId: string) {
  return `${MQTT_TOPIC_PREFIX}/ingest/vehicles/${deviceSegment(deviceId)}/telemetry` as const;
}

export function vehicleRfidTopic(deviceId: string) {
  return `${MQTT_TOPIC_PREFIX}/ingest/vehicles/${deviceSegment(deviceId)}/rfid` as const;
}

/** Device-only response to a vehicle RFID/e-KTP scan. */
export function vehicleRfidDecisionTopic(deviceId: string) {
  return `${MQTT_TOPIC_PREFIX}/commands/vehicles/${deviceSegment(deviceId)}/rfid-decision` as const;
}

export function deviceStatusTopic(deviceId: string) {
  return `${MQTT_TOPIC_PREFIX}/ingest/devices/${deviceSegment(deviceId)}/status` as const;
}

export function siteRealtimeTopic(siteId: string) {
  return `${MQTT_TOPIC_PREFIX}/realtime/sites/${deviceSegment(siteId)}` as const;
}

export function vehicleRealtimeTopic(vehicleId: string) {
  return `${MQTT_TOPIC_PREFIX}/realtime/vehicles/${deviceSegment(vehicleId)}` as const;
}

export function routeRealtimeTopic(routeId: string) {
  return `${MQTT_TOPIC_PREFIX}/realtime/routes/${deviceSegment(routeId)}` as const;
}

export function deviceRealtimeTopic(deviceId: string) {
  return `${MQTT_TOPIC_PREFIX}/realtime/devices/${deviceSegment(deviceId)}` as const;
}

export const ALERTS_REALTIME_TOPIC = `${MQTT_TOPIC_PREFIX}/realtime/alerts` as const;
export const OPERATIONS_REALTIME_TOPIC = `${MQTT_TOPIC_PREFIX}/realtime/operations` as const;
/** Development simulator receives only events intentionally mirrored from SIM-* entities. */
export const SIMULATOR_REALTIME_TOPIC = `${MQTT_TOPIC_PREFIX}/realtime/simulator` as const;

function deviceIdFromTopic(topic: string, pattern: RegExp) {
  const match = pattern.exec(topic);
  if (!match) return undefined;
  return DeviceIdSchema.safeParse(match[1]).data;
}

export function deviceIdFromCapacityTelemetryTopic(topic: string) {
  return deviceIdFromTopic(topic, /^sispik\/v1\/ingest\/sites\/([^/]+)\/telemetry$/);
}

export function deviceIdFromVehicleTelemetryTopic(topic: string) {
  return deviceIdFromTopic(topic, /^sispik\/v1\/ingest\/vehicles\/([^/]+)\/telemetry$/);
}

export function deviceIdFromVehicleRfidTopic(topic: string) {
  return deviceIdFromTopic(topic, /^sispik\/v1\/ingest\/vehicles\/([^/]+)\/rfid$/);
}

export function deviceIdFromStatusTopic(topic: string) {
  return deviceIdFromTopic(topic, /^sispik\/v1\/ingest\/devices\/([^/]+)\/status$/);
}
