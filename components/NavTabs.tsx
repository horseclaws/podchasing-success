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
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-6 h-14">
          <span className="font-semibold text-gray-900 mr-4">Podchaser Intelligence</span>
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-sm font-medium pb-0.5 border-b-2 transition-colors ${
                pathname.startsWith(tab.href)
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
