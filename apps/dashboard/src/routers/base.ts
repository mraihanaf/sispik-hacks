import { ORPCError, os as orpcOs } from '@orpc/server';
import { type auth } from '@/lib/auth';

type User = typeof auth.$Infer.Session.user;

export interface ORPCContext { user?: User }

export const publicProcedure = orpcOs.$context<ORPCContext>();

export const protectedMiddleware = publicProcedure.middleware(async ({ context, next }) => {
  if (!context.user) throw new ORPCError('UNAUTHORIZED', { message: 'Authentication is required.' });
  return next({ context: { user: context.user } });
});

/** Use this for every oRPC procedure that requires an authenticated administrator. */
export const protectedProcedure = publicProcedure.use(protectedMiddleware);
