import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import TopNav from '@/components/TopNav';
import Sidebar from '@/components/Sidebar';
import FetchBasePathPatch from '@/components/FetchBasePathPatch';
import { auth } from '@/lib/auth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CS Dashboard',
  description: 'Client Success team dashboard',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-background`}>
        <FetchBasePathPatch />
        {session ? (
          <>
            <TopNav />
            <div className="flex pt-14 min-h-screen">
              <Sidebar />
              <div className="ml-52 flex-1 min-w-0">
                <main>{children}</main>
              </div>
            </div>
          </>
        ) : (
          <main className="min-h-screen flex items-center justify-center px-6">
            {children}
          </main>
        )}
      </body>
    </html>
  );
}
