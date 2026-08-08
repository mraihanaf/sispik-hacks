'use client';

import { type FormEvent, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';

export function ChangePasswordForm() {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSuccess(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get('newPassword') ?? '');

    if (newPassword !== String(formData.get('confirmPassword') ?? '')) {
      setError('The new password and confirmation do not match.');
      return;
    }

    setPending(true);
    const result = await authClient.changePassword({
      currentPassword: String(formData.get('currentPassword') ?? ''),
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    form.reset();
    setSuccess(true);
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Other active sessions will be signed out when the password changes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" name="newPassword" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {success && <Alert><AlertDescription>Password updated successfully.</AlertDescription></Alert>}
          <Button type="submit" disabled={pending}>{pending ? 'Updating…' : 'Update password'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
