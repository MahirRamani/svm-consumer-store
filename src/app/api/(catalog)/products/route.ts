// app/api/products/route.ts
import connectDB from '@/lib/config/db';
import { Product, type IProduct } from '@/models/Product';
import { withErrorHandler, successResponse, paginatedResponse } from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import {
  createProductSchema,
  getProductsQuerySchema,
  type CreateProductDto,
  type GetProductsQueryDto,
} from '@/lib/validations/product';
import mongoose, { type FilterQuery, type PipelineStage } from 'mongoose';

// =============================================
// GET - List Products
// =============================================
const getProductsHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getProductsQuerySchema);
  const { page, limit, sortBy, sortOrder, search, categoryId, includeInactive, countOnly } = query;

  // Build aggregation match stage with proper typing
  const matchStage: FilterQuery<IProduct> = {};
  if (!includeInactive) {
    matchStage.isActive = true;
  }
  if (categoryId) {
    matchStage.categoryId = new mongoose.Types.ObjectId(categoryId);
  }
  if (search) {
    matchStage.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const aggregationPipeline: PipelineStage[] = [
    { $match: matchStage },
    // Join with categories
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'categoryInfo',
      },
    },
    // Join with subproducts to count variants
    {
      $lookup: {
        from: 'subproducts',
        localField: '_id',
        foreignField: 'productId',
        as: 'variants',
      },
    },
    // Reshape document
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        priority: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        categoryId: 1,
        category: {
          $cond: {
            if: { $gt: [{ $size: '$categoryInfo' }, 0] },
            then: {
              id: { $toString: { $arrayElemAt: ['$categoryInfo._id', 0] } },
              name: { $arrayElemAt: ['$categoryInfo.name', 0] },
            },
            else: null,
          },
        },
        variantCount: { $size: '$variants' },
        hasVariants: { $gt: [{ $size: '$variants' }, 0] },
      },
    },
  ];

  // Count only
  if (countOnly) {
    const countPipeline: PipelineStage[] = [
      ...aggregationPipeline,
      { $count: 'totalCount' },
    ];
    const result = await Product.aggregate(countPipeline);
    const totalCount = result[0]?.totalCount || 0;
    return successResponse({ totalCount });
  }

  // Pagination with $facet - FIX: Use 1 | -1 for sort
  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === 'desc' ? -1 : 1,
  };

  const facetStage: PipelineStage = {
    $facet: {
      data: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
      metadata: [{ $count: 'total' }],
    },
  };

  const aggregateResult = await Product.aggregate([...aggregationPipeline, facetStage]);

  const result = aggregateResult[0] as {
    data: unknown[];
    metadata: Array<{ total: number }>;
  };

  const products = result.data;
  const totalCount = result.metadata[0]?.total || 0;

  return paginatedResponse('products', products, { page, limit, totalCount });
};

// =============================================
// POST - Create Product (Admin only)
// =============================================
const createProductHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const data = await validateBody(req, createProductSchema);
  const product = await Product.create(data);
  const populated = await product.populate({ path: 'categoryId', select: 'name' });

  return successResponse(populated.toObject(), 201, 'Product created successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getProductsHandler);
export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(createProductHandler));