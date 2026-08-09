import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCapacityPercent, calculatePriority, median, siteStatus } from './capacity.ts';

test('converts calibrated distances to bounded fill percentages', () => {
  assert.equal(calculateCapacityPercent(100, 20, 100), 0);
  assert.equal(calculateCapacityPercent(100, 20, 20), 100);
  assert.equal(calculateCapacityPercent(100, 20, 60), 50);
  assert.throws(() => calculateCapacityPercent(20, 100, 60));
});

test('filters capacity noise and assigns operational status', () => {
  assert.equal(median([10, Number.NaN, 30, 20, 100]), 25);
  assert.equal(siteStatus(69.9), 'NORMAL');
  assert.equal(siteStatus(70), 'HIGH');
  assert.equal(siteStatus(90), 'CRITICAL');
});

test('increases priority for old collections and imminent capacity risk', () => {
  const now = new Date('2026-08-09T00:00:00.000Z');
  const priority = calculatePriority(90, new Date('2026-08-01T00:00:00.000Z'), new Date('2026-08-09T06:00:00.000Z'), now);
  assert.ok(priority > 85);
});
