// proxy.ts (Fixed)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth/auth';

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const session = await auth();
  const isLoggedIn = !!session;

  // Skip API routes and auth routes - IMPORTANT!
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Logged in + trying to access login
  if (isLoggedIn && pathname === '/login') {
    const callbackUrl = searchParams.get('callbackUrl');
    
    // ✅ Don't redirect if coming from auth error
    if (callbackUrl?.includes('/api/auth/error')) {
      return NextResponse.next(); // Let them stay on login page
    }
    
    // Only redirect to callback if it's a safe user route
    const redirectUrl = callbackUrl && callbackUrl.startsWith('/user') 
      ? callbackUrl 
      : '/user/dashboard';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // Not logged in + trying to access protected route
  if (!isLoggedIn && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    // Save the intended destination (but not if it's already an auth route)
    if (!pathname.startsWith('/api/auth')) {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Root redirect
  if (pathname === '/') {
    const redirectUrl = isLoggedIn ? '/user/dashboard' : '/login';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};