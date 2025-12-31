// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth/auth';

// Define protected routes and their allowed roles
const ROLE_ROUTES: Record<string, string[]> = {
  '/seller': ['SELLER', 'SUPERUSER'],
  '/admin': ['ADMIN', 'SUPERUSER'],
  '/accountant': ['ACCOUNTANT', 'SUPERUSER'],
  '/user': ['SUPERUSER'],
};

// Public routes that don't require authentication
// const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password'];
const PUBLIC_ROUTES = ['/login'];

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const session = await auth();
  const isLoggedIn = !!session;
  const userRole = session?.user?.role?.toUpperCase() || '';


  
  // Skip API routes, static files, and auth routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next();
  }

  // =============================================
  // 1. Logged in + trying to access login page
  // =============================================
  if (isLoggedIn && PUBLIC_ROUTES.includes(pathname)) {
    const callbackUrl = searchParams.get('callbackUrl');
    
    // Don't redirect if coming from auth error
    if (callbackUrl?.includes('/api/auth/error')) {
      return NextResponse.next();
    }
    
    // Role-based redirect with safe callback
    const redirectUrl = getRoleBasedRedirect(userRole, callbackUrl);
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // =============================================
  // 2. Not logged in + trying to access protected route
  // =============================================
  if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname)) {
    const loginUrl = new URL('/login', request.url);
    if (!pathname.startsWith('/api/auth')) {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // =============================================
  // 3. Role-based route protection
  // =============================================
  if (isLoggedIn) {
    const unauthorizedRedirect = checkRoleAccess(pathname, userRole, request.url);
    if (unauthorizedRedirect) {
      return unauthorizedRedirect;
    }
  }

  // =============================================
  // 4. Root redirect based on role
  // =============================================
  if (pathname === '/') {
    const redirectUrl = isLoggedIn 
      ? getRoleDashboard(userRole)
      : '/login';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  return NextResponse.next();
}

// =============================================
// Check if user has access to the route
// =============================================
function checkRoleAccess(pathname: string, userRole: string, baseUrl: string): NextResponse | null {
  // Find matching route prefix
  for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(routePrefix)) {
      // Check if user's role is allowed
      if (!allowedRoles.includes(userRole)) {
        // Redirect to their own dashboard with unauthorized message
        const userDashboard = getRoleDashboard(userRole);
        const redirectUrl = new URL(userDashboard, baseUrl);
        redirectUrl.searchParams.set('error', 'unauthorized');
        redirectUrl.searchParams.set('message', 'You do not have access to that page');
        return NextResponse.redirect(redirectUrl);
      }
      break;
    }
  }
  return null;
}

// =============================================
// Get dashboard path for role
// =============================================
function getRoleDashboard(role: string): string {
  switch (role?.toUpperCase()) {
    case 'SELLER':
      return '/seller/dashboard';
    case 'ADMIN':
    case 'SUPERUSER':
      return '/admin/dashboard';
    case 'ACCOUNTANT':
      return '/accountant/dashboard';
    case 'SUPERUSER':
      return '/user/dashboard';
    default:
      return '/login';
  }
}

// =============================================
// Role-based redirect with optional callback
// =============================================
function getRoleBasedRedirect(role: string, callbackUrl?: string | null): string {
  const roleDashboard = getRoleDashboard(role);
  
  // If no callback, return role dashboard
  if (!callbackUrl) {
    return roleDashboard;
  }

  // Check if callback URL is allowed for this role
  if (isRouteAllowedForRole(callbackUrl, role)) {
    return callbackUrl;
  }

  // Callback doesn't match role permissions, use role dashboard
  return roleDashboard;
}

// =============================================
// Check if a route is allowed for a role
// =============================================
function isRouteAllowedForRole(pathname: string, role: string): boolean {
  for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(routePrefix)) {
      return allowedRoles.includes(role.toUpperCase());
    }
  }
  // If route is not in ROLE_ROUTES, allow access (public or unprotected)
  return true;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};