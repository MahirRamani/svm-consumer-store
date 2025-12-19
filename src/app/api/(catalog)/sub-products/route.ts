import connectDB from '@/lib/config/db';
import { SubProduct, type ISubProduct } from '@/models/SubProduct';
import { Product } from '@/models/Product';
import { Category } from '@/models/Category';
import { withErrorHandler, successResponse, paginatedResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import {
  createSubProductSchema,
  getSubProductsQuerySchema,
  type CreateSubProductDto,
  type GetSubProductsQueryDto,
} from '@/lib/validations/subProduct';
import mongoose, { type FilterQuery, type PopulateOptions } from 'mongoose';

// Ensure models are registered for populate
const _Product = Product;
const _Category = Category;

// Type guard for populated product
interface PopulatedProduct {
  _id: mongoose.Types.ObjectId;
  name: string;
  categoryId?: {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
}

const isPopulatedProduct = (value: unknown): value is PopulatedProduct => {
  return value !== null && typeof value === 'object' && 'name' in value;
};
// =============================================
// GET - List SubProducts
// =============================================
const getSubProductsHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getSubProductsQuerySchema);
  const { page, limit, sortBy, sortOrder, search, productId, includeInactive } = query;

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

  const populateOptions: PopulateOptions = {
    path: 'productId',
    select: 'name categoryId',  // Changed from 'category' to 'categoryId'
    populate: {
      path: 'categoryId',        // Changed from 'category' to 'categoryId'
      select: 'name',
    },
    strictPopulate: false,
  };

  const [subProducts, totalCount] = await Promise.all([
    SubProduct.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate(populateOptions)
      .lean(),
    SubProduct.countDocuments(filter),
  ]);

  // return paginatedResponse('subProducts', subProducts, { page, limit, totalCount });

  const transformedSubProducts = subProducts.map((sp) => {
  const product = isPopulatedProduct(sp.productId) ? sp.productId : null;

  return {
    ...sp,
    productId: product ? product._id : sp.productId,
    parentProduct: product
      ? {
          _id: product._id,
          name: product.name,
          category: product.categoryId || null,
        }
      : null,
    };
  });
  
  return paginatedResponse('subProducts', transformedSubProducts, { page, limit, totalCount });
};

// // =============================================
// // Types for populated data
// // =============================================
// interface PopulatedCategory {
//   _id: mongoose.Types.ObjectId;
//   name: string;
// }

// interface PopulatedProduct {
//   _id: mongoose.Types.ObjectId;
//   name: string;
//   category?: PopulatedCategory | null;
// }

// interface PopulatedSubProduct extends Omit<ISubProduct, 'productId'> {
//   _id: mongoose.Types.ObjectId;
//   productId: PopulatedProduct | null;
// }

// interface TransformedSubProduct extends Omit<PopulatedSubProduct, 'productId'> {
//   productId: PopulatedProduct | null;
//   parentProduct: {
//     _id: string;
//     name: string;
//     category: {
//       _id: string;
//       name: string;
//     } | null;
//   } | null;
// }

// // =============================================
// // GET - List SubProducts
// // =============================================
// const getSubProductsHandler = async (req: Request) => {
//   await connectDB();

//   const query = validateQuery(req, getSubProductsQuerySchema);
//   const { page, limit, sortBy, sortOrder, search, productId, includeInactive } = query;

//   // Build filter with proper typing
//   const filter: FilterQuery<ISubProduct> = {};
//   if (productId) {
//     filter.productId = new mongoose.Types.ObjectId(productId);
//   }
//   if (!includeInactive) {
//     filter.isActive = true;
//   }
//   if (search) {
//     filter.$or = [
//       { name: { $regex: search, $options: 'i' } },
//       { size: { $regex: search, $options: 'i' } },
//       { barcode: { $regex: search, $options: 'i' } },
//     ];
//   }

//   const skip = (page - 1) * limit;
//   const sort: Record<string, 1 | -1> = {
//     [sortBy]: sortOrder === 'desc' ? -1 : 1,
//   };

//   // const [subProducts, totalCount] = await Promise.all([
//   //   SubProduct.find(filter)
//   //     .sort(sort)
//   //     .skip(skip)
//   //     .limit(limit)
//   //     .populate({ path: 'productId', select: 'name' })
//   //     .lean(),
//   //   SubProduct.countDocuments(filter),
//   // ]);

//   // return paginatedResponse('subProducts', subProducts, { page, limit, totalCount });
  
//   // Define populate options with model references
//   // Define populate options with strictPopulate disabled
//   const populateOptions: PopulateOptions = {
//     path: 'productId',
//     model: Product,
//     select: 'name category',
//     strictPopulate: false,
//     populate: {
//       path: 'category',
//       model: Category,
//       select: 'name',
//       strictPopulate: false,
//     },
//   };

//   const [subProducts, totalCount] = await Promise.all([
//     SubProduct.find(filter)
//       .sort(sort)
//       .skip(skip)
//       .limit(limit)
//       .populate(populateOptions)
//       .lean<PopulatedSubProduct[]>(),
//     SubProduct.countDocuments(filter),
//   ]);

