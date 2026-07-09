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

// ─── Schema — only rollNumber + standard, no id ───────────────────────────────

const assignRollsSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  students: z
    .array(
      z.object({
        studentMongoId: z.string().min(1),
        rollNumber: z.number()
          .refine((n) => Number.isInteger(n), { error: "Roll number must be an integer" })
          .refine((n) => n >= 100 && n <= 9999, { error: "Roll number must be 3 to 4 digits" }).optional(),  // "" → undefined
        standard: z.number()
          .refine((n) => STANDARDS.includes(n as (typeof STANDARDS)[number]) || n === 0, {
            error: "Invalid standard selected",
          }).optional(),
      })
    )
    .min(1, 'At least one student is required')
    .max(500, 'Maximum 500 students per request'),
});

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ConsumerYearConfigLean {
  consumerYear: string;
  isActive: boolean;
}

interface StudentLean {
  _id: mongoose.Types.ObjectId;
  rollNumber: number;
  standard: number;
  year: string;
  name: string;
  isActive: boolean;
}

interface StudentConflictLean {
  _id: mongoose.Types.ObjectId;
  rollNumber: number;
  name: string;
}

const parseCollisionMessage = (errmsg: string): string => {
  if (!errmsg) return 'Duplicate roll number detected';

  const dupKeyMatch = errmsg.match(/dup key:\s*\{([^}]+)\}/);
  if (!dupKeyMatch) return errmsg;  // return raw errmsg as fallback, not a template

  const parts: Record<string, string> = {};
  const kvRegex = /(\w+):\s*"([^"]+)"/g;  // stricter — only matches quoted values
  let m: RegExpExecArray | null;

  while ((m = kvRegex.exec(dupKeyMatch[1])) !== null) {
    parts[m[1]] = m[2];
  }

  if (parts.rollNumber && parts.year) {
    return `Roll No "${parts.rollNumber}" is already assigned in year "${parts.year}"`;
  }
  if (parts.rollNumber) {
    return `Roll No "${parts.rollNumber}" already exists`;
  }

  return 'Duplicate roll number detected';
};

// ─── Handler ──────────────────────────────────────────────────────────────────

const assignRollsHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const { students, dryRun } = await validateBody(req, assignRollsSchema);

  // ── 0. Get active year ─────────────────────────────────────────────────────
  const consumerYearConfig = await ConsumerYearConfig.findOne({ isActive: true })
    .select('consumerYear isActive')
    .lean<ConsumerYearConfigLean | null>();

  if (!consumerYearConfig) {
    throw new ApiError(
      'No active academic year found. Please create a new year first.',
      400
    );
  }

  const { consumerYear } = consumerYearConfig;
  const studentMongoIds = students.map((s) => s.studentMongoId);
  const objectIdBatch = studentMongoIds.map((id) => new mongoose.Types.ObjectId(id));

  // ── 1. Fetch students — no isActive filter ─────────────────────────────────
  //       Students may be from a previous year; we update them to the new year
  const existingStudents = await Student.find({ _id: { $in: objectIdBatch } })
    .select('_id rollNumber standard year name isActive')
    .lean<StudentLean[]>();

  if (existingStudents.length !== students.length) {
    const foundIds = new Set(existingStudents.map((s) => s._id.toString()));
    const notFound = studentMongoIds.filter((id) => !foundIds.has(id));
    throw new ApiError(`Students not found: ${notFound.join(', ')}`, 404);
  }

  const studentMap = new Map(existingStudents.map((s) => [s._id.toString(), s]));

  // ── 2. Resolve post-update final rolls for every student ───────────────────
  const finalRolls = students.map(({ studentMongoId, rollNumber }) => {
    const prev = studentMap.get(studentMongoId)!;
    return {
      studentMongoId,
      finalRoll: rollNumber ?? prev.rollNumber, // keep existing if blank
    };
  });

  // ── 3. Duplicate roll numbers within batch ─────────────────────────────────
  //   const finalRollList = finalRolls
  //     .map((r) => r.finalRoll)
  //     .filter((r): r is string => !!r);

  //   const explicitAssignments = students.filter((s) => s.rollNumber);
  // const explicitRollList    = explicitAssignments.map((s) => s.rollNumber as string);
  //   // const dupRolls = finalRollList.filter((r, i) => finalRollList.indexOf(r) !== i);
  //   const dupRolls            = explicitRollList.filter((r, i) => explicitRollList.indexOf(r) !== i);

  //   if (dupRolls.length > 0) {
  //     // const conflicting = finalRolls
  //     //   .filter((r) => r.finalRoll && dupRolls.includes(r.finalRoll))
  //     //   .map((r) => {
  //     //     const s = studentMap.get(r.studentMongoId)!;
  //     //     return `Roll "${r.finalRoll}" → ${s.name}`;
  //     //   });

  //     const conflicting = explicitAssignments
  //     .filter((s) => dupRolls.includes(s.rollNumber as string))
  //     .map((s) => {
  //       const student = studentMap.get(s.studentMongoId)!;
  //       return `Roll "${s.rollNumber}" → ${student.name}`;
  //     });
  //     throw new ApiError(
  //       `Duplicate roll numbers would result after update: ${[...new Set(conflicting)].join(' | ')}`,
  //       400
  //     );
  //   }

  // ── 3. Duplicate rolls within batch ───────────────────────────────────────────
  // ALL batch students land in consumerYear after tx → every finalRoll must be unique
  const finalRollList = finalRolls
    .map((r) => r.finalRoll)
    .filter((r): r is number => !!r);

  const dupRolls = finalRollList.filter((r, i) => finalRollList.indexOf(r) !== i);

  if (dupRolls.length > 0) {
    const conflicting = finalRolls
      .filter((r) => r.finalRoll && dupRolls.includes(r.finalRoll))
      .map((r) => {
        const s = studentMap.get(r.studentMongoId)!;
        return `Roll "${r.finalRoll}" → ${s.name} (currently in ${s.year})`;
      });
    throw new ApiError(
      `These rolls would clash in ${consumerYear}: ${[...new Set(conflicting)].join(' | ')}. ` +
      `Assign one of them a different roll, or use the Swap feature.`,
      400
    );
  }
  // ── 4. Roll number conflicts with OTHER ACTIVE students in current year ─────
  //       Filter out unchanged rolls to prevent a student colliding with themselves.
  //       Also treat previously inactive students as changes since they are now becoming active.
  // const changedRolls = finalRolls
  //   .filter((r) => {
  //     if (!r.finalRoll) return false;
  //     const prev = studentMap.get(r.studentMongoId)!;
  //     if (!prev.isActive) return true;
  //     if (prev.year !== consumerYear) return true; // crossing into new year with same roll — must check
  //     return r.finalRoll !== prev.rollNumber;
  //   })
  //   .map((r) => r.finalRoll as string);

  // if (changedRolls.length > 0) {
  //   const rollConflicts = await Student.find({
  //     rollNumber: { $in: changedRolls },
  //     year:       consumerYear,
  //     isActive:   true, // 🌟 Fixes conflict: completely ignore inactive students
  //     _id:        { $nin: objectIdBatch }, // exclude this batch safely using true ObjectIds
  //   })
  //     .select('rollNumber name')
  //     .lean<StudentConflictLean[]>();

  //   if (rollConflicts.length > 0) {
  //     // const details = rollConflicts
  //     //   .map((s) => `"${s.rollNumber}" → ${s.name}`)
  //     //   .join(' | ');
  //     // throw new ApiError(
  //     //   `Roll numbers already taken by active students in ${consumerYear}: ${details}`,
  //     //   409
  //     // );
  //     const details = rollConflicts
  //   .map((s) => {
  //     return (
  //       `Roll No "${s.rollNumber}" is already assigned to "${s.name}" and is active. ` +
  //       `Make them inactive (if they have left) or change their roll number first.`
  //     );
  //   })
  //   .join(' | ');
  //   }
  // }

  // ── 4. Roll number conflicts ───────────────────────────────────────────────
  const changedRolls = finalRolls
    .filter((r) => {
      if (!r.finalRoll) return false;
      const prev = studentMap.get(r.studentMongoId)!;
      if (!prev.isActive) return true; // inactive → active
      if (prev.year !== consumerYear) return true; // crossing into new year
      return r.finalRoll !== prev.rollNumber;     // genuinely changed roll
    })
    .map((r) => r.finalRoll);

  if (changedRolls.length > 0) {
    const candidates = await Student.find({
      rollNumber: { $in: changedRolls },
      year: consumerYear,
      isActive: true,
    }).select('rollNumber name _id').lean<StudentConflictLean[]>();

    const finalRollMap = new Map(finalRolls.map((r) => [r.studentMongoId, r.finalRoll]));

    const rollConflicts = candidates.filter((candidate) => {
      const candidateId = candidate._id.toString();
      const prev = studentMap.get(candidateId);

      // Not in this batch at all → always a conflict
      if (!prev) return true;

      // In batch — only a conflict if they are KEEPING this roll in consumerYear
      // (i.e. not vacating it by changing to something else or coming from another year)
      const afterRoll = finalRollMap.get(candidateId);
      const isKeeping =
        afterRoll === candidate.rollNumber &&
        prev.rollNumber === candidate.rollNumber &&
        prev.year === consumerYear &&
        prev.isActive;

      return isKeeping;
    });

    // if (rollConflicts.length > 0) {
    //   const details = rollConflicts
    //     .map((s) =>
    //       `Roll No "${s.rollNumber}" is already assigned to "${s.name}" and is active. ` +
    //       `Make them inactive (if they have left) or change their roll number first.`
    //     )
    //     .join(' | ');
    //   throw new ApiError(details, 409);
    // }
    if (rollConflicts.length > 0) {
      const conflicts = rollConflicts
        .map((s) => `${s.name} (Roll ${s.rollNumber})`)
        .join(' | ');

      throw new ApiError(
        `These students are already active with conflicting roll numbers: | ${conflicts}`,
        409
      );
    }
  }

  // ── Pre-compute change report ──────────────────────────────────────────────
  const changeReport = {
    rollChanged: [] as { name: string; from: number; to: number }[],
    stdChanged: [] as { name: string; rollNumber: number; from: number; to: number }[],
    yearMoved: [] as { name: string; rollNumber: number; fromYear: string }[],
    activated: [] as { name: string; rollNumber: number }[],
    unchanged: [] as { name: string; rollNumber: number }[],
  };

  for (const { studentMongoId, rollNumber, standard } of students) {
    const prev = studentMap.get(studentMongoId)!;
    const newRoll = rollNumber ?? prev.rollNumber;
    const newStd = standard ?? prev.standard;

    if (!prev.isActive) {
      changeReport.activated.push({ name: prev.name, rollNumber: newRoll });
    } else if (prev.year !== consumerYear) {
      changeReport.yearMoved.push({ name: prev.name, rollNumber: newRoll, fromYear: prev.year });
    } else {
      const rollDiff = newRoll !== prev.rollNumber;
      const stdDiff = newStd !== prev.standard;
      if (rollDiff) changeReport.rollChanged.push({ name: prev.name, from: prev.rollNumber, to: newRoll });
      else if (stdDiff) changeReport.stdChanged.push({ name: prev.name, rollNumber: newRoll, from: prev.standard, to: newStd });
      else changeReport.unchanged.push({ name: prev.name, rollNumber: newRoll });
    }
  }
  // ── Dry-run: return report without writing ─────────────────────────────────
  if (dryRun) {
    return successResponse(
      { year: consumerYear, report: changeReport },
      200,
      'Preview ready — no changes were made.'
    );
  }
  // ── 5. Transaction ─────────────────────────────────────────────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const trulyUnchangedIds = new Set(
      students
        .filter(({ studentMongoId, rollNumber, standard }) => {
          const prev = studentMap.get(studentMongoId)!;
          const newRoll = rollNumber ?? prev.rollNumber;
          const newStd = standard ?? prev.standard;
          return (
            prev.isActive &&
            prev.year === consumerYear &&
            newRoll === prev.rollNumber &&
            newStd === prev.standard
          );
        })
        .map((s) => s.studentMongoId)
    );

    const studentsToUpdate = students.filter(
      (s) => !trulyUnchangedIds.has(s.studentMongoId)
    );

    // ── BulkWrite ────────────────────────────────────────────────────────────
    const studentBulkOps = studentsToUpdate.map(({ studentMongoId, rollNumber, standard }) => {
      const prev = studentMap.get(studentMongoId)!;
      return {
        updateOne: {
          filter: { _id: studentMongoId },
          update: {
            $set: {
              rollNumber: rollNumber ?? prev.rollNumber,
              standard: standard ?? prev.standard,
              year: consumerYear,
              isActive: true,
            },
          },
        },
      };
    });

    if (studentBulkOps.length > 0) {
      await Student.bulkWrite(studentBulkOps, { session, ordered: false });
    }

    // ── Audit logs ───────────────────────────────────────────────────────────
    const auditLogs = studentsToUpdate.map(({ studentMongoId, rollNumber, standard }) => {
      const prev = studentMap.get(studentMongoId)!;
      return {
        action: 'ROLL_NUMBER_UPDATE',
        entity: 'Student',
        entityId: studentMongoId,
        before: { rollNumber: prev.rollNumber, standard: prev.standard, year: prev.year, isActive: prev.isActive },
        after: { rollNumber: rollNumber ?? prev.rollNumber, standard: standard ?? prev.standard, year: consumerYear, isActive: true },
        performedBy: authContext.user.id,
        year: consumerYear,
        reason: `Roll assignment for ${consumerYear}`,
      };
    });

    if (auditLogs.length > 0) {
      await AuditLog.insertMany(auditLogs, { session });
    }

    await session.commitTransaction();

    return successResponse(
      { updated: studentsToUpdate.length, skipped: trulyUnchangedIds.size, year: consumerYear, report: changeReport },
      200,
      `${studentsToUpdate.length} updated, ${trulyUnchangedIds.size} already current — no changes needed.`
    );
  } catch (err: unknown) {
    await session.abortTransaction();

    // Check by shape — writeErrors + result are unique to MongoBulkWriteError
    const isBulkWriteError =
      typeof err === 'object' &&
      err !== null &&
      'writeErrors' in err &&
      'result' in err;

    // if (isBulkWriteError) {
    //   const bulkErr = err as { writeErrors: Array<{ err?: { code?: number; errmsg?: string } }> };

    //   const messages = bulkErr.writeErrors
    //     .map((e) => {
    //       if (e.err?.code !== 11000) return null;
    //       return parseCollisionMessage(e.err.errmsg ?? '');
    //     })
    //     .filter((m): m is string => m !== null);

    //   throw new ApiError(
    //     messages.length
    //       ? `Duplicate roll number — ${messages.join('; ')}`
    //       : 'Duplicate roll number collision.',
    //     409
    //   );
    // }

    if (isBulkWriteError) {
      const bulkErr = err as {
        writeErrors: Array<{ err?: { code?: number; errmsg?: string; op?: { rollNumber?: number } } }>
      };

      const conflicts = bulkErr.writeErrors
        .filter((e) => e.err?.code === 11000)
        .map((e) => {
          // Extract rollNumber from the failed operation directly
          const rollNumber = e.err?.op?.rollNumber;
          // Find student name from studentMap using rollNumber
          const student = [...studentMap.values()].find(
            (s) => s.rollNumber === rollNumber
          );
          return student
            ? `${student.name} (Roll ${rollNumber})`
            : `Roll ${rollNumber}`;
        })
        .filter(Boolean);

      throw new ApiError(
        conflicts.length
          ? `These roll numbers already exist in ${consumerYear} | ${conflicts.join(' | ')}`
          : 'Duplicate roll number collision.',
        409
      );
    }

    throw err;
  } finally {
    session.endSession();
  }
};

export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(assignRollsHandler));