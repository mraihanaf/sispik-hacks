import { z } from 'zod';
import { protectedProcedure } from './base';
import prisma from '@/lib/prisma';

export const list = protectedProcedure.handler(() => prisma.facility.findMany({ orderBy: { code: 'asc' } }));
export const byId = protectedProcedure.input(z.object({ id: z.string().min(1) })).handler(({ input }) => prisma.facility.findUniqueOrThrow({ where: { id: input.id }, include: { routeStarts: { take: 20, orderBy: { createdAt: 'desc' } }, routeEnds: { take: 20, orderBy: { createdAt: 'desc' } } } }));
