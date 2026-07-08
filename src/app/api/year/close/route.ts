import mongoose from 'mongoose';
import connectDB from '@/lib/config/db';
import { YearConfig } from '@/models/YearConfig';
import { AuditLog } from '@/models/AuditLog';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';

const closeYearHandler = async (_req: Request, authContext: AuthContext) => {
  await connectDB();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const closed = await YearConfig.findOneAndUpdate(
      { isActive: true },
      { $set: { isActive: false, isYearLocked: true } },
      { new: true, session }
    );

    if (!closed) throw new ApiError('No active year to close.', 404);

    // Students are NOT touched — user manages isActive on students manually
    await AuditLog.create(
      [{
        action: 'YEAR_END',
        entity: 'YearConfig',
        entityId: closed._id.toString(),
        before: { isActive: true,  isYearLocked: false },
        after:  { isActive: false, isYearLocked: true  },
        performedBy: authContext.user.id,
        year: closed.currentYear,
        reason: `Academic year ${closed.currentYear} closed and locked.`,
      }],
      { session }
    );

    await session.commitTransaction();
    return successResponse({ closedYear: closed.currentYear }, 200,
      `Year ${closed.currentYear} closed successfully.`);

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export const POST = withRole(['ADMIN'])(withErrorHandler(closeYearHandler));