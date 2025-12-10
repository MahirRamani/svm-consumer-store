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


// // proxy.ts (Enhanced with Callback)
// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';
// import { auth } from '@/auth/auth';

// export async function proxy(request: NextRequest) {
//   const { pathname, searchParams } = request.nextUrl;
//   const session = await auth();
//   const isLoggedIn = !!session;

//   // console.log("session", session);

//   if (!isLoggedIn && pathname !== '/login') {
//     const loginUrl = new URL('/login', request.url);
//     // Save the intended destination
//     loginUrl.searchParams.set('callbackUrl', pathname);
//     return NextResponse.redirect(loginUrl);
//   }

//   // Skip API routes
//   if (pathname.startsWith('/api')) {
//     return NextResponse.next();
//   }

//   // Not logged in + trying to access protected route
//   if (!isLoggedIn && pathname.startsWith('/user')) {
//     const loginUrl = new URL('/login', request.url);
//     // Save the intended destination
//     loginUrl.searchParams.set('callbackUrl', pathname);
//     return NextResponse.redirect(loginUrl);
//   }

//   // Logged in + trying to access login
//   if (isLoggedIn && pathname === '/login') {
//     // Check if there's a callback URL
//     const callbackUrl = searchParams.get('callbackUrl');
//     const redirectUrl = callbackUrl && callbackUrl.startsWith('/user') 
//       ? callbackUrl 
//       : '/user/dashboard';
//     return NextResponse.redirect(new URL(redirectUrl, request.url));
//   }

//   // Root redirect
//   if (pathname === '/') {
//     const redirectUrl = isLoggedIn ? '/user/dashboard' : '/login';
//     return NextResponse.redirect(new URL(redirectUrl, request.url));
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
// };





// // import { NextResponse } from 'next/server';
// // import type { NextRequest } from 'next/server';
// // import { auth } from '@/auth/auth';

// // // export const runtime = 'nodejs';

// // // IMPORTANT: Function must be named 'proxy', not 'middleware'
// // export async function proxy(request: NextRequest) {

// //   const { pathname } = request.nextUrl;
  
// //   // Don't redirect if already on login page to avoid infinite loop
// //   // if (pathname === '/login') {
// //   //   return NextResponse.next();
// //   // }

// //   // return NextResponse.redirect(new URL('/login', request.url));
  
// //   const session = await auth(); // Get the session object

// //   console.log("session", session);

// //   const isLoggedIn = !!session;
  

// //   // 1. If user is not logged in and is trying to access a protected route, redirect to /login
// //   // if (!isLoggedIn && pathname.startsWith('/user')) { // Example: protecting '/dashboard'
// //   //   return NextResponse.redirect(new URL('/login', request.url));
// //   // }

// //   // // 2. If user is logged in and tries to access the login page, redirect to the dashboard
// //   // if (isLoggedIn && pathname === '/login') {
// //   //   return NextResponse.redirect(new URL('/user', request.url));
// //   // }

// //   // 3. Otherwise, continue to the requested page
// //   // return NextResponse.next();
// // }

// // // Configure a matcher to specify which routes should be processed by the proxy
// // export const config = {
// //   matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
// // };