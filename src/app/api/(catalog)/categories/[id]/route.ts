// app/api/categories/[id]/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Category } from '@/models/Category';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
import { withAuth, withRole, type AuthContext } from '@/lib/api/auth-helpers';
import { updateCategorySchema, type UpdateCategoryDto } from '@/lib/validations/category';

type RouteContext = { params: Promise<{ id: string }> };

const idParamsSchema = z.object({ id: objectIdSchema });

// =============================================
// GET - Single Category
// =============================================
const getCategoryHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const category = await Category.findById(id).lean();

  if (!category) {
    throw new ApiError('Category not found', 404);
  }

  return successResponse(category);
};

// =============================================
// PATCH - Update Category (Admin only)
// =============================================
const updateCategoryHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const data = await validateBody(req, updateCategorySchema);

  const category = await Category.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!category) {
    throw new ApiError('Category not found', 404);
  }

  return successResponse(category.toObject(), 200, 'Category updated successfully');
};

// =============================================
// DELETE - Delete Category (Admin only)
// =============================================
const deleteCategoryHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const result = await Category.findByIdAndDelete(id);

  if (!result) {
    throw new ApiError('Category not found', 404);
  }

  return successResponse(null, 200, 'Category deleted successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withRole(['SUPERUSER', 'ADMIN', 'SELLER'])(getCategoryHandler));
export const PATCH = withErrorHandler(withRole(['SUPERUSER', 'ADMIN', 'SELLER'])(updateCategoryHandler));
export const DELETE = withErrorHandler(withRole(['SUPERUSER'])(deleteCategoryHandler));