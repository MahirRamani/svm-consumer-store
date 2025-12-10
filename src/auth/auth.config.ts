// auth.config.ts
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    // signOut: '/logout',
    // error: '/error',
    // verifyRequest: '/verify-request',
    // newUser: '/welcome'
  },
  callbacks: {
    // authorized({ auth, request: { nextUrl } }) {
    //   const isLoggedIn = !!auth?.user;
    //   const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
    //   const isOnAdmin = nextUrl.pathname.startsWith('/admin');
    //   const isOnTeacher = nextUrl.pathname.startsWith('/teacher');
    //   const isOnApi = nextUrl.pathname.startsWith('/api');
    //   const isOnAuth = nextUrl.pathname.startsWith('/login') || 
    //                    nextUrl.pathname.startsWith('/auth');
    //   const isPublic = nextUrl.pathname === '/' || 
    //                   nextUrl.pathname.startsWith('/public');

    //   // Allow public routes
    //   if (isPublic) return true;

    //   // Redirect logged in users away from auth pages
    //   if (isLoggedIn && isOnAuth) {
    //     return Response.redirect(new URL('/dashboard', nextUrl));
    //   }

    //   // Protect dashboard routes
    //   if (isOnDashboard || isOnTeacher) {
    //     if (!isLoggedIn) return false;
        
    //     // Check if user is still active
    //     if (auth.user && 'isActive' in auth.user && !auth.user.isActive) {
    //       return Response.redirect(new URL('/account-disabled', nextUrl));
    //     }
        
    //     return true;
    //   }

    //   // Protect admin routes
    //   if (isOnAdmin) {
    //     if (!isLoggedIn) return false;
        
    //     if (auth.user && 'role' in auth.user && !['SUPERUSER', 'ADMIN', 'PRINCIPAL'].includes(auth.user.role as string)) {
    //       return Response.redirect(new URL('/unauthorized', nextUrl));
    //     }
        
    //     return true;
    //   }

    //   // Allow API routes (handled separately in API middleware)
    //   if (isOnApi) {
    //     return true;
    //   }

    //   // Allow auth pages for non-logged in users
    //   if (!isLoggedIn && isOnAuth) {
    //     return true;
    //   }

    //   return true;
    // },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;

// import type { NextAuthConfig } from 'next-auth';

// export const authConfig = {
//   pages: {
//     signIn: '/login',
//     signOut: '/logout',
//     error: '/error',
//     verifyRequest: '/verify-request',
//     newUser: '/welcome'
//   },
//   callbacks: {
//     authorized({ auth, request: { nextUrl } }) {
//       const isLoggedIn = !!auth?.user;
//       const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
//       const isOnAdmin = nextUrl.pathname.startsWith('/admin');
//       const isOnApi = nextUrl.pathname.startsWith('/api');
//       const isOnAuth = nextUrl.pathname.startsWith('/login');

//       if (isOnDashboard || isOnAdmin) {
//         if (isLoggedIn) return true;
//         return false; // Redirect unauthenticated users to login page
//       } else if (isLoggedIn && isOnAuth) {
//         return Response.redirect(new URL('/dashboard', nextUrl));
//       }
      
//       return true;
//     },
//   },
//   providers: [], // Add providers with an empty array for now
// } satisfies NextAuthConfig;