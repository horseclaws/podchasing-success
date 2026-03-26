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
      <body className={`${inter.className} min-h-screen bg-background`}>
        {session && <NavTabs />}
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
