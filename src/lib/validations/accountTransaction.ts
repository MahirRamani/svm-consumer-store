// lib/validations/accountTransaction.ts
import { z } from 'zod';
import { objectIdSchema } from '@/lib/api/validation-helpers';

export const createAccountTransactionSchema = z.object({
  accountId: objectIdSchema,
  type: z.enum(['CREDIT', 'DEBIT'], {
    error: 'Transaction type is required',
  }),
  amount: z.coerce
    .number()
    .positive('Amount must be greater than 0'),
  note: z
    .string()
    .trim()
    .max(500, 'Note cannot exceed 500 characters')
    .optional()
    .default(''),
  billUrl: z
    .url({ message: "Invalid URL" })
    .trim()
    .max(2048, 'URL cannot exceed 2048 characters')
    .nullable()
    .optional(),
  enteredAt: z.coerce.date().optional().default(() => new Date()),
});

export const updateAccountTransactionSchema = z.object({
  note: z
    .string()
    .trim()
    .max(500, 'Note cannot exceed 500 characters')
    .optional(),
  billUrl: z
    .url({ message: "Invalid URL" })
    .trim()
    .max(2048, 'URL cannot exceed 2048 characters')
    .nullable()
    .optional(),
});

export const getAccountTransactionsQuerySchema = z.object({
  accountId: objectIdSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'enteredAt', ]).default('enteredAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  search: z.string().optional(),
});

export const getAccountTransactionsSummaryQuerySchema = z.object({
  accountId: objectIdSchema,
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateAccountTransactionDto = z.infer<typeof createAccountTransactionSchema>;
export type UpdateAccountTransactionDto = z.infer<typeof updateAccountTransactionSchema>;
export type GetAccountTransactionsQueryDto = z.infer<typeof getAccountTransactionsQuerySchema>;
export type GetAccountTransactionsSummaryQueryDto = z.infer<typeof getAccountTransactionsSummaryQuerySchema>;



// // lib/validations/accountTransaction.ts
// import { z } from 'zod';
// import { objectIdSchema } from '@/lib/api/validation-helpers';

// export const createAccountTransactionSchema = z.object({
//   accountId: objectIdSchema,
//   type: z.enum(['CREDIT', 'DEBIT'], {
//     error: 'Transaction type is required',
//   }),
//   amount: z.coerce
//     .number()
//     .positive('Amount must be greater than 0'),
//   note: z
//     .string()
//     .trim()
//     .max(500, 'Note cannot exceed 500 characters')
//     .optional()
//     .default(''),
//   billUrl: z
//     .url({ message: "Invalid URL" })
//     .trim()
//     .max(2048, 'URL cannot exceed 2048 characters')
//     .nullable()
//     .optional(),
//   enteredAt: z.coerce.date().optional().default(() => new Date()),
// });

// export const updateAccountTransactionSchema = z.object({
//   note: z
//     .string()
//     .trim()
//     .max(500, 'Note cannot exceed 500 characters')
//     .optional(),
//   billUrl: z
//     .url({ message: "Invalid URL" })
//     .trim()
//     .max(2048, 'URL cannot exceed 2048 characters')
//     .nullable()
//     .optional(),
// });

// export const getAccountTransactionsQuerySchema = z.object({
//   accountId: objectIdSchema,
//   page: z.coerce.number().int().min(1).default(1),
//   limit: z.coerce.number().int().min(1).max(100).default(20),
//   sortBy: z.enum(['enteredAt', 'amount', 'createdAt']).default('enteredAt'),
//   sortOrder: z.enum(['asc', 'desc']).default('desc'),
//   type: z.enum(['CREDIT', 'DEBIT']).optional(),
//   startDate: z.coerce.date().optional(),
//   endDate: z.coerce.date().optional(),
//   includeDeleted: z.coerce.boolean().default(false),
//   search: z.string().optional(),
// });

// export const getAccountTransactionsSummaryQuerySchema = z.object({
//   accountId: objectIdSchema,
//   startDate: z.coerce.date().optional(),
//   endDate: z.coerce.date().optional(),
// });

// export type CreateAccountTransactionDto = z.infer<typeof createAccountTransactionSchema>;
// export type UpdateAccountTransactionDto = z.infer<typeof updateAccountTransactionSchema>;
// export type GetAccountTransactionsQueryDto = z.infer<typeof getAccountTransactionsQuerySchema>;
// export type GetAccountTransactionsSummaryQueryDto = z.infer<typeof getAccountTransactionsSummaryQuerySchema>;