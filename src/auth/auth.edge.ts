// auth/auth.edge.ts (new file - Edge-safe exports)
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// This is ONLY for middleware - no Mongoose imports
export const { auth: authEdge } = NextAuth({
  ...authConfig,
  providers: [], // Empty providers for edge
});