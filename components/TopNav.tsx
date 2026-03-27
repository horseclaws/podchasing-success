'use client';
import { signOut } from 'next-auth/react';

export default function TopNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-6" style={{ backgroundColor: '#2D034F' }}>
      <div className="flex items-center gap-3">
        <span className="text-white font-bold text-sm tracking-tight">Podchaser</span>
        <span className="w-px h-4 bg-white/20" />
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full tracking-wide"
          style={{ backgroundColor: '#FB0467', color: '#ffffff' }}
        >
          CS DASHBOARD
        </span>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="text-sm text-white/60 hover:text-white transition-colors duration-150"
      >
        Log out
      </button>
    </nav>
  );
}
