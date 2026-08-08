'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';

type AuthCardProps = { mode: 'setup' | 'sign-in' };

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const isSetup = mode === 'setup';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const result = isSetup
      ? await authClient.signUp.email({
          name: String(formData.get('name') ?? ''),
          email,
          password,
        })
      : await authClient.signIn.email({ email, password });

    setPending(false);
    if (result.error) {
      setError(isSetup ? 'Setup could not be completed. The administrator may already exist.' : result.error.message);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isSetup ? 'Set up the administrator' : 'Sign in'}</CardTitle>
        <CardDescription>
          {isSetup
            ? 'Create the only administrator account for this dashboard.'
            : 'Use the administrator email and password to continue.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          {isSetup && (
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required autoComplete="name" />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} required autoComplete={isSetup ? 'new-password' : 'current-password'} />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" disabled={pending}>{pending ? 'Please wait…' : isSetup ? 'Create administrator' : 'Sign in'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
