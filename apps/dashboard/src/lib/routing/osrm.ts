import { z } from 'zod';

export type RoutingCoordinate = { latitude: number; longitude: number };
export type RoadRoute = { geometry: { type: 'LineString'; coordinates: [number, number][] }; distanceKm: number; durationMinutes: number };

const tableResponse = z.object({ code: z.literal('Ok'), distances: z.array(z.array(z.number().nullable())) });
const routeResponse = z.object({ code: z.literal('Ok'), routes: z.array(z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative(), geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(z.tuple([z.number(), z.number()])).min(2) }) })).min(1) });

export class RoutingError extends Error {}

function baseUrl() { return (process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org').replace(/\/$/, ''); }
function encodedCoordinates(points: RoutingCoordinate[]) { return points.map((point) => `${point.longitude},${point.latitude}`).join(';'); }
async function request(path: string) {
  let response: Response;
  try { response = await fetch(`${baseUrl()}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) }); } catch { throw new RoutingError('Road routing service is unavailable.'); }
  if (!response.ok) throw new RoutingError('Road routing service could not calculate this route.');
  return response.json();
}

export async function roadDistanceTable(points: RoutingCoordinate[]) {
  if (points.length < 2) throw new RoutingError('At least two routing coordinates are required.');
  const data = tableResponse.safeParse(await request(`/table/v1/driving/${encodedCoordinates(points)}?annotations=distance`));
  if (!data.success || data.data.distances.some((row) => row.length !== points.length || row.some((distance) => distance === null))) throw new RoutingError('Some route points are not connected by drivable roads.');
  return data.data.distances as number[][];
}

export async function roadRoute(points: RoutingCoordinate[]): Promise<RoadRoute> {
  if (points.length < 2) throw new RoutingError('At least two routing coordinates are required.');
  const data = routeResponse.safeParse(await request(`/route/v1/driving/${encodedCoordinates(points)}?overview=full&geometries=geojson&steps=false`));
  if (!data.success) throw new RoutingError('No drivable road route is available for these points.');
  const route = data.data.routes[0];
  return { geometry: route.geometry, distanceKm: route.distance / 1_000, durationMinutes: Math.ceil(route.duration / 60) };
}
