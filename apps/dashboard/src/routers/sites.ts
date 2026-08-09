import { z } from 'zod';
import { protectedProcedure } from './base';
import prisma from '@/lib/prisma';
export const list = protectedProcedure.handler(() => prisma.wasteSite.findMany({ orderBy: { priorityScore: 'desc' }, include: { devices: true } }));
export const byId = protectedProcedure.input(z.object({ id: z.string().min(1) })).handler(({ input }) => prisma.wasteSite.findUniqueOrThrow({ where: { id: input.id }, include: { devices: true, telemetry: { orderBy: { observedAt: 'desc' }, take: 100 }, collections: { orderBy: { collectedAt: 'desc' }, take: 25, include: { vehicle: true, routeStop: true } }, routeStops: { where: { routePlan: { status: { in: ['DRAFT', 'ASSIGNED', 'ACTIVE'] } } }, include: { routePlan: { include: { vehicle: true } } }, orderBy: { sequence: 'asc' } } } }));

export const paged = protectedProcedure.input(z.object({
  search: z.string().trim().max(160).default(''),
  status: z.enum(['ALL', 'NORMAL', 'HIGH', 'CRITICAL', 'OFFLINE', 'MAINTENANCE']).default('ALL'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(5).max(50).default(10),
})).handler(async ({ input }) => {
  const where = {
    ...(input.status !== 'ALL' ? { status: input.status } : {}),
    ...(input.search ? { OR: [{ code: { contains: input.search, mode: 'insensitive' as const } }, { name: { contains: input.search, mode: 'insensitive' as const } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.wasteSite.findMany({ where, include: { devices: true, telemetry: { orderBy: { observedAt: 'desc' }, take: 8 } }, orderBy: [{ priorityScore: 'desc' }, { code: 'asc' }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.wasteSite.count({ where }),
  ]);
  const withPrediction = items.map(({ telemetry, ...site }) => {
    const readings = [...telemetry].reverse();
    const first = readings[0]; const last = readings.at(-1);
    const elapsedHours = first && last ? (last.observedAt.getTime() - first.observedAt.getTime()) / 3_600_000 : 0;
    const growthPerHour = first && last && elapsedHours > 0 ? (last.capacityPercent - first.capacityPercent) / elapsedHours : 0;
    const hoursUntilFull = growthPerHour > 0.25 ? (100 - site.currentCapacityPercent) / growthPerHour : null;
    return { ...site, predictedFullAt: hoursUntilFull != null && hoursUntilFull < 24 * 30 ? new Date(Date.now() + hoursUntilFull * 3_600_000) : null };
  });
  return { items: withPrediction, total, page: input.page, pageSize: input.pageSize };
});
