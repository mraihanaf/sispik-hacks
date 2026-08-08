import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import type { router } from '@/routers';

const link = new RPCLink({ url: typeof window === 'undefined' ? 'http://localhost:3000/rpc' : `${window.location.origin}/rpc` });
const client: RouterClient<typeof router> = createORPCClient(link);

export default createTanstackQueryUtils(client);
