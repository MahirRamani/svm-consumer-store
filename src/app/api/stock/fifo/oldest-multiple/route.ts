// app/api/stock/fifo/bulk/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { StockTransaction } from '@/models/StockTransaction';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { validateBody, objectIdSchema } from '@/lib/api/validation-helpers';
import mongoose from 'mongoose';

// =============================================
// Validation Schema
// =============================================
const bulkOldestStockSchema = z.object({
  productIds: z.array(objectIdSchema).min(1).max(1000),
});

type BulkOldestStockDto = z.infer<typeof bulkOldestStockSchema>;

// =============================================
// Types
// =============================================
interface OldestStockAggregation {
  _id: mongoose.Types.ObjectId;
  stockTransactionId: mongoose.Types.ObjectId;
  sellingPrice: number;
  quantityLeft: number;
  stockDate: Date;
}

// =============================================
// Handler
// =============================================
const bulkOldestStockHandler = async (req: Request) => {
  await connectDB();

  const data = await validateBody(req, bulkOldestStockSchema);
  const { productIds } = data;

  // Convert to ObjectIds
  const validIds = productIds.map((id) => new mongoose.Types.ObjectId(id));

  // Fetch oldest stock for each product using aggregation (FIFO)
  const oldestStocks = await StockTransaction.aggregate<OldestStockAggregation>([
    {
      $match: {
        productId: { $in: validIds },
        transactionType: { $in: ['Buy', 'Adjustment'] },
        quantityLeft: { $gt: 0 },
      },
    },
    {
      $sort: {
        productId: 1,
        purchaseDate: 1,
        createdAt: 1,
      },
    },
    {
      $group: {
        _id: '$productId',
        stockTransactionId: { $first: '$_id' },
        sellingPrice: { $first: '$sellingPrice' },
        quantityLeft: { $first: '$quantityLeft' },
        stockDate: { $first: '$purchaseDate' },
      },
    },
  ]);

  // // Create lookup map
  // const stockMap = new Map(
  //   oldestStocks.map((stock) => [
  //     stock._id.toString(),
  //     {
  //       stockTransactionId: stock.stockTransactionId.toString(),
  //       sellingPrice: stock.sellingPrice,
  //       quantityLeft: stock.quantityLeft,
  //       stockDate: stock.stockDate,
  //     },
  //   ])
  // );

  const stockMap = new Map(
    oldestStocks.map((stock) => [
      stock._id.toString(),
      {
        stockTransactionId: stock.stockTransactionId.toString(),
        sellingPrice: stock.sellingPrice ? parseFloat(stock.sellingPrice.toString()) : 0, // ADD THIS
        quantityLeft: stock.quantityLeft,
        stockDate: stock.stockDate,
      },
    ])
  );

  // Build response maintaining order of input IDs
  const result = validIds.map((id) => {
    const idString = id.toString();
    const stockData = stockMap.get(idString);

    return {
      productId: idString,
      stock: stockData || null,
    };
  });

  // Separate items with/without stock
  const withStock = result.filter((item) => item.stock !== null);
  const withoutStock = result.filter((item) => item.stock === null);

  return successResponse(
    {
      data: result,
      summary: {
        total: validIds.length,
        withStock: withStock.length,
        withoutStock: withoutStock.length,
      },
    },
    200,
    'Bulk oldest stock fetched successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const POST = withErrorHandler(bulkOldestStockHandler);