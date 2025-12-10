import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { StockTransaction } from '@/models/StockTransaction';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { validateQuery, objectIdSchema } from '@/lib/api/validation-helpers';
import mongoose from 'mongoose';

// =============================================
// Validation Schema
// =============================================
const getOldestStockSchema = z.object({
  subProductId: objectIdSchema,
});

// =============================================
// Handler
// =============================================
const getOldestStockHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getOldestStockSchema);
  const { subProductId } = query;

  // Fetch oldest available stock (FIFO)
  const oldestStock = await StockTransaction.findOne({
    subProductId: new mongoose.Types.ObjectId(subProductId),
    transactionType: { $in: ['Buy', 'Adjustment'] },
    quantityLeft: { $gt: 0 },
  })
    .sort({ date: 1, createdAt: 1 })
    .select('_id sellingPrice quantityLeft date')
    .lean<{
      _id: mongoose.Types.ObjectId;
      sellingPrice: number;
      quantityLeft: number;
      date: Date;
    }>();

  // No stock available
  if (!oldestStock) {
    return successResponse(null, 200, 'No available stock for this sub-product');
  }

  // Return formatted response
  return successResponse(
    {
      stockTransactionId: oldestStock._id.toString(),
      subProductId,
      sellingPrice: oldestStock.sellingPrice,
      quantityLeft: oldestStock.quantityLeft,
      stockDate: oldestStock.date,
    },
    200,
    'Oldest stock fetched successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getOldestStockHandler);




// // app/api/stock/oldest/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import dbConnect from "@/lib/config/db";
// import { StockTransaction } from "@/models/StockTransaction";
// import mongoose from "mongoose";

// /**
//  * GET /api/stock/oldest?subProductId=xxx
//  * Fetches the single oldest stock transaction with available quantity for a sub-product
//  */
// export async function GET(req: NextRequest) {
//   try {
//     await dbConnect();

//     const { searchParams } = req.nextUrl;
//     const subProductId = searchParams.get("subProductId");

//     // Validation
//     if (!subProductId) {
//       return NextResponse.json(
//         { success: false, message: "subProductId is required" },
//         { status: 400 }
//       );
//     }

//     if (!mongoose.Types.ObjectId.isValid(subProductId)) {
//       return NextResponse.json(
//         { success: false, message: "Invalid subProductId format" },
//         { status: 400 }
//       );
//     }

//     // Fetch oldest available stock (FIFO)
//     const oldestStock = await StockTransaction.findOne({
//       subProductId: new mongoose.Types.ObjectId(subProductId),
//       transactionType: { $in: ["Buy", "Adjustment"] },
//       quantityLeft: { $gt: 0 },
//     })
//       .sort({ date: 1, createdAt: 1 }) // FIFO: oldest first
//       .select("_id sellingPrice quantityLeft date") // Exclude buyingPrice
//       .lean<{
//         _id: mongoose.Types.ObjectId;
//         sellingPrice: number;
//         quantityLeft: number;
//         date: Date;
//       }>();

//     // No stock available
//     if (!oldestStock) {
//       return NextResponse.json(
//         {
//           success: true,
//           message: "No available stock for this sub-product",
//           data: null,
//         },
//         { status: 200 }
//       );
//     }

//     // Return formatted response
//     return NextResponse.json(
//       {
//         success: true,
//         data: {
//           stockTransactionId: oldestStock._id.toString(),
//           subProductId,
//           sellingPrice: oldestStock.sellingPrice,
//           quantityLeft: oldestStock.quantityLeft,
//           stockDate: oldestStock.date,
//         },
//       },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("[GET /api/stock/oldest] Error:", error);
    
//     return NextResponse.json(
//       {
//         success: false,
//         message: "Failed to fetch oldest stock",
//         error: process.env.NODE_ENV === "development" 
//           ? (error as Error).message 
//           : undefined,
//       },
//       { status: 500 }
//     );
//   }
// }
// // // API 1: Get the SINGLE oldest stock for ONE sub-product (manual refresh)

// // import { NextRequest, NextResponse } from "next/server";
// // import dbConnect from "@/lib/config/db";
// // import { StockTransaction } from "@/models/StockTransaction";
// // import mongoose from "mongoose";

// // export async function GET(req: NextRequest) {
// //   try {
// //     await dbConnect();

// //     const { searchParams } = new URL(req.url);
// //     const subProductId = searchParams.get("subProductId");

// //     if (!subProductId || !mongoose.Types.ObjectId.isValid(subProductId)) {
// //       return NextResponse.json(
// //         { success: false, message: "Valid subProductId is required" },
// //         { status: 400 }
// //       );
// //     }

// //     // Get the SINGLE oldest stock with available quantity
// //     const oldestStock = await StockTransaction.findOne({
// //       subProductId: new mongoose.Types.ObjectId(subProductId),
// //       transactionType: { $in: ["Buy", "Adjustment"] },
// //       quantityLeft: { $gt: 0 },
// //     })
// //       .sort({ date: 1, createdAt: 1 })
// //       .select("_id buyingPrice sellingPrice quantityLeft date")
// //       //   .lean();
// //       .lean<{ _id: mongoose.Types.ObjectId; buyingPrice: number; sellingPrice: number; quantityLeft: number; date: Date }>();

// //     if (!oldestStock) {
// //       return NextResponse.json(
// //         {
// //           success: true,
// //           message: "No available stock",
// //           data: null,
// //         },
// //         { status: 200 }
// //       );
// //     }

// //     return NextResponse.json(
// //       {
// //         success: true,
// //         data: {
// //           stockTransactionId: oldestStock._id,
// //           subProductId,
// //           buyingPrice: oldestStock.buyingPrice,
// //           sellingPrice: oldestStock.sellingPrice,
// //           quantityLeft: oldestStock.quantityLeft,
// //           stockDate: oldestStock.date,
// //         },
// //       },
// //       { status: 200 }
// //     );
// //   } catch (error: any) {
// //     console.error("Error fetching oldest stock:", error);
// //     return NextResponse.json(
// //       { success: false, message: "Internal server error", error: error.message },
// //       { status: 500 }
// //     );
// //   }
// // }