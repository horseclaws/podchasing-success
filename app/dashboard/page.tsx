// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <DashboardClient
      isManager={session.user.is_manager}
      hubspotOwnerId={session.user.hubspot_owner_id}
    />
  );
}
