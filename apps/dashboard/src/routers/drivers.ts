import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { adminProcedure } from './base';
import prisma from '@/lib/prisma';
import { driverPhotoUrl } from '@/lib/driver-photos';
import { recordAudit } from '@/lib/domain/audit';

const listInput = z.object({
  search: z.string().trim().max(160).default(''),
  status: z.enum(['ALL', 'PENDING', 'VERIFIED', 'REJECTED']).default('ALL'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(5).max(50).default(10),
}).optional();

export const list = adminProcedure.input(listInput).handler(async ({ input }) => {
  const filters = input ?? { search: '', status: 'ALL' as const, page: 1, pageSize: 10 };
  const where = {
    ...(filters.status !== 'ALL' ? { verificationStatus: filters.status } : {}),
    ...(filters.search ? { OR: [
      { name: { contains: filters.search, mode: 'insensitive' as const } },
      { identityRef: { contains: filters.search, mode: 'insensitive' as const } },
    ] } : {}),
  };
  const [items, total, groupedCounts] = await Promise.all([
    prisma.driver.findMany({
      where,
      include: {
        assignments: { where: { active: true }, include: { vehicle: true }, take: 1 },
        verificationReviews: { include: { reviewer: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: [{ verificationStatus: 'asc' }, { name: 'asc' }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.driver.count({ where }),
    prisma.driver.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
  ]);
  return {
    items: await Promise.all(items.map(async (driver) => ({ ...driver, photoUrl: await driverPhotoUrl(driver.photoKey) }))),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    counts: Object.fromEntries(groupedCounts.map((item) => [item.verificationStatus, item._count._all])) as Record<'PENDING' | 'VERIFIED' | 'REJECTED', number>,
  };
});

const reviewInput = z.object({
  driverId: z.string().min(1),
  decision: z.enum(['VERIFIED', 'REJECTED']),
  note: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (value.decision === 'REJECTED' && !value.note) context.addIssue({ code: 'custom', path: ['note'], message: 'A rejection reason is required.' });
});

export const review = adminProcedure.input(reviewInput).handler(async ({ input, context }) => {
  if (!context.user) throw new ORPCError('UNAUTHORIZED');
  const reviewerId = context.user.id;
  const driver = await prisma.driver.findUniqueOrThrow({ where: { id: input.driverId } });
  if (!driver.identityRef) throw new ORPCError('BAD_REQUEST', { message: 'Add an identity reference before reviewing this driver.' });
  const [updated] = await prisma.$transaction([
    prisma.driver.update({ where: { id: driver.id }, data: { verificationStatus: input.decision } }),
    prisma.driverVerificationReview.create({ data: { driverId: driver.id, reviewerId, decision: input.decision, note: input.note || null } }),
  ]);
  await recordAudit({ actorId: reviewerId, action: `DRIVER_${input.decision}`, entityType: 'driver', entityId: driver.id, summary: `${driver.name} was ${input.decision.toLowerCase()}.`, metadata: input.note ? { note: input.note } : undefined });
  return updated;
});
