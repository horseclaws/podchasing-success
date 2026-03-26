'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/client-health', label: 'Client Health' },
  { href: '/chart-history', label: 'Chart History' },
  { href: '/guest-finder', label: 'Guest Finder' },
  { href: '/team', label: 'Team' },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav style={{ backgroundColor: '#4A027D' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-1 h-14">
          <span className="text-sm font-semibold tracking-tight mr-6" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Podchaser Intelligence
          </span>
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-150"
                style={{
                  color: active ? '#FFEF70' : 'rgba(255,255,255,0.6)',
                  backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
