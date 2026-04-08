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

  const transaction = await AccountTransaction.findOne({ _id: id, isDeleted: false });
  if (!transaction) throw new ApiError('Transaction not found or already cancelled', 404);

  const account = await Account.findOne({ _id: transaction.accountId, isDeleted: false });
  if (!account) throw new ApiError('Account not found', 404);

  const isMaster = authContext.user.role === 'SUPERUSER' && authContext.user.username === 'SVM';
  const isOwner = account.ownerId.toString() === authContext.user.id;
  if (!isMaster && !isOwner) throw new ApiError('Access denied', 403);

  // Soft-delete the transaction
  await AccountTransaction.findByIdAndUpdate(id, { $set: { isDeleted: true } });

  // Find the transaction just BEFORE the cancelled one to get correct base balance
  const previousTransaction = await AccountTransaction.findOne({
    accountId: transaction.accountId,
    isDeleted: false,
    $or: [
      { enteredAt: { $lt: transaction.enteredAt } },
      { enteredAt: transaction.enteredAt, createdAt: { $lt: transaction.createdAt } },
    ],
  })
    .sort({ enteredAt: -1, createdAt: -1 })
    .select('balanceAfter');

  const baseBalance = previousTransaction?.balanceAfter ?? 0;

  // Fetch ALL transactions after the cancelled one and re-chain them
  const subsequentTransactions = await AccountTransaction.find({
    accountId: transaction.accountId,
    isDeleted: false,
    $or: [
      { enteredAt: { $gt: transaction.enteredAt } },
      { enteredAt: transaction.enteredAt, createdAt: { $gt: transaction.createdAt } },
    ],
  }).sort({ enteredAt: 1, createdAt: 1 });

  let runningBalance = baseBalance;
  for (const tx of subsequentTransactions) {
    const newBalanceAfter =
      tx.type === 'CREDIT'
        ? runningBalance + tx.amount
        : runningBalance - tx.amount;

    await AccountTransaction.updateOne(
      { _id: tx._id },
      { balanceBefore: runningBalance, balanceAfter: newBalanceAfter }
    );

    runningBalance = newBalanceAfter;
  }

  // currentBalance = end of the re-chained sequence
  await Account.findByIdAndUpdate(transaction.accountId, {
    currentBalance: runningBalance,
  });

  return successResponse(
    { newBalance: runningBalance },
    200,
    'Transaction cancelled and balance recalculated'
  );
};

export const POST = withErrorHandler(withAuth(cancelAccountTransactionHandler));