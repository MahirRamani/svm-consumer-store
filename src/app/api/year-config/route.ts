import { z } from 'zod';
import mongoose from 'mongoose';
import connectDB from '@/lib/config/db';
import { YearConfig } from '@/models/YearConfig';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface YearConfigLean {
  _id: mongoose.Types.ObjectId;
  currentYear: string;
  yearStartDate: Date;
  yearEndDate: Date;
  isActive: boolean;
  createdAt: Date;
}

// ─── GET — active year + full history ────────────────────────────────────────

const getYearConfigHandler = async (_req: Request) => {
  await connectDB();

  const [activeYear, history] = await Promise.all([
    YearConfig.findOne({ isActive: true })
      .select('currentYear yearStartDate yearEndDate isActive')
      .lean<YearConfigLean | null>(),

    YearConfig.find()
      .select('currentYear yearStartDate yearEndDate isActive createdAt')
      .sort({ createdAt: -1 })
      .lean<YearConfigLean[]>(),
  ]);

  return successResponse({ activeYear, history });
};

// ─── POST — start new year (deactivates old, creates new) ────────────────────

const yearConfigSchema = z.object({
  currentYear:   z.string().trim().min(1, 'Academic year is required'),
  yearStartDate: z.string().min(1, 'Start date is required'),
  yearEndDate:   z.string().min(1, 'End date is required'),
});

const saveYearConfigHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const { currentYear, yearStartDate, yearEndDate } = await validateBody(req, yearConfigSchema);

  // Prevent duplicate year name
  const duplicate = await YearConfig.findOne({ currentYear }).lean<{ isActive: boolean } | null>();
  if (duplicate) {
    throw new ApiError(
      `Year "${currentYear}" already exists. Use a different name.`,
      409
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Mark current active year as inactive (keep the record)
    await YearConfig.findOneAndUpdate(
      { isActive: true },
      { $set: { isActive: false } },
      { session }
    );

    // Create new active year as a fresh document
    await YearConfig.create(
      [
        {
          currentYear,
          yearStartDate: new Date(yearStartDate),
          yearEndDate:   new Date(yearEndDate),
          isActive:      true,
          createdBy:     authContext.user.id,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return successResponse(
      { currentYear },
      200,
      `Academic year ${currentYear} started.`
    );
  } catch (err: unknown) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export const GET  = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(getYearConfigHandler));
export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(saveYearConfigHandler));



// import { z } from 'zod';
// import connectDB from '@/lib/config/db';
// import { YearConfig } from '@/models/YearConfig';
// import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
// import { validateBody } from '@/lib/api/validation-helpers';
// import { withRole, type AuthContext } from '@/lib/api/auth-helpers';

// interface YearConfigLean {
//   _id: unknown;
//   currentYear: string;
//   yearStartDate: Date;
//   yearEndDate: Date;
//   isYearLocked: boolean;
// }

// // ─── GET — fetch current year config ─────────────────────────────────────────
// const getYearConfigHandler = async (_req: Request) => {
//   await connectDB();

//   const config = await YearConfig.findOne()
//     .select('currentYear yearStartDate yearEndDate isYearLocked')
//     .lean<YearConfigLean | null>();

//   return successResponse(config ?? null);
// };

// // ─── POST — create or update year config (separate from roll assignment) ──────
// const yearConfigSchema = z.object({
//   currentYear:   z.string().trim().min(1, 'Academic year is required'),
//   yearStartDate: z.string().min(1, 'Start date is required'),
//   yearEndDate:   z.string().min(1, 'End date is required'),
// });

// const saveYearConfigHandler = async (req: Request, authContext: AuthContext) => {
//   await connectDB();

//   const { currentYear, yearStartDate, yearEndDate } = await validateBody(req, yearConfigSchema);

//   // Prevent updating if current year is locked (ended) — must use a new year string
//   const existing = await YearConfig.findOne()
//     .select('currentYear isYearLocked')
//     .lean<{ currentYear: string; isYearLocked: boolean } | null>();

//   if (existing?.isYearLocked && existing.currentYear === currentYear) {
//     throw new ApiError(
//       `Year ${currentYear} is locked (ended). Use a different year name to start a new one.`,
//       409
//     );
//   }

//   await YearConfig.findOneAndUpdate(
//     {},
//     {
//       $set: {
//         currentYear,
//         yearStartDate: new Date(yearStartDate),
//         yearEndDate:   new Date(yearEndDate),
//         isYearLocked:  false,
//         createdBy:     authContext.user.id,
//       },
//     },
//     { upsert: true, new: true }
//   );

//   return successResponse(
//     { currentYear },
//     200,
//     `Academic year ${currentYear} configured successfully.`
//   );
// };

// export const GET  = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(getYearConfigHandler));
// export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(saveYearConfigHandler));