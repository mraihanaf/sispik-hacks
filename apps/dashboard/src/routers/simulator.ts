import { z } from 'zod';
import prisma from '@/lib/prisma';
import { simulatorProcedure } from './base';
import { calculatePriority, siteStatus } from '@/lib/domain/sites/capacity';
import { optimizeStopOrder, routeCost, selectEligibleStops } from '@/lib/domain/routing/optimize';
import { haversineKm } from '@/lib/domain/routing/haversine';
import { roadDistanceTable, roadRoute } from '@/lib/routing/osrm';
import { SIMULATOR_REALTIME_TOPIC, routeRealtimeTopic, siteRealtimeTopic, vehicleRealtimeTopic, type RealtimeEvent } from '@sispik-hacks/iot-contracts';
import { publishDomainEvent } from '@/lib/mqtt/publisher';
import { SignJWT } from 'jose';

const fleetId = z.object({ fleetId: z.string().min(1) });
const SIM_PREFIX = 'SIM-';
const leaseMs = 3_000;
const FLEET_PRESETS = {
  LIGHT: { label: 'Light collector', capacityKg: 1_000 },
  STANDARD: { label: 'Standard collector', capacityKg: 2_000 },
  HEAVY: { label: 'Heavy collector', capacityKg: 4_000 },
} as const;

function enabled() { if (process.env.ENABLE_SIMULATOR_DEV_API !== 'true') throw new Error('Simulator API is disabled.'); }
function uid(sequence: number) { return `DE${sequence.toString(16).padStart(6, '0')}`.toUpperCase(); }
function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) { return Math.hypot((a.latitude - b.latitude) * 111_000, (a.longitude - b.longitude) * 111_000 * Math.cos(a.latitude * Math.PI / 180)); }
async function publishSimulatorEvent(topic: string, event: RealtimeEvent) { await Promise.all([publishDomainEvent(topic, event), publishDomainEvent(SIMULATOR_REALTIME_TOPIC, event)]); }

export const createRealtimeConnectionToken = simulatorProcedure.handler(async () => {
  const secret = process.env.MQTT_JWT_SECRET; const brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_WSS_URL;
  if (!secret || !brokerUrl) throw new Error('Simulator realtime MQTT is not configured.');
  const token = await new SignJWT({ acl: [{ permission: 'allow', action: 'subscribe', topic: SIMULATOR_REALTIME_TOPIC, qos: [0, 1] }, { permission: 'deny', action: 'publish', topic: '#' }] }).setProtectedHeader({ alg: 'HS256' }).setSubject(`simulator-${crypto.randomUUID()}`).setExpirationTime('5m').sign(new TextEncoder().encode(secret));
  return { brokerUrl, clientId: `simulator-${crypto.randomUUID()}`, token, topic: SIMULATOR_REALTIME_TOPIC };
});

