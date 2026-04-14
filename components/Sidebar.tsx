'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/client-health', label: 'Health Reports' },
  { href: '/call-review', label: 'Call Review' },
  { href: '/chart-history', label: 'Chart History' },
  { href: '/guest-finder', label: 'Find Me Podcasts' },
  { href: '/kb', label: 'Ask the KB' },
  { href: '/team', label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="fixed top-14 left-0 bottom-0 w-52 z-40 flex flex-col border-r border-white/10"
      style={{ backgroundColor: '#1a0236' }}
    >
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-2 rounded-md text-sm transition-colors duration-150 ${
                active
                  ? 'bg-white/10 text-brand-yellow font-medium'
                  : 'text-white/55 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
