// app/api/accounts/[id]/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Account } from '@/models';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import { updateAccountSchema } from '@/lib/validations/account';

type RouteContext = { params: Promise<{ id: string }> };

const idParamsSchema = z.object({ id: objectIdSchema });

// Helper: Check access - FIXED comparison
const checkAccountAccess = async (accountId: string, authContext: AuthContext) => {
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
// GET - Single Account
// =============================================
const getAccountHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const account = await checkAccountAccess(id, authContext);

  if (authContext.user.role === 'SUPERUSER') {
    await account.populate('ownerId', 'name email username');
  }

  return successResponse(account.toObject());
};

// =============================================
// PATCH - Update Account
// =============================================
const updateAccountHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  await checkAccountAccess(id, authContext);

  const data = await validateBody(req, updateAccountSchema);

  const account = await Account.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  );

  return successResponse(account!.toObject(), 200, 'Account updated successfully');
};

// =============================================
// DELETE - Soft Delete Account
// =============================================
const deleteAccountHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  await checkAccountAccess(id, authContext);

  await Account.findByIdAndUpdate(id, {
    $set: { isDeleted: true, isActive: false },
  });

  return successResponse(null, 200, 'Account deleted successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getAccountHandler));
export const PATCH = withErrorHandler(withAuth(updateAccountHandler));
export const DELETE = withErrorHandler(withAuth(deleteAccountHandler));