import { ALERTS_REALTIME_TOPIC } from '@sispik-hacks/iot-contracts';
import prisma from '@/lib/prisma';
import { publishDomainEvent } from '@/lib/mqtt/publisher';
import { gpsOfflineRisk, prolongedStopRisk, routeDeviationRisk } from './risk';

export type DetectableAnomaly = {
  vehicleId: string;
  routePlanId?: string;
  type: 'ROUTE_DEVIATION' | 'PROLONGED_STOP' | 'GPS_OFFLINE';
  value: number;
  latitude?: number;
  longitude?: number;
};

function details(input: DetectableAnomaly) {
  const riskScore = input.type === 'ROUTE_DEVIATION' ? routeDeviationRisk(input.value) : input.type === 'PROLONGED_STOP' ? prolongedStopRisk(input.value) : gpsOfflineRisk(input.value);
  const title = input.type === 'ROUTE_DEVIATION' ? 'Potential route deviation detected' : input.type === 'PROLONGED_STOP' ? 'Prolonged vehicle stop detected' : 'Vehicle GPS appears offline';
  return { riskScore, title };
}

/** Persist a deduplicated anomaly, then publish its alert only after the transaction commits. */
export async function recordAnomaly(input: DetectableAnomaly) {
  const { riskScore, title } = details(input);
  const since = new Date(Date.now() - 10 * 60_000);
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.anomaly.findFirst({ where: { vehicleId: input.vehicleId, routePlanId: input.routePlanId, type: input.type, resolvedAt: null, detectedAt: { gte: since } }, orderBy: { detectedAt: 'desc' } });
    if (existing) return { anomaly: existing, alert: null, created: false };
    const anomaly = await tx.anomaly.create({ data: { vehicleId: input.vehicleId, routePlanId: input.routePlanId, type: input.type, riskScore, latitude: input.latitude, longitude: input.longitude, title, description: `${title}; risk score ${riskScore}/100.` } });
    const alert = await tx.alert.create({ data: { severity: riskScore >= 80 ? 'CRITICAL' : 'WARNING', category: input.type, title, description: anomaly.description, entityType: 'VEHICLE', entityId: input.vehicleId } });
    return { anomaly, alert, created: true };
  });
  if (result.alert) await publishDomainEvent(ALERTS_REALTIME_TOPIC, { eventId: result.alert.id, type: 'alert.created', timestamp: result.alert.createdAt.toISOString(), data: { alertId: result.alert.id, severity: result.alert.severity, category: result.alert.category, entityId: result.alert.entityId, title: result.alert.title } });
  return result;
}
