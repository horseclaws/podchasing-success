'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError('Invalid email or password.');
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl p-8" style={{ backgroundColor: '#ffffff', boxShadow: '0 24px 48px rgba(0,0,0,0.25)' }}>
      <div className="mb-8">
        <div className="w-8 h-8 rounded-lg mb-4" style={{ backgroundColor: '#FB0467' }} />
        <h1 className="text-xl font-semibold mb-1" style={{ color: '#1a1a2e' }}>P.E.R.C.Y</h1>
        <p className="text-sm" style={{ color: '#6b7280' }}>Sign in to your account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-shadow"
            style={{ border: '1.5px solid #e5e7eb', color: '#1a1a2e' }}
            onFocus={e => (e.target.style.borderColor = '#4A027D')}
            onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none transition-shadow"
            style={{ border: '1.5px solid #e5e7eb', color: '#1a1a2e' }}
            onFocus={e => (e.target.style.borderColor = '#4A027D')}
            onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
          />
        </div>
        {error && <p className="text-xs font-medium" style={{ color: '#FB0467' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 text-sm font-semibold rounded-lg transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#FB0467', color: '#ffffff' }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
