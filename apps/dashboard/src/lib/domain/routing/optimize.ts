import type { Coordinate } from './haversine.ts';

export type RouteCandidate = Coordinate & { id: string; estimatedWasteKg: number; priorityScore: number };

/** Capacity and priority are business rules; road costs are supplied by the routing engine. */
export function selectEligibleStops(candidates: RouteCandidate[], vehicleCapacityKg: number) {
  return [...candidates]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .filter((candidate, index, list) => list.slice(0, index).reduce((sum, item) => sum + item.estimatedWasteKg, 0) + candidate.estimatedWasteKg <= vehicleCapacityKg);
}

export function routeCost(matrix: number[][], order: number[]) {
  return order.slice(1).reduce((total, point, index) => total + matrix[order[index]][point], 0);
}

/** Nearest-neighbour followed by 2-opt, using OSRM's road-distance table rather than straight-line distance. */
export function optimizeStopOrder(matrix: number[][], stopCount: number) {
  const destination = stopCount + 1;
  const remaining = Array.from({ length: stopCount }, (_, index) => index + 1);
  const order = [0];
  while (remaining.length) {
    const current = order[order.length - 1];
    if (current === undefined) throw new Error('Route order has no current point.');
    remaining.sort((a, b) => matrix[current][a] - matrix[current][b]);
    const next = remaining.shift();
    if (next === undefined) break;
    order.push(next);
  }
  order.push(destination);
  let improved = order;
  let changed = true;
  while (changed) {
    changed = false;
    for (let start = 1; start < improved.length - 2; start++) for (let end = start + 1; end < improved.length - 1; end++) {
      const candidate = [...improved.slice(0, start), ...improved.slice(start, end + 1).reverse(), ...improved.slice(end + 1)];
      if (routeCost(matrix, candidate) < routeCost(matrix, improved)) { improved = candidate; changed = true; }
    }
  }
  return improved;
}
