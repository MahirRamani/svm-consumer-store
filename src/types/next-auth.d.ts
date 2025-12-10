// FILE: src/types/next-auth.d.ts

import NextAuth, { type DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import { AppRole } from "."; // Assuming you have AppRole in src/types/index.ts

declare module "next-auth" {
    interface User {
        id?: string;
        username?: string;
        role?: AppRole;
        allowedTabs?: string[];
        isActive?: boolean;
    }

    interface Session {
        user: {
            id?: string;
            username?: string;
            role?: AppRole;
            allowedTabs?: string[];
            isActive?: boolean;
        } & DefaultSession["user"];
    }

    // Augment the default User type returned by the provider
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string;
        username?: string;
        role?: AppRole;
        allowedTabs?: string[];
        isActive?: boolean;
    }
}