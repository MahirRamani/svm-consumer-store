// app/api/students/[id]/balance/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Student } from '@/models/Student';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateParams } from '@/lib/api/validation-helpers';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';

type RouteContext = { params: Promise<{ id: string }> };

const idParamsSchema = z.object({
  id: z.string().min(1, 'Student ID is required'),
});

const balanceUpdateSchema = z.object({
  amount: z.number().int().min(-100000).max(100000),
  reason: z.string().min(1).max(200),
});

// =============================================
// PATCH - Update Student Balance
// =============================================
const updateBalanceHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const { amount, reason } = await validateBody(req, balanceUpdateSchema);

  const student = await Student.findById(id);

  if (!student) {
    throw new ApiError('Student not found', 404);
  }

  // Update balance
  student.balance = (student.balance || 0) + amount;
  
  // Optionally: Add transaction record, prevent negative balance, etc.
  if (student.balance < 0) {
    throw new ApiError('Insufficient balance', 400);
  }

  await student.save();

  return successResponse(student.toObject(), 200, 'Balance updated successfully');
};

export const PATCH = withErrorHandler(withAuth(updateBalanceHandler));