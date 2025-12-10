// lib/api/auth-helpers.ts
import { auth } from '@/auth/auth';
import { errorResponse } from './base-handler';
import type { NextResponse } from 'next/server';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export interface AuthContext {
  user: AuthUser;
}

// Type for route params (dynamic routes like [id])
type RouteParams<T = Record<string, string>> = { params: Promise<T> };

// =============================================
// Require Authentication HOF (supports optional route params)
// =============================================
export function withAuth<TParams = Record<string, string>>(
  handler: (
    req: Request,
    context: AuthContext,
    routeContext?: RouteParams<TParams>
  ) => Promise<NextResponse>
) {
  return async (
    req: Request,
    routeContext?: RouteParams<TParams>
  ): Promise<NextResponse> => {
    const session = await auth();

    if (!session?.user) {
      return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
    }

    const authContext: AuthContext = {
      user: session.user as AuthUser,
    };

    return handler(req, authContext, routeContext);
  };
}

// =============================================
// Role-Based Access Control HOF (supports optional route params)
// =============================================
export function withRole(allowedRoles: string[]) {
  return function <TParams = Record<string, string>>(
    handler: (
      req: Request,
      context: AuthContext,
      routeContext?: RouteParams<TParams>
    ) => Promise<NextResponse>
  ) {
    return async (
      req: Request,
      routeContext?: RouteParams<TParams>
    ): Promise<NextResponse> => {
      const session = await auth();

      if (!session?.user) {
        return errorResponse('Authentication required', 401, 'UNAUTHORIZED');
      }

      if (!allowedRoles.includes(session.user.role)) {
        return errorResponse('Insufficient permissions', 403, 'FORBIDDEN');
      }

      const authContext: AuthContext = {
        user: session.user as AuthUser,
      };

      return handler(req, authContext, routeContext);
    };
  };
}

// =============================================
// Get Current User Helper
// =============================================
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await auth();
  return session?.user as AuthUser | null;
}

// =============================================
// Require Current User (throws if not authenticated)
// =============================================
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}


// // lib/api/auth-helpers.ts
// import { auth } from '@/auth';
// import { errorResponse } from './base-handler';
// import type { NextResponse } from 'next/server';

// export interface AuthUser {
//   id: string;
//   username: string;
//   role: string;
//   allowedTabs?: string[];
// }

// export interface AuthContext {
//   user: AuthUser;
// }

// // =============================================
// // Require Authentication HOF
// // =============================================
// export function withAuth<T extends any[]>(
//   handler: (req: Request, context: AuthContext, ...args: T) => Promise<NextResponse>
// ) {
//   return async (req: Request, ...args: T): Promise<NextResponse> => {
//     const session = await auth();
    
//     if (!session?.user) {
//       return errorResponse(
//         'Authentication required',
//         401,
//         'UNAUTHORIZED'
//       );
//     }

//     const authContext: AuthContext = {
//       user: session.user as AuthUser,
//     };

//     return handler(req, authContext, ...args);
//   };
// }

// // =============================================
// // Role-Based Access Control HOF
// // =============================================
// export function withRole(allowedRoles: string[]) {
//   return function <T extends any[]>(
//     handler: (req: Request, context: AuthContext, ...args: T) => Promise<NextResponse>
//   ) {
//     return async (req: Request, ...args: T): Promise<NextResponse> => {
//       const session = await auth();
      
//       if (!session?.user) {
//         return errorResponse(
//           'Authentication required',
//           401,
//           'UNAUTHORIZED'
//         );
//       }

//       if (!allowedRoles.includes(session.user.role)) {
//         return errorResponse(
//           'Insufficient permissions',
//           403,
//           'FORBIDDEN'
//         );
//       }

//       const authContext: AuthContext = {
//         user: session.user as AuthUser,
//       };

//       return handler(req, authContext, ...args);
//     };
//   };
// }

// // =============================================
// // Get Current User Helper
// // =============================================
// export async function getCurrentUser(): Promise<AuthUser | null> {
//   const session = await auth();
//   return session?.user as AuthUser | null;
// }

// // =============================================
// // Require Current User (throws if not authenticated)
// // =============================================
// export async function requireUser(): Promise<AuthUser> {
//   const user = await getCurrentUser();
//   if (!user) {
//     throw new Error('UNAUTHORIZED');
//   }
//   return user;
// }