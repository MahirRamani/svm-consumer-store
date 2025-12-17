import { ROLES } from "@/lib/config/rolesConfig";

// Dynamically creates a union type of all possible role IDs (e.g., "employee" | "accountant" | ...)
export type AppRole = (typeof ROLES)[keyof typeof ROLES]["id"];

// The primary User type used across the frontend
export interface User {
  _id: string;
  username: string;
  role: AppRole;
  allowedTabs: string[];
  createdAt?: string; // Date is serialized as a string over JSON
  createdBy?: string;
}