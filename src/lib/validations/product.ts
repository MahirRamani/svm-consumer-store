// lib/validations/product.ts
import { z } from 'zod';
import { objectIdSchema } from '../api/validation-helpers';

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name is required')
    .max(150, 'Product name cannot exceed 150 characters'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description cannot exceed 1000 characters')
    .optional(),
  categoryId: objectIdSchema,
  priority: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const getProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  sortBy: z.enum(['name', 'priority', 'createdAt']).default('priority'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().optional(),
  categoryId: objectIdSchema.optional(),
  includeInactive: z.coerce.boolean().default(false),
  countOnly: z.coerce.boolean().default(false),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type GetProductsQueryDto = z.infer<typeof getProductsQuerySchema>;