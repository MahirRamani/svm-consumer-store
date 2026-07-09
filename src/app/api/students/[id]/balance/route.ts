// app/api/students/[id]/balance/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Student } from '@/models';
import { Transaction } from '@/models';
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
  const type = amount > 0 ? 'Topup' : 'Deduction';

  // Create transaction record
  const transaction = await Transaction.create({
    studentId: student._id,
    rollNumber: student.rollNumber,
    year: student.year,
    items: [], // No items for topup/deduction
    totalAmount: Math.abs(amount), // Always positive in transaction record
    status: 'Completed',
    type,
    reason,
    performedBy: authContext.user?.id,
  });

  // // Update student balance
  // student.balance = newBalance;
  // await student.save();

  const updated = await Student.findByIdAndUpdate(
    id,
    { $set: { balance: newBalance } },
    { new: true, runValidators: true, context: 'query' }
  );

  return successResponse(
    {
      rollNumber: student.rollNumber,
      newBalance: updated!.balance,
      action: type === 'Topup' ? 'added to' : 'deducted from',
    },
    200,
    `Balance ${type.toLowerCase()} successful`
  );

  // return successResponse(
  //   {
  //     student: student.toObject(),
  //     transaction: transaction.toObject(),
  //   },
  //   200,
  //   `Balance ${type.toLowerCase()} successful`
  // );
};

export const PATCH = withErrorHandler(withAuth(updateBalanceHandler));