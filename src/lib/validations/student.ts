// lib/validations/student.ts
import { z } from 'zod';
import { STANDARDS, YEARS } from '@/lib/config/constants';

export const createStudentSchema = z.object({
  rollNumber: z.number()
  .refine((n) => Number.isInteger(n), { error: "Roll number must be an integer" })
  .refine((n) => n >= 100 && n <= 9999, { error: "Roll number must be 3 to 4 digits" }),
  id: z.number()
  .refine((n) => Number.isInteger(n), { error: "ID must be an integer" })
  .refine((n) => n > 0, { error: "ID must be greater than 0" }),
  name: z.string().trim().min(1, 'Name is required'),
  standard: z.number()
  .refine((n) => STANDARDS.includes(n as (typeof STANDARDS)[number]), {
    error: "Invalid standard selected",
  }),
  year: z.string()
    .trim()
    .min(1, "Year is required")
    .refine((val) => YEARS.includes(val), {
      error: "Invalid year selected",
    }),
  isActive: z.boolean().default(true),
  mobileNo: z.string().trim().optional().refine((val) => !val || /^[0-9]{10}$/.test(val), {
    error: "Mobile number must be 10 digits",
  }),
});

export const updateStudentSchema = createStudentSchema.partial().extend({ isActive: z.boolean().optional() });;

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