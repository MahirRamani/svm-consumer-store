// app/api/products/[id]/route.ts
import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Product } from '@/models/Product';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateParams, objectIdSchema } from '@/lib/api/validation-helpers';
import { withAuth, withRole, type AuthContext } from '@/lib/api/auth-helpers';
import { updateProductSchema, type UpdateProductDto } from '@/lib/validations/product';

type RouteContext = { params: Promise<{ id: string }> };

const idParamsSchema = z.object({ id: objectIdSchema });

// =============================================
// GET - Single Product
// =============================================
const getProductHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const product = await Product.findById(id).populate('categoryId', 'name').lean();

  if (!product) {
    throw new ApiError('Product not found', 404);
  }

  return successResponse(product);
};

// =============================================
// PATCH - Update Product (Admin only)
// =============================================
const updateProductHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const data = await validateBody(req, updateProductSchema);

  const product = await Product.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate('categoryId', 'name');

  if (!product) {
    throw new ApiError('Product not found', 404);
  }

  return successResponse(product.toObject(), 200, 'Product updated successfully');
};

// =============================================
// DELETE - Delete Product (Admin only)
// =============================================
const deleteProductHandler = async (
  req: Request,
  authContext: AuthContext,
  routeContext?: RouteContext
) => {
  await connectDB();

  const { id } = validateParams(await routeContext!.params, idParamsSchema);
  const result = await Product.findByIdAndDelete(id);

  if (!result) {
    throw new ApiError('Product not found', 404);
  }

  return successResponse(null, 200, 'Product deleted successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getProductHandler));
export const PATCH = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(updateProductHandler));
export const DELETE = withErrorHandler(withRole(['SUPERUSER', 'ADMIN'])(deleteProductHandler));