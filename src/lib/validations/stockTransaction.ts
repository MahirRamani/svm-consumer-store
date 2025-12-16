// lib/validations/stockTransaction.ts
import { z } from 'zod';
import { objectIdSchema } from '../api/validation-helpers';

export const createStockTransactionSchema = z.object({
  subProductId: objectIdSchema,
  transactionType: z.enum(['Buy', 'Sell', 'Adjustment']),
  buyingPrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  initialQuantity: z.coerce.number().int().positive(),
  quantityLeft: z.coerce.number().int().min(0).optional(),
  reason: z.enum([
    'purchase',
    'sale',
    'return',
    'damage',
    'expired',
    'adjustment',
    '',
  ]).optional(),
  description: z.string().min(3).max(500).optional(),
  date: z.coerce.date().optional(),
  createdBy: objectIdSchema.optional(),
})
  .refine(
    (data) => {
      if (data.transactionType === 'Buy') {
        return typeof data.buyingPrice === 'number';
      }
      return true;
    },
    { message: "Buying price is required for 'Buy' transactions", path: ['buyingPrice'] }
  )
  .refine(
    (data) => {
      if (data.transactionType === 'Sell') {
        return typeof data.sellingPrice === 'number';
      }
      return true;
    },
    { message: "Selling price is required for 'Sell' transactions", path: ['sellingPrice'] }
  );

export const updateStockTransactionSchema = createStockTransactionSchema.partial();

export const getStockTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  subProductId: objectIdSchema.optional(),
  transactionType: z.enum(['Buy', 'Sell', 'Adjustment']).optional(),
});

export type CreateStockTransactionDto = z.infer<typeof createStockTransactionSchema>;
export type UpdateStockTransactionDto = z.infer<typeof updateStockTransactionSchema>;
export type GetStockTransactionsQueryDto = z.infer<typeof getStockTransactionsQuerySchema>;