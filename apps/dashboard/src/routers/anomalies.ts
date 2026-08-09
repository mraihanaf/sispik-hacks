import { z } from 'zod';
import { protectedProcedure } from './base';
import { recordAnomaly } from '@/lib/domain/anomalies/service';
import prisma from '@/lib/prisma';
import { recordAudit } from '@/lib/domain/audit';
const input = z.object({ vehicleId: z.string(), routePlanId: z.string().optional(), type: z.enum(['ROUTE_DEVIATION', 'PROLONGED_STOP', 'GPS_OFFLINE']), value: z.number().nonnegative(), latitude: z.number().optional(), longitude: z.number().optional() });
export const detect = protectedProcedure.input(input).handler(async ({ input }) => {
  return recordAnomaly(input);
});
export const list = protectedProcedure.handler(() => prisma.anomaly.findMany({ include: { vehicle: true, routePlan: true, resolvedBy: { select: { name: true } } }, orderBy: { detectedAt: 'desc' }, take: 100 }));
export const byId = protectedProcedure.input(z.object({ id: z.string().min(1) })).handler(({ input }) => prisma.anomaly.findUniqueOrThrow({ where: { id: input.id }, include: { vehicle: true, resolvedBy: { select: { name: true } }, routePlan: { include: { stops: { include: { site: true } } } } } }));
export const resolve = protectedProcedure.input(z.object({ id: z.string().min(1), note: z.string().trim().min(3).max(1000) })).handler(async ({ input, context }) => {
  const anomaly = await prisma.anomaly.update({ where: { id: input.id }, data: { resolvedAt: new Date(), resolvedById: context.user.id, resolutionNote: input.note } });
  await recordAudit({ actorId: context.user.id, action: 'ANOMALY_RESOLVED', entityType: 'anomaly', entityId: anomaly.id, summary: anomaly.title, metadata: { note: input.note } });
  return anomaly;
});
