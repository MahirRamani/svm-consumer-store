// app/api/account-transactions/balance/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Account } from '@/models';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateQuery, objectIdSchema } from '@/lib/api/validation-helpers';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';

const getBalanceQuerySchema = z.object({
    accountId: objectIdSchema,
});

// =============================================
// GET - Current Balance
// =============================================
const getBalanceHandler = async (req: Request, authContext: AuthContext) => {
    await connectDB();

    const { accountId } = validateQuery(req, getBalanceQuerySchema);

    const account = await Account.findOne({
        _id: accountId,
        isDeleted: false,
    }).select('name currentBalance ownerId');

    if (!account) {
        throw new ApiError('Account not found', 404);
    }

    const isMaster = authContext.user.role === 'SUPERUSER';
    // ✅ FIX: Convert ObjectId to string for comparison
    const isOwner = account.ownerId.toString() === authContext.user.id;

    if (!isMaster && !isOwner) {
        throw new ApiError('Access denied', 403);
    }

    return successResponse({
        accountId: account._id,
        accountName: account.name,
        currentBalance: account.currentBalance,
    });
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getBalanceHandler));


// // app/api/account-transactions/balance/route.ts
// import { z } from 'zod';
// import connectDB from '@/lib/config/db';
// import { Account } from '@/models';
// import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
// import { validateQuery, objectIdSchema } from '@/lib/api/validation-helpers';
// import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';

// const getBalanceQuerySchema = z.object({
//   accountId: objectIdSchema,
// });

// // =============================================
// // GET - Current Balance
// // =============================================
// const getBalanceHandler = async (req: Request, authContext: AuthContext) => {
//   await connectDB();

//   const { accountId } = validateQuery(req, getBalanceQuerySchema);

//   const account = await Account.findOne({
//     _id: accountId,
//     ownerId: authContext.user.id,
//     isDeleted: false,
//   }).select('name currentBalance');

//   if (!account) {
//     throw new ApiError('Account not found', 404);
//   }

//   return successResponse({
//     accountId: account._id,
//     accountName: account.name,
//     currentBalance: account.currentBalance,
//   });
// };

// // =============================================
// // Export Routes
// // =============================================
// export const GET = withErrorHandler(withAuth(getBalanceHandler));