'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CommandCenter } from '@/components/dashboard/command-center';
import { DriverConsole } from '@/components/dashboard/driver-console';
import { FleetConsole } from '@/components/dashboard/fleet-console';
import { IncidentConsole } from '@/components/dashboard/incident-console';
import { ReportConsole } from '@/components/dashboard/report-console';
import { RoutesConsole } from '@/components/dashboard/routes-console';
import { SensorConsole } from '@/components/dashboard/sensor-console';
import type { AlertRecord, Anomaly, Facility, RoutePlan, Site, Vehicle } from '@/components/dashboard/types';
import orpc from '@/lib/orpc/client';

export type OperationsView = 'overview' | 'routes' | 'sites' | 'fleet' | 'drivers' | 'incidents' | 'reports';

const problem = (error: unknown) => error instanceof Error ? error.message : 'Unable to load operational data.';

export function OperationsConsole({ view }: { view: OperationsView }) {
  const queryClient = useQueryClient();
  const sites = useQuery(orpc.sites.list.queryOptions());
  const vehicles = useQuery(orpc.vehicles.tracking.queryOptions());
  const facilities = useQuery(orpc.facilities.list.queryOptions());
  const routes = useQuery(orpc.routes.list.queryOptions());
  const alerts = useQuery(orpc.alerts.list.queryOptions());
  const anomalies = useQuery(orpc.anomalies.list.queryOptions());
  const queries = [sites, vehicles, facilities, routes, alerts, anomalies];
  const anyError = queries.find((query) => query.error)?.error;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: orpc.sites.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.vehicles.tracking.key() });
    queryClient.invalidateQueries({ queryKey: orpc.routes.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.alerts.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.anomalies.list.key() });
  };
  if (queries.some((query) => query.isLoading)) return <div className="grid gap-4"><div className="h-10 w-72 animate-pulse rounded bg-muted" /><div className="grid gap-3 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg bg-muted" />)}</div><div className="h-[520px] animate-pulse rounded-lg bg-muted" /></div>;
  if (anyError) return <Alert variant="destructive"><AlertDescription>{problem(anyError)} <button className="ml-2 font-semibold underline" onClick={refresh}>Retry</button></AlertDescription></Alert>;
  const siteData = sites.data as Site[];
  const vehicleData = vehicles.data as unknown as Vehicle[];
  const facilityData = facilities.data as Facility[];
  const routeData = routes.data as unknown as RoutePlan[];
  const alertData = alerts.data as unknown as AlertRecord[];
  const anomalyData = anomalies.data as unknown as Anomaly[];
  if (view === 'overview') return <CommandCenter sites={siteData} vehicles={vehicleData} facilities={facilityData} routes={routeData} alerts={alertData} anomalies={anomalyData} refresh={refresh} />;
  if (view === 'sites') return <SensorConsole />;
  if (view === 'fleet') return <FleetConsole sites={siteData} vehicles={vehicleData} facilities={facilityData} routes={routeData} anomalies={anomalyData} />;
  if (view === 'routes') return <RoutesConsole sites={siteData} vehicles={vehicleData} facilities={facilityData} routes={routeData} anomalies={anomalyData} refresh={refresh} />;
  if (view === 'drivers') return <DriverConsole />;
  if (view === 'incidents') return <IncidentConsole alerts={alertData} anomalies={anomalyData} refresh={refresh} />;
  return <ReportConsole />;
}

