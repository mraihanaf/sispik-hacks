import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChangePasswordForm } from '@/components/change-password-form';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';

export default async function AccountPage() {
  if (!await auth.api.getSession({ headers: await headers() })) redirect('/sign-in');

  return (
    <main className="min-h-screen bg-muted/40 p-6">
      <div className="mx-auto max-w-4xl py-6">
        <Button variant="ghost" asChild><Link href="/dashboard">← Dashboard</Link></Button>
        <div className="mt-6"><ChangePasswordForm /></div>
      </div>
    </main>
  );
}
