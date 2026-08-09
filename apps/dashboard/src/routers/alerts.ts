import { z } from 'zod';
import { protectedProcedure } from './base';
import prisma from '@/lib/prisma';
import { recordAudit } from '@/lib/domain/audit';
export const list = protectedProcedure.handler(() => prisma.alert.findMany({ include: { acknowledgedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }));
export const byId = protectedProcedure.input(z.object({ id: z.string().min(1) })).handler(({ input }) => prisma.alert.findUniqueOrThrow({ where: { id: input.id }, include: { acknowledgedBy: { select: { name: true } } } }));
export const acknowledge = protectedProcedure.input(z.object({ id: z.string().min(1), note: z.string().trim().max(1000).optional() })).handler(async ({ input, context }) => {
  const alert = await prisma.alert.update({ where: { id: input.id }, data: { acknowledged: true, acknowledgedAt: new Date(), acknowledgedById: context.user.id, acknowledgementNote: input.note || null } });
  await recordAudit({ actorId: context.user.id, action: 'ALERT_ACKNOWLEDGED', entityType: 'alert', entityId: alert.id, summary: alert.title, metadata: input.note ? { note: input.note } : undefined });
  return alert;
});
