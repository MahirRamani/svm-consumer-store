import connectDB from '@/lib/config/db';
import { YearConfig } from '@/models/YearConfig';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';

interface YearConfigLean {
  _id: unknown;
  currentYear: string;
}

// ─── POST — end current academic year ────────────────────────────────────────
// Only marks YearConfig as inactive. Students are NOT touched.

const endYearHandler = async (_req: Request, _authContext: AuthContext) => {
  await connectDB();

  const activeYear = await YearConfig.findOne({ isActive: true })
    .select('_id currentYear')
    .lean<YearConfigLean | null>();

  if (!activeYear) {
    throw new ApiError('No active academic year found.', 400);
  }

  await YearConfig.findOneAndUpdate(
    { isActive: true },
    { $set: { isActive: false } }
  );

  return successResponse(
    { year: activeYear.currentYear },
    200,
    `Year ${activeYear.currentYear} has been ended.`
  );
};

export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(endYearHandler));// import mongoose from 'mongoose';




// import connectDB from '@/lib/config/db';
// import { Student } from '@/models/Student';
// import { YearConfig } from '@/models/YearConfig';
// import { AuditLog } from '@/models/AuditLog';
// import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
// import { withRole, type AuthContext } from '@/lib/api/auth-helpers';

// interface YearConfigLean {
//   _id: mongoose.Types.ObjectId;
//   currentYear: string;
//   isYearLocked: boolean;
// }

// // ─── POST — end current academic year ────────────────────────────────────────
// // Sets all active students in currentYear → isActive: false
// // Locks YearConfig so no more roll assignments can happen for this year

// const endYearHandler = async (_req: Request, authContext: AuthContext) => {
//   await connectDB();

//   const config = await YearConfig.findOne()
//     .select('_id currentYear isYearLocked')
//     .lean<YearConfigLean | null>();

//   if (!config) {
//     throw new ApiError('No active academic year configured.', 400);
//   }

//   if (config.isYearLocked) {
//     throw new ApiError(`Year ${config.currentYear} is already ended and locked.`, 409);
//   }

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     // Deactivate all active students in current year
//     const result = await Student.updateMany(
//       { year: config.currentYear, isActive: true },
//       { $set: { isActive: false } },
//       { session }
//     );

//     // Lock the year config — prevents further roll assignments
//     await YearConfig.findOneAndUpdate(
//       {},
//       { $set: { isYearLocked: true } },
//       { session }
//     );

//     // Single audit entry for the year-end event
//     await AuditLog.create(
//       [
//         {
//           action:      'YEAR_END',
//           entity:      'YearConfig',
//           entityId:    config._id,
//           before:      { isYearLocked: false, year: config.currentYear },
//           after:       { isYearLocked: true,  year: config.currentYear },
//           performedBy: authContext.user.id,
//           year:        config.currentYear,
//           reason:      `Academic year ${config.currentYear} ended — ${result.modifiedCount} students deactivated`,
//         },
//       ],
//       { session }
//     );

//     await session.commitTransaction();

//     return successResponse(
//       { deactivated: result.modifiedCount, year: config.currentYear },
//       200,
//       `Year ${config.currentYear} ended. ${result.modifiedCount} students set to inactive.`
//     );
//   } catch (err: unknown) {
//     await session.abortTransaction();
//     throw err;
//   } finally {
//     session.endSession();
//   }
// };

// export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(endYearHandler));