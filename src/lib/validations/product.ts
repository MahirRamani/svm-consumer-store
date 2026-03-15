// lib/validations/product.ts
import { z } from 'zod';
import { objectIdSchema } from '../api/validation-helpers';

// =============================================
// Create Product Schema
// =============================================
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
  
  priority: z
    .coerce
    .number()
    .int('Priority must be a whole number')
    .min(0, 'Priority cannot be negative')
    .default(0),
  
  isActive: z.boolean().default(true),
  
  // Merged from SubProduct
  imageURL: z
    .url({ message: "Must be a valid URL" })
    .trim()
    .optional()
    .or(z.literal('')),
  
  size: z
    .string()
    .trim()
    .max(50, 'Size cannot exceed 50 characters')
    .optional(),
  
  weight: z
    .string()
    .trim()
    .max(50, 'Weight cannot exceed 50 characters')
    .optional(),
  
  volume: z
    .string()
    .trim()
    .max(50, 'Volume cannot exceed 50 characters')
    .optional(),
  
  barcode: z
    .string()
    .trim()
    .max(100, 'Barcode cannot exceed 100 characters')
    .optional(),
  
  lowStockThreshold: z
    .coerce
    .number()
    .int('Threshold must be a whole number')
    .min(0, 'Threshold cannot be negative')
    .default(10),
});

// =============================================
// Update Product Schema
// =============================================
export const updateProductSchema = createProductSchema.partial();

// =============================================
// Get Products Query Schema
// =============================================
export const getProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  
  sortBy: z
    .enum(['name', 'priority', 'createdAt', 'size', 'lowStockThreshold'])
    .default('name'),
  
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  
  search: z.string().trim().optional(),
  
  categoryId: objectIdSchema.optional(),
  
  includeInactive: z.coerce.boolean().default(false),
  
  // Filter by size
  size: z.string().trim().optional(),
  
  // Filter by low stock status
  lowStockOnly: z.coerce.boolean().default(false),
});

// =============================================
// Type Exports
// =============================================
export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type GetProductsQueryDto = z.infer<typeof getProductsQuerySchema>;


// // lib/validations/product.ts
// import { z } from 'zod';
// import { objectIdSchema } from '../api/validation-helpers';

// export const createProductSchema = z.object({
//   name: z
//     .string()
//     .trim()
//     .min(1, 'Product name is required')
//     .max(150, 'Product name cannot exceed 150 characters'),
//   description: z
//     .string()
//     .trim()
//     .max(1000, 'Description cannot exceed 1000 characters')
//     .optional(),
//   categoryId: objectIdSchema,
//   priority: z.coerce.number().int().min(0).default(0),
//   isActive: z.boolean().default(true),
// });

// export const updateProductSchema = createProductSchema.partial();

// export const getProductsQuerySchema = z.object({
//   page: z.coerce.number().int().min(1).default(1),
//   limit: z.coerce.number().int().min(1).max(100).default(100),
//   sortBy: z.enum(['name', 'priority', 'createdAt']).default('name'),
//   sortOrder: z.enum(['asc', 'desc']).default('asc'),
//   search: z.string().trim().optional(),
//   categoryId: objectIdSchema.optional(),
//   includeInactive: z.coerce.boolean().default(false),
//   countOnly: z.coerce.boolean().default(false),
// });

// export type CreateProductDto = z.infer<typeof createProductSchema>;
// export type UpdateProductDto = z.infer<typeof updateProductSchema>;
// export type GetProductsQueryDto = z.infer<typeof getProductsQuerySchema>;