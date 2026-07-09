import connectDB from '@/lib/config/db';
import { ConsumerYearConfig } from '@/models';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';

interface ConsumerYearConfigLean {
  _id: unknown;
  consumerYear: string;
}

// ─── POST — end current academic year ────────────────────────────────────────
// Only marks ConsumerYearConfig as inactive. Students are NOT touched.

const endYearHandler = async (_req: Request, _authContext: AuthContext) => {
  await connectDB();

  const activeYear = await ConsumerYearConfig.findOne({ isActive: true })
    .select('_id consumerYear')
    .lean<ConsumerYearConfigLean | null>();

  if (!activeYear) {
    throw new ApiError('No active academic year found.', 400);
  }

  await ConsumerYearConfig.findOneAndUpdate(
    { isActive: true },
    { $set: { isActive: false } }
  );

  return successResponse(
    { year: activeYear.consumerYear },
    200,
    `Year ${activeYear.consumerYear} has been ended.`
  );
};

export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(endYearHandler));// import mongoose from 'mongoose';