//   // Transform to include parentProduct for frontend compatibility
//   const transformedSubProducts: TransformedSubProduct[] = subProducts.map((sp) => {
//     const product = sp.productId;
    
//     return {
//       ...sp,
//       parentProduct: product
//         ? {
//             _id: product._id.toString(),
//             name: product.name,
//             category: product.category
//               ? {
//                   _id: product.category._id.toString(),
//                   name: product.category.name,
//                 }
//               : null,
//           }
//         : null,
//     };
//   });

//   return paginatedResponse('subProducts', transformedSubProducts, { page, limit, totalCount });
// };

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


// //NOTE - Other Way of GET with Aggregation Pipeline (Category : {})
// import connectDB from '@/lib/config/db';
// import { SubProduct, type ISubProduct } from '@/models/SubProduct';
// import { Product } from '@/models/Product';
// import { Category } from '@/models/Category';
// import { withErrorHandler, successResponse, paginatedResponse, ApiError } from '@/lib/api/base-handler';
// import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
// import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
// import {
//   createSubProductSchema,
//   getSubProductsQuerySchema,
//   type CreateSubProductDto,
//   type GetSubProductsQueryDto,
// } from '@/lib/validations/subProduct';
// import mongoose, { type FilterQuery, type PipelineStage } from 'mongoose';

// // =============================================
// // Types for aggregated data
// // =============================================
// interface AggregatedCategory {
//   _id: string;
//   name: string;
// }

// interface AggregatedProduct {
//   _id: string;
//   name: string;
//   category: AggregatedCategory | null;
// }

// interface AggregatedSubProduct {
//   _id: string;
//   productId: mongoose.Types.ObjectId;
//   name: string;
//   size?: string;
//   weight?: string;
//   volume?: string;
//   barcode?: string;
//   description?: string;
//   imageURL?: string;
//   isActive: boolean;
//   priority: number;
//   createdAt: Date;
//   updatedAt: Date;
//   parentProduct: AggregatedProduct | null;
// }

// // =============================================
// // GET - List SubProducts
// // =============================================
// const getSubProductsHandler = async (req: Request) => {
//   await connectDB();

//   const query = validateQuery(req, getSubProductsQuerySchema);
//   const { page, limit, sortBy, sortOrder, search, productId, includeInactive } = query;

//   // Build match filter
//   const matchFilter: Record<string, unknown> = {};
  
//   if (productId) {
//     matchFilter.productId = new mongoose.Types.ObjectId(productId);
//   }
//   if (!includeInactive) {
//     matchFilter.isActive = true;
//   }
//   if (search) {
//     matchFilter.$or = [
//       { name: { $regex: search, $options: 'i' } },
//       { size: { $regex: search, $options: 'i' } },
//       { barcode: { $regex: search, $options: 'i' } },
//     ];
//   }

//   const skip = (page - 1) * limit;
//   const sortDirection = sortOrder === 'desc' ? -1 : 1;

//   // Aggregation pipeline
//   const pipeline: PipelineStage[] = [
//     // Match filter
//     { $match: matchFilter },
    
//     // Sort
//     { $sort: { [sortBy]: sortDirection } as Record<string, 1 | -1> },
    
//     // Skip and limit
//     { $skip: skip },
//     { $limit: limit },
    
//     // Lookup Product
//     {
//       $lookup: {
//         from: 'products', // MongoDB collection name (usually lowercase plural)
//         localField: 'productId',
//         foreignField: '_id',
//         as: 'productData',
//       },
//     },
    
//     // Unwind product (convert array to object)
//     {
//       $unwind: {
//         path: '$productData',
//         preserveNullAndEmptyArrays: true,
//       },
//     },
    
//     // Lookup Category from Product
//     {
//       $lookup: {
//         from: 'categories', // MongoDB collection name
//         localField: 'productData.category',
//         foreignField: '_id',
//         as: 'categoryData',
//       },
//     },
    
//     // Unwind category
//     {
//       $unwind: {
//         path: '$categoryData',
//         preserveNullAndEmptyArrays: true,
//       },
//     },
    
//     // Project final shape
//     {
//       $project: {
//         _id: 1,
//         productId: 1,
//         name: 1,
//         size: 1,
//         weight: 1,
//         volume: 1,
//         barcode: 1,
//         description: 1,
//         imageURL: 1,
//         isActive: 1,
//         priority: 1,
//         createdAt: 1,
//         updatedAt: 1,
//         parentProduct: {
//           $cond: {
//             if: { $ne: ['$productData', null] },
//             then: {
//               _id: '$productData._id',
//               name: '$productData.name',
//               category: {
//                 $cond: {
//                   if: { $ne: ['$categoryData', null] },
//                   then: {
//                     _id: '$categoryData._id',
//                     name: '$categoryData.name',
//                   },
//                   else: null,
//                 },
//               },
//             },
//             else: null,
//           },
//         },
//       },
//     },
//   ];

//   const [subProducts, countResult] = await Promise.all([
//     SubProduct.aggregate<AggregatedSubProduct>(pipeline),
//     SubProduct.countDocuments(matchFilter),
//   ]);

//   return paginatedResponse('subProducts', subProducts, { page, limit, totalCount: countResult });
// };