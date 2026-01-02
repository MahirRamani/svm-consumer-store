// middleware.ts
import { authEdge as auth } from "@/auth/auth.edge";
import { NextResponse } from "next/server";

const ROLE_ROUTES: Record<string, string[]> = {
  '/seller': ['SELLER', 'SUPERUSER'],
  '/admin': ['ADMIN', 'SUPERUSER'],
  '/accountant': ['ACCOUNTANT', 'SUPERUSER'],
  '/user': ['SUPERUSER'],
};

const PUBLIC_ROUTES = ['/login'];

export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;
  
  // Skip static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role?.toUpperCase() || '';

  // Not logged in + trying to access protected route
  if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname)) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in + trying to access login page
  if (isLoggedIn && PUBLIC_ROUTES.includes(pathname)) {
    const callbackUrl = searchParams.get('callbackUrl');
    
    if (callbackUrl?.includes('/api/auth/error')) {
      return NextResponse.next();
    }
    
    const redirectUrl = getRoleBasedRedirect(userRole, callbackUrl);
    const response = NextResponse.redirect(new URL(redirectUrl, req.url));
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  }

  // Role-based route protection
  if (isLoggedIn && !searchParams.has('error')) {
    const unauthorizedRedirect = checkRoleAccess(pathname, userRole, req.url);
    if (unauthorizedRedirect) {
      return unauthorizedRedirect;
    }
  }

  // Root redirect
  if (pathname === '/') {
    const redirectUrl = isLoggedIn 
      ? getRoleDashboard(userRole)
      : '/login';
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  return NextResponse.next();
});

function checkRoleAccess(pathname: string, userRole: string, baseUrl: string): NextResponse | null {
  for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    const isMatch = pathname === routePrefix || pathname.startsWith(routePrefix + '/');
    
    if (isMatch && !allowedRoles.includes(userRole)) {
      const userDashboard = getRoleDashboard(userRole);
      const redirectUrl = new URL(userDashboard, baseUrl);
      redirectUrl.searchParams.set('error', 'unauthorized');
      
      return NextResponse.redirect(redirectUrl);
    }
  }
  return null;
}

