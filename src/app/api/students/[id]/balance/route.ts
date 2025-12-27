// app/api/students/[id]/balance/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Student } from '@/models/Student';
import { Transaction } from '@/models/Transaction';
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

  // Calculate new balance
  const newBalance = (student.balance || 0) + amount;
  
  // Prevent negative balance for deductions
  if (newBalance < 0) {
    throw new ApiError('Insufficient balance', 400);
  }

  // Determine transaction type based on amount
  const transactionType = amount > 0 ? 'Topup' : 'Deduction';

  // Create transaction record
  const transaction = await Transaction.create({
    studentId: student._id,
    items: [], // No items for topup/deduction
    totalAmount: Math.abs(amount), // Always positive in transaction record
    status: 'Completed',
    transactionType,
    reason,
    performedBy: authContext.user?.id,
  });

  // Update student balance
  student.balance = newBalance;
  await student.save();

  return successResponse(
    {
      student: student.toObject(),
      transaction: transaction.toObject(),
    },
    200,
    `Balance ${transactionType.toLowerCase()} successful`
  );
};

export const PATCH = withErrorHandler(withAuth(updateBalanceHandler));