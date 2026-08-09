export type Coordinate = { latitude: number; longitude: number };
const R = 6371;
const radians = (value: number) => (value * Math.PI) / 180;
export function haversineKm(origin: Coordinate, destination: Coordinate) {
  const dLat = radians(destination.latitude - origin.latitude);
  const dLon = radians(destination.longitude - origin.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
