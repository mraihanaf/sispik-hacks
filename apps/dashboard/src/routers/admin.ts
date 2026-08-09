import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { adminProcedure } from './base';
import { createDriverPhotoUpload, validateDriverPhoto } from '@/lib/driver-photos';

const id = z.object({ id: z.string().min(1) });
const coordinates = { latitude: z.number().finite().gte(-90).lte(90), longitude: z.number().finite().gte(-180).lte(180) };
const siteInput = z.object({ code: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(160), ...coordinates, maxCapacityKg: z.number().positive() });
const facilityInput = z.object({ code: z.string().trim().min(2).max(64), name: z.string().trim().min(2).max(160), type: z.enum(['DEPOT', 'TRANSFER_STATION', 'PROCESSING_FACILITY', 'LANDFILL']), ...coordinates });
const vehicleInput = z.object({ code: z.string().trim().min(2).max(64), licensePlate: z.string().trim().min(2).max(32), capacityKg: z.number().positive() });
const driverInput = z.object({ name: z.string().trim().min(2).max(160), identityRef: z.string().trim().min(1).max(128).regex(/^[A-Fa-f0-9:\s-]+$/, 'RFID/e-KTP UID must contain hexadecimal characters only.').nullable().optional() });
const normalizeIdentityRef = (value: string | null | undefined) => value ? value.replace(/[^A-Fa-f0-9]/g, '').toUpperCase() : null;
const deviceInput = z.object({ deviceId: z.string().trim().min(2).max(128), mqttClientId: z.string().trim().min(2).max(128), type: z.enum(['CAPACITY_SENSOR', 'VEHICLE_TRACKER']), siteId: z.string().min(1).nullable().optional(), vehicleId: z.string().min(1).nullable().optional(), emptyDistanceCm: z.number().positive().nullable().optional(), fullDistanceCm: z.number().positive().nullable().optional(), hardwareModel: z.string().trim().max(128).nullable().optional(), firmwareVersion: z.string().trim().max(128).nullable().optional() }).superRefine((value, ctx) => {
  const assigned = Number(Boolean(value.siteId)) + Number(Boolean(value.vehicleId));
  if (assigned !== 1) ctx.addIssue({ code: 'custom', message: 'A device must be assigned to exactly one site or vehicle.' });
  if (value.type === 'CAPACITY_SENSOR' && (!value.siteId || !value.emptyDistanceCm || !value.fullDistanceCm || value.emptyDistanceCm <= value.fullDistanceCm)) ctx.addIssue({ code: 'custom', message: 'Capacity sensors require a site and empty distance greater than full distance.' });
  if (value.type === 'VEHICLE_TRACKER' && (!value.vehicleId || value.emptyDistanceCm || value.fullDistanceCm)) ctx.addIssue({ code: 'custom', message: 'Vehicle trackers require a vehicle and cannot have capacity calibration.' });
});

function conflict(message: string): never { throw new ORPCError('CONFLICT', { message }); }

