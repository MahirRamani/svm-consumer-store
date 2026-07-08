import { z } from 'zod';
import mongoose from 'mongoose';
import { MongoBulkWriteError, WriteError } from 'mongodb';
import connectDB from '@/lib/config/db';
import { Student } from '@/models/Student';
import { YearConfig } from '@/models/YearConfig';
import { AuditLog } from '@/models/AuditLog';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import { STANDARDS } from '@/lib/config/constants';

// ─── Schema ───────────────────────────────────────────────────────────────────

const yearStartSchema = z.object({
  newYear: z.string().trim().min(1, 'Academic year is required'),
  yearStartDate: z.string().min(1, 'Start date is required'),
  yearEndDate: z.string().min(1, 'End date is required'),
  students: z
    .array(
      z.object({
        studentMongoId: z.string().min(1),
        // rollNumber: z.string().trim().min(1, 'Roll number is required'),
        rollNumber: z.number()
  .refine((n) => Number.isInteger(n), { error: "Roll number must be an integer" })
  .refine((n) => n >= 100 && n <= 9999, { error: "Roll number must be 3 to 4 digits" }).optional(),
        name: z.string().trim().min(1, 'Name is required'),
        // standard: z.string().trim().min(1, 'Standard is required'),
        standard: z.number()
  .refine((n) => STANDARDS.includes(n as (typeof STANDARDS)[number]), {
    error: "Invalid standard selected",
  }).optional(),
        id: z.number()
  .refine((n) => Number.isInteger(n), { error: "ID must be an integer" })
  .refine((n) => n > 0, { error: "ID must be greater than 0" }),
      })
    )
    .min(1, 'At least one student is required')
    .max(500, 'Maximum 500 students per request'),
});

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface StudentLean {
  _id: mongoose.Types.ObjectId;
  rollNumber: string;
  standard: string;
  year: string;
  id?: string | null;
  name: string;
}

interface StudentConflictLean {
  _id: mongoose.Types.ObjectId;
  id?: string | null;
  rollNumber: string;
  name: string;
}

