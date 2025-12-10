import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { Transaction } from '@/models/Transaction';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { validateQuery, objectIdSchema } from '@/lib/api/validation-helpers';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import type { PipelineStage } from 'mongoose';

// =============================================
// Validation Schema
// =============================================
const getAnalyticsSchema = z.object({
  view: z.enum(['category', 'product', 'subproduct']).default('subproduct'),
  categoryId: objectIdSchema.optional(),
  productId: objectIdSchema.optional(),
});

type GetAnalyticsQuery = z.infer<typeof getAnalyticsSchema>;

// =============================================
// Handler
// =============================================
const getAnalyticsHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const query = validateQuery(req, getAnalyticsSchema);
  const { view, categoryId, productId } = query;

  // Get last 30 days of data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let aggregationPipeline: PipelineStage[] = [
    {
      $match: {
        status: 'Completed',
        transactionType: 'Purchase',
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    { $unwind: '$items' },
  ];

  // Add filters based on selection
  if (categoryId && categoryId !== 'all') {
    aggregationPipeline.push({
      $match: { 'items.categoryId': categoryId },
    });
  }

  if (productId && productId !== 'all') {
    aggregationPipeline.push({
      $match: { 'items.productId': productId },
    });
  }

  // Group based on view type
  if (view === 'category') {
    aggregationPipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'items.categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$items.categoryId',
          name: { $first: '$category.name' },
          sales: { $sum: '$items.totalPrice' },
          quantity: { $sum: '$items.quantity' },
        },
      }
    );
  } else if (view === 'product') {
    aggregationPipeline.push(
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$product.name' },
          sales: { $sum: '$items.totalPrice' },
          quantity: { $sum: '$items.quantity' },
        },
      }
    );
  } else {
    aggregationPipeline.push(
      {
        $lookup: {
          from: 'subproducts',
          localField: 'items.subProductId',
          foreignField: '_id',
          as: 'subProduct',
        },
      },
      { $unwind: '$subProduct' },
      {
        $group: {
          _id: '$items.subProductId',
          name: { $first: '$subProduct.name' },
          sales: { $sum: '$items.totalPrice' },
          quantity: { $sum: '$items.quantity' },
        },
      }
    );
  }

  aggregationPipeline.push({ $sort: { sales: -1 } }, { $limit: 10 });

  const result = await Transaction.aggregate(aggregationPipeline);

  return successResponse(result, 200, 'Analytics data fetched successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getAnalyticsHandler));





// // app/api/dashboard/analytics/route.ts
// import { NextRequest, NextResponse } from "next/server"
// import connectDB from "@/lib/config/db"
// import { Transaction } from "@/models/Transaction"

// export async function GET(request: NextRequest) {
//   try {
//     await connectDB()

//     const searchParams = request.nextUrl.searchParams
//     const view = searchParams.get("view")
//     const categoryId = searchParams.get("categoryId")
//     const productId = searchParams.get("productId")

//     // Get last 30 days of data
//     const thirtyDaysAgo = new Date()
//     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

//     let aggregationPipeline: any[] = [
//       {
//         $match: {
//           status: "Completed",
//           transactionType: "Purchase",
//           createdAt: { $gte: thirtyDaysAgo }
//         }
//       },
//       { $unwind: "$items" }
//     ]

//     // Add filters based on selection
//     if (categoryId && categoryId !== "all") {
//       aggregationPipeline.push({
//         $match: { "items.categoryId": categoryId }
//       })
//     }

//     if (productId && productId !== "all") {
//       aggregationPipeline.push({
//         $match: { "items.productId": productId }
//       })
//     }

//     // Group based on view type
//     if (view === "category") {
//       aggregationPipeline.push(
//         {
//           $lookup: {
//             from: "categories",
//             localField: "items.categoryId",
//             foreignField: "_id",
//             as: "category"
//           }
//         },
//         { $unwind: "$category" },
//         {
//           $group: {
//             _id: "$items.categoryId",
//             name: { $first: "$category.name" },
//             sales: { $sum: "$items.totalPrice" },
//             quantity: { $sum: "$items.quantity" }
//           }
//         }
//       )
//     } else if (view === "product") {
//       aggregationPipeline.push(
//         {
//           $lookup: {
//             from: "products",
//             localField: "items.productId",
//             foreignField: "_id",
//             as: "product"
//           }
//         },
//         { $unwind: "$product" },
//         {
//           $group: {
//             _id: "$items.productId",
//             name: { $first: "$product.name" },
//             sales: { $sum: "$items.totalPrice" },
//             quantity: { $sum: "$items.quantity" }
//           }
//         }
//       )
//     } else {
//       aggregationPipeline.push(
//         {
//           $lookup: {
//             from: "subproducts",
//             localField: "items.subProductId",
//             foreignField: "_id",
//             as: "subProduct"
//           }
//         },
//         { $unwind: "$subProduct" },
//         {
//           $group: {
//             _id: "$items.subProductId",
//             name: { $first: "$subProduct.name" },
//             sales: { $sum: "$items.totalPrice" },
//             quantity: { $sum: "$items.quantity" }
//           }
//         }
//       )
//     }

//     aggregationPipeline.push(
//       { $sort: { sales: -1 } },
//       { $limit: 10 }
//     )

//     const result = await Transaction.aggregate(aggregationPipeline)

//     return NextResponse.json({ data: result })

//   } catch (error) {
//     console.error("Error fetching analytics data:", error)
//     return NextResponse.json(
//       { error: "Failed to fetch analytics data" },
//       { status: 500 }
//     )
//   }
// }