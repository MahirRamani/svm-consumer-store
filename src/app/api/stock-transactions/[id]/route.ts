// app/api/stock-transactions/[id]/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { StockTransaction } from '@/models';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
import { withAuth, withRole, type AuthContext } from '@/lib/api/auth-helpers';
import { updateStockTransactionSchema } from '@/lib/validations/stockTransaction';

type RouteContext = { params: Promise<{ id: string }> };

const idParamsSchema = z.object({ id: objectIdSchema });

// =============================================
// GET - Single Stock Transaction
// =============================================
const getStockTransactionHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const transaction = await StockTransaction.findById(id)
    .populate('createdBy', 'username')
    .populate('productId', 'name size imageURL')
    .populate('categoryId', 'name')
    .lean();

  if (!transaction) {
    throw new ApiError('Stock transaction not found', 404);
  }

  return successResponse(transaction);
};

// =============================================
// PATCH - Update Stock Transaction (Admin only)
// =============================================
const updateStockTransactionHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const data = await validateBody(req, updateStockTransactionSchema);

  const transaction = await StockTransaction.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  })
    .populate('createdBy', 'username')
    .populate('productId', 'name size imageURL')
    .populate('categoryId', 'name');

  if (!transaction) {
    throw new ApiError('Stock transaction not found', 404);
  }

  return successResponse(transaction.toObject(), 200, 'Stock transaction updated successfully');
};

// =============================================
// DELETE - Delete Stock Transaction (Admin only)
// =============================================
const deleteStockTransactionHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const result = await StockTransaction.findByIdAndDelete(id);

  if (!result) {
    throw new ApiError('Stock transaction not found', 404);
  }

  return successResponse(null, 200, 'Stock transaction deleted successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withRole(['SUPERUSER', 'ADMIN', 'SELLER'])(getStockTransactionHandler));
export const PATCH = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(updateStockTransactionHandler));
export const DELETE = withErrorHandler(withRole(['SUPERUSER'])(deleteStockTransactionHandler));