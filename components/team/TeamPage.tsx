'use client';
import { useState, useCallback } from 'react';
import TeamMemberList from './TeamMemberList';
import AddMemberForm from './AddMemberForm';
import ChangePasswordForm from './ChangePasswordForm';

interface Member {
  id: string;
  name: string;
  email: string;
  hubspot_owner_id: string;
  created_at: string;
}

interface Props {
  members: Member[];
  currentUserId: string;
}

export default function TeamPage({ members: initial, currentUserId }: Props) {
  const [members, setMembers] = useState(initial);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/team');
    const data = await res.json();
    setMembers(data);
  }, []);

  async function handleRemove(id: string) {
    if (!confirm('Remove this member?')) return;
    await fetch(`/api/team/${id}`, { method: 'DELETE' });
    await refresh();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-900">Team</h1>
      <TeamMemberList members={members} currentUserId={currentUserId} onRemove={handleRemove} />
      <div className="border-t border-gray-200 pt-6">
        <AddMemberForm onAdded={refresh} />
      </div>
      <div className="border-t border-gray-200 pt-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
