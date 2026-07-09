import { z } from 'zod';
import mongoose from 'mongoose';
import connectDB from '@/lib/config/db';
import { ConsumerYearConfig } from '@/models';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ConsumerYearConfigLean {
  _id: mongoose.Types.ObjectId;
  consumerYear: string;
  yearStartDate: Date;
  yearEndDate: Date;
  isActive: boolean;
  createdAt: Date;
}

// ─── GET — active year + full history ────────────────────────────────────────

const getConsumerYearConfigHandler = async (_req: Request) => {
  await connectDB();

  const [activeYear, history] = await Promise.all([
    ConsumerYearConfig.findOne({ isActive: true })
      .select('consumerYear yearStartDate yearEndDate isActive')
      .lean<ConsumerYearConfigLean | null>(),

    ConsumerYearConfig.find()
      .select('consumerYear yearStartDate yearEndDate isActive createdAt')
      .sort({ createdAt: -1 })
      .lean<ConsumerYearConfigLean[]>(),
  ]);

  return successResponse({ activeYear, history });
};

// ─── POST — start new year (deactivates old, creates new) ────────────────────

const yearConfigSchema = z.object({
  consumerYear: z.string().trim().min(1, 'Academic year is required'),
  yearStartDate: z.string().min(1, 'Start date is required'),
  yearEndDate: z.string().min(1, 'End date is required'),
});

const saveConsumerYearConfigHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const { consumerYear, yearStartDate, yearEndDate } = await validateBody(req, yearConfigSchema);

  // Prevent duplicate year name
  const duplicate = await ConsumerYearConfig.findOne({ consumerYear }).lean<{ isActive: boolean } | null>();
  if (duplicate) {
    throw new ApiError(
      `Year "${consumerYear}" already exists. Use a different name.`,
      409
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Mark current active year as inactive (keep the record)
    await ConsumerYearConfig.findOneAndUpdate(
      { isActive: true },
      { $set: { isActive: false } },
      { session }
    );

    // Create new active year as a fresh document
    await ConsumerYearConfig.create(
      [
        {
          consumerYear,
          yearStartDate: new Date(yearStartDate),
          yearEndDate: new Date(yearEndDate),
          isActive: true,
          createdBy: authContext.user.id,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return successResponse(
      { consumerYear },
      200,
      `Academic year ${consumerYear} started.`
    );
  } catch (err: unknown) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export const GET = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(getConsumerYearConfigHandler));
export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(saveConsumerYearConfigHandler));