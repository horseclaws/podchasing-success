'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/client-health', label: 'Health Reports' },
  { href: '/call-review', label: 'Call Review' },
  { href: '/chart-history', label: 'Chart History' },
  { href: '/guest-finder', label: 'Find Me Podcasts' },
  { href: '/team', label: 'Settings' },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="bg-brand-purple">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-1 h-14">
          <span className="text-sm font-semibold tracking-tight mr-6 text-white/85">
            P.E.R.C.Y
          </span>
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-150 ${
                  active
                    ? 'text-brand-yellow bg-white/10'
                    : 'text-white/60 bg-transparent hover:text-white/85'
                }`}
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
