import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { SignJWT } from 'jose';
import mqtt, { MqttClient } from 'mqtt';
import { CAPACITY_TELEMETRY_SUBSCRIPTION, CapacityTelemetrySchema, DEVICE_STATUS_SUBSCRIPTION, DeviceStatusSchema, deviceIdFromCapacityTelemetryTopic, deviceIdFromStatusTopic, deviceIdFromVehicleRfidTopic, deviceIdFromVehicleTelemetryTopic, RfidTelemetrySchema, VEHICLE_RFID_SUBSCRIPTION, VEHICLE_TELEMETRY_SUBSCRIPTION, VehicleTelemetrySchema } from '@sispik-hacks/iot-contracts';

type InternalTelemetryMethod = 'ingestCapacity' | 'ingestVehicleLocation' | 'ingestRfidScan' | 'updateStatus';
type InternalTelemetryClient = {
  internal: {
    telemetry: Pick<Record<InternalTelemetryMethod, (input: unknown) => Promise<unknown>>, 'ingestCapacity' | 'ingestVehicleLocation' | 'ingestRfidScan'>;
    device: Pick<Record<InternalTelemetryMethod, (input: unknown) => Promise<unknown>>, 'updateStatus'>;
  };
};

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client?: MqttClient;
  async onModuleInit() {
    const url = process.env.MQTT_BROKER_URL;
    if (!url) { this.logger.warn('MQTT_BROKER_URL is not configured; ingestion is disabled.'); return; }
    const secret = process.env.MQTT_JWT_SECRET;
    if (!secret) { this.logger.warn('MQTT_JWT_SECRET is not configured; ingestion is disabled.'); return; }
    const token = await new SignJWT({ acl: [{ permission: 'allow', action: 'subscribe', topic: 'sispik/v1/ingest/#', qos: [0, 1] }] }).setProtectedHeader({ alg: 'HS256' }).setSubject('iot-ingestor').setExpirationTime('1h').sign(new TextEncoder().encode(secret));
    this.client = mqtt.connect(url, { clientId: process.env.MQTT_CLIENT_ID ?? 'sispik-iot-ingestor', username: 'iot-ingestor', password: token });
    this.client.on('connect', () => this.client?.subscribe([CAPACITY_TELEMETRY_SUBSCRIPTION, VEHICLE_TELEMETRY_SUBSCRIPTION, VEHICLE_RFID_SUBSCRIPTION, DEVICE_STATUS_SUBSCRIPTION], { qos: 1 }));
    this.client.on('message', (topic, payload) => void this.handle(topic, payload));
  }
  private async handle(topic: string, payload: Buffer) {
    try {
      const value: unknown = JSON.parse(payload.toString('utf8'));
      const capacityDeviceId = deviceIdFromCapacityTelemetryTopic(topic);
      const vehicleDeviceId = deviceIdFromVehicleTelemetryTopic(topic);
      const rfidDeviceId = deviceIdFromVehicleRfidTopic(topic);
      const statusDeviceId = deviceIdFromStatusTopic(topic);
      if (capacityDeviceId) await this.forward('ingestCapacity', { deviceId: capacityDeviceId, telemetry: CapacityTelemetrySchema.parse(value) });
      else if (vehicleDeviceId) await this.forward('ingestVehicleLocation', { deviceId: vehicleDeviceId, telemetry: VehicleTelemetrySchema.parse(value) });
      else if (rfidDeviceId) await this.forward('ingestRfidScan', { deviceId: rfidDeviceId, telemetry: RfidTelemetrySchema.parse(value) });
      else if (statusDeviceId) await this.forward('updateStatus', { deviceId: statusDeviceId, status: DeviceStatusSchema.parse(value) });
      else return;
      this.logger.debug(`Validated telemetry from ${capacityDeviceId ?? vehicleDeviceId ?? statusDeviceId}`);
    } catch (error) { this.logger.warn(`Rejected MQTT message on ${topic}: ${error instanceof Error ? error.message : 'invalid payload'}`); }
  }
  private async forward(method: InternalTelemetryMethod, input: unknown) {
    const baseUrl = process.env.DASHBOARD_RPC_URL;
    const token = process.env.DASHBOARD_SERVICE_TOKEN;
    if (!baseUrl || !token) throw new Error('DASHBOARD_RPC_URL and DASHBOARD_SERVICE_TOKEN are required for telemetry forwarding.');
    const link = new RPCLink({
      url: baseUrl,
      headers: () => ({ 'x-sispik-service-key': token }),
    });
    // The dashboard owns the router type; this narrow boundary keeps this Nest
    // application independently buildable while all inputs are still validated
    // by the shared schemas before crossing the network.
    const client = createORPCClient(link) as unknown as InternalTelemetryClient;
    if (method === 'updateStatus') await client.internal.device.updateStatus(input);
    else await client.internal.telemetry[method](input);
  }
  onModuleDestroy() { this.client?.end(true); }
}
