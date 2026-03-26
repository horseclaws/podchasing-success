'use client';
import { useState } from 'react';
import InsightCard from '@/components/ui/InsightCard';

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setMessage('');
    setLoading(true);
    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to change password');
        return;
      }
      setMessage('Password updated.');
      setCurrent(''); setNext('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <InsightCard className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Change Password</h3>
        <input
          type="password"
          placeholder="Current password"
          value={current}
          onChange={e => setCurrent(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple"
        />
        <input
          type="password"
          placeholder="New password"
          value={next}
          onChange={e => setNext(e.target.value)}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-purple"
        />
        {message && <p className="text-xs text-brand-mint">{message}</p>}
        {error && <p className="text-xs text-brand-pink">{error}</p>}
        <button type="submit" disabled={loading} className="px-4 py-1.5 text-sm bg-brand-purple text-white rounded-lg hover:opacity-90 disabled:opacity-50">
          {loading ? 'Saving…' : 'Change Password'}
        </button>
      </form>
    </InsightCard>
  );
}
