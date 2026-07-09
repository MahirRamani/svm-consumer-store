// app/api/accounts/route.ts
import connectDB from '@/lib/config/db';
import { Account } from '@/models';
import { withErrorHandler, successResponse, paginatedResponse } from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import {
  createAccountSchema,
  getAccountsQuerySchema,
} from '@/lib/validations/account';
import type { FilterQuery } from 'mongoose';
import { IAccount } from '@/models/Account';

// =============================================
// GET - List Accounts
// =============================================
const getAccountsHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const query = validateQuery(req, getAccountsQuerySchema);
  const { page, limit, sortBy, sortOrder, includeInactive, search, countOnly, ownerId } = query;

  const isMaster = authContext.user.role === 'SUPERUSER';

  const filter: FilterQuery<IAccount> = {
    isDeleted: false,
  };

  if (isMaster) {
    if (ownerId) {
      filter.ownerId = ownerId;
    }
  } else {
    filter.ownerId = authContext.user.id;
  }

  if (!includeInactive) {
    filter.isActive = true;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (countOnly) {
    const totalCount = await Account.countDocuments(filter);
    return successResponse({ totalCount });
  }

  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === 'desc' ? -1 : 1,
  };

  const accountsQuery = Account.find(filter).sort(sort).skip(skip).limit(limit);

  if (isMaster) {
    accountsQuery.populate('ownerId', 'name email username');
  }

  const [accounts, totalCount] = await Promise.all([
    accountsQuery.lean(),
    Account.countDocuments(filter),
  ]);

  return paginatedResponse('accounts', accounts, { page, limit, totalCount });
};

// =============================================
// POST - Create Account
// =============================================
const createAccountHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const data = await validateBody(req, createAccountSchema);

  const isMaster = authContext.user.role === 'SUPERUSER';

  const ownerId = isMaster && data.ownerId
    ? data.ownerId
    : authContext.user.id;

  const account = await Account.create({
    ...data,
    ownerId,
  });

  return successResponse(account.toObject(), 201, 'Account created successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getAccountsHandler));
export const POST = withErrorHandler(withAuth(createAccountHandler));



// // app/api/accounts/route.ts
// import connectDB from '@/lib/config/db';
// import { Account, type IAccount } from '@/models';
// import { withErrorHandler, successResponse, paginatedResponse } from '@/lib/api/base-handler';
// import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
// import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
// import {
//   createAccountSchema,
//   getAccountsQuerySchema,
// } from '@/lib/validations/account';
// import type { FilterQuery } from 'mongoose';

// // =============================================
// // GET - List Accounts (for current user)
// // =============================================
// const getAccountsHandler = async (req: Request, authContext: AuthContext) => {
//   await connectDB();

//   const query = validateQuery(req, getAccountsQuerySchema);
//   const { page, limit, sortBy, sortOrder, includeInactive, search, countOnly } = query;

//   // Build filter - only show current user's accounts
//   const filter: FilterQuery<IAccount> = {
//     ownerId: authContext.user.id,
//     isDeleted: false,
//   };

//   if (!includeInactive) {
//     filter.isActive = true;
//   }

//   if (search) {
//     filter.$or = [
//       { name: { $regex: search, $options: 'i' } },
//       { description: { $regex: search, $options: 'i' } },
//     ];
//   }

//   // Count only
//   if (countOnly) {
//     const totalCount = await Account.countDocuments(filter);
//     return successResponse({ totalCount });
//   }

//   const skip = (page - 1) * limit;
//   const sort: Record<string, 1 | -1> = {
//     [sortBy]: sortOrder === 'desc' ? -1 : 1,
//   };

//   const [accounts, totalCount] = await Promise.all([
//     Account.find(filter).sort(sort).skip(skip).limit(limit).lean(),
//     Account.countDocuments(filter),
//   ]);

//   return paginatedResponse('accounts', accounts, { page, limit, totalCount });
// };

// // =============================================
// // POST - Create Account
// // =============================================
// const createAccountHandler = async (req: Request, authContext: AuthContext) => {
//   await connectDB();

//   const data = await validateBody(req, createAccountSchema);

//   const account = await Account.create({
//     ...data,
//     ownerId: authContext.user.id,
//   });

//   return successResponse(account.toObject(), 201, 'Account created successfully');
// };

// // =============================================
// // Export Routes
// // =============================================
// export const GET = withErrorHandler(withAuth(getAccountsHandler));
// export const POST = withErrorHandler(withAuth(createAccountHandler));