import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { sql } from '@/lib/db';
import TeamPage from '@/components/team/TeamPage';

export default async function Team() {
  const session = await auth();
  if (!session) redirect('/login');
  const members = await sql`SELECT id, name, email, hubspot_owner_id, created_at FROM users ORDER BY created_at ASC`;
  return (
    <TeamPage
      members={members as { id: string; name: string; email: string; hubspot_owner_id: string; created_at: string }[]}
      currentUserId={session.user.id}
    />
  );
}
