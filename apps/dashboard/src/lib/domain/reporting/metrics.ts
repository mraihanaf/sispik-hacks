export type ReportRouteMetric = {
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  distanceSavingsKm: number;
};

export type ReportCollectionMetric = { estimatedCollectedKg: number };
export type ReportAnomalyMetric = { type: string };

export function calculateReportMetrics(routes: ReportRouteMetric[], collections: ReportCollectionMetric[], anomalies: ReportAnomalyMetric[]) {
  const completed = routes.filter((route) => route.status === 'COMPLETED');
  const durations = completed.flatMap((route) => route.startedAt && route.completedAt ? [(route.completedAt.getTime() - route.startedAt.getTime()) / 60_000] : []);
  return {
    collectedTonnes: collections.reduce((sum, item) => sum + item.estimatedCollectedKg, 0) / 1000,
    averageRouteMinutes: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
    deviationCount: anomalies.filter((item) => item.type === 'ROUTE_DEVIATION').length,
    completionRate: routes.length ? completed.length / routes.length * 100 : 0,
    distanceSavedKm: routes.reduce((sum, route) => sum + route.distanceSavingsKm, 0),
  };
}

