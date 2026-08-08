import { z } from 'zod';
import { protectedProcedure } from './base';

const getMe = protectedProcedure.output(z.object({ id: z.string(), email: z.string().email(), name: z.string() })).handler(({ context }) => ({
  id: context.user.id,
  email: context.user.email,
  name: context.user.name,
}));

export const router = { getMe };
