// app/api/account-transactions/summary/route.ts
import mongoose from 'mongoose';
import connectDB from '@/lib/config/db';
import { AccountTransaction } from '@/models/AccountTransaction';
import { Account } from '@/models/Account';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateQuery } from '@/lib/api/validation-helpers';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import { getAccountTransactionsSummaryQuerySchema } from '@/lib/validations/accountTransaction';

// =============================================
// GET - Account Transaction Summary
// =============================================
const getAccountTransactionsSummaryHandler = async (
    req: Request,
    authContext: AuthContext
) => {
    await connectDB();

    const query = validateQuery(req, getAccountTransactionsSummaryQuerySchema);
    const { accountId, startDate, endDate } = query;

    // Verify access
    const account = await Account.findOne({
        _id: accountId,
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

    // Build match stage
    const matchStage: Record<string, unknown> = {
        accountId: new mongoose.Types.ObjectId(accountId),
        isDeleted: false,
    };

    if (startDate || endDate) {
        matchStage.enteredAt = {};
        if (startDate) (matchStage.enteredAt as Record<string, Date>).$gte = new Date(startDate);
        if (endDate) (matchStage.enteredAt as Record<string, Date>).$lte = new Date(endDate);
    }

    const summary = await AccountTransaction.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalCredit: {
                    $sum: { $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0] },
                },
                totalDebit: {
                    $sum: { $cond: [{ $eq: ['$type', 'DEBIT'] }, '$amount', 0] },
                },
                totalEntries: { $sum: 1 },
                firstEntryDate: { $min: '$enteredAt' },
                lastEntryDate: { $max: '$enteredAt' },
            },
        },
    ]);

    const result = summary[0] || {
        totalCredit: 0,
        totalDebit: 0,
        totalEntries: 0,
        firstEntryDate: null,
        lastEntryDate: null,
    };

    return successResponse({
        accountId: account._id,
        accountName: account.name,
        currentBalance: account.currentBalance,
        totalCredit: result.totalCredit,
        totalDebit: result.totalDebit,
        netFlow: result.totalCredit - result.totalDebit,
        totalEntries: result.totalEntries,
        firstEntryDate: result.firstEntryDate,
        lastEntryDate: result.lastEntryDate,
    });
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getAccountTransactionsSummaryHandler));





// // app/api/account-transactions/summary/route.ts
// import mongoose from 'mongoose';
// import connectDB from '@/lib/config/db';
// import { AccountTransaction } from '@/models/AccountTransaction';
// import { Account } from '@/models/Account';
// import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
// import { validateQuery } from '@/lib/api/validation-helpers';
// import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
// import { getAccountTransactionsSummaryQuerySchema } from '@/lib/validations/accountTransaction';

// // =============================================
// // GET - Account Transaction Summary
// // =============================================
// const getAccountTransactionsSummaryHandler = async (
//   req: Request,
//   authContext: AuthContext
// ) => {
//   await connectDB();

//   const query = validateQuery(req, getAccountTransactionsSummaryQuerySchema);
//   const { accountId, startDate, endDate } = query;

//   // Verify account belongs to user
//   const account = await Account.findOne({
//     _id: accountId,
//     ownerId: authContext.user.id,
//     isDeleted: false,
//   });

//   if (!account) {
//     throw new ApiError('Account not found', 404);
//   }

//   // Build match stage
//   const matchStage: Record<string, unknown> = {
//     accountId: new mongoose.Types.ObjectId(accountId),
//     isDeleted: false,
//   };

//   if (startDate || endDate) {
//     matchStage.enteredAt = {};
//     if (startDate) (matchStage.enteredAt as Record<string, Date>).$gte = startDate;
//     if (endDate) (matchStage.enteredAt as Record<string, Date>).$lte = endDate;
//   }

//   const summary = await AccountTransaction.aggregate([
//     { $match: matchStage },
//     {
//       $group: {
//         _id: null,
//         totalCredit: {
//           $sum: { $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0] },
//         },
//         totalDebit: {
//           $sum: { $cond: [{ $eq: ['$type', 'DEBIT'] }, '$amount', 0] },
//         },
//         totalEntries: { $sum: 1 },
//         firstEntryDate: { $min: '$enteredAt' },
//         lastEntryDate: { $max: '$enteredAt' },
//       },
//     },
//   ]);

//   const result = summary[0] || {
//     totalCredit: 0,
//     totalDebit: 0,
//     totalEntries: 0,
//     firstEntryDate: null,
//     lastEntryDate: null,
//   };

//   return successResponse({
//     accountId: account._id,
//     accountName: account.name,
//     currentBalance: account.currentBalance,
//     totalCredit: result.totalCredit,
//     totalDebit: result.totalDebit,
//     netFlow: result.totalCredit - result.totalDebit,
//     totalEntries: result.totalEntries,
//     firstEntryDate: result.firstEntryDate,
//     lastEntryDate: result.lastEntryDate,
//   });
// };

// // =============================================
// // Export Routes
// // =============================================
// export const GET = withErrorHandler(withAuth(getAccountTransactionsSummaryHandler));