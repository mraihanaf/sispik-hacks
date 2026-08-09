import mqtt from 'mqtt';
import { SignJWT } from 'jose';
import { capacityTelemetryTopic, deviceStatusTopic, vehicleRfidTopic, vehicleTelemetryTopic } from '@sispik-hacks/iot-contracts';

export async function startSimulator() {
  const url = process.env.MQTT_BROKER_URL;
  const secret = process.env.MQTT_JWT_SECRET;
  if (!url || !secret) throw new Error('MQTT_BROKER_URL and MQTT_JWT_SECRET are required for the simulator.');
  const topics = ['sispik/v1/ingest/sites/SENSOR-TPS-001/telemetry', 'sispik/v1/ingest/vehicles/TRACKER-TRK-001/telemetry', 'sispik/v1/ingest/vehicles/TRACKER-TRK-001/rfid', 'sispik/v1/ingest/devices/SENSOR-TPS-001/status', 'sispik/v1/ingest/devices/TRACKER-TRK-001/status'];
  const token = await new SignJWT({ acl: topics.map((topic) => ({ permission: 'allow', action: 'publish', topic, qos: [0, 1] })) }).setProtectedHeader({ alg: 'HS256' }).setSubject('sispik-simulator').setExpirationTime('1h').sign(new TextEncoder().encode(secret));
  const client = mqtt.connect(url, { clientId: 'sispik-simulator', username: 'sispik-simulator', password: token });
  client.on('connect', () => {
    let tick = 0;
    const publishCycle = () => {
      tick += 1;
      const now = new Date().toISOString();
      const deviation = process.env.IOT_SIMULATOR_DEVIATION === 'true' && tick % 12 >= 9;
      const latitude = -6.1701 + (deviation ? 0.018 : Math.sin(tick / 4) * 0.002);
      const longitude = 106.8403 + (deviation ? 0.018 : Math.cos(tick / 4) * 0.002);
      client.publish(deviceStatusTopic('SENSOR-TPS-001'), JSON.stringify({ messageId: crypto.randomUUID(), status: 'online', observedAt: now }), { qos: 1, retain: true });
      client.publish(deviceStatusTopic('TRACKER-TRK-001'), JSON.stringify({ messageId: crypto.randomUUID(), status: 'online', observedAt: now }), { qos: 1, retain: true });
      client.publish(capacityTelemetryTopic('SENSOR-TPS-001'), JSON.stringify({ messageId: crypto.randomUUID(), distanceCm: 75 - (tick % 45), batteryPercent: 86, signalStrength: -63, observedAt: now }), { qos: 1 });
      client.publish(vehicleTelemetryTopic('TRACKER-TRK-001'), JSON.stringify({ messageId: crypto.randomUUID(), latitude, longitude, speedKph: deviation ? 12 : 23.4, heading: 120, observedAt: now }), { qos: 1 });
      if (tick % 20 === 1) client.publish(vehicleRfidTopic('TRACKER-TRK-001'), JSON.stringify({ messageId: crypto.randomUUID(), rfidUid: 'A1B2C3D4', observedAt: now }), { qos: 1 });
    };
    publishCycle();
    setInterval(publishCycle, Number(process.env.IOT_SIMULATOR_INTERVAL_MS ?? 5_000)).unref();
  });
  return client;
}
