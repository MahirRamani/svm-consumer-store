// app/api/products/route.ts
import connectDB from '@/lib/config/db';
import { Product, type IProduct } from '@/models/Product';
import { StockTransaction } from '@/models/StockTransaction';
import { 
  withErrorHandler, 
  successResponse, 
  paginatedResponse 
} from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import {
  createProductSchema,
  getProductsQuerySchema,
  type CreateProductDto,
  type GetProductsQueryDto,
} from '@/lib/validations/product';
import mongoose, { type FilterQuery } from 'mongoose';

// =============================================
// GET - List Products with Filtering, Pagination & Stock
// =============================================
const getProductsHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getProductsQuerySchema);
  const { 
    page, 
    limit, 
    sortBy, 
    sortOrder, 
    search, 
    categoryId, 
    includeInactive,
    size,
    lowStockOnly 
  } = query;

  // Build filter
  const filter: FilterQuery<IProduct> = {};
  
  if (!includeInactive) {
    filter.isActive = true;
  }
  
  if (categoryId) {
    filter.categoryId = new mongoose.Types.ObjectId(categoryId);
  }
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ];
  }
  
  if (size) {
    filter.size = { $regex: size, $options: 'i' };
  }

  // Pagination
  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === 'desc' ? -1 : 1,
  };

  // Execute product query
  const [products, totalCount] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('categoryId', 'name description')
      .lean(),
    Product.countDocuments(filter),
  ]);

  // Get product IDs for stock lookup
  const productIds = products.map((p) => p._id);

  // Fetch stock transactions for all products (only "Buy" with quantityLeft > 0)
  const stockTransactions = await StockTransaction.find({
    productId: { $in: productIds },
    stockType: 'Buy',
    quantityLeft: { $gt: 0 },
  })
    .select('productId quantityLeft purchaseDate createdAt')
    .sort({ purchaseDate: -1 }) // Latest first
    .lean();

  // Group stock transactions by productId
  const stockByProductId: Record<string, Array<{
    _id: string;
    quantity: number;
    purchaseDate: string;
    createdAt: string;
  }>> = {};

  stockTransactions.forEach((tx) => {
    const productIdStr = tx.productId.toString();
    if (!stockByProductId[productIdStr]) {
      stockByProductId[productIdStr] = [];
    }
    stockByProductId[productIdStr].push({
      _id: tx._id.toString(),
      quantity: tx.quantityLeft,
      purchaseDate: tx.purchaseDate.toISOString(),
      createdAt: tx.createdAt.toISOString(),
    });
  });

  // Transform for response
  const transformedProducts = products.map((product) => {
    const productIdStr = product._id.toString();
    const stockEntries = stockByProductId[productIdStr] || [];
    const totalStock = stockEntries.reduce((sum, entry) => sum + entry.quantity, 0);

    return {
      ...product,
      _id: productIdStr,
      category: product.categoryId 
        ? {
            _id: (product.categoryId as any)._id?.toString(),
            name: (product.categoryId as any).name,
            description: (product.categoryId as any).description,
          }
        : null,
      categoryId: (product.categoryId as any)?._id?.toString() || product.categoryId?.toString(),
      stockEntries,
      totalStock,
    };
  });

  // Filter by low stock if requested
  let finalProducts = transformedProducts;
  if (lowStockOnly) {
    finalProducts = transformedProducts.filter((p) => {
      const threshold = p.lowStockThreshold || 10;
      return p.totalStock < threshold;
    });
  }

  return paginatedResponse('products', finalProducts, { 
    page, 
    limit, 
    totalCount: lowStockOnly ? finalProducts.length : totalCount 
  });
};

// =============================================
// POST - Create Product (Admin only)
// =============================================
const createProductHandler = async (
  req: Request, 
  authContext: AuthContext
) => {
  await connectDB();

  const data = await validateBody(req, createProductSchema);
  
  // Clean empty strings to undefined
  const cleanedData = {
    ...data,
    imageURL: data.imageURL || undefined,
    size: data.size || undefined,
    weight: data.weight || undefined,
    volume: data.volume || undefined,
    barcode: data.barcode || undefined,
  };

  const product = await Product.create(cleanedData);
  
  const populated = await product.populate({
    path: 'categoryId',
    select: 'name description',
  });

  return successResponse(
    populated.toObject(), 
    201, 
    'Product created successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getProductsHandler);
export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(createProductHandler));