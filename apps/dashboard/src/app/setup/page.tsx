import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth-card';
import prisma from '@/lib/prisma';

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) redirect('/sign-in');

  return <main className="grid min-h-screen place-items-center bg-muted/40 p-6"><AuthCard mode="setup" /></main>;
}
