// lib/validations/student.ts
import { z } from 'zod';

export const createStudentSchema = z.object({
  rollNumber: z.string().trim().min(0, 'Roll number is required'),
  id: z.string().trim().regex(/^\d+$/, 'ID must be numbers only').optional(),
  name: z.string().trim().min(1, 'Name is required'),
  mobileNo: z.string().trim().optional(),
  standard: z.string().trim().min(1, 'Standard is required'),
  year: z.coerce.number().int().min(2000).max(2100),
  balance: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateStudentSchema = createStudentSchema.partial().omit({ rollNumber: true, balance: true });;

export const getStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  sortBy: z.enum(['name', 'rollNumber', 'createdAt']).default('rollNumber'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
  standard: z.string().optional(),
  year: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CreateStudentDto = z.infer<typeof createStudentSchema>;
export type UpdateStudentDto = z.infer<typeof updateStudentSchema>;
export type GetStudentsQueryDto = z.infer<typeof getStudentsQuerySchema>;