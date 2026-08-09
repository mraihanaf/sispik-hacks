import { SignJWT } from 'jose';

const [deviceId, lifetime = '720h'] = process.argv.slice(2).filter((argument) => argument !== '--');
const secret = process.env.MQTT_JWT_SECRET;
if (!deviceId || !/^[A-Za-z0-9_-]+$/.test(deviceId) || !secret) {
  console.error('Usage: MQTT_JWT_SECRET=... node scripts/mint-mqtt-device-token.mjs DEVICE_ID [lifetime]');
  process.exit(1);
}

const ingestTopics = [
  `sispik/v1/ingest/sites/${deviceId}/telemetry`,
  `sispik/v1/ingest/vehicles/${deviceId}/telemetry`,
  `sispik/v1/ingest/vehicles/${deviceId}/rfid`,
  `sispik/v1/ingest/devices/${deviceId}/status`,
];
const token = await new SignJWT({ acl: [...ingestTopics.map((topic) => ({ permission: 'allow', action: 'publish', topic, qos: [0, 1] })), { permission: 'allow', action: 'subscribe', topic: `sispik/v1/commands/vehicles/${deviceId}/rfid-decision`, qos: [0, 1] }] })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(deviceId)
  .setExpirationTime(lifetime)
  .sign(new TextEncoder().encode(secret));
console.log(token);
