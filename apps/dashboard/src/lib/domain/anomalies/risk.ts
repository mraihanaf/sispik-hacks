export function routeDeviationRisk(distanceKm: number) { return Math.min(100, Math.round(40 + distanceKm * 20)); }
export function prolongedStopRisk(minutes: number) { return Math.min(100, Math.round(30 + minutes * 2)); }
export function gpsOfflineRisk(minutes: number) { return Math.min(100, Math.round(20 + minutes * 3)); }
