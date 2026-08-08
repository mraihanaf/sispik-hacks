import { createRouterClient } from '@orpc/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { router } from '@/routers';

export const orpcServer = createRouterClient(router, {
  context: async () => ({ user: (await auth.api.getSession({ headers: await headers() }))?.user }),
});
