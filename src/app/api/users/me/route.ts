// app/api/users/me/route.ts
import connectDB from '@/lib/config/db';
import { User } from '@/models/User';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';

// =============================================
// GET - Get Current User Info
// =============================================
const getCurrentUserHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const user = await User.findById(authContext.user.id).select('-password').lean();

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  return successResponse(user);
};

// =============================================
// Export Route
// =============================================
export const GET = withErrorHandler(withAuth(getCurrentUserHandler));