// hooks/use-auth.ts
"use client";

import { useSession } from "next-auth/react";
import type { AppRole } from "@/lib/config/rolesConfig";

export function useAuth() {
  const { data: session, status, update } = useSession();

  return {
    user: session?.user ? {
      id: session.user.id!,
      username: session.user.username,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      role: session.user.role,
      allowedTabs: session.user.allowedTabs,
      isActive: session.user.isActive,
    } : null,
    session,
    status,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    isUnauthenticated: status === "unauthenticated",
    update, // For updating session if needed
  };
}

// Type-safe return type for the hook
export type UseAuthReturn = {
  user: {
    id: string;
    username?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    role?: AppRole;
    allowedTabs?: string[];
    isActive?: boolean;
  } | null;
  session: ReturnType<typeof useSession>["data"];
  status: "loading" | "authenticated" | "unauthenticated";
  isLoading: boolean;
  isAuthenticated: boolean;
  isUnauthenticated: boolean;
  update: ReturnType<typeof useSession>["update"];
};