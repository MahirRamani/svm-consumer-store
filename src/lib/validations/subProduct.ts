// lib/validations/subProduct.ts
import { z } from 'zod';
import { objectIdSchema } from '../api/validation-helpers';

export const createSubProductSchema = z.object({
  productId: objectIdSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Variant name is required')
    .max(100, 'Variant name cannot exceed 100 characters'),
  description: z.string().trim().max(500).optional(),
  priority: z.coerce.number().int().min(0).default(0),
  size: z.string().trim().max(50).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).default(10),
  weight: z.string().trim().max(50).optional(),
  volume: z.string().trim().max(50).optional(),
  barcode: z.string().trim().max(100).optional(),
  imageURL: z.string().trim().url('Must be a valid URL').optional(),
  isActive: z.boolean().default(true),
});

export const updateSubProductSchema = createSubProductSchema.partial();

export const getSubProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  sortBy: z.enum(['name', 'priority', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().optional(),
  productId: objectIdSchema.optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export type CreateSubProductDto = z.infer<typeof createSubProductSchema>;
export type UpdateSubProductDto = z.infer<typeof updateSubProductSchema>;
export type GetSubProductsQueryDto = z.infer<typeof getSubProductsQuerySchema>;