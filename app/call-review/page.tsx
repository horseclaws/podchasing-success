import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import CallReviewClient from '@/components/call-review/CallReviewClient';

export default async function CallReviewPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <CallReviewClient
      repName={session.user.name ?? 'Rep'}
      repEmail={session.user.email ?? ''}
    />
  );
}
