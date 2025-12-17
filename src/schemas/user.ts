// FILE: validations/user.ts

import { z } from "zod";
import { ALL_TAB_IDS } from "@/lib/config/tabs-registry";
import { ROLES } from "@/lib/config/rolesConfig";

const roleIds = Object.values(ROLES).map(r => r.id) as [string, ...string[]];

export const CreateUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  role: z.enum(roleIds),
  allowedTabs: z.array(z.enum(ALL_TAB_IDS)).min(1, "User must have at least one allowed tab."),
});

// New schema for updating users. All fields are optional.
export const UpdateUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long.").optional(),
  role: z.enum(roleIds).optional(),
  allowedTabs: z.array(z.enum(ALL_TAB_IDS)).min(1, "User must have at least one allowed tab.").optional(),
});

export type CreateUserValues = z.infer<typeof CreateUserSchema>;
export type UpdateUserValues = z.infer<typeof UpdateUserSchema>;






// // FILE: validations/user.ts

// import { z } from "zod";
// import { ALL_TAB_IDS } from "@/lib/config/dashboardConfig";
// import { ROLES } from "@/lib/config/rolesConfig";

// const roleIds = Object.values(ROLES).map(r => r.id) as [string, ...string[]];

// export const CreateUserSchema = z.object({
//   username: z.string().min(3, "Username must be at least 3 characters long."),
//   password: z.string().min(6, "Password must be at least 6 characters long."),
//   role: z.enum(roleIds),
//   allowedTabs: z.array(z.enum(ALL_TAB_IDS)).min(1, "User must have at least one allowed tab."),
// });

// // New schema for updating users. All fields are optional.
// export const UpdateUserSchema = z.object({
//   username: z.string().min(3, "Username must be at least 3 characters long.").optional(),
//   role: z.enum(roleIds).optional(),
//   allowedTabs: z.array(z.enum(ALL_TAB_IDS)).min(1, "User must have at least one allowed tab.").optional(),
// });

// export type CreateUserValues = z.infer<typeof CreateUserSchema>;
// export type UpdateUserValues = z.infer<typeof UpdateUserSchema>;