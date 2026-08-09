import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ChangePasswordForm } from '@/components/change-password-form';
import { PageHeader } from '@/components/dashboard/page-header';
import { auth } from '@/lib/auth';

export default async function AccountPage() {
  if (!await auth.api.getSession({ headers: await headers() })) redirect('/sign-in');

  return <><PageHeader eyebrow="Account security" title="Account" description="Update the single operator account used for Rotom administration." /><div className="max-w-2xl"><ChangePasswordForm /></div></>;
}
