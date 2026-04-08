// app/api/account-transactions/[id]/cancel/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { AccountTransaction } from '@/models/AccountTransaction';
import { Account } from '@/models/Account';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';

type RouteContext = { params: Promise<{ id: string }> };
const idParamsSchema = z.object({ id: objectIdSchema });

const cancelAccountTransactionHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);

  // Find the transaction
  const transaction = await AccountTransaction.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!transaction) {
    throw new ApiError('Transaction not found or already cancelled', 404);
  }

  // Verify account access
  const account = await Account.findOne({
    _id: transaction.accountId,
    isDeleted: false,
  });

  if (!account) {
    throw new ApiError('Account not found', 404);
  }

  const isMaster = authContext.user.role === 'SUPERUSER' && authContext.user.username === 'SVM';
  const isOwner = account.ownerId.toString() === authContext.user.id;

  if (!isMaster && !isOwner) {
    throw new ApiError('Access denied', 403);
  }

  // Soft-delete the transaction
  await AccountTransaction.findByIdAndUpdate(id, { $set: { isDeleted: true } });

  // Recalculate account balance from remaining active transactions
  const lastActiveTransaction = await AccountTransaction.findOne({
    accountId: transaction.accountId,
    isDeleted: false,
  })
    .sort({ enteredAt: -1, createdAt: -1 })
    .select('balanceAfter');

  const newBalance = lastActiveTransaction?.balanceAfter ?? 0;

  await Account.findByIdAndUpdate(transaction.accountId, {
    currentBalance: newBalance,
  });

  return successResponse(
    { newBalance },
    200,
    'Transaction cancelled and balance recalculated'
  );
};

export const POST = withErrorHandler(withAuth(cancelAccountTransactionHandler));