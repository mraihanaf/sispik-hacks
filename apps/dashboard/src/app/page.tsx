import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function Home() {
  if ((await prisma.user.count()) === 0) redirect('/setup');

  const session = await auth.api.getSession({ headers: await headers() });
  redirect(session ? '/dashboard' : '/sign-in');
}
