import { z } from 'zod';
import { adminProcedure, protectedProcedure } from './base';
import prisma from '@/lib/prisma';
import { driverPhotoUrl } from '@/lib/driver-photos';
export const list = protectedProcedure.handler(() => prisma.vehicle.findMany({ include: { assignments: { where: { active: true }, include: { driver: true } }, locations: { orderBy: { observedAt: 'desc' }, take: 100 } }, orderBy: { code: 'asc' } }));
export const byId = protectedProcedure.input(z.object({ id: z.string().min(1) })).handler(({ input }) => prisma.vehicle.findUniqueOrThrow({ where: { id: input.id }, include: { assignments: { where: { active: true }, include: { driver: true } }, devices: true, locations: { orderBy: { observedAt: 'desc' }, take: 100 }, routes: { where: { status: { in: ['DRAFT', 'ASSIGNED', 'ACTIVE'] } }, include: { startFacility: true, endFacility: true, stops: { include: { site: true }, orderBy: { sequence: 'asc' } } }, orderBy: { createdAt: 'desc' } }, anomalies: { where: { resolvedAt: null }, orderBy: { detectedAt: 'desc' }, take: 25 } } }));
/** Sensitive driver identity, live GPS history and active-route progress for administrators. */
export const tracking = adminProcedure.handler(async () => {
  const vehicles = await prisma.vehicle.findMany({
  include: {
    assignments: { where: { active: true }, include: { driver: true } },
    locations: { orderBy: { observedAt: 'desc' }, take: 100 },
    devices: true,
    routes: { where: { status: { in: ['DRAFT', 'ASSIGNED', 'ACTIVE'] } }, include: { startFacility: true, endFacility: true, startedByDriver: true, stops: { include: { site: true }, orderBy: { sequence: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 1 },
    anomalies: { where: { resolvedAt: null }, orderBy: { detectedAt: 'desc' }, take: 25 },
  },
  orderBy: { code: 'asc' },
  });
  return Promise.all(vehicles.map(async (vehicle) => ({
    ...vehicle,
    assignments: await Promise.all(vehicle.assignments.map(async (assignment) => ({
      ...assignment,
      driver: { ...assignment.driver, photoUrl: await driverPhotoUrl(assignment.driver.photoKey) },
    }))),
    routes: await Promise.all(vehicle.routes.map(async (route) => ({
      ...route,
      startedByDriver: route.startedByDriver ? { ...route.startedByDriver, photoUrl: await driverPhotoUrl(route.startedByDriver.photoKey) } : null,
    }))),
  })));
});

export const routeReplay = adminProcedure.input(z.object({ routePlanId: z.string().min(1) })).handler(async ({ input }) => {
  const route = await prisma.routePlan.findUniqueOrThrow({ where: { id: input.routePlanId }, include: { vehicle: true, stops: { include: { site: true, facility: true }, orderBy: { sequence: 'asc' } } } });
  const from = route.startedAt ?? route.assignedAt ?? route.createdAt;
  const to = route.completedAt ?? new Date();
  const points = await prisma.vehicleLocation.findMany({ where: { vehicleId: route.vehicleId, observedAt: { gte: from, lte: to } }, orderBy: { observedAt: 'asc' }, take: 2000 });
  return { route, points, from, to };
});
