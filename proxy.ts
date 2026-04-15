import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { basePath, withBase } from '@/lib/basePath';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = basePath && req.nextUrl.pathname.startsWith(basePath)
    ? req.nextUrl.pathname.slice(basePath.length) || '/'
    : req.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/api/auth');
  const isLoginPage = pathname === '/login';

  if (isAuthRoute || isLoginPage) return NextResponse.next();
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL(withBase('/login'), req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};
