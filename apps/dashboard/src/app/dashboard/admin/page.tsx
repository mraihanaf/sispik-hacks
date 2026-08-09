import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminConsole } from '@/components/admin-console';
import { PageHeader } from '@/components/dashboard/page-header';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');
  const administrator = await prisma.user.findUnique({ where: { singleton: 1 }, select: { id: true } });
  if (!administrator || administrator.id !== session.user.id) redirect('/dashboard');
  return <><PageHeader eyebrow="System configuration" title="Management" description="Maintain sites, facilities, fleet, drivers, devices, and active assignments." /><AdminConsole /></>;
}
