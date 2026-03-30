'use client';
import { useState } from 'react';

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
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      <h3 className="text-sm font-medium text-gray-900">Change Password</h3>
      <input placeholder="Current password" type="password" value={current} onChange={e => setCurrent(e.target.value)} required className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
      <input placeholder="New password" type="password" value={next} onChange={e => setNext(e.target.value)} required className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm" />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {message && <p className="text-xs text-green-600">{message}</p>}
      <button type="submit" disabled={loading} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
        {loading ? 'Saving…' : 'Change Password'}
      </button>
    </form>
  );
}
