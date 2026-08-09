import { SignJWT } from 'jose';
import { adminProcedure } from './base';

/** Only administrators may receive live GPS and driver-assignment topics. */
export const createConnectionToken = adminProcedure.handler(async ({ context }) => {
  const user = context.user;
  if (!user) throw new Error('Administrator authentication is required.');
  const secret = process.env.MQTT_JWT_SECRET;
  const brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_WSS_URL;
  if (!secret || !brokerUrl) throw new Error('Realtime MQTT is not configured.');
  const clientId = `dashboard-${user.id}-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  const token = await new SignJWT({
    acl: [
      { permission: 'allow', action: 'subscribe', topic: 'sispik/v1/realtime/#', qos: [0, 1] },
      { permission: 'deny', action: 'publish', topic: '#' },
    ],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setAudience('sispik-dashboard')
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(new TextEncoder().encode(secret));
  return { brokerUrl, clientId, token, expiresAt: expiresAt.toISOString() };
});
