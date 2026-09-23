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
   
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;