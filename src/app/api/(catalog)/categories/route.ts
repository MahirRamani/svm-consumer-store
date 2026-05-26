// app/api/categories/route.ts
import connectDB from '@/lib/config/db';
import { Category, type ICategory } from '@/models/Category';
import { withErrorHandler, successResponse, paginatedResponse } from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import {
  createCategorySchema,
  getCategoriesQuerySchema,
} from '@/lib/validations/category';
import type { FilterQuery } from 'mongoose';

// =============================================
// GET - List Categories
// =============================================
const getCategoriesHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getCategoriesQuerySchema);
  const { page, limit, sortBy, sortOrder, includeInactive, search, countOnly } = query;

  // Build filter with proper typing
  const filter: FilterQuery<ICategory> = {};
  if (!includeInactive) {
    filter.isActive = true;
  }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Count only
  if (countOnly) {
    const totalCount = await Category.countDocuments(filter);
    return successResponse({ totalCount });
  }

  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === 'desc' ? -1 : 1,
  };

  const [categories, totalCount] = await Promise.all([
    Category.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter),
  ]);

  return paginatedResponse('categories', categories, { page, limit, totalCount });
};

// =============================================
// POST - Create Category (Admin only)
// =============================================
const createCategoryHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const data = await validateBody(req, createCategorySchema);
  const category = await Category.create(data);

  return successResponse(category.toObject(), 201, 'Category created successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withRole(['SUPERUSER', 'ADMIN', 'SELLER'])(getCategoriesHandler));

// Only admin can create categories
export const POST = withErrorHandler(withRole(['SUPERUSER', 'ADMIN', 'SELLER'])(createCategoryHandler));