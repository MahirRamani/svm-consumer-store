// app/api/sub-products/[id]/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { SubProduct } from '@/models/SubProduct';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
import { withRole, withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import { updateSubProductSchema, type UpdateSubProductDto } from '@/lib/validations/subProduct';

type RouteContext = { params: Promise<{ id: string }> };

const idParamsSchema = z.object({ id: objectIdSchema });

// =============================================
// GET - Single SubProduct
// =============================================
const getSubProductHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const subProduct = await SubProduct.findById(id)
    .populate({ path: 'productId', select: 'name' })
    .lean();

  if (!subProduct) {
    throw new ApiError('SubProduct not found', 404);
  }

  return successResponse(subProduct);
};

// =============================================
// PATCH - Update SubProduct (Admin only)
// =============================================
const updateSubProductHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const data = await validateBody(req, updateSubProductSchema);

  const subProduct = await SubProduct.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate({ path: 'productId', select: 'name' });

  if (!subProduct) {
    throw new ApiError('SubProduct not found', 404);
  }

  return successResponse(subProduct.toObject(), 200, 'SubProduct updated successfully');
};

// =============================================
// DELETE - Delete SubProduct (Admin only)
// =============================================
const deleteSubProductHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const result = await SubProduct.findByIdAndDelete(id);

  if (!result) {
    throw new ApiError('SubProduct not found', 404);
  }

  return successResponse(null, 200, 'SubProduct deleted successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getSubProductHandler));
export const PATCH = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(updateSubProductHandler));
export const DELETE = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(deleteSubProductHandler));