interface BulkWriteErrorDetail {
  code: number;
  err?: {
    op?: {
      rollNumber?: string;
    };
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

const yearStartHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const { newYear, yearStartDate, yearEndDate, students } =
    await validateBody(req, yearStartSchema);

  const studentMongoIds = students.map((s) => s.studentMongoId);

  // ── 1. Duplicate roll numbers within batch ─────────────────────────────────
  // const rollNumbers = students.map((s) => s.rollNumber);
  // const dupRolls = rollNumbers.filter((r, i) => rollNumbers.indexOf(r) !== i);
  const rollNumbers = students
    .map((s) => s.rollNumber)
    .filter((r): r is number => !!r);   // ← skip undefined ones

  const dupRolls = rollNumbers.filter((r, i) => rollNumbers.indexOf(r) !== i);
  if (dupRolls.length > 0) {
    throw new ApiError(
      `Duplicate roll numbers in request: ${[...new Set(dupRolls)].join(', ')}`,
      400
    );
  }

  // ── 2. Duplicate IDs within batch (only for those providing IDs) ───────────
  const incomingIds = students.map((s) => s.id).filter((id): id is number => !!id);
  const dupIds = incomingIds.filter((id, i) => incomingIds.indexOf(id) !== i);
  if (dupIds.length > 0) {
    throw new ApiError(
      `Duplicate student IDs in request: ${[...new Set(dupIds)].join(', ')}`,
      400
    );
  }

  // ── 3. Prevent re-applying year start (idempotency guard) ─────────────────
  // const alreadyExists = await Student.countDocuments({
  //   year: newYear,
  //   isActive: true,
  // });
  // if (alreadyExists > 0) {
  //   throw new ApiError(
  //     `Year ${newYear} already has ${alreadyExists} active student(s). ` +
  //     `Year start has already been applied.`,
  //     409
  //   );
  // }

  // ✅ After — checks YearConfig, which only updates when year start actually runs
const currentConfig = await YearConfig.findOne()
  .select('currentYear')
  .lean<{ currentYear: string }>();

if (currentConfig?.currentYear === newYear) {
  throw new ApiError(
    `Year ${newYear} is already the active academic year in config. ` +
    `Year start has already been applied.`,
    409
  );
}

  
  // ── 4. Verify all students exist and are active ────────────────────────────
  const existingStudents = await Student.find({
    _id: { $in: studentMongoIds },
    isActive: true,
  })
    .select('_id rollNumber standard year id name')
    .lean<StudentLean[]>()   // ← generic fixes _id: unknown

  if (existingStudents.length !== students.length) {
    const foundIds = new Set(existingStudents.map((s) => s._id.toString()));
    const notFound = studentMongoIds.filter((id) => !foundIds.has(id));
    throw new ApiError(
      `Students not found or inactive: ${notFound.join(', ')}`,
      404
    );
  }

  // ── 5. Check ID conflicts with OTHER active students in current year ────────
  //       (students providing an ID that belongs to someone not in this batch)
  if (incomingIds.length > 0) {
    const idConflicts = await Student.find({
      id: { $in: incomingIds },
      isActive: true,
      _id: { $nin: studentMongoIds }, // exclude self — they may already own this id
    })
      .select('id rollNumber name')
      // .lean();
      .lean<StudentConflictLean[]>();

    if (idConflicts.length > 0) {
      const details = idConflicts
        .map((s) => `"${s.id}" → Roll ${s.rollNumber} (${s.name})`)
        .join(' | ');
      throw new ApiError(
        `These IDs are already taken by other active students: ${details}`,
        409
      );
    }
  }

  // Build a map for audit log before/after snapshots
  const studentMap = new Map(existingStudents.map((s) => [s._id.toString(), s]));

  // ── 6. Transaction ─────────────────────────────────────────────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 6a. Update YearConfig
    await YearConfig.findOneAndUpdate(
      {},
      {
        $set: {
          currentYear: newYear,
          yearStartDate: new Date(yearStartDate),
          yearEndDate: new Date(yearEndDate),
          isYearLocked: false,
          createdBy: authContext.user.id,
        },
      },
      { upsert: true, new: true, session }
    );

    // 6b. Bulk update students — scoped to _id + isActive to prevent
    //     accidentally updating an inactive or wrong-year student
    const studentBulkOps = students.map(({ studentMongoId, rollNumber, standard, id }) => ({
      updateOne: {
        filter: { _id: studentMongoId, isActive: true },
        update: {
          $set: {
            rollNumber,
            standard,
            year: newYear,
            ...(id ? { id } : {}),
          },
        },
      },
    }));

    await Student.bulkWrite(studentBulkOps, { session, ordered: false });

    // 6c. Audit log — one entry per student, full before/after snapshot
    // const auditLogs = students.map(({ studentMongoId, rollNumber, standard, id }) => {
    //   const prev = studentMap.get(studentMongoId)!;
    //   return {
    //     action: 'YEAR_START_UPDATE',
    //     entity: 'Student',
    //     entityId: studentMongoId,
    //     before: {
    //       rollNumber: rollNumber || prev.rollNumber,
    //       standard: standard ?? prev.standard,
    //       year: prev.year,
    //       id: prev.id ?? null,
    //     },
    //     after: {
    //       rollNumber,
    //       standard,
    //       year: newYear,
    //       ...(id ? { id } : {}),
    //     },
    //     performedBy: authContext.user.id,
    //     year: newYear,
    //     reason: `Academic year transition to ${newYear}`,
    //   };
    // });

    const auditLogs = students.map(({ studentMongoId, rollNumber, standard, id }) => {
  const prev = studentMap.get(studentMongoId)!;
  
  // Create safe objects without literal 'undefined' properties
  const beforeState: Record<string, any> = {
    rollNumber: rollNumber || prev.rollNumber,
    standard: standard ?? prev.standard,
    year: prev.year,
  };
  if (prev.id) beforeState.id = prev.id;

  const afterState: Record<string, any> = {
    rollNumber,
    standard,
    year: newYear,
  };
  if (id) afterState.id = id;

  return {
    action: 'YEAR_START',
    entity: 'Student',
    entityId: studentMongoId,
    before: beforeState,
    after: afterState,
    performedBy: authContext.user.id,
    year: newYear,
    reason: `Academic year transition to ${newYear}`,
  };
});


    await AuditLog.insertMany(auditLogs, { session });

    await session.commitTransaction();

    return successResponse(
      { updated: students.length, year: newYear },
      200,
      `Year ${newYear} started successfully. ${students.length} students updated.`
    );
  } catch (err: unknown) {
    await session.abortTransaction();

    if (err instanceof MongoBulkWriteError) {
      // OneOrMore<WriteError> can be T | T[] — normalize to array
      // Array.from on readonly array gives mutable copy
      const writeErrors: WriteError[] = Array.isArray(err.writeErrors)
        ? Array.from(err.writeErrors)
        : [err.writeErrors as WriteError];

      // errmsg has full dup key detail e.g: "dup key: { rollNumber: "701", year: "2025-26" }"
      const collisionDetails = writeErrors
        .filter((e) => e.code === 11000)
        .map((e) => e.errmsg ?? 'unknown collision')
        .join(' | ');

      throw new ApiError(
        `Roll number collision at DB level. ${collisionDetails}`,
        409
      );
    }

    throw err;
  } finally {
    session.endSession();
  }
};

export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(yearStartHandler));