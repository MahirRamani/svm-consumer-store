// app/api/students/route.ts
import connectDB from '@/lib/config/db';
import { Student } from '@/models/Student';
import { withErrorHandler, successResponse, paginatedResponse } from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import {
  createStudentSchema,
  getStudentsQuerySchema,
  type CreateStudentDto,
  type GetStudentsQueryDto,
} from '@/lib/validations/student';
import type { FilterQuery } from 'mongoose';
import type { IStudent } from '@/models/Student';

// =============================================
// GET - List Students
// =============================================
const getStudentsHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getStudentsQuerySchema);
  const { page, limit, sortBy, sortOrder, search, standard, year, isActive } = query;

  // Build filter with proper typing
  const filter: FilterQuery<IStudent> = {};
  if (standard) {
    filter.standard = standard;
  }
  if (year) {
    filter.year = year;
  }
  if (isActive !== undefined) {
    filter.isActive = isActive;
  }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { rollNumber: { $regex: search, $options: 'i' } },
      { mobileNo: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === 'desc' ? -1 : 1,
  };

  const [students, totalCount] = await Promise.all([
    Student.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Student.countDocuments(filter),
  ]);

  return paginatedResponse('students', students, { page, limit, totalCount });
};

// =============================================
// POST - Create Student
// =============================================
const createStudentHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const data = await validateBody(req, createStudentSchema);
  const student = await Student.create(data);

  return successResponse(student.toObject(), 201, 'Student created successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withRole(['ADMIN', 'SUPERUSER', 'ACCOUNTANT'])(getStudentsHandler));
export const POST = withErrorHandler(withRole(['ADMIN', 'SUPERUSER', 'ACCOUNTANT'])(createStudentHandler));