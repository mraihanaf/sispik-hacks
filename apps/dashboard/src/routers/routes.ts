import { z } from 'zod';
import prisma from '@/lib/prisma';
import { protectedProcedure } from './base';
import { optimizeStopOrder, routeCost, selectEligibleStops } from '@/lib/domain/routing/optimize';
import { roadDistanceTable, roadRoute, type RoadRoute } from '@/lib/routing/osrm';
import { publishDomainEvent } from '@/lib/mqtt/publisher';
import { routeRealtimeTopic, SIMULATOR_REALTIME_TOPIC, siteRealtimeTopic } from '@sispik-hacks/iot-contracts';
import { recordAudit } from '@/lib/domain/audit';

const routeInput = z.object({ vehicleId: z.string(), startFacilityId: z.string(), endFacilityId: z.string(), siteIds: z.array(z.string()).min(1) });
const routeIdInput = z.object({ routeId: z.string().min(1) });
const routeInclude = { vehicle: true, startFacility: true, endFacility: true, stops: { include: { site: true, facility: true }, orderBy: { sequence: 'asc' as const } }, anomalies: { where: { resolvedAt: null }, orderBy: { detectedAt: 'desc' as const } } };
async function publishRouteEvent(route: { id: string; status: string; vehicle?: { code: string } }, eventId = route.id) { const event = { eventId, type: 'route.updated' as const, timestamp: new Date().toISOString(), data: { routeId: route.id, status: route.status } }; await publishDomainEvent(routeRealtimeTopic(route.id), event); if (route.vehicle?.code.startsWith('SIM-')) await publishDomainEvent(SIMULATOR_REALTIME_TOPIC, event); }
async function computeRoute(input: z.infer<typeof routeInput>) {
  const [vehicle, start, end, sites] = await Promise.all([prisma.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId } }), prisma.facility.findUniqueOrThrow({ where: { id: input.startFacilityId } }), prisma.facility.findUniqueOrThrow({ where: { id: input.endFacilityId } }), prisma.wasteSite.findMany({ where: { id: { in: input.siteIds } } })]);
  if (sites.length !== input.siteIds.length) throw new Error('One or more selected collection sites no longer exist.');
  const eligible = selectEligibleStops(sites.map((site) => ({ id: site.id, latitude: site.latitude, longitude: site.longitude, estimatedWasteKg: site.estimatedWasteKg, priorityScore: site.priorityScore })), vehicle.capacityKg - vehicle.currentLoadKg);
  if (!eligible.length) throw new Error('No selected sites fit the vehicle’s remaining capacity.');
  const points = [start, ...eligible, end]; const matrix = await roadDistanceTable(points);
  const orderedIndices = optimizeStopOrder(matrix, eligible.length); const stops = orderedIndices.slice(1, -1).map((index) => eligible[index - 1]);
  const route: RoadRoute = await roadRoute([start, ...stops, end]);
  const baselineDistanceKm = routeCost(matrix, Array.from({ length: eligible.length + 2 }, (_, index) => index)) / 1_000;
  const distanceSavingsKm = Math.max(0, baselineDistanceKm - route.distanceKm);
  return { stops, ...route, baselineDistanceKm, distanceSavingsKm, distanceSavingsPercent: baselineDistanceKm ? distanceSavingsKm / baselineDistanceKm * 100 : 0 };
}
export const optimize = protectedProcedure.input(routeInput).handler(({ input }) => computeRoute(input));
export const list = protectedProcedure.handler(() => prisma.routePlan.findMany({ include: routeInclude, orderBy: { createdAt: 'desc' }, take: 100 }));
export const byId = protectedProcedure.input(routeIdInput).handler(({ input }) => prisma.routePlan.findUniqueOrThrow({ where: { id: input.routeId }, include: routeInclude }));
export const create = protectedProcedure.input(routeInput).handler(async ({ input }) => {
  const result = await computeRoute(input);
  const route = await prisma.routePlan.create({ data: { vehicleId: input.vehicleId, startFacilityId: input.startFacilityId, endFacilityId: input.endFacilityId, estimatedDistanceKm: result.distanceKm, estimatedDurationMinutes: result.durationMinutes, baselineDistanceKm: result.baselineDistanceKm, distanceSavingsKm: result.distanceSavingsKm, distanceSavingsPercent: result.distanceSavingsPercent, geometry: result.geometry, stops: { create: result.stops.map((stop, sequence) => ({ sequence: sequence + 1, siteId: stop.id, type: 'COLLECTION', estimatedWasteKg: stop.estimatedWasteKg })) } }, include: { stops: true, vehicle: true } });
  await publishRouteEvent(route); return route;
});
export const createAndAssign = protectedProcedure.input(routeInput).handler(async ({ input, context }) => {
  const result = await computeRoute(input);
  const route = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: input.vehicleId } });
    if (vehicle.status !== 'AVAILABLE') throw new Error('The selected vehicle is no longer available.');
    const created = await tx.routePlan.create({ data: { vehicleId: input.vehicleId, startFacilityId: input.startFacilityId, endFacilityId: input.endFacilityId, status: 'ASSIGNED', assignedAt: new Date(), estimatedDistanceKm: result.distanceKm, estimatedDurationMinutes: result.durationMinutes, baselineDistanceKm: result.baselineDistanceKm, distanceSavingsKm: result.distanceSavingsKm, distanceSavingsPercent: result.distanceSavingsPercent, geometry: result.geometry, stops: { create: result.stops.map((stop, sequence) => ({ sequence: sequence + 1, siteId: stop.id, type: 'COLLECTION', estimatedWasteKg: stop.estimatedWasteKg })) } }, include: { stops: true, vehicle: true } });
    await tx.vehicle.update({ where: { id: input.vehicleId }, data: { status: 'ASSIGNED' } });
    return created;
  });
  await Promise.all([
    publishRouteEvent(route),
    recordAudit({ actorId: context.user.id, action: 'ROUTE_CREATED_AND_ASSIGNED', entityType: 'route', entityId: route.id, summary: `${route.vehicle.code} assigned to ${route.stops.length} collection stops.`, metadata: { siteIds: input.siteIds } }),
  ]);
  return route;
});
export const assign = protectedProcedure.input(routeIdInput).handler(async ({ input }) => { const route = await prisma.routePlan.update({ where: { id: input.routeId }, data: { status: 'ASSIGNED', assignedAt: new Date(), vehicle: { update: { status: 'ASSIGNED' } } }, include: { vehicle: true } }); await publishRouteEvent(route); return route; });
/** Route start is authorized by tracker-delivered eKTP scans only. */
export const start = protectedProcedure.input(routeIdInput).handler(() => { throw new Error('Route start requires a valid eKTP scan from the vehicle tracker.'); });
export const completeStop = protectedProcedure.input(z.object({ routeId: z.string(), stopId: z.string() })).handler(async ({ input }) => {
  const completed = await prisma.$transaction(async (tx) => {
  const stop = await tx.routeStop.findUniqueOrThrow({ where: { id: input.stopId }, include: { site: true, routePlan: true } });
  if (stop.routePlanId !== input.routeId || !stop.siteId || !stop.site) throw new Error('Only collection stops can be completed.');
  if (stop.status === 'COMPLETED') throw new Error('Collection stop is already completed.');
  await tx.routeStop.update({ where: { id: stop.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
  const collectionEvent = await tx.collectionEvent.create({ data: { vehicleId: stop.routePlan.vehicleId, siteId: stop.siteId, routeStopId: stop.id, estimatedCollectedKg: stop.site.estimatedWasteKg, capacityBeforePercent: stop.site.currentCapacityPercent, capacityAfterPercent: 5 } });
  const site = await tx.wasteSite.update({ where: { id: stop.siteId }, data: { currentCapacityPercent: 5, estimatedWasteKg: stop.site.maxCapacityKg * 0.05, status: 'NORMAL', lastCollectedAt: new Date() } });
  return { collectionEvent, site, routeId: stop.routePlanId };
  });
  const timestamp = new Date().toISOString();
  await Promise.all([
    publishDomainEvent(routeRealtimeTopic(completed.routeId), { eventId: completed.collectionEvent.id, type: 'collection.completed', timestamp, data: { collectionEventId: completed.collectionEvent.id, routeId: completed.routeId, siteId: completed.site.id } }),
    publishDomainEvent(siteRealtimeTopic(completed.site.id), { eventId: completed.collectionEvent.id, type: 'site.updated', timestamp, data: { siteId: completed.site.id, capacityPercent: completed.site.currentCapacityPercent, estimatedWasteKg: completed.site.estimatedWasteKg, status: completed.site.status, priorityScore: completed.site.priorityScore } }),
    ...(completed.site.code.startsWith('SIM-') ? [
      publishDomainEvent(SIMULATOR_REALTIME_TOPIC, { eventId: completed.collectionEvent.id, type: 'collection.completed', timestamp, data: { collectionEventId: completed.collectionEvent.id, routeId: completed.routeId, siteId: completed.site.id } }),
      publishDomainEvent(SIMULATOR_REALTIME_TOPIC, { eventId: completed.collectionEvent.id, type: 'site.updated', timestamp, data: { siteId: completed.site.id, capacityPercent: completed.site.currentCapacityPercent, estimatedWasteKg: completed.site.estimatedWasteKg, status: completed.site.status, priorityScore: completed.site.priorityScore } }),
    ] : []),
  ]);
  return completed;
});
/** Route completion is authorized by a closing eKTP scan after all collection stops are complete. */
export const complete = protectedProcedure.input(routeIdInput).handler(() => { throw new Error('Route completion requires all collection stops and a valid closing eKTP scan.'); });
export const cancel = protectedProcedure.input(routeIdInput).handler(async ({ input }) => {
  const route = await prisma.routePlan.findUniqueOrThrow({ where: { id: input.routeId }, include: { vehicle: true } });
  if (route.status === 'COMPLETED' || route.status === 'CANCELLED') throw new Error('This route can no longer be cancelled.');
  const cancelled = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.routePlan.update({ where: { id: route.id }, data: { status: 'CANCELLED' } });
    await tx.vehicle.update({ where: { id: route.vehicleId }, data: { status: 'AVAILABLE' } });
    return cancelled;
  });
  await publishRouteEvent({ ...cancelled, vehicle: route.vehicle }); return cancelled;
});
