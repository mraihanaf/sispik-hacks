import { CapacityTelemetrySchema, DeviceStatusSchema, RfidTelemetrySchema, SIMULATOR_REALTIME_TOPIC, VehicleTelemetrySchema, deviceRealtimeTopic, routeRealtimeTopic, siteRealtimeTopic, vehicleRealtimeTopic } from '@sispik-hacks/iot-contracts';
import { publishDomainEvent, publishRfidAccessDecision } from '@/lib/mqtt/publisher';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { VehicleStatus } from '@/generated/prisma/enums';
import { calculateCapacityPercent, calculatePriority, siteStatus } from '@/lib/domain/sites/capacity';
import { haversineKm } from '@/lib/domain/routing/haversine';
import { recordAnomaly } from '@/lib/domain/anomalies/service';
import { serviceProcedure } from '../base';

const deviceInput = z.object({ deviceId: z.string().min(1) });
const normalizeRfidUid = (value: string) => value.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
const legacyRfidUid = (value: string) => value.match(/.{1,2}/g)?.join(':') ?? value;
export const ingestCapacity = serviceProcedure.input(deviceInput.extend({ telemetry: CapacityTelemetrySchema })).handler(async ({ input }) => {
  const device = await prisma.ioTDevice.findUnique({ where: { deviceId: input.deviceId }, include: { site: true } });
  if (!device?.site || device.type !== 'CAPACITY_SENSOR' || device.emptyDistanceCm === null || device.fullDistanceCm === null) throw new Error('Unknown or uncalibrated capacity device.');
  const site = device.site;
  const capacityPercent = calculateCapacityPercent(device.emptyDistanceCm, device.fullDistanceCm, input.telemetry.distanceCm);
  const status = siteStatus(capacityPercent);
  const telemetry = await prisma.$transaction(async (tx) => {
    const telemetry = await tx.siteTelemetry.upsert({ where: { deviceId_messageId: { deviceId: device.id, messageId: input.telemetry.messageId } }, create: { deviceId: device.id, siteId: site.id, messageId: input.telemetry.messageId, distanceCm: input.telemetry.distanceCm, capacityPercent, batteryPercent: input.telemetry.batteryPercent, signalStrength: input.telemetry.signalStrength, observedAt: new Date(input.telemetry.observedAt) }, update: {} });
    await tx.ioTDevice.update({ where: { id: device.id }, data: { status: 'ONLINE', lastSeenAt: new Date(input.telemetry.observedAt), batteryPercent: input.telemetry.batteryPercent } });
    await tx.wasteSite.update({ where: { id: site.id }, data: { currentCapacityPercent: capacityPercent, estimatedWasteKg: site.maxCapacityKg * capacityPercent / 100, status, priorityScore: calculatePriority(capacityPercent, site.lastCollectedAt, null) } });
    return telemetry;
  });
  const event = { eventId: telemetry.id, type: 'site.updated' as const, timestamp: new Date().toISOString(), data: { siteId: site.id, capacityPercent, estimatedWasteKg: site.maxCapacityKg * capacityPercent / 100, status, priorityScore: calculatePriority(capacityPercent, site.lastCollectedAt, null) } };
  await publishDomainEvent(siteRealtimeTopic(site.id), event); if (site.code.startsWith('SIM-')) await publishDomainEvent(SIMULATOR_REALTIME_TOPIC, event);
  return telemetry;
});

export const ingestVehicleLocation = serviceProcedure.input(deviceInput.extend({ telemetry: VehicleTelemetrySchema })).handler(async ({ input }) => {
  const device = await prisma.ioTDevice.findUnique({ where: { deviceId: input.deviceId }, include: { vehicle: { select: { code: true } } } });
  if (!device?.vehicleId || device.type !== 'VEHICLE_TRACKER') throw new Error('Unknown vehicle tracker.');
  const vehicleId = device.vehicleId;
  const location = await prisma.$transaction(async (tx) => {
    const location = await tx.vehicleLocation.upsert({ where: { deviceId_messageId: { deviceId: device.id, messageId: input.telemetry.messageId } }, create: { deviceId: device.id, vehicleId, messageId: input.telemetry.messageId, latitude: input.telemetry.latitude, longitude: input.telemetry.longitude, speedKph: input.telemetry.speedKph, heading: input.telemetry.heading, observedAt: new Date(input.telemetry.observedAt) }, update: {} });
    await tx.vehicle.update({ where: { id: vehicleId }, data: { lastLatitude: input.telemetry.latitude, lastLongitude: input.telemetry.longitude, lastSeenAt: new Date(input.telemetry.observedAt) } });
    return location;
  });
  const event = { eventId: location.id, type: 'vehicle.location.updated' as const, timestamp: new Date().toISOString(), data: { vehicleId, latitude: input.telemetry.latitude, longitude: input.telemetry.longitude, speedKph: input.telemetry.speedKph, heading: input.telemetry.heading } };
  await publishDomainEvent(vehicleRealtimeTopic(vehicleId), event); if (device.vehicle?.code.startsWith('SIM-')) await publishDomainEvent(SIMULATOR_REALTIME_TOPIC, event);
  void detectVehicleLocationAnomalies(vehicleId, location.id, input.telemetry.latitude, input.telemetry.longitude, input.telemetry.speedKph).catch(() => undefined);
  return location;
});