export const overview = adminProcedure.handler(async () => {
  const [sites, facilities, vehicles, drivers, devices, assignments, routes, alerts, anomalies] = await Promise.all([
    prisma.wasteSite.findMany({ orderBy: { code: 'asc' }, include: { devices: { select: { deviceId: true } } } }),
    prisma.facility.findMany({ orderBy: { code: 'asc' } }),
    prisma.vehicle.findMany({ orderBy: { code: 'asc' }, include: { assignments: { where: { active: true }, include: { driver: true } }, devices: { select: { deviceId: true } } } }),
    prisma.driver.findMany({ orderBy: { name: 'asc' }, include: { verificationReviews: { orderBy: { createdAt: 'desc' }, take: 1 } } }),
    prisma.ioTDevice.findMany({ orderBy: { deviceId: 'asc' } }),
    prisma.vehicleAssignment.findMany({ where: { active: true }, include: { vehicle: true, driver: true }, orderBy: { startedAt: 'desc' } }),
    prisma.routePlan.findMany({ include: { vehicle: true, startFacility: true, endFacility: true, stops: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.alert.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.anomaly.findMany({ include: { vehicle: true, routePlan: true }, orderBy: { detectedAt: 'desc' }, take: 100 }),
  ]);
  return { sites, facilities, vehicles, drivers, devices, assignments, routes, alerts, anomalies };
});

export const sites = {
  create: adminProcedure.input(siteInput).handler(({ input }) => prisma.wasteSite.create({ data: input })),
  update: adminProcedure.input(id.merge(siteInput)).handler(({ input }) => { const { id, ...data } = input; return prisma.wasteSite.update({ where: { id }, data }); }),
  retire: adminProcedure.input(id).handler(({ input }) => prisma.wasteSite.update({ where: input, data: { status: 'MAINTENANCE' } })),
  restore: adminProcedure.input(id).handler(({ input }) => prisma.wasteSite.update({ where: input, data: { status: 'NORMAL' } })),
  remove: adminProcedure.input(id).handler(async ({ input }) => { const related = await prisma.wasteSite.findUnique({ where: input, select: { _count: { select: { devices: true, telemetry: true, routeStops: true, collections: true } } } }); if (!related) throw new ORPCError('NOT_FOUND'); if (Object.values(related._count).some(Boolean)) conflict('Sites with operational history must be retired, not deleted.'); return prisma.wasteSite.delete({ where: input }); }),
};
export const facilities = {
  create: adminProcedure.input(facilityInput).handler(({ input }) => prisma.facility.create({ data: input })),
  update: adminProcedure.input(id.merge(facilityInput)).handler(({ input }) => { const { id, ...data } = input; return prisma.facility.update({ where: { id }, data }); }),
  retire: adminProcedure.input(id).handler(({ input }) => prisma.facility.update({ where: input, data: { status: 'INACTIVE' } })),
  restore: adminProcedure.input(id).handler(({ input }) => prisma.facility.update({ where: input, data: { status: 'ACTIVE' } })),
  remove: adminProcedure.input(id).handler(async ({ input }) => { const related = await prisma.facility.findUnique({ where: input, select: { _count: { select: { routeStarts: true, routeEnds: true, routeStops: true } } } }); if (!related) throw new ORPCError('NOT_FOUND'); if (Object.values(related._count).some(Boolean)) conflict('Facilities used by routes must be retired, not deleted.'); return prisma.facility.delete({ where: input }); }),
};
export const vehicles = {
  create: adminProcedure.input(vehicleInput).handler(({ input }) => prisma.vehicle.create({ data: input })),
  update: adminProcedure.input(id.merge(vehicleInput)).handler(({ input }) => { const { id, ...data } = input; return prisma.vehicle.update({ where: { id }, data }); }),
  retire: adminProcedure.input(id).handler(({ input }) => prisma.vehicle.update({ where: input, data: { status: 'MAINTENANCE' } })),
  restore: adminProcedure.input(id).handler(({ input }) => prisma.vehicle.update({ where: input, data: { status: 'AVAILABLE' } })),
  remove: adminProcedure.input(id).handler(async ({ input }) => { const related = await prisma.vehicle.findUnique({ where: input, select: { _count: { select: { devices: true, assignments: true, locations: true, routes: true, collections: true, anomalies: true } } } }); if (!related) throw new ORPCError('NOT_FOUND'); if (Object.values(related._count).some(Boolean)) conflict('Vehicles with operational history must be retired, not deleted.'); return prisma.vehicle.delete({ where: input }); }),
};
export const drivers = {
  create: adminProcedure.input(driverInput).handler(({ input }) => prisma.driver.create({ data: { ...input, identityRef: normalizeIdentityRef(input.identityRef) } })),
  update: adminProcedure.input(id.merge(driverInput)).handler(async ({ input }) => { const { id, ...data } = input; const current = await prisma.driver.findUniqueOrThrow({ where: { id } }); const identityRef = normalizeIdentityRef(data.identityRef); return prisma.driver.update({ where: { id }, data: { ...data, identityRef, ...(current.identityRef !== identityRef ? { verificationStatus: 'PENDING' } : {}) } }); }),
  createPhotoUpload: adminProcedure.input(z.object({ driverId: z.string().min(1), contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']), size: z.number().int().positive().max(5 * 1024 * 1024) })).handler(async ({ input }) => { validateDriverPhoto(input.contentType, input.size); await prisma.driver.findUniqueOrThrow({ where: { id: input.driverId }, select: { id: true } }); return createDriverPhotoUpload(input.driverId, input.contentType); }),
  setPhoto: adminProcedure.input(z.object({ driverId: z.string().min(1), photoKey: z.string().min(1) })).handler(({ input }) => { if (!input.photoKey.startsWith(`drivers/${input.driverId}/photos/`)) throw new ORPCError('BAD_REQUEST', { message: 'Invalid driver photo key.' }); return prisma.driver.update({ where: { id: input.driverId }, data: { photoKey: input.photoKey, verificationStatus: 'PENDING' } }); }),
  retire: adminProcedure.input(id).handler(({ input }) => prisma.driver.update({ where: input, data: { status: 'SUSPENDED' } })),
  restore: adminProcedure.input(id).handler(({ input }) => prisma.driver.update({ where: input, data: { status: 'AVAILABLE' } })),
  remove: adminProcedure.input(id).handler(async ({ input }) => { const related = await prisma.driver.findUnique({ where: input, select: { _count: { select: { assignments: true, rfidScans: true } } } }); if (!related) throw new ORPCError('NOT_FOUND'); if (Object.values(related._count).some(Boolean)) conflict('Drivers with assignment or RFID history must be retired, not deleted.'); return prisma.driver.delete({ where: input }); }),
};
export const devices = {
  create: adminProcedure.input(deviceInput).handler(({ input }) => prisma.ioTDevice.create({ data: input })),
  update: adminProcedure.input(id.merge(deviceInput)).handler(({ input }) => { const { id, ...data } = input; return prisma.ioTDevice.update({ where: { id }, data }); }),
  retire: adminProcedure.input(id).handler(({ input }) => prisma.ioTDevice.update({ where: input, data: { status: 'MAINTENANCE' } })),
  restore: adminProcedure.input(id).handler(({ input }) => prisma.ioTDevice.update({ where: input, data: { status: 'OFFLINE' } })),
  remove: adminProcedure.input(id).handler(async ({ input }) => { const related = await prisma.ioTDevice.findUnique({ where: input, select: { _count: { select: { siteTelemetry: true, vehicleLocations: true } } } }); if (!related) throw new ORPCError('NOT_FOUND'); if (Object.values(related._count).some(Boolean)) conflict('Devices with telemetry history must be retired, not deleted.'); return prisma.ioTDevice.delete({ where: input }); }),
};
export const assignments = {
  assign: adminProcedure.input(z.object({ vehicleId: z.string().min(1), driverId: z.string().min(1) })).handler(async ({ input }) => prisma.$transaction(async (tx) => { const driver = await tx.driver.findUniqueOrThrow({ where: { id: input.driverId } }); if (driver.verificationStatus !== 'VERIFIED' || driver.status === 'SUSPENDED') conflict('Only verified, active drivers can be assigned to a truck.'); await tx.vehicleAssignment.updateMany({ where: { vehicleId: input.vehicleId, active: true }, data: { active: false, endedAt: new Date() } }); return tx.vehicleAssignment.create({ data: input, include: { vehicle: true, driver: true } }); })),
  end: adminProcedure.input(id).handler(({ input }) => prisma.vehicleAssignment.update({ where: input, data: { active: false, endedAt: new Date() } })),
};
export const routes = { cancel: adminProcedure.input(z.object({ routeId: z.string().min(1) })).handler(async ({ input }) => { const route = await prisma.routePlan.findUniqueOrThrow({ where: { id: input.routeId } }); if (route.status === 'COMPLETED') conflict('Completed routes cannot be cancelled.'); return prisma.routePlan.update({ where: { id: route.id }, data: { status: 'CANCELLED' } }); }) };
export const alerts = { acknowledge: adminProcedure.input(id).handler(({ input }) => prisma.alert.update({ where: input, data: { acknowledged: true, acknowledgedAt: new Date() } })) };
export const anomalies = { resolve: adminProcedure.input(id).handler(({ input }) => prisma.anomaly.update({ where: input, data: { resolvedAt: new Date() } })) };
