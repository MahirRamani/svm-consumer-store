// lib/validations/account.ts
import { z } from 'zod';
import { objectIdSchema } from '../api/validation-helpers';

export const createAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Account name is required')
    .max(100, 'Account name cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .default(''),
  isActive: z.boolean().default(true),
  ownerId: objectIdSchema.optional(), // Master can specify owner
});

export const updateAccountSchema = createAccountSchema.partial();

export const getAccountsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'createdAt', 'currentBalance']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  includeInactive: z.coerce.boolean().default(false),
  search: z.string().optional(),
  countOnly: z.coerce.boolean().default(false),
  ownerId: objectIdSchema.optional(),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
export type GetAccountsQueryDto = z.infer<typeof getAccountsQuerySchema>;