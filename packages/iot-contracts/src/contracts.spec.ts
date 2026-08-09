import assert from 'node:assert/strict';
import test from 'node:test';
import { CapacityTelemetrySchema, RealtimeEventSchema, RfidAccessDecisionSchema, vehicleRfidDecisionTopic, vehicleRfidTopic } from './index.js';

test('validates capacity telemetry and rejects unknown fields', () => {
  assert.equal(
    CapacityTelemetrySchema.safeParse({
      messageId: '019c-capacity-001',
      distanceCm: 38.2,
      observedAt: '2026-08-09T03:00:00+07:00',
    }).success,
    true,
  );

  assert.equal(
    CapacityTelemetrySchema.safeParse({
      messageId: '019c-capacity-001',
      distanceCm: 38.2,
      observedAt: '2026-08-09T03:00:00+07:00',
      untrusted: true,
    }).success,
    false,
  );
});

test('validates realtime events and keeps RFID telemetry on its ingest topic', () => {
  assert.equal(
    RealtimeEventSchema.safeParse({
      eventId: '019c-event-02',
      type: 'vehicle.location.updated',
      timestamp: '2026-08-09T03:00:03+07:00',
      data: { vehicleId: 'vehicle_001', latitude: -6.1701, longitude: 106.8403 },
    }).success,
    true,
  );

  assert.equal(vehicleRfidTopic('TRACKER-TRK-001'), 'sispik/v1/ingest/vehicles/TRACKER-TRK-001/rfid');
});

test('validates RFID decisions and scopes them to a tracker command topic', () => {
  assert.equal(
    RfidAccessDecisionSchema.safeParse({
      messageId: 'scan-001',
      accepted: false,
      outcome: 'REJECTED_UNKNOWN_DRIVER',
      observedAt: '2026-08-09T03:00:03+07:00',
      expiresAtEpochMs: 1_786_000_000_000,
    }).success,
    true,
  );
  assert.equal(
    RfidAccessDecisionSchema.safeParse({
      messageId: 'scan-001',
      accepted: true,
      outcome: 'REJECTED_UNKNOWN_DRIVER',
      observedAt: '2026-08-09T03:00:03+07:00',
      expiresAtEpochMs: 1_786_000_000_000,
    }).success,
    false,
  );
  assert.equal(vehicleRfidDecisionTopic('TRACKER-TRK-001'), 'sispik/v1/commands/vehicles/TRACKER-TRK-001/rfid-decision');
});
