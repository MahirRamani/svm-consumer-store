import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Product, type IProduct } from '@/models/Product';
import { SubProduct, type ISubProduct } from '@/models/SubProduct';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { validateQuery } from '@/lib/api/validation-helpers';
import mongoose from 'mongoose';

// =============================================
// Types for populated category
// =============================================
interface PopulatedCategory {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
}

interface ProductWithPopulatedCategory extends Omit<IProduct, 'categoryId'> {
  categoryId: PopulatedCategory | mongoose.Types.ObjectId | null;
}

// =============================================
// Validation Schema (FIXED)
// =============================================
const getProductsWithVariantsSchema = z.object({
  categoryId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  // FIX: Properly handle undefined - don't transform undefined to false
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  productId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  // FIX: Same fix for hasVariants
  hasVariants: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

type GetProductsWithVariantsQuery = z.infer<typeof getProductsWithVariantsSchema>;

// =============================================
// Handler
// =============================================
const getProductsWithVariantsHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getProductsWithVariantsSchema);
  const { categoryId, isActive, productId, hasVariants, search, page, limit } = query;

  // Build filter
  const productFilter: mongoose.FilterQuery<IProduct> = {};

  if (productId) {
    productFilter._id = new mongoose.Types.ObjectId(productId);
  }

  if (categoryId) {
    productFilter.categoryId = new mongoose.Types.ObjectId(categoryId);
  }

  // FIX: Only add isActive filter if it's explicitly provided
  if (isActive !== undefined) {
    productFilter.isActive = isActive;
  }

  // FIX: Only add hasVariants filter if it's explicitly provided
  if (hasVariants !== undefined) {
    productFilter.hasVariants = hasVariants;
  }

  if (search) {
    productFilter.name = { $regex: search, $options: 'i' };
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Fetch products with count
  const [products, total] = await Promise.all([
    Product.find(productFilter)
      .populate('categoryId', 'name description')
      .sort({ priority: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean<ProductWithPopulatedCategory[]>(),
    Product.countDocuments(productFilter),
  ]);

  // Get all product IDs to fetch variants
  const productIds = products.map((p) => p._id);

  // Fetch all variants for these products in one query
  const variants = await SubProduct.find({
    productId: { $in: productIds },
  })
    .sort({ priority: -1, name: 1 })
    .lean<ISubProduct[]>();

  // Group variants by productId
  const variantsByProductId = variants.reduce(
    (acc, variant) => {
      const prodId = variant.productId.toString();
      if (!acc[prodId]) {
        acc[prodId] = [];
      }
      acc[prodId].push(variant);
      return acc;
    },
    {} as Record<string, ISubProduct[]>
  );

  // Helper to check if categoryId is populated
  const isPopulatedCategory = (
    cat: PopulatedCategory | mongoose.Types.ObjectId | null
  ): cat is PopulatedCategory => {
    return cat !== null && typeof cat === 'object' && 'name' in cat;
  };

  // Combine products with their variants
  // FIX: Return _id instead of id to match frontend expectations
  const productsWithVariants = products.map((product) => ({
    _id: product._id.toString(), // Changed from 'id' to '_id'
    name: product.name,
    description: product.description,
    priority: product.priority,
    isActive: product.isActive,
    hasVariants: product.hasVariants,
    variantCount: variantsByProductId[product._id.toString()]?.length || 0,
    categoryId: isPopulatedCategory(product.categoryId)
      ? {
          _id: product.categoryId._id.toString(),
          name: product.categoryId.name,
          description: product.categoryId.description,
        }
      : product.categoryId?.toString() || null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    // FIX: Return _id instead of id for variants
    variants: (variantsByProductId[product._id.toString()] || []).map((v) => ({
      _id: v._id.toString(), // Changed from 'id' to '_id'
      productId: v.productId.toString(),
      name: v.name,
      description: v.description,
      priority: v.priority,
      imageURL: v.imageURL,
      size: v.size,
      lowStockThreshold: v.lowStockThreshold,
      weight: v.weight,
      volume: v.volume,
      barcode: v.barcode,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    })),
  }));

  return successResponse(
    {
      products: productsWithVariants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    200,
    'Products with variants fetched successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getProductsWithVariantsHandler);





// import { z } from 'zod';
// import connectDB from '@/lib/config/db';
// import { Product, type IProduct } from '@/models/Product';
// import { SubProduct, type ISubProduct } from '@/models/SubProduct';
// import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
// import { validateQuery } from '@/lib/api/validation-helpers';
// import mongoose from 'mongoose';

// // =============================================
// // Validation Schema
// // =============================================
// const getProductsWithVariantsSchema = z.object({
//   categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
//   isActive: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
//   productId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
//   hasVariants: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
//   search: z.string().optional(),
//   page: z.coerce.number().int().min(1).default(1),
//   limit: z.coerce.number().int().min(1).max(100).default(50),
// });

// type GetProductsWithVariantsQuery = z.infer<typeof getProductsWithVariantsSchema>;

// // =============================================
// // Handler
// // =============================================
// const getProductsWithVariantsHandler = async (req: Request) => {
//   await connectDB();

//   const query = validateQuery(req, getProductsWithVariantsSchema);
//   const { categoryId, isActive, productId, hasVariants, search, page, limit } = query;

//   // Build filter
//   const productFilter: mongoose.FilterQuery<IProduct> = {};

//   if (productId) {
//     productFilter._id = new mongoose.Types.ObjectId(productId);
//   }

//   if (categoryId) {
//     productFilter.categoryId = new mongoose.Types.ObjectId(categoryId);
//   }

//   if (isActive !== undefined) {
//     productFilter.isActive = isActive;
//   }

//   if (hasVariants !== undefined) {
//     productFilter.hasVariants = hasVariants;
//   }

//   if (search) {
//     productFilter.name = { $regex: search, $options: 'i' };
//   }

//   // Calculate pagination
//   const skip = (page - 1) * limit;

//   // Fetch products with count
//   const [products, total] = await Promise.all([
//     Product.find(productFilter)
//       .populate('categoryId', 'name description')
//       .sort({ priority: -1, name: 1 })
//       .skip(skip)
//       .limit(limit)
//       .lean<IProduct[]>(),
//     Product.countDocuments(productFilter),
//   ]);

//   // Get all product IDs to fetch variants
//   const productIds = products.map((p) => p._id);

//   // Fetch all variants for these products in one query
//   const variants = await SubProduct.find({
//     productId: { $in: productIds },
//   })
//     .sort({ priority: -1, name: 1 })
//     .lean<ISubProduct[]>();

//   // Group variants by productId
//   const variantsByProductId = variants.reduce((acc, variant) => {
//     const productId = variant.productId.toString();
//     if (!acc[productId]) {
//       acc[productId] = [];
//     }
//     acc[productId].push(variant);
//     return acc;
//   }, {} as Record<string, ISubProduct[]>);

//   // Combine products with their variants
//   const productsWithVariants = products.map((product) => ({
//     id: product._id.toString(),
//     name: product.name,
//     description: product.description,
//     priority: product.priority,
//     isActive: product.isActive,
//     hasVariants: product.hasVariants,
//     categoryId: product.categoryId 
//       ? {
//           id: (product.categoryId as any)._id.toString(),
//           name: (product.categoryId as any).name,
//           description: (product.categoryId as any).description,
//         }
//       : null,
//     createdAt: product.createdAt,
//     updatedAt: product.updatedAt,
//     variants: (variantsByProductId[product._id.toString()] || []).map(v => ({
//       id: v._id.toString(),
//       productId: v.productId.toString(),
//       name: v.name,
//       description: v.description,
//       priority: v.priority,
//       imageURL: v.imageURL,
//       size: v.size,
//       lowStockThreshold: v.lowStockThreshold,
//       weight: v.weight,
//       volume: v.volume,
//       barcode: v.barcode,
//       isActive: v.isActive,
//       createdAt: v.createdAt,
//       updatedAt: v.updatedAt,
//     })),
//   }));

//   return successResponse(
//     {
//       products: productsWithVariants,
//       pagination: {
//         page,
//         limit,
//         total,
//         totalPages: Math.ceil(total / limit),
//       },
//     },
//     200,
//     'Products with variants fetched successfully'
//   );
// };

// // =============================================
// // Export Routes
// // =============================================
// export const GET = withErrorHandler(getProductsWithVariantsHandler);