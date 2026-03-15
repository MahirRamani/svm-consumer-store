export const ROLES = {
  SELLER: { id: "SELLER", name: "SELLER" },
  ADMIN: { id: "ADMIN", name: "ADMIN" },
  ACCOUNTANT: { id: "ACCOUNTANT", name: "ACCOUNTANT" },
  SUPERUSER: { id: "SUPERUSER", name: "SUPERUSER" },
} as const;

// Auto-generated type from roles
export type AppRole = Uppercase<(typeof ROLES)[keyof typeof ROLES]['id']>;

// Auto-generated array of all role IDs
export const ALL_ROLE_IDS = Object.values(ROLES).map((role) => role.id);

// Helper to validate role at runtime
export function isValidRole(role: string): role is AppRole {
  return ALL_ROLE_IDS.includes(role as AppRole);
}