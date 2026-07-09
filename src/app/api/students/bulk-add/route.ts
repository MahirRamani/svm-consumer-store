import { z } from 'zod';
import mongoose from 'mongoose';
import connectDB from '@/lib/config/db';
import { Student } from '@/models';
import { ConsumerYearConfig } from '@/models';
import { AuditLog } from '@/models';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import { STANDARDS } from '@/lib/config/constants';

// ─── Schema ───────────────────────────────────────────────────────────────────

const bulkAddSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  students: z
    .array(
      z.object({
        id: z.number()
          .refine((n) => Number.isInteger(n), { error: "ID must be an integer" })
          .refine((n) => n > 0, { error: "ID must be greater than 0" }).optional(),
        rollNumber: z.number()
          .refine((n) => Number.isInteger(n), { error: "Roll number must be an integer" })
          .refine((n) => n >= 100 && n <= 9999, { error: "Roll number must be 3 to 4 digits" }),
        name: z.string().trim().min(1, 'Name required'),
        standard: z.number()
          .refine((n) => STANDARDS.includes(n as (typeof STANDARDS)[number]), {
            error: "Invalid standard selected",
          }),
      })
    )
    .min(1, 'At least one student required')
    .max(500, 'Maximum 200 students per request'),
});

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ConsumerYearConfigLean { consumerYear: string; isActive: boolean; }
interface ExistingConflict { rollNumber?: string; id?: string; name: string; }

// ─── Handler ──────────────────────────────────────────────────────────────────

const bulkAddHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const { dryRun, students } = await validateBody(req, bulkAddSchema);

  // ── 0. Active year ─────────────────────────────────────────────────────────
  const consumerYearConfig = await ConsumerYearConfig.findOne({ isActive: true })
    .select('consumerYear isActive')
    .lean<ConsumerYearConfigLean | null>();

  if (!consumerYearConfig) {
    throw new ApiError('No active academic year found. Please create one in Year Config first.', 400);
  }

  const { consumerYear } = consumerYearConfig;

  // ── 1. Duplicate roll numbers in batch ─────────────────────────────────────
  const rolls = students.map((s) => s.rollNumber);
  const dupRolls = rolls.filter((r, i) => rolls.indexOf(r) !== i);

  if (dupRolls.length > 0) {
    const conflicting = students
      .filter((s) => dupRolls.includes(s.rollNumber))
      .map((s) => `Roll "${s.rollNumber}" → ${s.name}`);
    throw new ApiError(
      `Duplicate roll numbers in batch: ${[...new Set(conflicting)].join(' | ')}`,
      400
    );
  }

  // ── 2. Duplicate IDs in batch ──────────────────────────────────────────────
  const ids = students.filter((s) => s.id).map((s) => s.id!);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);

  if (dupIds.length > 0) {
    throw new ApiError(
      `Duplicate IDs in batch: ${[...new Set(dupIds)].join(', ')}`,
      400
    );
  }

  // ── 3. Roll conflicts against existing active students in current year ──────
  const rollConflicts = await Student.find({
    rollNumber: { $in: rolls },
    year: consumerYear,
    isActive: true,
  }).select('rollNumber name').lean<ExistingConflict[]>();

  // if (rollConflicts.length > 0) {
  //   const details = rollConflicts
  //     .map((s) => `Roll "${s.rollNumber}" is already taken by "${s.name}"`)
  //     .join(' | ');
  //   throw new ApiError(details, 409);
  // }
  // ── 3. Roll conflicts ──────────────────────────────────────────────────────
if (rollConflicts.length > 0) {
  const conflicts = rollConflicts
    .map((s) => `${s.name} (Roll ${s.rollNumber})`)
    .join(' | ');
  throw new ApiError(
    `These roll numbers are already taken in ${consumerYear} | ${conflicts}`,
    409
  );
}

  // ── 4. ID conflicts against any existing student ───────────────────────────
  if (ids.length > 0) {
    const idConflicts = await Student.find({ id: { $in: ids } })
      .select('id name')
      .lean<ExistingConflict[]>();

    // if (idConflicts.length > 0) {
    //   const details = idConflicts
    //     .map((s) => `ID "${s.id}" is already assigned to "${s.name}"`)
    //     .join(' | ');
    //   throw new ApiError(details, 409);
    // }
    // ── 4. ID conflicts ────────────────────────────────────────────────────────
if (idConflicts.length > 0) {
  const conflicts = idConflicts
    .map((s) => `${s.name} (ID ${s.id})`)
    .join(' | ');
  throw new ApiError(
    `These IDs are already assigned to existing students | ${conflicts}`,
    409
  );
}
  }

  // ── Dry-run: return preview without writing ────────────────────────────────
  if (dryRun) {
    return successResponse(
      {
        year: consumerYear,
        report: { toCreate: students.map(({ id, rollNumber, name, standard }) => ({ id, rollNumber, name, standard })) },
      },
      200,
      'Preview ready — no students have been created yet.'
    );
  }

  // ── 5. Transaction ─────────────────────────────────────────────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const docs = students.map(({ id, rollNumber, name, standard }) => ({
      rollNumber,
      name,
      standard,
      year: consumerYear,
      isActive: true,
      ...(id ? { id } : {}),
    }));

    const created = await Student.insertMany(docs, { session });

    const auditLogs = created.map((student) => ({
      action: 'STUDENT_CREATED',
      entity: 'Student',
      entityId: student._id.toString(),
      before: {},
      after: {
        rollNumber: student.rollNumber,
        name: student.name,
        standard: student.standard,
        year: consumerYear,
        isActive: true,
      },
      performedBy: authContext.user.id,
      year: consumerYear,
      reason: `Bulk student creation for ${consumerYear}`,
    }));

    await AuditLog.insertMany(auditLogs, { session });
    await session.commitTransaction();

    return successResponse(
      { created: students.length, year: consumerYear },
      201,
      `${students.length} student${students.length !== 1 ? 's' : ''} created for ${consumerYear}.`
    );

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(bulkAddHandler));