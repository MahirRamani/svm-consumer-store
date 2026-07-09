// app/api/users/me/tabs/route.ts
import connectDB from '@/lib/config/db';
import { User } from '@/models';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { withAuth } from '@/lib/api/auth-helpers';

// =============================================
// GET - Get Current User's Allowed Tabs
// =============================================
const getUserTabsHandler = async (req: Request, context: { user: { id: string } }) => {
  await connectDB();

  const user = await User.findById(context.user.id).select('allowedTabs').lean();

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  return successResponse({ allowedTabs: user.allowedTabs });
};

// =============================================
// Export Route
// =============================================
export const GET = withErrorHandler(withAuth(getUserTabsHandler));