// app/api/sub-products/route.ts
import connectDB from '@/lib/config/db';
import { SubProduct, type ISubProduct } from '@/models/SubProduct';
import { Product } from '@/models/Product';
import { withErrorHandler, successResponse, paginatedResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import {
  createSubProductSchema,
  getSubProductsQuerySchema,
  type CreateSubProductDto,
  type GetSubProductsQueryDto,
} from '@/lib/validations/subProduct';
import mongoose, { type FilterQuery } from 'mongoose';

// =============================================
// GET - List SubProducts
// =============================================
const getSubProductsHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getSubProductsQuerySchema);
  const { page, limit, sortBy, sortOrder, search, productId, includeInactive } = query;

  // Build filter with proper typing
  const filter: FilterQuery<ISubProduct> = {};
  if (productId) {
    filter.productId = new mongoose.Types.ObjectId(productId);
  }
  if (!includeInactive) {
    filter.isActive = true;
  }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { size: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === 'desc' ? -1 : 1,
  };

  const [subProducts, totalCount] = await Promise.all([
    SubProduct.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'productId', select: 'name' })
      .lean(),
    SubProduct.countDocuments(filter),
  ]);

  return paginatedResponse('subProducts', subProducts, { page, limit, totalCount });
};

// =============================================
// POST - Create SubProduct (Admin only)
// =============================================
const createSubProductHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const data = await validateBody(req, createSubProductSchema);

  // Verify parent product exists
  const parentProduct = await Product.findById(data.productId);
  if (!parentProduct) {
    throw new ApiError('Parent product not found', 404);
  }

  const subProduct = await SubProduct.create(data);
  const populated = await subProduct.populate({ path: 'productId', select: 'name' });

  return successResponse(populated.toObject(), 201, 'SubProduct created successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getSubProductsHandler);
export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(createSubProductHandler));