'use client';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';

const client: any = createORPCClient(new RPCLink({ url: process.env.NEXT_PUBLIC_SIMULATOR_API_URL ?? 'http://localhost:3000/rpc' }));
/** createORPCClient procedures are callable; `.call` is only used by TanStack query utilities. */
export const api = new Proxy({}, { get: (_, key) => (input?: unknown) => client.simulator[key as string](input) }) as Record<string, (input?: any) => Promise<any>>;
