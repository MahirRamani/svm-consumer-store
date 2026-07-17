// app/api/transactions/[id]/revert/route.ts
import connectDB from '@/lib/config/db';
import { Transaction } from '@/models';
import { Student } from '@/models';
import { StockTransaction } from '@/models';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import mongoose from 'mongoose';
import { z } from 'zod';

// =============================================
// Validation Schemas
// =============================================
const revertItemSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  stockTransactionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  quantity: z.number().int().positive(),
  price: z.number().min(0),
  totalPrice: z.number().min(0),
});

const revertTransactionSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  revertType: z.enum(['Full', 'Partial']),
  items: z.array(revertItemSchema).optional(), // Required for partial revert
});

type RevertTransactionDto = z.infer<typeof revertTransactionSchema>;

// =============================================
// Helper: Restore Stock
// =============================================
async function restoreStock(
  stockTransactionId: mongoose.Types.ObjectId,
  quantityToRestore: number,
  session?: mongoose.ClientSession
): Promise<void> {
  const stockTransaction = await StockTransaction.findById(stockTransactionId);

  if (!stockTransaction) {
    throw new ApiError(`Stock transaction not found: ${stockTransactionId}`, 404);
  }

  if (stockTransaction.stockType !== 'Buy') {
    throw new ApiError(
      `Cannot restore stock to non-Buy transaction: ${stockTransactionId}`,
      400
    );
  }

  // Restore the quantity
  stockTransaction.quantityLeft += quantityToRestore;

  // If quantity was 0 and we're restoring, clear endedAt
  if (stockTransaction.endedAt && stockTransaction.quantityLeft > 0) {
    stockTransaction.endedAt = null;
  }

  await stockTransaction.save();
}

// =============================================
// POST - Revert Transaction (Full or Partial)
// =============================================
const revertTransactionHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: { params: Promise<{ id: string }> }
) => {
  await connectDB();

  const { id } = await routeContext!.params;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError('Invalid transaction ID', 400);
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError('Invalid JSON in request body', 400);
  }

  const result = revertTransactionSchema.safeParse(body);

  if (!result.success) {
    const details = result.error.issues.reduce((acc, err) => {
      const path = err.path.join('.');
      acc[path] = err.message;
      return acc;
    }, {} as Record<string, string>);

    throw new ApiError('Validation failed', 400, 'VALIDATION_ERROR', details);
  }

  const data: RevertTransactionDto = result.data;

  // ✅ Start session — all DB writes are atomic
  const session = await mongoose.startSession();

  try {
    let responsePayload: unknown;

    await session.withTransaction(async () => {
      const originalTransaction = await Transaction.findById(id).session(session);
      if (!originalTransaction) throw new ApiError('Transaction not found', 404);

      if (originalTransaction.type !== 'Purchase') {
        throw new ApiError('Only Purchase transactions can be reverted', 400);
      }
      if (originalTransaction.status === 'Cancelled') {
        throw new ApiError('Transaction is already cancelled', 400);
      }

      const existingRevert = await Transaction.findOne({
        type: { $in: ['Revert', 'Partial Revert'] },
        reason: { $regex: id, $options: 'i' },
      }).session(session);

      if (existingRevert && data.revertType === 'Full') {
        throw new ApiError('Transaction has already been reverted', 400);
      }

      const student = await Student.findById(originalTransaction.studentId).session(session);
      if (!student) throw new ApiError('Student not found', 404);

      let revertAmount = 0;
      let revertItems: typeof originalTransaction.items = [];

      if (data.revertType === 'Full') {
        revertAmount = originalTransaction.totalAmount;
        revertItems = originalTransaction.items || [];

        if (revertItems.length > 0) {
          await Promise.all(
            revertItems.map(async (item) => {
              if (item.stockTransactionId) {
                await restoreStock(
                  new mongoose.Types.ObjectId(item.stockTransactionId),
                  item.quantity,
                  session  // ✅ pass session
                );
              }
            })
          );
        }

        originalTransaction.type = 'Reverted';
        originalTransaction.status = 'Cancelled';
        originalTransaction.id = student.id;
        originalTransaction.year = student.year;
        originalTransaction.rollNumber = student.rollNumber
        await originalTransaction.save({ session });
      } else {
        if (!data.items || data.items.length === 0) {
          throw new ApiError('Items are required for partial revert', 400);
        }

        const originalItemsMap = new Map(
          (originalTransaction.items || []).map(item => [item.productId.toString(), item])
        );

        revertItems = await Promise.all(
          data.items.map(async (item) => {
            const originalItem = originalItemsMap.get(item.productId);
            if (!originalItem) {
              throw new ApiError(`Product ${item.productId} not found in original transaction`, 400);
            }
            if (item.quantity > originalItem.quantity) {
              throw new ApiError(
                `Revert quantity (${item.quantity}) exceeds original quantity (${originalItem.quantity})`,
                400
              );
            }

            if (item.stockTransactionId) {
              await restoreStock(
                new mongoose.Types.ObjectId(item.stockTransactionId),
                item.quantity,
                session  // ✅ pass session
              );
            }

            revertAmount += item.totalPrice;

            return {
              categoryId: originalItem.categoryId,
              productId: new mongoose.Types.ObjectId(item.productId),
              stockTransactionId: new mongoose.Types.ObjectId(item.stockTransactionId),
              quantity: item.quantity,
              price: item.price,
              totalPrice: item.totalPrice,
            };
          })
        );

        originalTransaction.type = 'Partial Reverted';
        // originalTransaction.status = 'Cancelled';
        originalTransaction.id = student.id;
        originalTransaction.year = student.year;
        originalTransaction.rollNumber = student.rollNumber;
        await originalTransaction.save({ session });
      }

      const updatedStudent = await Student.findByIdAndUpdate(
        originalTransaction.studentId,
        { $inc: { balance: revertAmount } },
        { new: true, runValidators: true, session }  // ✅ pass session
      );

      // ✅ If this throws (e.g. missing `id` field), everything above rolls back
      const revertTransaction = await Transaction.create(
        [{
          studentId: originalTransaction.studentId,
          id: originalTransaction.id ?? student.id,
          year: originalTransaction.year,
          rollNumber: originalTransaction.rollNumber,
          items: revertItems,
          totalAmount: revertAmount,
          status: 'Completed',
          type: data.revertType === 'Full' ? 'Revert' : 'Partial Revert',
          reason: `${data.revertType === 'Full' ? 'Full' : 'Partial'} revert of transaction ${id}: ${data.reason}`,
          performedBy: authContext.user.id,
        }],
        { session }  // ✅ create() with session needs array form
      );

      responsePayload = {
        revertTransaction: revertTransaction[0],
        originalTransaction: {
          id: originalTransaction._id,
          status: originalTransaction.status,
          type: originalTransaction.type,
        },
        student: {
          id: updatedStudent?._id,
          name: updatedStudent?.name,
          rollNumber: updatedStudent?.rollNumber,
          previousBalance: student.balance,
          newBalance: updatedStudent?.balance,
          amountRestored: revertAmount,
        },
        summary: {
          revertType: data.revertType,
          totalItemsReverted: revertItems.length,
          totalAmountRestored: revertAmount,
        },
      };
    });

    return successResponse(
      responsePayload,
      201,
      `Transaction ${data.revertType === 'Full' ? 'fully' : 'partially'} reverted successfully`
    );
  } finally {
    await session.endSession();  // ✅ always clean up
  }
};
// =============================================
// Export Route
// =============================================
export const POST = withErrorHandler(withAuth(revertTransactionHandler));