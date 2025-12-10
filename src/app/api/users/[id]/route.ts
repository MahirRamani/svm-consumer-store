// app/api/users/[id]/route.ts
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/config/db';
import { User } from '@/models/User';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
import { withRole, withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import { updateUserSchema, type UpdateUserDto } from '@/lib/validations/user';

type RouteContext = { params: Promise<{ id: string }> };

const idParamsSchema = z.object({ id: objectIdSchema });

// =============================================
// GET - Single User
// =============================================
const getUserHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const user = await User.findById(id).select('-password').lean();

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  return successResponse(user);
};

// =============================================
// PATCH - Update User (Admin only)
// =============================================
const updateUserHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const data = await validateBody(req, updateUserSchema);

  // If updating username, check for duplicates
  if (data.username) {
    const existingUser = await User.findOne({
      username: data.username,
      _id: { $ne: id },
    });

    if (existingUser) {
      throw new ApiError('Username already exists', 409);
    }
  }

  // If updating password, hash it
  const updateData: Record<string, unknown> = { ...data };
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 12);
  }

  const user = await User.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  return successResponse(user.toObject(), 200, 'User updated successfully');
};

// =============================================
// DELETE - Delete User (Admin only)
// =============================================
const deleteUserHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);

  // Prevent deleting yourself
  if (authContext.user.id === id) {
    throw new ApiError('Cannot delete your own account', 400);
  }

  const result = await User.findByIdAndDelete(id);

  if (!result) {
    throw new ApiError('User not found', 404);
  }

  return successResponse(null, 200, 'User deleted successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getUserHandler));
export const PATCH = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(updateUserHandler));
export const DELETE = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(deleteUserHandler));