export const snapshot = simulatorProcedure.handler(async () => {
  enabled();
  const [sites, facilities, fleets] = await Promise.all([
    prisma.wasteSite.findMany({ where: { code: { startsWith: SIM_PREFIX } }, orderBy: { code: 'asc' } }),
    prisma.facility.findMany({ where: { code: { startsWith: SIM_PREFIX } }, orderBy: { code: 'asc' } }),
    prisma.demoFleet.findMany({
      include: { startFacility: true, vehicle: { include: { locations: { orderBy: { observedAt: 'desc' }, take: 1 } } }, drive: { include: { routePlan: { include: { stops: { include: { site: true }, orderBy: { sequence: 'asc' } } } } } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return { sites, facilities, fleets };
});

export const seed = simulatorProcedure.handler(async () => {
  enabled();
  const depot = await prisma.facility.upsert({ where: { code: 'SIM-DEPOT' }, update: {}, create: { code: 'SIM-DEPOT', name: 'Simulator Depot', type: 'DEPOT', latitude: -6.1818, longitude: 106.8224 } });
  const landfill = await prisma.facility.upsert({ where: { code: 'SIM-LANDFILL' }, update: {}, create: { code: 'SIM-LANDFILL', name: 'Simulator Landfill', type: 'LANDFILL', latitude: -6.2297, longitude: 106.8353 } });
  const records = [
    ['SIM-SITE-01', 'Cikini Collection Point', -6.186, 106.834, 78], ['SIM-SITE-02', 'Menteng Collection Point', -6.196, 106.842, 45], ['SIM-SITE-03', 'Gambir Collection Point', -6.171, 106.831, 91],
  ] as const;
  await Promise.all(records.map(async ([code, name, latitude, longitude, capacity]) => {
    const site = await prisma.wasteSite.upsert({ where: { code }, update: {}, create: { code, name, latitude, longitude, maxCapacityKg: 800, currentCapacityPercent: capacity, estimatedWasteKg: 8 * capacity, priorityScore: capacity, status: siteStatus(capacity) } });
    await prisma.ioTDevice.upsert({ where: { deviceId: `SENSOR-${code}` }, update: { siteId: site.id }, create: { deviceId: `SENSOR-${code}`, mqttClientId: `SENSOR-${code}`, type: 'CAPACITY_SENSOR', siteId: site.id, emptyDistanceCm: 75, fullDistanceCm: 20, status: 'ONLINE' } });
  }));
  return { depotId: depot.id, landfillId: landfill.id };
});

export const addFleet = simulatorProcedure.input(z.object({ preset: z.enum(['LIGHT', 'STANDARD', 'HEAVY']), startFacilityId: z.string().optional() })).handler(async ({ input }) => {
  enabled();
  const start = input.startFacilityId
    ? await prisma.facility.findFirst({ where: { id: input.startFacilityId, code: { startsWith: SIM_PREFIX } } })
    : await prisma.facility.findUnique({ where: { code: 'SIM-DEPOT' } });
  if (!start) throw new Error('Load the simulator scenario first or select a valid simulator facility.');
  const preset = FLEET_PRESETS[input.preset]; const sequence = await prisma.demoFleet.count() + 1; const code = `SIM-FLEET-${String(sequence).padStart(2, '0')}`;
  const vehicle = await prisma.vehicle.create({ data: { code, licensePlate: `SIM ${String(sequence).padStart(4, '0')}`, capacityKg: preset.capacityKg, lastLatitude: start.latitude, lastLongitude: start.longitude } });
  const driver = await prisma.driver.create({ data: { name: `${preset.label} Driver`, identityRef: uid(sequence), verificationStatus: 'VERIFIED' } });
  const tracker = await prisma.ioTDevice.create({ data: { deviceId: `TRACKER-${code}`, mqttClientId: `TRACKER-${code}`, type: 'VEHICLE_TRACKER', vehicleId: vehicle.id, status: 'ONLINE' } });
  return prisma.demoFleet.create({ data: { label: preset.label, vehicleId: vehicle.id, driverId: driver.id, trackerDeviceId: tracker.id, startFacilityId: start.id, drive: { create: {} } }, include: { startFacility: true, vehicle: true, drive: true } });
});

export const routeOptions = simulatorProcedure.input(fleetId).handler(async ({ input }) => {
  const fleet = await prisma.demoFleet.findUniqueOrThrow({ where: { id: input.fleetId } });
  return prisma.routePlan.findMany({ where: { vehicleId: fleet.vehicleId, status: { in: ['DRAFT', 'ASSIGNED'] } }, select: { id: true, status: true, estimatedDistanceKm: true, stops: { select: { id: true } } }, orderBy: { createdAt: 'desc' } });
});

async function beginRoute(fleetIdValue: string, routeId?: string) {
  const fleet = await prisma.demoFleet.findUniqueOrThrow({ where: { id: fleetIdValue }, include: { startFacility: true, vehicle: true, drive: true } });
  let route = routeId ? await prisma.routePlan.findFirstOrThrow({ where: { id: routeId, vehicleId: fleet.vehicleId, status: { in: ['DRAFT', 'ASSIGNED'] } } }) : undefined;
  if (!route) {
    const [defaultStart, end, sites] = await Promise.all([prisma.facility.findUniqueOrThrow({ where: { code: 'SIM-DEPOT' } }), prisma.facility.findUniqueOrThrow({ where: { code: 'SIM-LANDFILL' } }), prisma.wasteSite.findMany({ where: { code: { startsWith: 'SIM-SITE-' } }, orderBy: { code: 'asc' } })]);
    const start = fleet.startFacility ?? defaultStart;
    const eligible = selectEligibleStops(sites.map((site) => ({ id: site.id, latitude: site.latitude, longitude: site.longitude, estimatedWasteKg: site.estimatedWasteKg, priorityScore: site.priorityScore })), fleet.vehicle.capacityKg);
    const matrix = await roadDistanceTable([start, ...eligible, end]); const order = optimizeStopOrder(matrix, eligible.length); const stops = order.slice(1, -1).map((index) => eligible[index - 1]); const road = await roadRoute([start, ...stops, end]);
    const baselineDistanceKm = routeCost(matrix, Array.from({ length: eligible.length + 2 }, (_, index) => index)) / 1_000;
    route = await prisma.routePlan.create({ data: { vehicleId: fleet.vehicleId, startFacilityId: start.id, endFacilityId: end.id, status: 'ASSIGNED', assignedAt: new Date(), estimatedDistanceKm: road.distanceKm, estimatedDurationMinutes: road.durationMinutes, baselineDistanceKm, distanceSavingsKm: Math.max(0, baselineDistanceKm - road.distanceKm), distanceSavingsPercent: baselineDistanceKm ? Math.max(0, baselineDistanceKm - road.distanceKm) / baselineDistanceKm * 100 : 0, geometry: road.geometry, stops: { create: stops.map((site, index) => ({ sequence: index + 1, siteId: site.id, type: 'COLLECTION', estimatedWasteKg: site.estimatedWasteKg })) } } });
  } else route = await prisma.routePlan.update({ where: { id: route.id }, data: { status: 'ASSIGNED', assignedAt: new Date() } });
  await prisma.vehicle.update({ where: { id: fleet.vehicleId }, data: { status: 'ASSIGNED' } });
  await publishSimulatorEvent(routeRealtimeTopic(route.id), { eventId: route.id, type: 'route.updated', timestamp: new Date().toISOString(), data: { routeId: route.id, status: route.status } });
  return prisma.demoDrive.update({ where: { fleetId: fleet.id }, data: { routePlanId: route.id, mode: 'STOPPED', waypointIndex: 0 } });
}

export const startDrive = simulatorProcedure.input(fleetId.extend({ routeId: z.string().optional() })).handler(({ input }) => beginRoute(input.fleetId, input.routeId));

export const scanEktp = simulatorProcedure.input(fleetId).handler(async ({ input }) => {
  const fleet = await prisma.demoFleet.findUniqueOrThrow({ where: { id: input.fleetId }, include: { drive: { include: { routePlan: { include: { stops: true } } } } } }); const route = fleet.drive?.routePlan;
  if (!route) throw new Error('Create a route first.');
  if (route.status === 'ASSIGNED') { await prisma.$transaction([prisma.routePlan.update({ where: { id: route.id }, data: { status: 'ACTIVE', startedAt: new Date(), startedByDriverId: fleet.driverId } }), prisma.vehicle.update({ where: { id: fleet.vehicleId }, data: { status: 'COLLECTING' } }), prisma.demoDrive.update({ where: { fleetId: fleet.id }, data: { mode: 'AUTOMATIC' } })]); await publishSimulatorEvent(routeRealtimeTopic(route.id), { eventId: route.id, type: 'route.updated', timestamp: new Date().toISOString(), data: { routeId: route.id, status: 'ACTIVE' } }); return { outcome: 'ROUTE_STARTED' }; }
  if (route.status === 'ACTIVE' && route.stops.every((stop) => stop.status === 'COMPLETED')) { await prisma.$transaction([prisma.routePlan.update({ where: { id: route.id }, data: { status: 'COMPLETED', completedAt: new Date(), completedByDriverId: fleet.driverId } }), prisma.vehicle.update({ where: { id: fleet.vehicleId }, data: { status: 'AVAILABLE', currentLoadKg: 0 } }), prisma.demoDrive.update({ where: { fleetId: fleet.id }, data: { mode: 'STOPPED' } })]); const timestamp = new Date().toISOString(); await Promise.all([publishSimulatorEvent(routeRealtimeTopic(route.id), { eventId: route.id, type: 'route.updated', timestamp, data: { routeId: route.id, status: 'COMPLETED' } }), publishSimulatorEvent(routeRealtimeTopic(route.id), { eventId: route.id, type: 'route.completed', timestamp, data: { routeId: route.id, vehicleId: fleet.vehicleId } })]); return { outcome: 'ROUTE_COMPLETED' }; }
  throw new Error('Complete all collection stops before the closing eKTP scan.');
});

export const setGarbage = simulatorProcedure.input(z.object({ siteId: z.string(), percent: z.number().int().min(1).max(100) })).handler(async ({ input }) => {
  const site = await prisma.wasteSite.findFirstOrThrow({ where: { OR: [{ id: input.siteId }, { code: input.siteId }], code: { startsWith: SIM_PREFIX } }, include: { devices: true } });
  const device = site.devices.find((item) => item.type === 'CAPACITY_SENSOR'); if (!device) throw new Error('Simulator site has no capacity sensor.');
  const capacity = input.percent; const distanceCm = 75 - ((75 - 20) * capacity / 100);
  const [telemetry, updated] = await prisma.$transaction([prisma.siteTelemetry.create({ data: { deviceId: device.id, siteId: site.id, messageId: crypto.randomUUID(), distanceCm, capacityPercent: capacity, observedAt: new Date() } }), prisma.wasteSite.update({ where: { id: site.id }, data: { currentCapacityPercent: capacity, estimatedWasteKg: site.maxCapacityKg * capacity / 100, status: siteStatus(capacity), priorityScore: calculatePriority(capacity, site.lastCollectedAt, null) } })]);
  await publishSimulatorEvent(siteRealtimeTopic(site.id), { eventId: telemetry.id, type: 'site.updated', timestamp: telemetry.observedAt.toISOString(), data: { siteId: site.id, capacityPercent: updated.currentCapacityPercent, estimatedWasteKg: updated.estimatedWasteKg, status: updated.status, priorityScore: updated.priorityScore } });
  return { siteId: site.id, percent: capacity };
});

export const setSpeed = simulatorProcedure.input(fleetId.extend({ speedKph: z.number().min(5).max(80) })).handler(async ({ input }) =>
  prisma.demoDrive.upsert({ where: { fleetId: input.fleetId }, update: { speedKph: input.speedKph }, create: { fleetId: input.fleetId, speedKph: input.speedKph } }),
);

export const takeControl = simulatorProcedure.input(fleetId.extend({ lease: z.string().uuid() })).handler(async ({ input }) => prisma.demoDrive.upsert({ where: { fleetId: input.fleetId }, update: { mode: 'MANUAL', controlLease: input.lease, controlLeaseExpiresAt: new Date(Date.now() + leaseMs) }, create: { fleetId: input.fleetId, mode: 'MANUAL', controlLease: input.lease, controlLeaseExpiresAt: new Date(Date.now() + leaseMs) } }));
export const releaseControl = simulatorProcedure.input(fleetId.extend({ lease: z.string().uuid() })).handler(async ({ input }) => prisma.demoDrive.updateMany({ where: { fleetId: input.fleetId, controlLease: input.lease }, data: { mode: 'AUTOMATIC', controlLease: null, controlLeaseExpiresAt: null } }));

async function move(fleetIdValue: string, latitude: number, longitude: number, speedKph: number, heading: number, lease?: string) {
  const fleet = await prisma.demoFleet.findUniqueOrThrow({ where: { id: fleetIdValue }, include: { vehicle: true, drive: { include: { routePlan: { include: { stops: { include: { site: true } } } } } } } });
  if (lease && (fleet.drive?.controlLease !== lease || !fleet.drive.controlLeaseExpiresAt || fleet.drive.controlLeaseExpiresAt < new Date())) throw new Error('Manual control lease has expired.');
  const previous = { latitude: fleet.vehicle.lastLatitude ?? latitude, longitude: fleet.vehicle.lastLongitude ?? longitude };
  if (latitude < -6.25 || latitude > -6.14 || longitude < 106.78 || longitude > 106.9 || distance(previous, { latitude, longitude }) > 250) throw new Error('Movement is outside the simulator area or too large.');
  const observedAt = new Date();
  const [location] = await prisma.$transaction([prisma.vehicleLocation.create({ data: { deviceId: fleet.trackerDeviceId, vehicleId: fleet.vehicleId, messageId: crypto.randomUUID(), latitude, longitude, speedKph, heading, observedAt } }), prisma.vehicle.update({ where: { id: fleet.vehicleId }, data: { lastLatitude: latitude, lastLongitude: longitude, lastSeenAt: observedAt } }), ...(lease ? [prisma.demoDrive.update({ where: { fleetId: fleet.id }, data: { controlLeaseExpiresAt: new Date(Date.now() + leaseMs) } })] : [])]);
  await publishSimulatorEvent(vehicleRealtimeTopic(fleet.vehicleId), { eventId: location.id, type: 'vehicle.location.updated', timestamp: location.observedAt.toISOString(), data: { vehicleId: fleet.vehicleId, latitude, longitude, speedKph, heading } });
  const next = fleet.drive?.routePlan?.stops.filter((stop) => stop.status !== 'COMPLETED').sort((a, b) => a.sequence - b.sequence)[0];
  if (next?.site && distance({ latitude, longitude }, next.site) < 60) { const completed = await prisma.$transaction(async (tx) => { await tx.routeStop.update({ where: { id: next.id }, data: { status: 'COMPLETED', completedAt: new Date() } }); const collectionEvent = await tx.collectionEvent.create({ data: { vehicleId: fleet.vehicleId, siteId: next.site!.id, routeStopId: next.id, estimatedCollectedKg: next.site!.estimatedWasteKg, capacityBeforePercent: next.site!.currentCapacityPercent, capacityAfterPercent: 5 } }); const site = await tx.wasteSite.update({ where: { id: next.site!.id }, data: { currentCapacityPercent: 5, estimatedWasteKg: next.site!.maxCapacityKg * .05, status: 'NORMAL', lastCollectedAt: new Date() } }); return { collectionEvent, site }; }); const timestamp = new Date().toISOString(); await Promise.all([publishSimulatorEvent(routeRealtimeTopic(next.routePlanId), { eventId: completed.collectionEvent.id, type: 'collection.completed', timestamp, data: { collectionEventId: completed.collectionEvent.id, routeId: next.routePlanId, siteId: completed.site.id } }), publishSimulatorEvent(siteRealtimeTopic(completed.site.id), { eventId: completed.collectionEvent.id, type: 'site.updated', timestamp, data: { siteId: completed.site.id, capacityPercent: completed.site.currentCapacityPercent, estimatedWasteKg: completed.site.estimatedWasteKg, status: completed.site.status, priorityScore: completed.site.priorityScore } })]); }
  return { latitude, longitude };
}
export const manualMove = simulatorProcedure.input(fleetId.extend({ lease: z.string().uuid(), latitude: z.number(), longitude: z.number(), speedKph: z.number().min(0).max(50), heading: z.number().min(0).lt(360) })).handler(({ input }) => move(input.fleetId, input.latitude, input.longitude, input.speedKph, input.heading, input.lease));
export const tick = simulatorProcedure.input(fleetId).handler(async ({ input }) => {
  const fleet = await prisma.demoFleet.findUniqueOrThrow({ where: { id: input.fleetId }, include: { vehicle: true, drive: { include: { routePlan: { include: { stops: { include: { site: true }, orderBy: { sequence: 'asc' } } } } } } } }); const drive = fleet.drive; const geometry = drive?.routePlan?.geometry as { type?: string; coordinates?: [number, number][] } | null;
  if (!drive?.routePlan || drive.mode !== 'AUTOMATIC' || geometry?.type !== 'LineString' || !geometry.coordinates?.length) return { moved: false };
  const coordinates = geometry.coordinates; let index = Math.min(drive.waypointIndex, coordinates.length - 1); let position = { latitude: fleet.vehicle.lastLatitude ?? coordinates[0][1], longitude: fleet.vehicle.lastLongitude ?? coordinates[0][0] }; let remainingKm = drive.speedKph / 3_600 * Math.min(5, Math.max(.25, (Date.now() - drive.updatedAt.getTime()) / 1_000));
  while (remainingKm > 0 && index < coordinates.length - 1) { const target = { latitude: coordinates[index + 1][1], longitude: coordinates[index + 1][0] }; const segmentKm = haversineKm(position, target); if (segmentKm <= remainingKm || segmentKm < .001) { position = target; remainingKm -= segmentKm; index += 1; } else { const ratio = remainingKm / segmentKm; position = { latitude: position.latitude + (target.latitude - position.latitude) * ratio, longitude: position.longitude + (target.longitude - position.longitude) * ratio }; remainingKm = 0; } }
  const nextPoint = coordinates[Math.min(index + 1, coordinates.length - 1)]; const heading = Math.round((Math.atan2(nextPoint[0] - position.longitude, nextPoint[1] - position.latitude) * 180 / Math.PI + 360) % 360); await move(fleet.id, position.latitude, position.longitude, drive.speedKph, heading); await prisma.demoDrive.update({ where: { fleetId: fleet.id }, data: { waypointIndex: index, mode: index >= coordinates.length - 1 ? 'STOPPED' : 'AUTOMATIC' } }); return { moved: true, complete: index >= coordinates.length - 1, ...position };
});
export const reset = simulatorProcedure.handler(async () => {
  enabled();
  const [fleets, sites] = await Promise.all([
    prisma.demoFleet.findMany({ select: { vehicleId: true, driverId: true, trackerDeviceId: true } }),
    prisma.wasteSite.findMany({ where: { code: { startsWith: SIM_PREFIX } }, select: { id: true } }),
  ]);
  const vehicleIds = fleets.map((fleet) => fleet.vehicleId);
  const driverIds = fleets.map((fleet) => fleet.driverId);
  const trackerDeviceIds = fleets.map((fleet) => fleet.trackerDeviceId);
  const siteIds = sites.map((site) => site.id);
  const sensorDevices = await prisma.ioTDevice.findMany({ where: { deviceId: { startsWith: 'SENSOR-SIM-' } }, select: { id: true } });
  const deviceIds = [...trackerDeviceIds, ...sensorDevices.map((device) => device.id)];

  await prisma.$transaction(async (tx) => {
    // Remove every child relation before deleting simulated parent records.
    await tx.rfidScan.deleteMany({ where: { OR: [{ vehicleId: { in: vehicleIds } }, { driverId: { in: driverIds } }] } });
    await tx.anomaly.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await tx.collectionEvent.deleteMany({ where: { OR: [{ vehicleId: { in: vehicleIds } }, { siteId: { in: siteIds } }] } });
    await tx.vehicleAssignment.deleteMany({ where: { OR: [{ vehicleId: { in: vehicleIds } }, { driverId: { in: driverIds } }] } });
    await tx.routePlan.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await tx.vehicleLocation.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await tx.siteTelemetry.deleteMany({ where: { siteId: { in: siteIds } } });
    await tx.demoFleet.deleteMany();
    await tx.ioTDevice.deleteMany({ where: { id: { in: deviceIds } } });
    await tx.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await tx.driver.deleteMany({ where: { id: { in: driverIds } } });
    await tx.wasteSite.deleteMany({ where: { id: { in: siteIds } } });
    await tx.facility.deleteMany({ where: { code: { startsWith: SIM_PREFIX } } });
  });

  return { reset: true };
});
