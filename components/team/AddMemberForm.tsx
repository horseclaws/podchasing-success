'use client';
import { useState } from 'react';
import InsightCard from '@/components/ui/InsightCard';

interface Props {
  onAdded: () => void;
}

export default function AddMemberForm({ onAdded }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hubspotOwnerId, setHubspotOwnerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, hubspot_owner_id: hubspotOwnerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add member');
        return;
      }
      setName(''); setEmail(''); setPassword(''); setHubspotOwnerId('');
      onAdded();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <InsightCard>
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Add Member</h3>
        <p className="text-xs text-gray-400">Known owner IDs — Jon: 1774818015 / Jules: 184892201 / Sydney: 157100429</p>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
          <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
          <input placeholder="Temp password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
          <input placeholder="HubSpot Owner ID" value={hubspotOwnerId} onChange={e => setHubspotOwnerId(e.target.value)} required className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple" />
        </div>
        {error && <p className="text-xs text-brand-pink">{error}</p>}
        <button type="submit" disabled={loading} className="px-4 py-1.5 text-sm bg-brand-purple text-white rounded-lg hover:opacity-90 disabled:opacity-50">
          {loading ? 'Adding…' : 'Add Member'}
        </button>
      </form>
    </InsightCard>
  );
}
