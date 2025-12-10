// lib/api/validation-helpers.ts
import { z } from 'zod';
import { ApiError } from './base-handler';

// =============================================
// Validate Request Body
// =============================================
export async function validateBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<z.infer<T>> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error; // Will be caught by withErrorHandler
    }
    throw new ApiError('Invalid request body', 400);
  }
}

// =============================================
// Validate Query Parameters
// =============================================
export function validateQuery<T extends z.ZodType>(
  req: Request,
  schema: T
): z.infer<T> {
  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams.entries());
  
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error; // Will be caught by withErrorHandler
    }
    throw new ApiError('Invalid query parameters', 400);
  }
}

// =============================================
// Validate Route Parameters (e.g., ID)
// =============================================
export function validateParams<T extends z.ZodType>(
  params: Record<string, string | string[] | undefined>,
  schema: T
): z.infer<T> {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error;
    }
    throw new ApiError('Invalid route parameters', 400);
  }
}

// =============================================
// Common Validation Schemas
// =============================================
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Optional pagination (for dropdowns/selects - NO pagination needed)
export const optionalPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});