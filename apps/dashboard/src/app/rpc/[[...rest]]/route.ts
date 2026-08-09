import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { auth } from '@/lib/auth';
import { router } from '@/routers';

const handler = new RPCHandler(router, { interceptors: [onError((error) => console.error(error))] });

async function handleRequest(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const origin = request.headers.get('origin');
  const allowed = process.env.ENABLE_SIMULATOR_DEV_API === 'true' && origin === process.env.SIMULATOR_ALLOWED_ORIGIN;
  if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: allowed ? { 'Access-Control-Allow-Origin': origin!, 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'content-type' } : {} });
  const { response } = await handler.handle(request, { prefix: '/rpc', context: { user: session?.user, serviceToken: request.headers.get('x-sispik-service-key') ?? undefined, origin } });
  const result = response ?? new Response('Not found', { status: 404 });
  if (allowed) result.headers.set('Access-Control-Allow-Origin', origin!);
  return result;
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const OPTIONS = handleRequest;
