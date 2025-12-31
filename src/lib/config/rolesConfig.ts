export const ROLES = {
  ADMIN: { id: "admin", name: "ADMIN" },
  SELLER: { id: "seller", name: "SELLER" },
  ACCOUNTANT: { id: "accountant", name: "ACCOUNTANT" },
  SUPERUSER: { id: "superuser", name: "SUPERUSER" },
} as const;

// Auto-generated type from roles
export type AppRole = (typeof ROLES)[keyof typeof ROLES]['id'];

// Auto-generated array of all role IDs
export const ALL_ROLE_IDS = Object.values(ROLES).map((role) => role.id);

// Helper to validate role at runtime
export function isValidRole(role: string): role is AppRole {
  return ALL_ROLE_IDS.includes(role as AppRole);
}