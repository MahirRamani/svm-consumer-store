// lib/validations/user.ts
import { z } from 'zod';
import { isValidRole, type AppRole } from '@/lib/config/rolesConfig';
import { isValidTab, type TabId } from '@/lib/config/tabs-registry';

// Create User Schema
export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .trim()
    .regex(/^[A-Za-z0-9._-]+$/, 'Username can only contain lowercase letters, numbers, dots, hyphens, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.string().refine(isValidRole, { message: 'Invalid role' }),
  allowedTabs: z
    .array(z.string().refine(isValidTab, { message: 'Invalid tab' }))
    .min(0).optional(),
  isActive: z.boolean().default(true),
});

// Update User Schema (all fields optional except password must remain strong if provided)
export const updateUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .trim()
    .regex(/^[A-Za-z0-9._-]+$/, 'Username can only contain lowercase letters, numbers, dots, hyphens, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.string().refine(isValidRole, { message: 'Invalid role' }),
  allowedTabs: z
    .array(z.string().refine(isValidTab, { message: 'Invalid tab' }))
    .optional(),
  isActive: z.boolean().optional(),
});

// Query Schema for listing users
export const getUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['username', 'createdAt', 'role']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  role: z.string().refine(isValidRole, { message: 'Invalid role' }).optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type GetUsersQueryDto = z.infer<typeof getUsersQuerySchema>;