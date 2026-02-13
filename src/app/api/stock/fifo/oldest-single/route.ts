// app/api/stock/fifo/oldest-single/route.ts
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
  productId: objectIdSchema,
});

// =============================================
// Handler
// =============================================
const getOldestStockHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getOldestStockSchema);
  const { productId } = query;

  // Fetch oldest available stock (FIFO)
  const oldestStock = await StockTransaction.findOne({
    productId: new mongoose.Types.ObjectId(productId),
    stockType: { $in: ['Buy', 'Adjustment'] },
    quantityLeft: { $gt: 0 },
  })
    .sort({ purchaseDate: 1, createdAt: 1 })
    .select('_id sellingPrice quantityLeft purchaseDate')
    .lean<{
      _id: mongoose.Types.ObjectId;
      sellingPrice: number;
      quantityLeft: number;
      purchaseDate: Date;
    }>();

  // No stock available
  if (!oldestStock) {
    return successResponse(null, 200, 'No available stock for this product');
  }

  // Return formatted response
  return successResponse(
    {
      stockTransactionId: oldestStock._id.toString(),
      productId,
      sellingPrice: parseInt(oldestStock.sellingPrice.toString()),
      quantityLeft: oldestStock.quantityLeft,
      stockDate: oldestStock.purchaseDate,
    },
    200,
    'Oldest stock fetched successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getOldestStockHandler);