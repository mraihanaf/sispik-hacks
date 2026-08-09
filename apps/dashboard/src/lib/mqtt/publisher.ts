import mqtt, { type MqttClient } from 'mqtt';
import { SignJWT } from 'jose';
import { type RealtimeEvent, type RfidAccessDecision, vehicleRfidDecisionTopic } from '@sispik-hacks/iot-contracts';

let client: MqttClient | undefined;
async function publisher() {
  if (!client) {
    const url = process.env.MQTT_BROKER_INTERNAL_URL;
    if (!url) throw new Error('MQTT_BROKER_INTERNAL_URL is required to publish realtime events.');
    const secret = process.env.MQTT_JWT_SECRET;
    if (!secret) throw new Error('MQTT_JWT_SECRET is required for the dashboard MQTT publisher.');
    const token = await new SignJWT({ acl: [{ permission: 'allow', action: 'publish', topic: 'sispik/v1/realtime/#', qos: [0, 1] }, { permission: 'allow', action: 'publish', topic: 'sispik/v1/commands/vehicles/#', qos: [0, 1] }] }).setProtectedHeader({ alg: 'HS256' }).setSubject('dashboard-server').setExpirationTime('1h').sign(new TextEncoder().encode(secret));
    client = mqtt.connect(url, { clientId: process.env.MQTT_SERVER_CLIENT_ID ?? 'sispik-dashboard', username: 'dashboard-server', password: token });
  }
  return client;
}

function publish(topic: string, payload: unknown, qos: 0 | 1) {
  return publisher().then((mqttClient) => new Promise<void>((resolve, reject) => mqttClient.publish(topic, JSON.stringify(payload), { qos, retain: false }, (error) => error ? reject(error) : resolve())));
}

export function publishDomainEvent(topic: string, event: RealtimeEvent) { return publish(topic, event, event.type === 'vehicle.location.updated' ? 0 : 1); }

/** Sends a non-retained authorization decision only to the tracker that made the scan. */
export function publishRfidAccessDecision(deviceId: string, decision: RfidAccessDecision) { return publish(vehicleRfidDecisionTopic(deviceId), decision, 1); }
