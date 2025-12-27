import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { StockTransaction } from '@/models/StockTransaction';
import { SubProduct } from '@/models/SubProduct';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { validateQuery } from '@/lib/api/validation-helpers';
import mongoose from 'mongoose';

// =============================================
// Validation Schema
// =============================================
const getSubProductsWithStockSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// =============================================
// Types
// =============================================
interface SubProductDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  size: string;
  barcode: string;
  lowStockThreshold: number;
  imageURL?: string;
}

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
const getSubProductsWithStockHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getSubProductsWithStockSchema);
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  // Fetch active sub-products with pagination
  const [activeSubProducts, totalCount] = await Promise.all([
    SubProduct.find({ isActive: true })
      .select('_id name size barcode lowStockThreshold imageURL')
      .skip(skip)
      .limit(limit)
      .lean<SubProductDoc[]>(),
    SubProduct.countDocuments({ isActive: true }),
  ]);

  // Early return if no sub-products
  if (activeSubProducts.length === 0) {
    return successResponse(
      {
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      },
      200,
      'No active sub-products found'
    );
  }

  const subProductIds = activeSubProducts.map((sp) => sp._id);

  // Fetch oldest stock for ONLY the paginated sub-products
  const oldestStocks = await StockTransaction.aggregate<OldestStockAggregation>([
    {
      $match: {
        subProductId: { $in: subProductIds },
        transactionType: { $in: ['Buy', 'Adjustment'] },
        quantityLeft: { $gt: 0 },
      },
    },
    { $sort: { subProductId: 1, date: 1, createdAt: 1 } }, // FIFO per sub-product
    {
      $group: {
        _id: '$subProductId',
        stockTransactionId: { $first: '$_id' },
        sellingPrice: { $first: '$sellingPrice' },
        quantityLeft: { $first: '$quantityLeft' },
        stockDate: { $first: '$date' },
      },
    },
  ]);

  // Create efficient lookup map
  const stockMap = new Map(
    oldestStocks.map((stock) => [
      stock._id.toString(),
      {
        stockTransactionId: stock.stockTransactionId.toString(),
        sellingPrice: stock.sellingPrice,
        quantityLeft: stock.quantityLeft,
        stockDate: stock.stockDate,
      },
    ])
  );

  // Combine data
  const result = activeSubProducts.map((subProduct) => {
    const stockData = stockMap.get(subProduct._id.toString());

    return {
      subProductId: subProduct._id.toString(),
      name: subProduct.name,
      size: subProduct.size,
      barcode: subProduct.barcode,
      imageURL: subProduct.imageURL || null,
      lowStockThreshold: subProduct.lowStockThreshold,
      currentStock: stockData || null,
    };
  });

  return successResponse(
    {
      data: result,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    },
    200,
    'Sub-products with stock fetched successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getSubProductsWithStockHandler);