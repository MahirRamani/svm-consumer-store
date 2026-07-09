// auth/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User } from '@/models';
import connectDB from '@/lib/config/db';
import type { AppRole } from '@/lib/config/rolesConfig';
import type { TabId } from '@/lib/config/tabs-registry';

// ============================================================================
// Helper: Get User by Username
// ============================================================================
async function getUserByUsername(username: string) {
  try {
    await connectDB();

    const user = await User.findOne({
      username: username,
      isActive: true,
    })
      .select('+password') // Include password for verification
      .lean();

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

// ============================================================================
// NextAuth Configuration
// ============================================================================
export const { auth, signIn, signOut, handlers } = NextAuth({
  trustHost: true,
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Validate credentials
        const parsedCredentials = z
          .object({
            username: z
              .string()
              .min(3, 'Username must be at least 3 characters')
              .trim(),
            password: z.string().min(6, 'Password must be at least 6 characters'),
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const { username, password } = parsedCredentials.data;

        // Get user from database
        const user = await getUserByUsername(username);

        if (!user) {
          return null;
        }

        // Verify password
        const passwordsMatch = await bcrypt.compare(password, user.password);

        if (!passwordsMatch) {
          return null;
        }

        // Return user object (without password)
        return {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in - save user data to token
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.isActive = user.isActive;
      }

      // Update session trigger (e.g., when user data changes)
      if (trigger === 'update' && session) {
        token = { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      // Add user data to session
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as AppRole;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
    // async authorized({ auth, request: { nextUrl } }) {
    //   const isLoggedIn = !!auth?.user;
    //   const isOnAdmin = nextUrl.pathname.startsWith('/admin');
    //   const isOnApi = nextUrl.pathname.startsWith('/api');
    //   const isOnAuth = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/auth');
    //   const isPublic = nextUrl.pathname === '/';

    //   // Allow public routes
    //   if (isPublic) return true;

    //   // Redirect logged-in users away from auth pages
    //   if (isLoggedIn && isOnAuth) {
    //     return Response.redirect(new URL('/admin/dashboard', nextUrl));
    //   }

    //   // Protect admin routes
    //   if (isOnAdmin) {
    //     if (!isLoggedIn) return false;

    //     // Check if user is still active
    //     if (!auth.user.isActive) {
    //       return Response.redirect(new URL('/account-disabled', nextUrl));
    //     }

    //     return true;
    //   }

    //   // Allow API routes (they handle their own auth)
    //   if (isOnApi) {
    //     return true;
    //   }

    //   // Allow auth pages for non-logged-in users
    //   if (!isLoggedIn && isOnAuth) {
    //     return true;
    //   }

    //   return true;
    // },
  },
  events: {
    async signIn({ user }) {
      console.log(`✅ User signed in: ${user.username}`);
    },
    async signOut(message) {
      if ('token' in message && message.token) {
        console.log(`🚪 User signed out: ${message.token.username} at ${new Date().toISOString()}`);
      }
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
});