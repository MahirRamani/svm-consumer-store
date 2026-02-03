// app/api/students/[id]/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Student } from '@/models/Student';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
import { withAuth, withRole, type AuthContext } from '@/lib/api/auth-helpers';
import { updateStudentSchema, type UpdateStudentDto } from '@/lib/validations/student';

type RouteContext = { params: Promise<{ id: string }> };

// const idParamsSchema = z.object({ id: objectIdSchema });
const idParamsSchema = z.object({
  id: z.string().min(1, 'Roll number is required'),
});

// =============================================
// GET - Single Student
// =============================================
const getStudentHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  // const student = await Student.findById(id).lean();
  const student = await Student.findOne({ rollNumber: id }).lean();

  if (!student) {
    throw new ApiError('Student not found', 404);
  }

  return successResponse(student);
};

// =============================================
// PATCH - Update Student
// =============================================
const updateStudentHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const data = await validateBody(req, updateStudentSchema);

  const student = await Student.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!student) {
    throw new ApiError('Student not found', 404);
  }

  return successResponse(student.toObject(), 200, 'Student updated successfully');
};

// =============================================
// DELETE - Delete Student
// =============================================
const deleteStudentHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const result = await Student.findByIdAndDelete(id);

  if (!result) {
    throw new ApiError('Student not found', 404);
  }

  return successResponse(null, 200, 'Student deleted successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getStudentHandler));
export const PUT = withErrorHandler(withRole(['SUPERUSER', 'ACCOUNTANT'])(updateStudentHandler));
export const DELETE = withErrorHandler(withRole(['SUPERUSER'])(deleteStudentHandler));