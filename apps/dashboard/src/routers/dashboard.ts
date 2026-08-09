import { protectedProcedure } from './base';
import prisma from '@/lib/prisma';
export const summary = protectedProcedure.handler(async () => {
  const [activeVehicles, criticalSites, openAlerts] = await Promise.all([prisma.vehicle.count({ where: { status: { in: ['ASSIGNED', 'COLLECTING'] } } }), prisma.wasteSite.count({ where: { status: 'CRITICAL' } }), prisma.alert.count({ where: { acknowledged: false } })]);
  return { activeVehicles, criticalSites, openAlerts };
});
