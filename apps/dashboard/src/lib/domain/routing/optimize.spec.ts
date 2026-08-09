import assert from 'node:assert/strict';
import test from 'node:test';
import { optimizeStopOrder, selectEligibleStops } from './optimize.ts';

test('excludes lower-priority stops that exceed vehicle capacity', () => {
  const stops = selectEligibleStops([
    { id: 'critical', latitude: -6.21, longitude: 106.81, estimatedWasteKg: 70, priorityScore: 100 },
    { id: 'overflow', latitude: -6.22, longitude: 106.82, estimatedWasteKg: 50, priorityScore: 20 },
  ], 100);
  assert.deepEqual(stops.map((stop) => stop.id), ['critical']);
});

test('orders stops using road-network costs, not coordinate distance', () => {
  // 0=start, 1/2=stops, 3=destination. Stop 2 is cheaper by road from the start.
  const matrix = [[0, 90, 10, 100], [90, 0, 20, 10], [10, 20, 0, 80], [100, 10, 80, 0]];
  assert.deepEqual(optimizeStopOrder(matrix, 2), [0, 2, 1, 3]);
});
