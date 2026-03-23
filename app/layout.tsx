import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavTabs from '@/components/NavTabs';
import { auth } from '@/lib/auth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Podchaser Intelligence',
  description: 'Podcast chart history and guest finder',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        {session && <NavTabs />}
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
