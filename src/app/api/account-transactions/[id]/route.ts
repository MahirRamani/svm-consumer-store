// app/api/account-transactions/[id]/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { AccountTransaction } from '@/models/AccountTransaction';
import { Account } from '@/models/Account';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import { updateAccountTransactionSchema } from '@/lib/validations/accountTransaction';

type RouteContext = { params: Promise<{ id: string }> };

const idParamsSchema = z.object({ id: objectIdSchema });

// ✅ Helper: Verify transaction ownership - FIXED comparison
const verifyTransactionAccess = async (
    transactionId: string,
    authContext: AuthContext
) => {
    const transaction = await AccountTransaction.findOne({
        _id: transactionId,
        isDeleted: false,
    });

    if (!transaction) {
        throw new ApiError('Transaction not found', 404);
    }

    const account = await Account.findOne({
        _id: transaction.accountId,
        isDeleted: false,
    });

    if (!account) {
        throw new ApiError('Account not found', 404);
    }

    const isMaster = authContext.user.role === 'SUPERUSER';
    // ✅ FIX: Convert ObjectId to string for comparison
    const isOwner = account.ownerId.toString() === authContext.user.id;

    if (!isMaster && !isOwner) {
        throw new ApiError('Access denied', 403);
    }

    return { transaction, account };
};

// =============================================
// GET - Single Transaction
// =============================================
const getAccountTransactionHandler = async (
    req: Request,
    authContext: AuthContext,
    routeContext?: RouteContext
) => {
    await connectDB();

    const { id } = validateParams(await routeContext!.params, idParamsSchema);

    await verifyTransactionAccess(id, authContext);

    const transaction = await AccountTransaction.findById(id)
        .populate('accountId', 'name')
        .lean();

    return successResponse(transaction);
};

// =============================================
// PATCH - Update Transaction (only note & billUrl)
// =============================================
const updateAccountTransactionHandler = async (
    req: Request,
    authContext: AuthContext,
    routeContext?: RouteContext
) => {
    await connectDB();

    const { id } = validateParams(await routeContext!.params, idParamsSchema);
    const data = await validateBody(req, updateAccountTransactionSchema);

    await verifyTransactionAccess(id, authContext);

    // Only allow updating note and billUrl
    const updateData: Record<string, unknown> = {};
    if (data.note !== undefined) updateData.note = data.note;
    if (data.billUrl !== undefined) updateData.billUrl = data.billUrl;

    const transaction = await AccountTransaction.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
    ).populate('accountId', 'name');

    return successResponse(transaction!.toObject(), 200, 'Transaction updated successfully');
};

// =============================================
// DELETE - Soft Delete Transaction
// =============================================
const deleteAccountTransactionHandler = async (
    req: Request,
    authContext: AuthContext,
    routeContext?: RouteContext
) => {
    await connectDB();

    const { id } = validateParams(await routeContext!.params, idParamsSchema);

    await verifyTransactionAccess(id, authContext);

    await AccountTransaction.findByIdAndUpdate(id, {
        $set: { isDeleted: true },
    });

    return successResponse(null, 200, 'Transaction deleted successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getAccountTransactionHandler));
export const PATCH = withErrorHandler(withAuth(updateAccountTransactionHandler));
export const DELETE = withErrorHandler(withAuth(deleteAccountTransactionHandler));





// // app/api/account-transactions/[id]/route.ts
// import { z } from 'zod';
// import connectDB from '@/lib/config/db';
// import { AccountTransaction } from '@/models/AccountTransaction';
// import { Account } from '@/models/Account';
// import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
// import { validateBody, validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
// import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
// import { updateAccountTransactionSchema } from '@/lib/validations/accountTransaction';

// type RouteContext = { params: Promise<{ id: string }> };

// const idParamsSchema = z.object({ id: objectIdSchema });

// // Helper: Verify transaction ownership
// const verifyTransactionOwnership = async (
//   transactionId: string,
//   userId: string
// ): Promise<typeof AccountTransaction.prototype> => {
//   const transaction = await AccountTransaction.findOne({
//     _id: transactionId,
//     isDeleted: false,
//   });

//   if (!transaction) {
//     throw new ApiError('Transaction not found', 404);
//   }

//   const account = await Account.findOne({
//     _id: transaction.accountId,
//     ownerId: userId,
//     isDeleted: false,
//   });

//   if (!account) {
//     throw new ApiError('Transaction not found', 404);
//   }

//   return transaction;
// };

// // =============================================
// // GET - Single Transaction
// // =============================================
// const getAccountTransactionHandler = async (
//   req: Request,
//   authContext: AuthContext,
//   routeContext?: RouteContext
// ) => {
//   await connectDB();

//   const { id } = validateParams(await routeContext!.params, idParamsSchema);

//   await verifyTransactionOwnership(id, authContext.user.id);

//   const transaction = await AccountTransaction.findById(id)
//     .populate('accountId', 'name')
//     .lean();

//   return successResponse(transaction);
// };

// // =============================================
// // PATCH - Update Transaction (only note & billUrl)
// // =============================================
// const updateAccountTransactionHandler = async (
//   req: Request,
//   authContext: AuthContext,
//   routeContext?: RouteContext
// ) => {
//   await connectDB();

//   const { id } = validateParams(await routeContext!.params, idParamsSchema);
//   const data = await validateBody(req, updateAccountTransactionSchema);

//   await verifyTransactionOwnership(id, authContext.user.id);

//   // Only allow updating note and billUrl
//   const updateData: Record<string, unknown> = {};
//   if (data.note !== undefined) updateData.note = data.note;
//   if (data.billUrl !== undefined) updateData.billUrl = data.billUrl;

//   const transaction = await AccountTransaction.findByIdAndUpdate(
//     id,
//     { $set: updateData },
//     { new: true, runValidators: true }
//   ).populate('accountId', 'name');

//   return successResponse(transaction!.toObject(), 200, 'Transaction updated successfully');
// };

// // =============================================
// // DELETE - Soft Delete Transaction
// // =============================================
// const deleteAccountTransactionHandler = async (
//   req: Request,
//   authContext: AuthContext,
//   routeContext?: RouteContext
// ) => {
//   await connectDB();

//   const { id } = validateParams(await routeContext!.params, idParamsSchema);

//   await verifyTransactionOwnership(id, authContext.user.id);

//   await AccountTransaction.findByIdAndUpdate(id, {
//     $set: { isDeleted: true },
//   });

//   // Note: You may want to recalculate subsequent balances here
//   // or handle this in a separate background job

//   return successResponse(null, 200, 'Transaction deleted successfully');
// };

// // =============================================
// // Export Routes
// // =============================================
// export const GET = withErrorHandler(withAuth(getAccountTransactionHandler));
// export const PATCH = withErrorHandler(withAuth(updateAccountTransactionHandler));
// export const DELETE = withErrorHandler(withAuth(deleteAccountTransactionHandler));