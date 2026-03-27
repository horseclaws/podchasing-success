'use client';
import { useState, useCallback } from 'react';
import TeamMemberList from './TeamMemberList';
import AddMemberForm from './AddMemberForm';
import ChangePasswordForm from './ChangePasswordForm';
import { HeroSection } from '@/components/ui';

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
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/team');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setMembers(data);
    } catch {
      // network error — keep existing list
    }
  }, []);

  async function handleRemove(id: string) {
    if (!confirm('Remove this member?')) return;
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to remove member');
        return;
      }
      setError('');
      await refresh();
    } catch {
      setError('Network error removing member');
    }
  }

  return (
    <>
      <HeroSection
        badge="TEAM"
        title="Team"
        subtitle="Manage members and access"
      />
      <div className="px-8 py-8">
      <div className="space-y-8 max-w-3xl">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <TeamMemberList members={members} currentUserId={currentUserId} onRemove={handleRemove} />
      <div className="border-t border-gray-200 pt-6">
        <AddMemberForm onAdded={refresh} />
      </div>
      <div className="border-t border-gray-200 pt-6">
        <ChangePasswordForm />
      </div>
      </div>
      </div>
    </>
  );
}
