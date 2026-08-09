import { z } from 'zod';
import { protectedProcedure } from './base';
import prisma from '@/lib/prisma';
import { calculateReportMetrics } from '@/lib/domain/reporting/metrics';

const reportInput = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  status: z.enum(['ALL', 'DRAFT', 'ASSIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).default('ALL'),
});

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const overview = protectedProcedure.input(reportInput).handler(async ({ input }) => {
  const routeWhere = {
    createdAt: { gte: input.from, lte: input.to },
    ...(input.status !== 'ALL' ? { status: input.status } : {}),
  };
  const [collections, routes, anomalies] = await Promise.all([
    prisma.collectionEvent.findMany({ where: { collectedAt: { gte: input.from, lte: input.to } }, orderBy: { collectedAt: 'asc' } }),
    prisma.routePlan.findMany({ where: routeWhere, include: { vehicle: true, startedByDriver: true, stops: true }, orderBy: { createdAt: 'desc' } }),
    prisma.anomaly.findMany({ where: { detectedAt: { gte: input.from, lte: input.to } }, include: { vehicle: true }, orderBy: { detectedAt: 'desc' } }),
  ]);
  const volumeByDay = new Map<string, number>();
  for (const item of collections) {
    const day = item.collectedAt.toISOString().slice(0, 10);
    volumeByDay.set(day, (volumeByDay.get(day) ?? 0) + item.estimatedCollectedKg / 1000);
  }
  return {
    metrics: calculateReportMetrics(routes, collections, anomalies),
    volumeSeries: [...volumeByDay].map(([date, tonnes]) => ({ date, tonnes })),
    routes: routes.map((route) => ({
      id: route.id,
      createdAt: route.createdAt,
      vehicleCode: route.vehicle.code,
      driverName: route.startedByDriver?.name ?? 'Unassigned',
      status: route.status,
      stops: route.stops.length,
      estimatedDistanceKm: route.estimatedDistanceKm,
      distanceSavingsKm: route.distanceSavingsKm,
    })),
    anomalies: anomalies.map((item) => ({ id: item.id, detectedAt: item.detectedAt, vehicleCode: item.vehicle.code, type: item.type, riskScore: item.riskScore, resolvedAt: item.resolvedAt })),
  };
});

export const exportCsv = protectedProcedure.input(reportInput).handler(async ({ input }) => {
  const data = await prisma.routePlan.findMany({
    where: { createdAt: { gte: input.from, lte: input.to }, ...(input.status !== 'ALL' ? { status: input.status } : {}) },
    include: { vehicle: true, startedByDriver: true, stops: true, anomalies: true },
    orderBy: { createdAt: 'desc' },
  });
  const rows = [['Date', 'Truck', 'Driver', 'Status', 'Stops', 'Distance (km)', 'Distance saved (km)', 'Anomalies'], ...data.map((route) => [route.createdAt.toISOString(), route.vehicle.code, route.startedByDriver?.name ?? '', route.status, route.stops.length, route.estimatedDistanceKm.toFixed(2), route.distanceSavingsKm.toFixed(2), route.anomalies.length])];
  return { filename: `rotom-routes-${input.from.toISOString().slice(0, 10)}-${input.to.toISOString().slice(0, 10)}.csv`, csv: rows.map((row) => row.map(csvCell).join(',')).join('\n') };
});
