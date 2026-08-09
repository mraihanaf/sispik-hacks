import { z } from 'zod';
import { protectedProcedure } from './base';
import { ingestCapacity, ingestRfidScan, ingestVehicleLocation, updateDeviceStatus } from './internal/telemetry';
import * as dashboard from './dashboard';
import * as sites from './sites';
import * as vehicles from './vehicles';
import * as alerts from './alerts';
import * as realtime from './realtime';
import * as routes from './routes';
import * as anomalies from './anomalies';
import * as demo from './demo';
import * as admin from './admin';
import * as facilities from './facilities';
import * as simulator from './simulator';
import * as drivers from './drivers';
import * as reports from './reports';
import * as search from './search';

const getMe = protectedProcedure.output(z.object({ id: z.string(), email: z.string().email(), name: z.string() })).handler(({ context }) => ({
  id: context.user.id,
  email: context.user.email,
  name: context.user.name,
}));

export const router = { getMe, dashboard, sites, facilities, vehicles, drivers, alerts, routes, anomalies, reports, search, demo, simulator, realtime, admin, internal: { telemetry: { ingestCapacity, ingestVehicleLocation, ingestRfidScan }, device: { updateStatus: updateDeviceStatus } } };
