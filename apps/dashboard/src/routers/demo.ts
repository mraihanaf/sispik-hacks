import prisma from '@/lib/prisma';
import { protectedProcedure } from './base';
import { z } from 'zod';

function enabled() { if (process.env.ENABLE_DEMO_CONTROLS !== 'true') throw new Error('Demo controls are disabled.'); }

export const seed = protectedProcedure.handler(async () => {
  enabled();
  const site = await prisma.wasteSite.upsert({ where: { code: 'TPS-001' }, update: {}, create: { code: 'TPS-001', name: 'Simulator Waste Site', latitude: -6.1701, longitude: 106.8403, maxCapacityKg: 500 } });
  const vehicle = await prisma.vehicle.upsert({ where: { code: 'TRK-001' }, update: {}, create: { code: 'TRK-001', licensePlate: 'B 1234 SIM', capacityKg: 2000 } });
  const startFacility = await prisma.facility.upsert({ where: { code: 'DEP-001' }, update: {}, create: { code: 'DEP-001', name: 'Simulator Depot', type: 'DEPOT', latitude: -6.1818, longitude: 106.8224 } });
  const endFacility = await prisma.facility.upsert({ where: { code: 'DSP-001' }, update: {}, create: { code: 'DSP-001', name: 'Simulator Disposal Facility', type: 'LANDFILL', latitude: -6.2297, longitude: 106.8353 } });
  await prisma.ioTDevice.upsert({ where: { deviceId: 'SENSOR-TPS-001' }, update: { siteId: site.id, emptyDistanceCm: 75, fullDistanceCm: 20 }, create: { deviceId: 'SENSOR-TPS-001', mqttClientId: 'SENSOR-TPS-001', type: 'CAPACITY_SENSOR', siteId: site.id, emptyDistanceCm: 75, fullDistanceCm: 20 } });
  await prisma.ioTDevice.upsert({ where: { deviceId: 'TRACKER-TRK-001' }, update: { vehicleId: vehicle.id }, create: { deviceId: 'TRACKER-TRK-001', mqttClientId: 'TRACKER-TRK-001', type: 'VEHICLE_TRACKER', vehicleId: vehicle.id } });
  return { siteId: site.id, vehicleId: vehicle.id, startFacilityId: startFacility.id, endFacilityId: endFacility.id };
});

/** Reset only simulator records; historical non-demo operational data is untouched. */
export const reset = protectedProcedure.handler(async () => {
  enabled();
  const site = await prisma.wasteSite.findUnique({ where: { code: 'TPS-001' } });
  const vehicle = await prisma.vehicle.findUnique({ where: { code: 'TRK-001' } });
  if (site) await prisma.wasteSite.update({ where: { id: site.id }, data: { currentCapacityPercent: 0, estimatedWasteKg: 0, priorityScore: 0, status: 'NORMAL', lastCollectedAt: null } });
  if (vehicle) await prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: 'AVAILABLE', currentLoadKg: 0, lastLatitude: null, lastLongitude: null, lastSeenAt: null } });
  return { reset: true };
});

export const setCriticalSite = protectedProcedure.input(z.object({ siteId: z.string().min(1).optional() })).handler(async ({ input }) => {
  enabled();
  const site = input.siteId ? await prisma.wasteSite.findUniqueOrThrow({ where: { id: input.siteId } }) : await prisma.wasteSite.findUniqueOrThrow({ where: { code: 'TPS-001' } });
  return prisma.wasteSite.update({ where: { id: site.id }, data: { currentCapacityPercent: 96, estimatedWasteKg: site.maxCapacityKg * .96, priorityScore: 100, status: 'CRITICAL' } });
});

export const triggerDeviation = protectedProcedure.input(z.object({ vehicleId: z.string().min(1), routePlanId: z.string().min(1).optional() })).handler(async ({ input }) => {
  enabled();
  return prisma.anomaly.create({ data: { vehicleId: input.vehicleId, routePlanId: input.routePlanId, type: 'ROUTE_DEVIATION', riskScore: 90, title: 'Route deviation detected', description: 'Simulator: vehicle departed from the planned route.' } });
});
