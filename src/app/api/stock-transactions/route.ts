// app/api/stock-transactions/route.ts
import connectDB from '@/lib/config/db';
import { StockTransaction, type IStockTransaction } from '@/models/StockTransaction';
import { withErrorHandler, successResponse, paginatedResponse } from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import {
  createStockTransactionSchema,
  getStockTransactionsQuerySchema,
} from '@/lib/validations/stockTransaction';
import type { FilterQuery } from 'mongoose';

// =============================================
// GET - List Stock Transactions
// =============================================
const getStockTransactionsHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getStockTransactionsQuerySchema);
  const { page, limit, sortBy, sortOrder, productId, categoryId, stockType } = query;

  // Build filter
  const filter: FilterQuery<IStockTransaction> = {};
  
  if (productId) {
    filter.productId = productId;
  }
  if (categoryId) {
    filter.categoryId = categoryId;
  }
  if (stockType) {
    filter.stockType = stockType;
  }

  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === 'desc' ? -1 : 1,
  };

  const [transactions, totalCount] = await Promise.all([
    StockTransaction.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username')
      .populate('productId', 'name size imageURL')
      .populate('categoryId', 'name')
      .lean(),
    StockTransaction.countDocuments(filter),
  ]);

  return paginatedResponse('transactions', transactions, { page, limit, totalCount });
};

// =============================================
// POST - Create Stock Transaction
// =============================================
const createStockTransactionHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const data = await validateBody(req, createStockTransactionSchema);

  // Set quantityLeft to initialQuantity if not provided
  const transactionData = {
    ...data,
    quantityLeft: data.quantityLeft ?? data.initialQuantity,
  };

  const transaction = await StockTransaction.create(transactionData);
  const populated = await transaction.populate([
    { path: 'createdBy', select: 'username' },
    { path: 'productId', select: 'name size imageURL' },
    { path: 'categoryId', select: 'name' },
  ]);

  return successResponse(populated.toObject(), 201, 'Stock transaction created successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(getStockTransactionsHandler));
export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(createStockTransactionHandler));