import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/sign-out-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in');

  return (
    <main className="min-h-screen bg-muted/40 p-6">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 py-6">
        <div><p className="text-sm text-muted-foreground">SispikHacks</p><h1 className="text-3xl font-semibold">Dashboard</h1></div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild><Link href="/dashboard/account">Account</Link></Button>
          <SignOutButton />
        </div>
      </div>
      <Card className="mx-auto max-w-4xl">
        <CardHeader><CardTitle>Administrator account</CardTitle><CardDescription>The dashboard foundation is ready for product features.</CardDescription></CardHeader>
        <CardContent><dl className="grid gap-1 text-sm"><dt className="text-muted-foreground">Signed in as</dt><dd className="font-medium">{session.user.email}</dd></dl></CardContent>
      </Card>
    </main>
  );
}
