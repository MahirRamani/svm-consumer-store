import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Student } from '@/models/Student';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
 
// GET — students without id assigned
const getStudentsWithoutIdHandler = async (req: Request) => {
  await connectDB();
 
  const students = await Student.find({
    $or: [{ id: null }, { id: '' }, { id: { $exists: false } }],
    isActive: true,
  })
    .select('_id rollNumber name standard year')
    .sort({ standard: 1, rollNumber: 1 })
    .lean();
 
  return successResponse(students);
};
 
// POST — bulk assign ids
// Body: [{ studentMongoId: string, id: string }, ...]
const bulkAssignIdSchema = z.object({
  assignments: z.array(
    z.object({
      studentMongoId: z.string().min(1),
      id: z.string().trim().regex(/^\d+$/, 'ID must be numbers only').min(1),
    })
  ).min(1).max(500),
});
 
const bulkAssignIdHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();
 
  const { assignments } = await validateBody(req, bulkAssignIdSchema);
 
  // Check all IDs are unique within the batch
  const ids = assignments.map((a) => a.id);
  if (new Set(ids).size !== ids.length) {
    throw new ApiError('Duplicate IDs in request', 400);
  }
 
  // Check none of these IDs already exist in DB
  const existing = await Student.find({ id: { $in: ids } }).select('id').lean();
  if (existing.length > 0) {
    const taken = existing.map((s) => s.id).join(', ');
    throw new ApiError(`These IDs are already taken: ${taken}`, 400);
  }
 
  // Bulk write — one DB round-trip for all updates
  const bulkOps = assignments.map(({ studentMongoId, id }) => ({
    updateOne: {
      filter: { _id: studentMongoId },
      update: { $set: { id } },
    },
  }));
 
  const result = await Student.bulkWrite(bulkOps);
 
  return successResponse(
    { updated: result.modifiedCount },
    200,
    `${result.modifiedCount} student IDs assigned successfully`
  );
};
 
export const GET  = withErrorHandler(withRole(['SUPERUSER', 'ACCOUNTANT', 'ADMIN'])(getStudentsWithoutIdHandler));
export const POST = withErrorHandler(withRole(['SUPERUSER', 'ACCOUNTANT', 'ADMIN'])(bulkAssignIdHandler));
 
