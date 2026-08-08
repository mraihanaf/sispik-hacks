import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth-card';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function SignInPage() {
  if ((await prisma.user.count()) === 0) redirect('/setup');
  if (await auth.api.getSession({ headers: await headers() })) redirect('/dashboard');

  return <main className="grid min-h-screen place-items-center bg-muted/40 p-6"><AuthCard mode="sign-in" /></main>;
}