async function detectVehicleLocationAnomalies(vehicleId: string, locationId: string, latitude: number, longitude: number, speedKph?: number) {
  const [route, recentLocations] = await Promise.all([
    prisma.routePlan.findFirst({ where: { vehicleId, status: 'ACTIVE' }, include: { stops: { include: { site: true } } } }),
    prisma.vehicleLocation.findMany({ where: { vehicleId }, orderBy: { observedAt: 'desc' }, take: 2 }),
  ]);
  const previous = recentLocations.find((item) => item.id !== locationId);
  if (route) {
    const collectionSites = route.stops.flatMap((stop) => stop.site ? [stop.site] : []);
    const nearestKm = collectionSites.length ? Math.min(...collectionSites.map((site) => haversineKm({ latitude, longitude }, site))) : 0;
    if (nearestKm > 1) await recordAnomaly({ vehicleId, routePlanId: route.id, type: 'ROUTE_DEVIATION', value: nearestKm, latitude, longitude });
  }
  if (previous && (speedKph ?? 0) <= 1 && (previous.speedKph ?? 0) <= 1 && haversineKm({ latitude, longitude }, previous) < 0.05) {
    const stationaryMinutes = (Date.now() - previous.observedAt.getTime()) / 60_000;
    if (stationaryMinutes >= 15) await recordAnomaly({ vehicleId, routePlanId: route?.id, type: 'PROLONGED_STOP', value: stationaryMinutes, latitude, longitude });
  }
}

export const updateDeviceStatus = serviceProcedure.input(deviceInput.extend({ status: DeviceStatusSchema })).handler(async ({ input }) => {
  const observedAt = input.status.observedAt ? new Date(input.status.observedAt) : new Date();
  const device = await prisma.ioTDevice.update({ where: { deviceId: input.deviceId }, data: { status: input.status.status.toUpperCase() as 'ONLINE' | 'OFFLINE' | 'MAINTENANCE', lastSeenAt: observedAt, batteryPercent: input.status.batteryPercent } });
  await publishDomainEvent(deviceRealtimeTopic(device.deviceId), { eventId: device.id, type: 'device.status.updated', timestamp: new Date().toISOString(), data: { deviceId: device.deviceId, status: device.status } });
  return device;
});

