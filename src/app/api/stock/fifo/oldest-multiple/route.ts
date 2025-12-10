import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { StockTransaction } from '@/models/StockTransaction';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, objectIdSchema } from '@/lib/api/validation-helpers';
import mongoose from 'mongoose';

// =============================================
// Validation Schema
// =============================================
const bulkOldestStockSchema = z.object({
  subProductIds: z.array(objectIdSchema).min(1).max(1000),
});

type BulkOldestStockDto = z.infer<typeof bulkOldestStockSchema>;

// =============================================
// Types
// =============================================
interface OldestStockAggregation {
  _id: mongoose.Types.ObjectId;
  stockTransactionId: mongoose.Types.ObjectId;
  sellingPrice: number;
  quantityLeft: number;
  stockDate: Date;
}

// =============================================
// Handler
// =============================================
const bulkOldestStockHandler = async (req: Request) => {
  await connectDB();

  const data = await validateBody(req, bulkOldestStockSchema);
  const { subProductIds } = data;

  // Convert to ObjectIds
  const validIds = subProductIds.map(id => new mongoose.Types.ObjectId(id));

  // Fetch oldest stock for each sub-product using aggregation (FIFO)
  const oldestStocks = await StockTransaction.aggregate<OldestStockAggregation>([
    {
      $match: {
        subProductId: { $in: validIds },
        transactionType: { $in: ['Buy', 'Adjustment'] },
        quantityLeft: { $gt: 0 },
      },
    },
    {
      $sort: {
        subProductId: 1,
        date: 1,
        createdAt: 1,
      },
    },
    {
      $group: {
        _id: '$subProductId',
        stockTransactionId: { $first: '$_id' },
        sellingPrice: { $first: '$sellingPrice' },
        quantityLeft: { $first: '$quantityLeft' },
        stockDate: { $first: '$date' },
      },
    },
  ]);

  // Create lookup map
  const stockMap = new Map(
    oldestStocks.map((stock) => [
      stock._id.toString(),
      {
        stockTransactionId: stock.stockTransactionId.toString(),
        sellingPrice: stock.sellingPrice,
        quantityLeft: stock.quantityLeft,
        stockDate: stock.stockDate,
      },
    ])
  );

  // Build response maintaining order of input IDs
  const result = validIds.map((id) => {
    const idString = id.toString();
    const stockData = stockMap.get(idString);

    return {
      subProductId: idString,
      stock: stockData || null,
    };
  });

  // Separate items with/without stock
  const withStock = result.filter((item) => item.stock !== null);
  const withoutStock = result.filter((item) => item.stock === null);

  return successResponse(
    {
      data: result,
      summary: {
        total: validIds.length,
        withStock: withStock.length,
        withoutStock: withoutStock.length,
      },
    },
    200,
    'Bulk oldest stock fetched successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const POST = withErrorHandler(bulkOldestStockHandler);



// // app/api/stock/oldest-multiple/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import dbConnect from "@/lib/config/db";
// import { StockTransaction } from "@/models/StockTransaction";
// import mongoose from "mongoose";

// interface OldestStockAggregation {
//   _id: mongoose.Types.ObjectId;
//   stockTransactionId: mongoose.Types.ObjectId;
//   sellingPrice: number;
//   quantityLeft: number;
//   stockDate: Date;
// }

// /**
//  * POST /api/stock/oldest/bulk
//  * Fetches oldest available stock for multiple sub-product IDs (FIFO)
//  * 
//  * Request Body:
//  * {
//  *   "subProductIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
//  * }
//  */
// export async function POST(req: NextRequest) {
//   try {
//     await dbConnect();

//     // Parse request body
//     const body = await req.json();
//     const { subProductIds } = body;

//     // Validation
//     if (!subProductIds || !Array.isArray(subProductIds)) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "subProductIds must be an array",
//         },
//         { status: 400 }
//       );
//     }

//     if (subProductIds.length === 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "subProductIds array cannot be empty",
//         },
//         { status: 400 }
//       );
//     }

//     // Limit to prevent abuse (max 1000 IDs per request)
//     if (subProductIds.length > 1000) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Maximum 1000 subProductIds allowed per request",
//         },
//         { status: 400 }
//       );
//     }

//     // Validate all IDs are valid ObjectIds
//     const validIds: mongoose.Types.ObjectId[] = [];
//     const invalidIds: string[] = [];

//     for (const id of subProductIds) {
//       if (mongoose.Types.ObjectId.isValid(id)) {
//         validIds.push(new mongoose.Types.ObjectId(id));
//       } else {
//         invalidIds.push(id);
//       }
//     }

//     if (invalidIds.length > 0) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid ObjectId format",
//           invalidIds,
//         },
//         { status: 400 }
//       );
//     }

//     // Fetch oldest stock for each sub-product using aggregation (FIFO)
//     const oldestStocks = await StockTransaction.aggregate<OldestStockAggregation>([
//       {
//         $match: {
//           subProductId: { $in: validIds },
//           transactionType: { $in: ["Buy", "Adjustment"] },
//           quantityLeft: { $gt: 0 },
//         },
//       },
//       {
//         $sort: {
//           subProductId: 1,
//           date: 1,        // Oldest date first
//           createdAt: 1,   // If same date, earliest created first
//         },
//       },
//       {
//         $group: {
//           _id: "$subProductId",
//           stockTransactionId: { $first: "$_id" },
//           sellingPrice: { $first: "$sellingPrice" },
//           quantityLeft: { $first: "$quantityLeft" },
//           stockDate: { $first: "$date" },
//         },
//       },
//     ]);

//     // Create lookup map for O(1) access
//     const stockMap = new Map(
//       oldestStocks.map((stock) => [
//         stock._id.toString(),
//         {
//           stockTransactionId: stock.stockTransactionId.toString(),
//           sellingPrice: stock.sellingPrice,
//           quantityLeft: stock.quantityLeft,
//           stockDate: stock.stockDate,
//         },
//       ])
//     );

//     // Build response maintaining order of input IDs
//     const result = validIds.map((id) => {
//       const idString = id.toString();
//       const stockData = stockMap.get(idString);

//       return {
//         subProductId: idString,
//         stock: stockData || null,
//       };
//     });

//     // Separate items with/without stock for easier filtering
//     const withStock = result.filter((item) => item.stock !== null);
//     const withoutStock = result.filter((item) => item.stock === null);

//     return NextResponse.json(
//       {
//         success: true,
//         data: result,
//         summary: {
//           total: validIds.length,
//           withStock: withStock.length,
//           withoutStock: withoutStock.length,
//         },
//       },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("[POST /api/stock/oldest/bulk] Error:", error);

//     // Handle JSON parse errors
//     if (error instanceof SyntaxError) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Invalid JSON in request body",
//         },
//         { status: 400 }
//       );
//     }

//     return NextResponse.json(
//       {
//         success: false,
//         message: "Failed to fetch oldest stock for given IDs",
//         error:
//           process.env.NODE_ENV === "development"
//             ? (error as Error).message
//             : undefined,
//       },
//       { status: 500 }
//     );
//   }
// }

// // // Optional: Add route config
// // export const dynamic = "force-dynamic";
// // export const maxDuration = 30; // 30 second timeout