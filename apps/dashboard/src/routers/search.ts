import { z } from 'zod';
import { protectedProcedure } from './base';
import prisma from '@/lib/prisma';

export const global = protectedProcedure.input(z.object({ query: z.string().trim().min(2).max(100) })).handler(async ({ input }) => {
  const contains = { contains: input.query, mode: 'insensitive' as const };
  const [sites, vehicles, drivers, routes] = await Promise.all([
    prisma.wasteSite.findMany({ where: { OR: [{ code: contains }, { name: contains }] }, select: { id: true, code: true, name: true, status: true }, take: 5 }),
    prisma.vehicle.findMany({ where: { OR: [{ code: contains }, { licensePlate: contains }] }, select: { id: true, code: true, licensePlate: true, status: true }, take: 5 }),
    prisma.driver.findMany({ where: { OR: [{ name: contains }, { identityRef: contains }] }, select: { id: true, name: true, status: true, verificationStatus: true }, take: 5 }),
    prisma.routePlan.findMany({ where: { vehicle: { OR: [{ code: contains }, { licensePlate: contains }] } }, select: { id: true, status: true, createdAt: true, vehicle: { select: { code: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);
  return [
    ...sites.map((item) => ({ type: 'site' as const, id: item.id, title: `${item.code} · ${item.name}`, subtitle: item.status, href: `/dashboard/sites?selected=${item.id}` })),
    ...vehicles.map((item) => ({ type: 'vehicle' as const, id: item.id, title: `${item.code} · ${item.licensePlate}`, subtitle: item.status, href: `/dashboard/fleet?selected=${item.id}` })),
    ...drivers.map((item) => ({ type: 'driver' as const, id: item.id, title: item.name, subtitle: item.verificationStatus, href: `/dashboard/drivers?selected=${item.id}` })),
    ...routes.map((item) => ({ type: 'route' as const, id: item.id, title: `${item.vehicle.code} route`, subtitle: item.status, href: `/dashboard/routes?selected=${item.id}` })),
  ];
});