export const ingestRfidScan = serviceProcedure.input(deviceInput.extend({ telemetry: RfidTelemetrySchema })).handler(async ({ input }) => {
  const device = await prisma.ioTDevice.findUnique({ where: { deviceId: input.deviceId } });
  if (!device?.vehicleId || device.type !== 'VEHICLE_TRACKER') throw new Error('Unknown vehicle tracker.');
  const vehicleId = device.vehicleId;
  const existing = await prisma.rfidScan.findUnique({ where: { deviceId_messageId: { deviceId: device.id, messageId: input.telemetry.messageId } } });
  if (existing) {
    const accepted = !existing.outcome.startsWith('REJECTED_');
    await publishRfidAccessDecision(input.deviceId, { messageId: input.telemetry.messageId, accepted, outcome: existing.outcome, observedAt: new Date().toISOString(), expiresAtEpochMs: Date.now() + 8_000 });
    return { accepted, scanId: existing.id, outcome: existing.outcome, routeId: existing.routePlanId };
  }
  const rfidUid = normalizeRfidUid(input.telemetry.rfidUid);
  const driver = await prisma.driver.findFirst({ where: { OR: [{ identityRef: { equals: rfidUid, mode: 'insensitive' } }, { identityRef: { equals: legacyRfidUid(rfidUid), mode: 'insensitive' } }] } });
  const observedAt = new Date(input.telemetry.observedAt);
  const result = await prisma.$transaction(async (tx) => {
    const audit = (outcome: 'REJECTED_UNKNOWN_DRIVER' | 'REJECTED_SUSPENDED_DRIVER' | 'REJECTED_UNVERIFIED_DRIVER' | 'REJECTED_NO_ACTIVE_ROUTE' | 'REJECTED_PENDING_STOPS', routePlanId?: string) => tx.rfidScan.create({ data: { deviceId: device.id, vehicleId, driverId: driver?.id, routePlanId, rfidUid, messageId: input.telemetry.messageId, observedAt, outcome } });
    if (!driver) return { scan: await audit('REJECTED_UNKNOWN_DRIVER'), route: undefined, driver: undefined };
    if (driver.status === 'SUSPENDED') return { scan: await audit('REJECTED_SUSPENDED_DRIVER'), route: undefined, driver };
    if (driver.verificationStatus !== 'VERIFIED') return { scan: await audit('REJECTED_UNVERIFIED_DRIVER'), route: undefined, driver };
    const route = await tx.routePlan.findFirst({ where: { vehicleId, status: { in: ['ASSIGNED', 'ACTIVE'] } }, include: { stops: true } });
    if (!route) return { scan: await audit('REJECTED_NO_ACTIVE_ROUTE'), route: undefined, driver };
    if (route.status === 'ASSIGNED') {
      await tx.vehicleAssignment.updateMany({ where: { vehicleId, active: true }, data: { active: false, endedAt: observedAt } });
      await tx.vehicleAssignment.create({ data: { vehicleId, driverId: driver.id, active: true, startedAt: observedAt } });
      await tx.driver.update({ where: { id: driver.id }, data: { status: 'ON_DUTY' } });
      const started = await tx.routePlan.update({ where: { id: route.id }, data: { status: 'ACTIVE', startedAt: observedAt, startedByDriverId: driver.id } });
      await tx.vehicle.update({ where: { id: vehicleId }, data: { status: VehicleStatus.COLLECTING } });
      const scan = await tx.rfidScan.create({ data: { deviceId: device.id, vehicleId, driverId: driver.id, routePlanId: route.id, rfidUid, messageId: input.telemetry.messageId, observedAt, outcome: 'ROUTE_STARTED' } });
      return { scan, route: started, driver };
    }
    const hasPendingCollections = route.stops.some((stop) => stop.type === 'COLLECTION' && stop.status !== 'COMPLETED');
    if (hasPendingCollections) return { scan: await audit('REJECTED_PENDING_STOPS', route.id), route: undefined, driver };
    const assignments = await tx.vehicleAssignment.findMany({ where: { vehicleId, active: true }, select: { driverId: true } });
    await tx.vehicleAssignment.updateMany({ where: { vehicleId, active: true }, data: { active: false, endedAt: observedAt } });
    await tx.driver.updateMany({ where: { id: { in: [...new Set([...assignments.map((assignment) => assignment.driverId), driver.id])] } }, data: { status: 'OFF_DUTY' } });
    const completed = await tx.routePlan.update({ where: { id: route.id }, data: { status: 'COMPLETED', completedAt: observedAt, completedByDriverId: driver.id } });
    await tx.vehicle.update({ where: { id: vehicleId }, data: { status: VehicleStatus.AVAILABLE, currentLoadKg: 0 } });
    const scan = await tx.rfidScan.create({ data: { deviceId: device.id, vehicleId, driverId: driver.id, routePlanId: route.id, rfidUid, messageId: input.telemetry.messageId, observedAt, outcome: 'ROUTE_COMPLETED' } });
    return { scan, route: completed, driver };
  });
  const accepted = !result.scan.outcome.startsWith('REJECTED_');
  if (accepted && result.driver && result.route) {
    const timestamp = new Date().toISOString();
    await Promise.all([
      publishDomainEvent(vehicleRealtimeTopic(vehicleId), { eventId: result.scan.id, type: 'driver.assignment.updated', timestamp, data: { vehicleId, driverId: result.driver.id, driverName: result.driver.name } }),
      publishDomainEvent(routeRealtimeTopic(result.route.id), { eventId: result.scan.id, type: 'route.updated', timestamp, data: { routeId: result.route.id, status: result.route.status } }),
    ]);
  }
  await publishRfidAccessDecision(input.deviceId, { messageId: input.telemetry.messageId, accepted, outcome: result.scan.outcome, observedAt: new Date().toISOString(), expiresAtEpochMs: Date.now() + 8_000 });
  return { accepted, scanId: result.scan.id, outcome: result.scan.outcome, routeId: result.scan.routePlanId };
});
