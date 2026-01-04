// app/api/stock/fifo/oldest-all/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { StockTransaction } from '@/models/StockTransaction';
import { Product } from '@/models/Product';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { validateQuery } from '@/lib/api/validation-helpers';
import mongoose from 'mongoose';

// =============================================
// Validation Schema
// =============================================
const getProductsWithStockSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(500),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

// =============================================
// Types
// =============================================
interface ProductDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
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
const getProductsWithStockHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getProductsWithStockSchema);
  const { page, limit, categoryId } = query;
  const skip = (page - 1) * limit;

  // Build filter
  const filter: mongoose.FilterQuery<typeof Product> = { isActive: true };
  if (categoryId) {
    filter.categoryId = new mongoose.Types.ObjectId(categoryId);
  }

  // Fetch active products with pagination
  const [activeProducts, totalCount] = await Promise.all([
    Product.find(filter)
      .select('_id name size weight volume barcode lowStockThreshold imageURL')
      .skip(skip)
      .limit(limit)
      .lean<ProductDoc[]>(),
    Product.countDocuments(filter),
  ]);

  // Early return if no products
  if (activeProducts.length === 0) {
    return successResponse(
      {
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
        summary: {
          total: 0,
          withStock: 0,
          withoutStock: 0,
        },
      },
      200,
      'No active products found'
    );
  }

  const productIds = activeProducts.map((p) => p._id);

  // Fetch oldest stock for ONLY the paginated products (FIFO)
  const oldestStocks = await StockTransaction.aggregate<OldestStockAggregation>([
    {
      $match: {
        productId: { $in: productIds },
        transactionType: { $in: ['Buy', 'Adjustment'] },
        quantityLeft: { $gt: 0 },
      },
    },
    { $sort: { productId: 1, purchaseDate: 1, createdAt: 1 } }, // FIFO per product
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

  // Create efficient lookup map
  const stockMap = new Map(
    oldestStocks.map((stock) => [
      stock._id.toString(),
      {
        stockTransactionId: stock.stockTransactionId.toString(),
        sellingPrice: parseInt(stock.sellingPrice.toString()),
        quantityLeft: stock.quantityLeft,
        stockDate: stock.stockDate,
      },
    ])
  );

  // Combine data
  const result = activeProducts.map((product) => {
    const stockData = stockMap.get(product._id.toString());

    return {
      productId: product._id.toString(),
      name: product.name,
      size: product.size || null,
      weight: product.weight || null,
      volume: product.volume || null,
      barcode: product.barcode || null,
      imageURL: product.imageURL || null,
      lowStockThreshold: product.lowStockThreshold,
      currentStock: stockData || null,
    };
  });

  // Calculate summary
  const withStock = result.filter((item) => item.currentStock !== null).length;
  const withoutStock = result.filter((item) => item.currentStock === null).length;

  return successResponse(
    {
      data: result,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        total: totalCount,
        withStock,
        withoutStock,
      },
    },
    200,
    'Products with stock fetched successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getProductsWithStockHandler);