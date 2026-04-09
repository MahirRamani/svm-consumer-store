// app/api/account-transactions/route.ts
import connectDB from '@/lib/config/db';
import { AccountTransaction, type IAccountTransaction } from '@/models/AccountTransaction';
import { Account } from '@/models/Account';
import { withErrorHandler, successResponse, paginatedResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import {
    createAccountTransactionSchema,
    getAccountTransactionsQuerySchema,
} from '@/lib/validations/accountTransaction';
import type { FilterQuery } from 'mongoose';

// ✅ Helper: Verify account access - FIXED comparison
const verifyAccountAccess = async (accountId: string, authContext: AuthContext) => {
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

    return account;
};

// =============================================
// GET - List Account Transactions
// =============================================
const getAccountTransactionsHandler = async (req: Request, authContext: AuthContext) => {
    await connectDB();

    const query = validateQuery(req, getAccountTransactionsQuerySchema);
    const {
        accountId,
        page,
        limit,
        sortBy,
        sortOrder,
        type,
        startDate,
        endDate,
        includeDeleted,
        search,
    } = query;

    await verifyAccountAccess(accountId, authContext);

    const filter: FilterQuery<IAccountTransaction> = {
        accountId,
    };

    if (!includeDeleted) {
        filter.isDeleted = false;
    }

    if (type) {
        filter.type = type;
    }

    if (startDate || endDate) {
        filter.enteredAt = {};
        if (startDate) filter.enteredAt.$gte = startDate;
        if (endDate) filter.enteredAt.$lte = endDate;
    }

    if (search) {
        filter.note = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;
    // const sort: Record<string, 1 | -1> = {
    //     [sortBy]: sortOrder === 'desc' ? -1 : 1,
    // };
    
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const sort: Record<string, 1 | -1> =
      sortBy === 'enteredAt'
      ? { enteredAt: sortDirection, createdAt: sortDirection, _id: sortDirection }
      : { createdAt: sortDirection, _id: sortDirection };

    const [transactions, totalCount] = await Promise.all([
        AccountTransaction.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate('accountId', 'name')
            .lean(),
        AccountTransaction.countDocuments(filter),
    ]);

    return paginatedResponse('transactions', transactions, { page, limit, totalCount });
};

// =============================================
// POST - Create Account Transaction
// =============================================
// const createAccountTransactionHandler = async (req: Request, authContext: AuthContext) => {
//     await connectDB();

//     const data = await validateBody(req, createAccountTransactionSchema);

//     await verifyAccountAccess(data.accountId, authContext);

//     const transaction = await AccountTransaction.create({
//         ...data,
//         performedBy: authContext.user.id,
//         balanceBefore: 0,
//         balanceAfter: 0,
//     });

//     const populated = await transaction.populate('accountId', 'name');

//     return successResponse(populated.toObject(), 201, 'Transaction recorded successfully');
// };

const createAccountTransactionHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const data = await validateBody(req, createAccountTransactionSchema);
  await verifyAccountAccess(data.accountId, authContext);

  const enteredAt = new Date(data.enteredAt);

  // Find the transaction just before this enteredAt
  const previousTransaction = await AccountTransaction.findOne({
    accountId: data.accountId,
    isDeleted: false,
    enteredAt: { $lte: enteredAt },
  })
    .sort({ enteredAt: -1, createdAt: -1 })
    .select('balanceAfter');

  const baseBalance = previousTransaction?.balanceAfter ?? 0;
  const balanceBefore = baseBalance;
  const balanceAfter =
    data.type === 'CREDIT'
      ? baseBalance + data.amount
      : baseBalance - data.amount;

  const transaction = await AccountTransaction.create({
    ...data,
    performedBy: authContext.user.id,
    balanceBefore,
    balanceAfter,
  });

  // Re-chain all subsequent transactions
  const subsequentTransactions = await AccountTransaction.find({
    accountId: data.accountId,
    isDeleted: false,
    $or: [
      { enteredAt: { $gt: enteredAt } },
      { enteredAt, createdAt: { $gt: transaction.createdAt } },
    ],
  }).sort({ enteredAt: 1, createdAt: 1 });

  let runningBalance = balanceAfter;
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

  // Update account's currentBalance to end of chain
  await Account.findByIdAndUpdate(data.accountId, {
    currentBalance: runningBalance,
  });

  const populated = await transaction.populate('accountId', 'name');
  return successResponse(populated.toObject(), 201, 'Transaction recorded successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getAccountTransactionsHandler));
export const POST = withErrorHandler(withAuth(createAccountTransactionHandler));






// // app/api/account-transactions/route.ts
// import connectDB from '@/lib/config/db';
// import { AccountTransaction, type IAccountTransaction } from '@/models/AccountTransaction';
// import { Account } from '@/models/Account';
// import { withErrorHandler, successResponse, paginatedResponse, ApiError } from '@/lib/api/base-handler';
// import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
// import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
// import {
//   createAccountTransactionSchema,
//   getAccountTransactionsQuerySchema,
// } from '@/lib/validations/accountTransaction';
// import type { FilterQuery } from 'mongoose';

// // Helper: Verify account access
// const verifyAccountAccess = async (accountId: string, authContext: AuthContext) => {
//   const account = await Account.findOne({
//     _id: accountId,
//     isDeleted: false,
//   });

//   if (!account) {
//     throw new ApiError('Account not found', 404);
//   }

//   const isMaster = authContext.user.role === 'SUPERUSER';
//   const isOwner = account.ownerId === authContext.user.id;

//   if (!isMaster && !isOwner) {
//     throw new ApiError('Access denied', 403);
//   }

//   return account;
// };

// // =============================================
// // GET - List Account Transactions
// // =============================================
// const getAccountTransactionsHandler = async (req: Request, authContext: AuthContext) => {
//   await connectDB();

//   const query = validateQuery(req, getAccountTransactionsQuerySchema);
//   const {
//     accountId,
//     page,
//     limit,
//     sortBy,
//     sortOrder,
//     type,
//     startDate,
//     endDate,
//     includeDeleted,
//     search,
//   } = query;

//   // Verify access
//   await verifyAccountAccess(accountId, authContext);

//   // Build filter
//   const filter: FilterQuery<IAccountTransaction> = {
//     accountId,
//   };

//   if (!includeDeleted) {
//     filter.isDeleted = false;
//   }

//   if (type) {
//     filter.type = type;
//   }

//   if (startDate || endDate) {
//     filter.enteredAt = {};
//     if (startDate) filter.enteredAt.$gte = startDate;
//     if (endDate) filter.enteredAt.$lte = endDate;
//   }

//   if (search) {
//     filter.note = { $regex: search, $options: 'i' };
//   }

//   const skip = (page - 1) * limit;
//   const sort: Record<string, 1 | -1> = {
//     [sortBy]: sortOrder === 'desc' ? -1 : 1,
//   };

//   const [transactions, totalCount] = await Promise.all([
//     AccountTransaction.find(filter)
//       .sort(sort)
//       .skip(skip)
//       .limit(limit)
//       .populate('accountId', 'name')
//       .lean(),
//     AccountTransaction.countDocuments(filter),
//   ]);

//   return paginatedResponse('transactions', transactions, { page, limit, totalCount });
// };

// // =============================================
// // POST - Create Account Transaction
// // =============================================
// const createAccountTransactionHandler = async (req: Request, authContext: AuthContext) => {
//   await connectDB();

//   const data = await validateBody(req, createAccountTransactionSchema);

//   // Verify access
//   await verifyAccountAccess(data.accountId, authContext);

//   // Create transaction
//   const transaction = await AccountTransaction.create({
//     ...data,
//     performedBy: authContext.user.id,
//     balanceBefore: 0,
//     balanceAfter: 0,
//   });

//   const populated = await transaction.populate('accountId', 'name');

//   return successResponse(populated.toObject(), 201, 'Transaction recorded successfully');
// };

// // =============================================
// // Export Routes
// // =============================================
// export const GET = withErrorHandler(withAuth(getAccountTransactionsHandler));
// export const POST = withErrorHandler(withAuth(createAccountTransactionHandler));



// // // app/api/account-transactions/route.ts
// // import connectDB from '@/lib/config/db';
// // import { AccountTransaction, type IAccountTransaction } from '@/models/AccountTransaction';
// // import { Account } from '@/models/Account';
// // import { withErrorHandler, successResponse, paginatedResponse, ApiError } from '@/lib/api/base-handler';
// // import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
// // import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
// // import {
// //   createAccountTransactionSchema,
// //   getAccountTransactionsQuerySchema,
// // } from '@/lib/validations/accountTransaction';
// // import type { FilterQuery } from 'mongoose';

// // // =============================================
// // // GET - List Account Transactions
// // // =============================================
// // const getAccountTransactionsHandler = async (req: Request, authContext: AuthContext) => {
// //   await connectDB();

// //   const query = validateQuery(req, getAccountTransactionsQuerySchema);
// //   const {
// //     accountId,
// //     page,
// //     limit,
// //     sortBy,
// //     sortOrder,
// //     type,
// //     startDate,
// //     endDate,
// //     includeDeleted,
// //     search,
// //   } = query;

// //   // Verify account belongs to user
// //   const account = await Account.findOne({
// //     _id: accountId,
// //     ownerId: authContext.user.id,
// //     isDeleted: false,
// //   });

// //   if (!account) {
// //     throw new ApiError('Account not found', 404);
// //   }

// //   // Build filter
// //   const filter: FilterQuery<IAccountTransaction> = {
// //     accountId,
// //   };

// //   if (!includeDeleted) {
// //     filter.isDeleted = false;
// //   }

// //   if (type) {
// //     filter.type = type;
// //   }

// //   if (startDate || endDate) {
// //     filter.enteredAt = {};
// //     if (startDate) filter.enteredAt.$gte = startDate;
// //     if (endDate) filter.enteredAt.$lte = endDate;
// //   }

// //   if (search) {
// //     filter.note = { $regex: search, $options: 'i' };
// //   }

// //   const skip = (page - 1) * limit;
// //   const sort: Record<string, 1 | -1> = {
// //     [sortBy]: sortOrder === 'desc' ? -1 : 1,
// //   };

// //   const [transactions, totalCount] = await Promise.all([
// //     AccountTransaction.find(filter)
// //       .sort(sort)
// //       .skip(skip)
// //       .limit(limit)
// //       .populate('accountId', 'name')
// //       .lean(),
// //     AccountTransaction.countDocuments(filter),
// //   ]);

// //   return paginatedResponse('transactions', transactions, { page, limit, totalCount });
// // };

// // // =============================================
// // // POST - Create Account Transaction
// // // =============================================
// // const createAccountTransactionHandler = async (req: Request, authContext: AuthContext) => {
// //   await connectDB();

// //   const data = await validateBody(req, createAccountTransactionSchema);

// //   // Verify account belongs to user
// //   const account = await Account.findOne({
// //     _id: data.accountId,
// //     ownerId: authContext.user.id,
// //     isDeleted: false,
// //   });

// //   if (!account) {
// //     throw new ApiError('Account not found', 404);
// //   }

// //   // Create transaction (balanceBefore/After auto-calculated in pre-save hook)
// //   const transaction = await AccountTransaction.create({
// //     ...data,
// //     performedBy: authContext.user.id,
// //     balanceBefore: 0, // Will be overwritten by pre-save hook
// //     balanceAfter: 0,  // Will be overwritten by pre-save hook
// //   });

// //   const populated = await transaction.populate('accountId', 'name');

// //   return successResponse(populated.toObject(), 201, 'Transaction recorded successfully');
// // };

// // // =============================================
// // // Export Routes
// // // =============================================
// // export const GET = withErrorHandler(withAuth(getAccountTransactionsHandler));
// // export const POST = withErrorHandler(withAuth(createAccountTransactionHandler));