function getRoleDashboard(role: string): string {
  switch (role?.toUpperCase()) {
    case 'SELLER':
      return '/seller/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'ACCOUNTANT':
      return '/accountant/dashboard';
    case 'SUPERUSER':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}

function getRoleBasedRedirect(role: string, callbackUrl?: string | null): string {
  const roleDashboard = getRoleDashboard(role);
  
  if (!callbackUrl || !callbackUrl.startsWith('/') || callbackUrl.startsWith('//')) {
    return roleDashboard;
  }

  for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if ((callbackUrl === routePrefix || callbackUrl.startsWith(routePrefix + '/')) 
        && allowedRoles.includes(role.toUpperCase())) {
      return callbackUrl;
    }
  }

  return roleDashboard;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

// // middleware.ts
// import { auth } from "@/auth/auth";
// import { NextResponse } from "next/server";

// const ROLE_ROUTES: Record<string, string[]> = {
//   '/seller': ['SELLER', 'SUPERUSER'],
//   '/admin': ['ADMIN', 'SUPERUSER'],
//   '/accountant': ['ACCOUNTANT', 'SUPERUSER'],
//   '/user': ['SUPERUSER'],
// };

// const PUBLIC_ROUTES = ['/login'];

// export default auth((req) => {
//   const { pathname, searchParams } = req.nextUrl;
  
//   // Skip static files
//   if (
//     pathname.startsWith('/api/') ||
//     pathname.startsWith('/_next') ||
//     pathname.startsWith('/favicon.ico') ||
//     pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js)$/)
//   ) {
//     return NextResponse.next();
//   }

//   const isLoggedIn = !!req.auth;
//   const userRole = req.auth?.user?.role?.toUpperCase() || '';

//   // Not logged in + trying to access protected route
//   if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname)) {
//     const loginUrl = new URL('/login', req.url);
//     loginUrl.searchParams.set('callbackUrl', pathname);
//     return NextResponse.redirect(loginUrl);
//   }

//   // Logged in + trying to access login page
//   if (isLoggedIn && PUBLIC_ROUTES.includes(pathname)) {
//     const callbackUrl = searchParams.get('callbackUrl');
    
//     if (callbackUrl?.includes('/api/auth/error')) {
//       return NextResponse.next();
//     }
    
//     const redirectUrl = getRoleBasedRedirect(userRole, callbackUrl);
//     const response = NextResponse.redirect(new URL(redirectUrl, req.url));
//     response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
//     return response;
//   }

//   // Role-based route protection
//   if (isLoggedIn && !searchParams.has('error')) {
//     const unauthorizedRedirect = checkRoleAccess(pathname, userRole, req.url);
//     if (unauthorizedRedirect) {
//       return unauthorizedRedirect;
//     }
//   }

//   // Root redirect
//   if (pathname === '/') {
//     const redirectUrl = isLoggedIn 
//       ? getRoleDashboard(userRole)
//       : '/login';
//     return NextResponse.redirect(new URL(redirectUrl, req.url));
//   }

//   return NextResponse.next();
// });

// function checkRoleAccess(pathname: string, userRole: string, baseUrl: string): NextResponse | null {
//   for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
//     const isMatch = pathname === routePrefix || pathname.startsWith(routePrefix + '/');
    
//     if (isMatch && !allowedRoles.includes(userRole)) {
//       const userDashboard = getRoleDashboard(userRole);
//       const redirectUrl = new URL(userDashboard, baseUrl);
//       redirectUrl.searchParams.set('error', 'unauthorized');
      
//       return NextResponse.redirect(redirectUrl);
//     }
//   }
//   return null;
// }

// function getRoleDashboard(role: string): string {
//   switch (role?.toUpperCase()) {
//     case 'SELLER':
//       return '/seller/dashboard';
//     case 'ADMIN':
//       return '/admin/dashboard';
//     case 'ACCOUNTANT':
//       return '/accountant/dashboard';
//     case 'SUPERUSER':
//       return '/admin/dashboard';
//     default:
//       return '/login';
//   }
// }

// function getRoleBasedRedirect(role: string, callbackUrl?: string | null): string {
//   const roleDashboard = getRoleDashboard(role);
  
//   if (!callbackUrl || !callbackUrl.startsWith('/') || callbackUrl.startsWith('//')) {
//     return roleDashboard;
//   }

//   for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
//     if ((callbackUrl === routePrefix || callbackUrl.startsWith(routePrefix + '/')) 
//         && allowedRoles.includes(role.toUpperCase())) {
//       return callbackUrl;
//     }
//   }

//   return roleDashboard;
// }

// export const config = {
//   matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
// };

// // // proxy.ts - FIXED VERSION FOR NEXT.JS 16 WITH DEBUG LOGS
// // import { NextResponse } from 'next/server';
// // import type { NextRequest } from 'next/server';
// // import { auth } from '@/auth/auth';

// // // Define protected routes and their allowed roles
// // const ROLE_ROUTES: Record<string, string[]> = {
// //   '/seller': ['SELLER', 'SUPERUSER'],
// //   '/admin': ['ADMIN', 'SUPERUSER'],
// //   '/accountant': ['ACCOUNTANT', 'SUPERUSER'],
// //   '/user': ['SUPERUSER'], // Only SUPERUSER can access /user routes
// // };

// // // Public routes that don't require authentication
// // const PUBLIC_ROUTES = ['/login'];

// // export async function proxy(request: NextRequest) {
// //   const { pathname, searchParams } = request.nextUrl;
  
// //   // Skip API routes, static files, and auth routes
// //   if (
// //     pathname.startsWith('/api/') ||
// //     pathname.startsWith('/_next') ||
// //     pathname.startsWith('/favicon.ico') ||
// //     pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js)$/)
// //   ) {
// //     return NextResponse.next();
// //   }

// //   const session = await auth();
// //   const isLoggedIn = !!session;
// //   const userRole = session?.user?.role?.toUpperCase() || '';

// //   // =============================================
// //   // 1. Not logged in + trying to access protected route
// //   // =============================================
// //   if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname)) {
// //     console.log('🚫 NOT LOGGED IN - Redirecting to login');
// //     const loginUrl = new URL('/login', request.url);
// //     if (!pathname.startsWith('/api/')) {
// //       loginUrl.searchParams.set('callbackUrl', pathname);
// //     }
// //     console.log('→ Redirect to:', loginUrl.toString());
// //     return NextResponse.redirect(loginUrl);
// //   }

// //   // =============================================
// //   // 2. Logged in + trying to access login page
// //   // =============================================
// //   if (isLoggedIn && PUBLIC_ROUTES.includes(pathname)) {
// //     const callbackUrl = searchParams.get('callbackUrl');
    
// //     console.log('✅ LOGGED IN on login page:', { callbackUrl });
    
// //     // Don't redirect if coming from auth error
// //     if (callbackUrl?.includes('/api/auth/error')) {
// //       console.log('⚠️  Auth error detected, allowing login page');
// //       return NextResponse.next();
// //     }
    
// //     // Role-based redirect with safe callback
// //     const redirectUrl = getRoleBasedRedirect(userRole, callbackUrl);
    
// //     console.log('→ Redirecting from login to:', redirectUrl);
    
// //     // Add cache control headers to prevent back button access
// //     const response = NextResponse.redirect(new URL(redirectUrl, request.url));
// //     response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
// //     response.headers.set('Pragma', 'no-cache');
// //     response.headers.set('Expires', '0');
// //     return response;
// //   }

// //   // =============================================
// //   // 3. Role-based route protection (FIXED)
// //   // =============================================
// //   if (isLoggedIn) {
// //     // Skip role check if already on an error page (prevent redirect loops)
// //     const hasErrorParam = searchParams.has('error');
    
// //     console.log('🔐 ROLE CHECK:', { 
// //       pathname, 
// //       userRole, 
// //       hasErrorParam 
// //     });
    
// //     if (!hasErrorParam) {
// //       const unauthorizedRedirect = checkRoleAccess(pathname, userRole, request.url);
// //       if (unauthorizedRedirect) {
// //         console.log('❌ UNAUTHORIZED ACCESS DETECTED!');
// //         return unauthorizedRedirect;
// //       }
// //       console.log('✅ Role access granted');
// //     } else {
// //       console.log('⏭️  Skipping role check (error param present)');
// //     }
// //   }

// //   // =============================================
// //   // 4. Root redirect based on role
// //   // =============================================
// //   if (pathname === '/') {
// //     const redirectUrl = isLoggedIn 
// //       ? getRoleDashboard(userRole)
// //       : '/login';
    
// //     console.log('🏠 ROOT REDIRECT:', { isLoggedIn, userRole, redirectUrl });
    
// //     const response = NextResponse.redirect(new URL(redirectUrl, request.url));
    
// //     // Add cache control headers
// //     if (isLoggedIn) {
// //       response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
// //       response.headers.set('Pragma', 'no-cache');
// //       response.headers.set('Expires', '0');
// //     }
    
// //     return response;
// //   }

// //   console.log('✅ ALLOWING ACCESS to:', pathname);
// //   return NextResponse.next();
// // }

// // // =============================================
// // // Check if user has access to the route (FIXED)
// // // =============================================
// // function checkRoleAccess(pathname: string, userRole: string, baseUrl: string): NextResponse | null {
// //   console.log('   🔍 checkRoleAccess:', { pathname, userRole });
  
// //   // Find matching route prefix
// //   for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
// //     // Use exact prefix matching - this is the key fix!
// //     const isMatch = pathname === routePrefix || pathname.startsWith(routePrefix + '/');
    
// //     console.log(`   📍 Testing route: ${routePrefix}`, {
// //       isMatch,
// //       allowedRoles,
// //       hasAccess: allowedRoles.includes(userRole)
// //     });
    
// //     if (isMatch) {
// //       // Check if user's role is allowed
// //       if (!allowedRoles.includes(userRole)) {
// //         console.log('   ❌ ACCESS DENIED!');
// //         console.log('   → User role:', userRole);
// //         console.log('   → Required roles:', allowedRoles);
        
// //         // Redirect to their own dashboard with unauthorized message
// //         const userDashboard = getRoleDashboard(userRole);
// //         const redirectUrl = new URL(userDashboard, baseUrl);
// //         redirectUrl.searchParams.set('error', 'unauthorized');
// //         redirectUrl.searchParams.set('message', 'You do not have access to that page');
        
// //         console.log('   → Redirecting to:', redirectUrl.toString());
        
// //         const response = NextResponse.redirect(redirectUrl);
// //         // Add cache control headers
// //         response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
// //         response.headers.set('Pragma', 'no-cache');
// //         response.headers.set('Expires', '0');
        
// //         return response;
// //       }
// //       console.log('   ✅ ACCESS GRANTED!');
// //       // Access granted - stop checking other routes
// //       return null;
// //     }
// //   }
  
// //   console.log('   ℹ️  No protected route matched, allowing access');
// //   return null;
// // }

// // // =============================================
// // // Get dashboard path for role
// // // =============================================
// // function getRoleDashboard(role: string): string {
// //   switch (role?.toUpperCase()) {
// //     case 'SELLER':
// //       return '/seller/dashboard';
// //     case 'ADMIN':
// //       return '/admin/dashboard';
// //     case 'ACCOUNTANT':
// //       return '/accountant/dashboard';
// //     case 'SUPERUSER':
// //       return '/admin/dashboard';
// //     default:
// //       return '/login';
// //   }
// // }

// // // =============================================
// // // Role-based redirect with optional callback
// // // =============================================
// // function getRoleBasedRedirect(role: string, callbackUrl?: string | null): string {
// //   const roleDashboard = getRoleDashboard(role);
  
// //   // If no callback, return role dashboard
// //   if (!callbackUrl) {
// //     return roleDashboard;
// //   }

// //   // Security: Prevent open redirects
// //   if (!callbackUrl.startsWith('/') || callbackUrl.startsWith('//')) {
// //     return roleDashboard;
// //   }

// //   // Check if callback URL is allowed for this role
// //   if (isRouteAllowedForRole(callbackUrl, role)) {
// //     return callbackUrl;
// //   }

// //   // Callback doesn't match role permissions, use role dashboard
// //   return roleDashboard;
// // }

// // // =============================================
// // // Check if a route is allowed for a role (FIXED)
// // // =============================================
// // function isRouteAllowedForRole(pathname: string, role: string): boolean {
// //   for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
// //     // Use exact prefix matching
// //     if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
// //       return allowedRoles.includes(role.toUpperCase());
// //     }
// //   }
// //   // If route is not in ROLE_ROUTES, allow access (public or unprotected)
// //   return true;
// // }

// // export const config = {
// //   matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
// // };




// // // // middleware.ts - DEBUG VERSION
// // // import { NextResponse } from 'next/server';
// // // import type { NextRequest } from 'next/server';
// // // import { auth } from '@/auth/auth';

// // // // Define protected routes and their allowed roles
// // // const ROLE_ROUTES: Record<string, string[]> = {
// // //   '/seller': ['SELLER', 'SUPERUSER'],
// // //   '/admin': ['ADMIN', 'SUPERUSER'],
// // //   '/accountant': ['ACCOUNTANT', 'SUPERUSER'],
// // //   '/user': ['SUPERUSER'],
// // // };

// // // // Public routes that don't require authentication
// // // const PUBLIC_ROUTES = ['/login'];

// // // export async function proxy(request: NextRequest) {
// // //   const { pathname, searchParams } = request.nextUrl;
  
// // //   // Skip API routes, static files, and auth routes
// // //   if (
// // //     pathname.startsWith('/api/') ||
// // //     pathname.startsWith('/_next') ||
// // //     pathname.startsWith('/favicon.ico') ||
// // //     pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js)$/)
// // //   ) {
// // //     return NextResponse.next();
// // //   }

// // //   const session = await auth();
// // //   const isLoggedIn = !!session;
// // //   const userRole = session?.user?.role?.toUpperCase();

// // //   // =============================================
// // //   // DEBUG LOGGING - Remove after fixing
// // //   // =============================================
// // //   // console.log('🔍 PROXY DEBUG:', {
// // //   //   pathname,
// // //   //   isLoggedIn,
// // //   //   userRole: userRole || 'NO ROLE',
// // //   //   sessionUserRole: session?.user?.role || 'NO ROLE IN SESSION',
// // //   //   fullUser: session?.user,
// // //   //   searchParams: Object.fromEntries(searchParams.entries()),
// // //   // });

// // //   // =============================================
// // //   // 1. Logged in + trying to access login page
// // //   // =============================================
// // //   if (isLoggedIn && PUBLIC_ROUTES.includes(pathname)) {
// // //     const callbackUrl = searchParams.get('callbackUrl');
    
// // //     // Don't redirect if coming from auth error
// // //     if (callbackUrl?.includes('/api/auth/error')) {
// // //       // console.log('⚠️ Auth error detected, allowing access to login');
// // //       return NextResponse.next();
// // //     }
    
// // //     // console.log('✅ User logged in, redirecting from login page');
// // //     // Role-based redirect with safe callback
// // //     const redirectUrl = getRoleBasedRedirect(userRole, callbackUrl);
// // //     // console.log('→ Redirecting to:', redirectUrl);
// // //     return NextResponse.redirect(new URL(redirectUrl, request.url));
// // //   }

// // //   // =============================================
// // //   // 2. Not logged in + trying to access protected route
// // //   // =============================================
// // //   if (!isLoggedIn && !PUBLIC_ROUTES.includes(pathname)) {
// // //     // console.log('⚠️ Not logged in, redirecting to login');
// // //     const loginUrl = new URL('/login', request.url);
// // //     if (!pathname.startsWith('/api/')) {
// // //       loginUrl.searchParams.set('callbackUrl', pathname);
// // //     }
// // //     return NextResponse.redirect(loginUrl);
// // //   }

// // //   // =============================================
// // //   // 3. Role-based route protection
// // //   // =============================================
// // //   if (isLoggedIn) {
// // //     // Skip role check if already on an error page (prevent redirect loops)
// // //     const hasErrorParam = searchParams.has('error');
    
// // //     // console.log('🔐 Checking role access:', { 
// // //     //   hasErrorParam, 
// // //     //   pathname, 
// // //     //   userRole,
// // //     //   willCheckAccess: !hasErrorParam 
// // //     // });
    
// // //     if (!hasErrorParam) {
// // //       const unauthorizedRedirect = checkRoleAccess(pathname, userRole, request.url);
// // //       if (unauthorizedRedirect) {
// // //         // console.log('❌ UNAUTHORIZED ACCESS DETECTED!');
// // //         // console.log('   User role:', userRole);
// // //         // console.log('   Attempted path:', pathname);
// // //         // console.log('   Redirecting with error');
// // //         return unauthorizedRedirect;
// // //       }
// // //       // console.log('✅ Role access granted');
// // //     } else {
// // //       // console.log('⏭️ Skipping role check (error param present)');
// // //     }
// // //   }

// // //   // =============================================
// // //   // 4. Root redirect based on role
// // //   // =============================================
// // //   if (pathname === '/') {
// // //     const redirectUrl = isLoggedIn 
// // //       ? getRoleDashboard(userRole)
// // //       : '/login';
// // //     // console.log('🏠 Root redirect to:', redirectUrl);
// // //     return NextResponse.redirect(new URL(redirectUrl, request.url));
// // //   }

// // //   // console.log('✅ Allowing access to:', pathname);
// // //   return NextResponse.next();
// // // }

// // // // =============================================
// // // // Check if user has access to the route
// // // // =============================================
// // // function checkRoleAccess(pathname: string, userRole: string, baseUrl: string): NextResponse | null {
// // //   // console.log('   🔍 checkRoleAccess called:', { pathname, userRole });
  
// // //   // Find matching route prefix
// // //   for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
// // //     if (pathname.startsWith(routePrefix)) {
// // //       // console.log('   📍 Matched route prefix:', routePrefix);
// // //       // console.log('   👥 Allowed roles:', allowedRoles);
// // //       // console.log('   👤 User role:', userRole);
// // //       // console.log('   ✓ Has access:', allowedRoles.includes(userRole));
      
// // //       // Check if user's role is allowed
// // //       if (!allowedRoles.includes(userRole)) {
// // //         // console.log('   ❌ ACCESS DENIED!');
// // //         // Redirect to their own dashboard with unauthorized message
// // //         const userDashboard = getRoleDashboard(userRole);
// // //         const redirectUrl = new URL(userDashboard, baseUrl);
// // //         redirectUrl.searchParams.set('error', 'unauthorized');
// // //         redirectUrl.searchParams.set('message', 'You do not have access to that page');
// // //         return NextResponse.redirect(redirectUrl);
// // //       }
// // //       break;
// // //     }
// // //   }
// // //   return null;
// // // }

// // // // =============================================
// // // // Get dashboard path for role
// // // // =============================================
// // // function getRoleDashboard(role: string): string {
// // //   // console.log('   🎯 getRoleDashboard for role:', role);
  
// // //   const dashboard = (() => {
// // //     switch (role?.toUpperCase()) {
// // //       case 'SELLER':
// // //         return '/seller/dashboard';
// // //       case 'ADMIN':
// // //         return '/admin/dashboard';
// // //       case 'ACCOUNTANT':
// // //         return '/accountant/dashboard';
// // //       case 'SUPERUSER':
// // //         return '/admin/dashboard';
// // //       default:
// // //         return '/login';
// // //     }
// // //   })();
  
// // //   // console.log('   → Dashboard:', dashboard);
// // //   return dashboard;
// // // }

// // // // =============================================
// // // // Role-based redirect with optional callback
// // // // =============================================
// // // function getRoleBasedRedirect(role: string, callbackUrl?: string | null): string {
// // //   const roleDashboard = getRoleDashboard(role);
  
// // //   // If no callback, return role dashboard
// // //   if (!callbackUrl) {
// // //     return roleDashboard;
// // //   }

// // //   // Security: Prevent open redirects
// // //   if (!callbackUrl.startsWith('/') || callbackUrl.startsWith('//')) {
// // //     return roleDashboard;
// // //   }

// // //   // Check if callback URL is allowed for this role
// // //   if (isRouteAllowedForRole(callbackUrl, role)) {
// // //     return callbackUrl;
// // //   }

// // //   // Callback doesn't match role permissions, use role dashboard
// // //   return roleDashboard;
// // // }

// // // // =============================================
// // // // Check if a route is allowed for a role
// // // // =============================================
// // // function isRouteAllowedForRole(pathname: string, role: string): boolean {
// // //   for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
// // //     if (pathname.startsWith(routePrefix)) {
// // //       return allowedRoles.includes(role.toUpperCase());
// // //     }
// // //   }
// // //   // If route is not in ROLE_ROUTES, allow access (public or unprotected)
// // //   return true;
// // // }

// // // export const config = {
// // //   matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
// // // };