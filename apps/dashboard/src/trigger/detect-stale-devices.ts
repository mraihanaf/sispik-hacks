import { logger, task } from '@trigger.dev/sdk';
import prisma from '@/lib/prisma';
import { recordAnomaly } from '@/lib/domain/anomalies/service';

export const detectStaleDevices = task({
  id: 'detect-stale-devices',
  run: async ({ staleAfterMinutes = 15 }: { staleAfterMinutes?: number }) => {
    const cutoff = new Date(Date.now() - staleAfterMinutes * 60_000);
    const staleDevices = await prisma.ioTDevice.findMany({ where: { lastSeenAt: { lt: cutoff }, status: 'ONLINE' }, select: { id: true, vehicleId: true } });
    const result = await prisma.ioTDevice.updateMany({ where: { id: { in: staleDevices.map((device) => device.id) } }, data: { status: 'OFFLINE' } });
    await Promise.all(staleDevices.flatMap((device) => device.vehicleId ? [recordAnomaly({ vehicleId: device.vehicleId, type: 'GPS_OFFLINE', value: staleAfterMinutes })] : []));
    logger.info('Marked stale devices offline', { count: result.count, staleAfterMinutes });
    return result;
  },
});
