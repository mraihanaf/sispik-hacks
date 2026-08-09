export type Site = {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  maxCapacityKg: number;
  currentCapacityPercent: number;
  estimatedWasteKg: number;
  priorityScore: number;
  status: string;
  lastCollectedAt?: string | Date | null;
  updatedAt?: string | Date;
  devices?: Array<{ id?: string; deviceId: string; status?: string; lastSeenAt?: string | Date | null; batteryPercent?: number | null }>;
};

export type Driver = { id: string; name: string; identityRef?: string | null; status: string; verificationStatus?: string; photoUrl?: string | null };
export type LocationPoint = { id?: string; latitude: number; longitude: number; speedKph?: number | null; heading?: number | null; observedAt: string | Date };
export type Vehicle = { id: string; code: string; licensePlate: string; capacityKg: number; currentLoadKg: number; status: string; lastLatitude?: number | null; lastLongitude?: number | null; lastSeenAt?: string | Date | null; assignments?: Array<{ driver: Driver }>; locations?: LocationPoint[]; routes?: RoutePlan[] };
export type Facility = { id: string; code: string; name: string; type: string; latitude: number; longitude: number; status: string };
export type RouteStop = { id: string; status: string; type: string; estimatedWasteKg?: number | null; site?: Site | null; facility?: Facility | null };
export type RoutePlan = { id: string; status: string; createdAt: string | Date; assignedAt?: string | Date | null; startedAt?: string | Date | null; completedAt?: string | Date | null; estimatedDistanceKm: number; estimatedDurationMinutes: number; baselineDistanceKm: number; distanceSavingsKm: number; distanceSavingsPercent: number; geometry?: unknown; vehicle: Vehicle; startFacility: Facility; endFacility: Facility; stops: RouteStop[]; anomalies?: Anomaly[] };
export type AlertRecord = { id: string; severity: string; category: string; title: string; description: string; entityType: string; entityId: string; acknowledged: boolean; acknowledgedAt?: string | Date | null; acknowledgementNote?: string | null; createdAt: string | Date; acknowledgedBy?: { name: string } | null };
export type Anomaly = { id: string; type: string; riskScore: number; latitude?: number | null; longitude?: number | null; title: string; description: string; detectedAt: string | Date; resolvedAt?: string | Date | null; resolutionNote?: string | null; vehicle: Vehicle; routePlan?: RoutePlan | null; resolvedBy?: { name: string } | null };

export const formatTime = (value?: string | Date | null) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Unavailable';
export const formatRelative = (value?: string | Date | null) => { if (!value) return 'Never'; const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000); if (seconds < 60) return 'Just now'; if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`; return `${Math.floor(seconds / 86400)} d ago`; };

