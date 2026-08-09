import { ORPCError, os as orpcOs } from '@orpc/server';
import { type auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

type User = typeof auth.$Infer.Session.user;

export interface ORPCContext { user?: User; serviceToken?: string; origin?: string | null }

export const publicProcedure = orpcOs.$context<ORPCContext>();

export const protectedMiddleware = publicProcedure.middleware(async ({ context, next }) => {
  if (!context.user) throw new ORPCError('UNAUTHORIZED', { message: 'Authentication is required.' });
  return next({ context: { user: context.user } });
});

/** Use this for every oRPC procedure that requires an authenticated administrator. */
export const protectedProcedure = publicProcedure.use(protectedMiddleware);

/**
 * The dashboard deliberately has one bootstrap account (enforced by User.singleton).
 * Resolve that account from the database instead of trusting a client supplied role.
 */
const administratorMiddleware = publicProcedure.middleware(async ({ context, next }) => {
  if (!context.user) throw new ORPCError('UNAUTHORIZED', { message: 'Authentication is required.' });
  const administrator = await prisma.user.findUnique({ where: { singleton: 1 }, select: { id: true } });
  if (!administrator || administrator.id !== context.user.id) {
    throw new ORPCError('FORBIDDEN', { message: 'Administrator access is required.' });
  }
  return next({ context });
});

export const adminProcedure = publicProcedure.use(administratorMiddleware);

const serviceMiddleware = publicProcedure.middleware(async ({ context, next }) => {
  if (!process.env.IOT_INGESTOR_SERVICE_TOKEN || context.serviceToken !== process.env.IOT_INGESTOR_SERVICE_TOKEN) {
    throw new ORPCError('UNAUTHORIZED', { message: 'A valid service credential is required.' });
  }
  return next();
});

export const serviceProcedure = publicProcedure.use(serviceMiddleware);

const simulatorMiddleware = publicProcedure.middleware(async ({ context, next }) => {
  const allowedOrigin = process.env.SIMULATOR_ALLOWED_ORIGIN;
  if (process.env.ENABLE_SIMULATOR_DEV_API !== 'true' || !allowedOrigin || context.origin !== allowedOrigin) throw new ORPCError('FORBIDDEN', { message: 'Simulator API is disabled or the origin is not allowed.' });
  return next({ context });
});
export const simulatorProcedure = publicProcedure.use(simulatorMiddleware);
