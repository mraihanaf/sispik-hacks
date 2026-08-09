import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReportMetrics } from './metrics.ts';

test('calculates operational KPIs from authoritative event records', () => {
  const metrics = calculateReportMetrics([
    { status: 'COMPLETED', startedAt: new Date('2026-08-09T01:00:00Z'), completedAt: new Date('2026-08-09T02:30:00Z'), distanceSavingsKm: 8 },
    { status: 'CANCELLED', startedAt: null, completedAt: null, distanceSavingsKm: 2 },
  ], [{ estimatedCollectedKg: 1250 }, { estimatedCollectedKg: 750 }], [{ type: 'ROUTE_DEVIATION' }, { type: 'GPS_OFFLINE' }]);
  assert.deepEqual(metrics, { collectedTonnes: 2, averageRouteMinutes: 90, deviationCount: 1, completionRate: 50, distanceSavedKm: 10 });
});

test('returns explicit empty-state values when no operational history exists', () => {
  assert.deepEqual(calculateReportMetrics([], [], []), { collectedTonnes: 0, averageRouteMinutes: null, deviationCount: 0, completionRate: 0, distanceSavedKm: 0 });
});

