import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { StockTransaction } from '@/models/StockTransaction';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { validateQuery, objectIdSchema } from '@/lib/api/validation-helpers';
import mongoose from 'mongoose';

// =============================================
// Validation Schema
// =============================================
const getOldestStockSchema = z.object({
  subProductId: objectIdSchema,
});

// =============================================
// Handler
// =============================================
const getOldestStockHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getOldestStockSchema);
  const { subProductId } = query;

  // Fetch oldest available stock (FIFO)
  const oldestStock = await StockTransaction.findOne({
    subProductId: new mongoose.Types.ObjectId(subProductId),
    transactionType: { $in: ['Buy', 'Adjustment'] },
    quantityLeft: { $gt: 0 },
  })
    .sort({ date: 1, createdAt: 1 })
    .select('_id sellingPrice quantityLeft date')
    .lean<{
      _id: mongoose.Types.ObjectId;
      sellingPrice: number;
      quantityLeft: number;
      date: Date;
    }>();

  // No stock available
  if (!oldestStock) {
    return successResponse(null, 200, 'No available stock for this sub-product');
  }

  // Return formatted response
  return successResponse(
    {
      stockTransactionId: oldestStock._id.toString(),
      subProductId,
      sellingPrice: oldestStock.sellingPrice,
      quantityLeft: oldestStock.quantityLeft,
      stockDate: oldestStock.date,
    },
    200,
    'Oldest stock fetched successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getOldestStockHandler);