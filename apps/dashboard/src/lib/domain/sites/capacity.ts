export const SITE_THRESHOLDS = { high: 70, critical: 90 } as const;

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function calculateCapacityPercent(emptyDistanceCm: number, fullDistanceCm: number, distanceCm: number) {
  if (!Number.isFinite(emptyDistanceCm) || !Number.isFinite(fullDistanceCm) || emptyDistanceCm <= fullDistanceCm) {
    throw new Error('Sensor calibration requires emptyDistanceCm to be greater than fullDistanceCm.');
  }
  return clamp(((emptyDistanceCm - distanceCm) / (emptyDistanceCm - fullDistanceCm)) * 100, 0, 100);
}

export function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) throw new Error('At least one valid measurement is required.');
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function siteStatus(capacityPercent: number) {
  if (capacityPercent >= SITE_THRESHOLDS.critical) return 'CRITICAL' as const;
  if (capacityPercent >= SITE_THRESHOLDS.high) return 'HIGH' as const;
  return 'NORMAL' as const;
}

export function calculatePriority(capacityPercent: number, lastCollectedAt: Date | null, predictedFullAt: Date | null, now = new Date()) {
  const collectionAge = lastCollectedAt ? clamp(((now.getTime() - lastCollectedAt.getTime()) / 3_600_000 / 72) * 100, 0, 100) : 100;
  const urgency = predictedFullAt ? clamp(((24 * 3_600_000 - (predictedFullAt.getTime() - now.getTime())) / (24 * 3_600_000)) * 100, 0, 100) : 0;
  return clamp(0.6 * capacityPercent + 0.2 * collectionAge + 0.2 * urgency, 0, 100);
}
