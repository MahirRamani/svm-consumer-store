import { z } from 'zod';
import connectDB from '@/lib/config/db';
import { StockTransaction } from '@/models/StockTransaction';
import { SubProduct } from '@/models/SubProduct';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { validateQuery } from '@/lib/api/validation-helpers';
import mongoose from 'mongoose';

// =============================================
// Validation Schema
// =============================================
const getSubProductsWithStockSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// =============================================
// Types
// =============================================
interface SubProductDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  size: string;
  barcode: string;
  lowStockThreshold: number;
  imageURL?: string;
}

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
const getSubProductsWithStockHandler = async (req: Request) => {
  await connectDB();

  const query = validateQuery(req, getSubProductsWithStockSchema);
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  // Fetch active sub-products with pagination
  const [activeSubProducts, totalCount] = await Promise.all([
    SubProduct.find({ isActive: true })
      .select('_id name size barcode lowStockThreshold imageURL')
      .skip(skip)
      .limit(limit)
      .lean<SubProductDoc[]>(),
    SubProduct.countDocuments({ isActive: true }),
  ]);

  // Early return if no sub-products
  if (activeSubProducts.length === 0) {
    return successResponse(
      {
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      },
      200,
      'No active sub-products found'
    );
  }

  const subProductIds = activeSubProducts.map((sp) => sp._id);

  // Fetch oldest stock for ONLY the paginated sub-products
  const oldestStocks = await StockTransaction.aggregate<OldestStockAggregation>([
    {
      $match: {
        subProductId: { $in: subProductIds },
        transactionType: { $in: ['Buy', 'Adjustment'] },
        quantityLeft: { $gt: 0 },
      },
    },
    { $sort: { subProductId: 1, date: 1, createdAt: 1 } }, // FIFO per sub-product
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

  // Create efficient lookup map
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

  // Combine data
  const result = activeSubProducts.map((subProduct) => {
    const stockData = stockMap.get(subProduct._id.toString());

    return {
      subProductId: subProduct._id.toString(),
      name: subProduct.name,
      size: subProduct.size,
      barcode: subProduct.barcode,
      imageURL: subProduct.imageURL || null,
      lowStockThreshold: subProduct.lowStockThreshold,
      currentStock: stockData || null,
    };
  });

  return successResponse(
    {
      data: result,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    },
    200,
    'Sub-products with stock fetched successfully'
  );
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(getSubProductsWithStockHandler);


// // app/api/stock/oldest-all/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import dbConnect from "@/lib/config/db";
// import { StockTransaction } from "@/models/StockTransaction";
// import { SubProduct } from "@/models/SubProduct";
// import mongoose from "mongoose";

// interface SubProductDoc {
//   _id: mongoose.Types.ObjectId;
//   name: string;
//   size: string;
//   barcode: string;
//   lowStockThreshold: number;
//   imageURL?: string;
// }

// interface OldestStockAggregation {
//   _id: mongoose.Types.ObjectId;
//   stockTransactionId: mongoose.Types.ObjectId;
//   sellingPrice: number;
//   quantityLeft: number;
//   stockDate: Date;
// }

// /**
//  * GET /api/sub-products/with-stock?page=1&limit=100
//  * Fetches all active sub-products with their oldest available stock (FIFO)
//  */
// export async function GET(req: NextRequest) {
//   try {
//     await dbConnect();

//     // Parse pagination params
//     const { searchParams } = req.nextUrl;
//     const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
//     const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100"))); // Max 500
//     const skip = (page - 1) * limit;

//     // Fetch active sub-products with pagination applied at DB level
//     const [activeSubProducts, totalCount] = await Promise.all([
//       SubProduct.find({ isActive: true })
//         .select("_id name size barcode lowStockThreshold imageURL")
//         .skip(skip)
//         .limit(limit)
//         .lean<SubProductDoc[]>(),
//       SubProduct.countDocuments({ isActive: true }),
//     ]);

//     // Early return if no sub-products
//     if (activeSubProducts.length === 0) {
//       return NextResponse.json(
//         {
//           success: true,
//           message: "No active sub-products found",
//           data: [],
//           pagination: {
//             total: 0,
//             page,
//             limit,
//             totalPages: 0,
//           },
//         },
//         { status: 200 }
//       );
//     }

//     const subProductIds = activeSubProducts.map((sp) => sp._id);

//     // Fetch oldest stock for ONLY the paginated sub-products
//     const oldestStocks = await StockTransaction.aggregate<OldestStockAggregation>([
//       {
//         $match: {
//           subProductId: { $in: subProductIds },
//           transactionType: { $in: ["Buy", "Adjustment"] },
//           quantityLeft: { $gt: 0 },
//         },
//       },
//       { $sort: { subProductId: 1, date: 1, createdAt: 1 } }, // FIFO per sub-product
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

//     // Create efficient lookup map
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

//     // Combine data
//     const result = activeSubProducts.map((subProduct) => {
//       const stockData = stockMap.get(subProduct._id.toString());
      
//       return {
//         subProductId: subProduct._id.toString(),
//         name: subProduct.name,
//         size: subProduct.size,
//         barcode: subProduct.barcode,
//         imageURL: subProduct.imageURL || null,
//         lowStockThreshold: subProduct.lowStockThreshold,
//         currentStock: stockData || null,
//         // isLowStock: stockData 
//         //   ? stockData.quantityLeft <= subProduct.lowStockThreshold
//         //   : true, // Consider out-of-stock as low stock
//       };
//     });

//     return NextResponse.json(
//       {
//         success: true,
//         data: result,
//         pagination: {
//           total: totalCount,
//           page,
//           limit,
//           totalPages: Math.ceil(totalCount / limit),
//         },
//       },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("[GET /api/sub-products/with-stock] Error:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: "Failed to fetch sub-products with stock",
//         error: process.env.NODE_ENV === "development" 
//           ? (error as Error).message 
//           : undefined,
//       },
//       { status: 500 }
//     );
//   }
// }

// // // Optional: Add route config
// // export const dynamic = "force-dynamic"; // Always fresh data
// // export const maxDuration = 30; // 30 second timeout



// // // API 3: Get ALL active sub-products with their oldest stock (for initial load)
// // import { NextRequest, NextResponse } from "next/server";
// // import dbConnect from "@/lib/config/db";
// // import { StockTransaction } from "@/models/StockTransaction";
// // import mongoose from "mongoose";
// // import { SubProduct } from "@/models/SubProduct";


// // export async function GET(req: NextRequest) {
// //     try {
// //         await dbConnect();

// //         const { searchParams } = new URL(req.url);
// //         const page = parseInt(searchParams.get("page") || "1");
// //         const limit = parseInt(searchParams.get("limit") || "100");
// //         const skip = (page - 1) * limit;

// //         // Get all active sub-products
// //         // const SubProduct = mongoose.models.SubProduct;
// //         const activeSubProducts = await SubProduct.find({ isActive: true })
// //             .select("_id name size barcode lowStockThreshold imageURL")
// //             .lean();

// //         const subProductIds = activeSubProducts.map((sp: any) => sp._id);

// //         // Get oldest stock for each sub-product
// //         const oldestStocks = await StockTransaction.aggregate([
// //             {
// //                 $match: {
// //                     subProductId: { $in: subProductIds },
// //                     transactionType: { $in: ["Buy", "Adjustment"] },
// //                     quantityLeft: { $gt: 0 },
// //                 },
// //             },
// //             { $sort: { subProductId: 1, date: 1, createdAt: 1 } },
// //             {
// //                 $group: {
// //                     _id: "$subProductId",
// //                     stockTransactionId: { $first: "$_id" },
// //                     buyingPrice: { $first: "$buyingPrice" },
// //                     sellingPrice: { $first: "$sellingPrice" },
// //                     quantityLeft: { $first: "$quantityLeft" },
// //                     stockDate: { $first: "$date" },
// //                 },
// //             },
// //         ]);

// //         // Create a map of stock data
// //         const stockMap = new Map(
// //             oldestStocks.map((stock) => [
// //                 stock._id.toString(),
// //                 {
// //                     stockTransactionId: stock.stockTransactionId,
// //                     buyingPrice: stock.buyingPrice,
// //                     sellingPrice: stock.sellingPrice,
// //                     quantityLeft: stock.quantityLeft,
// //                     stockDate: stock.stockDate,
// //                 },
// //             ])
// //         );

// //         // Combine sub-product info with stock data
// //         const result = activeSubProducts
// //             .map((subProduct: any) => {
// //                 const stockData = stockMap.get(subProduct._id.toString());
// //                 return {
// //                     subProductId: subProduct._id,
// //                     name: subProduct.name,
// //                     size: subProduct.size,
// //                     barcode: subProduct.barcode,
// //                     imageURL: subProduct.imageURL,
// //                     lowStockThreshold: subProduct.lowStockThreshold,
// //                     currentStock: stockData || null,
// //                 };
// //             })
// //             .slice(skip, skip + limit);

// //         return NextResponse.json(
// //             {
// //                 success: true,
// //                 message: "All sub-products with oldest stock fetched",
// //                 data: result,
// //                 pagination: {
// //                     total: activeSubProducts.length,
// //                     page,
// //                     limit,
// //                     totalPages: Math.ceil(activeSubProducts.length / limit),
// //                 },
// //             },
// //             { status: 200 }
// //         );
// //     } catch (error: any) {
// //         console.error("Error fetching all sub-products:", error);
// //         return NextResponse.json(
// //             { success: false, message: "Internal server error", error: error.message },
// //             { status: 500 }
// //         );
// //     }
// // }

// // // // API 2: Get the SINGLE oldest stock for MULTIPLE sub-products (initial dashboard load)

// // // import { NextRequest, NextResponse } from "next/server";
// // // import dbConnect from "@/lib/config/db";
// // // import { StockTransaction } from "@/models/StockTransaction";
// // // import mongoose from "mongoose";

// // // export async function POST(req: NextRequest) {
// // //   try {
// // //     await dbConnect();

// // //     const body = await req.json();
// // //     const { subProductIds } = body;

// // //     if (!subProductIds || !Array.isArray(subProductIds) || subProductIds.length === 0) {
// // //       return NextResponse.json(
// // //         { success: false, message: "subProductIds array is required" },
// // //         { status: 400 }
// // //       );
// // //     }

// // //     const validIds = subProductIds
// // //       .filter((id) => mongoose.Types.ObjectId.isValid(id))
// // //       .map((id) => new mongoose.Types.ObjectId(id));

// // //     if (validIds.length === 0) {
// // //       return NextResponse.json(
// // //         { success: false, message: "No valid subProductIds" },
// // //         { status: 400 }
// // //       );
// // //     }

// // //     // Get ONLY the oldest stock for each sub-product
// // //     const oldestStocks = await StockTransaction.aggregate([
// // //       {
// // //         $match: {
// // //           subProductId: { $in: validIds },
// // //           transactionType: { $in: ["Buy", "Adjustment"] },
// // //           quantityLeft: { $gt: 0 },
// // //         },
// // //       },
// // //       { $sort: { subProductId: 1, date: 1, createdAt: 1 } },
// // //       {
// // //         $group: {
// // //           _id: "$subProductId",
// // //           stockTransactionId: { $first: "$_id" },
// // //           buyingPrice: { $first: "$buyingPrice" },
// // //           sellingPrice: { $first: "$sellingPrice" },
// // //           quantityLeft: { $first: "$quantityLeft" },
// // //           stockDate: { $first: "$date" },
// // //         },
// // //       },
// // //       {
// // //         $project: {
// // //           _id: 0,
// // //           subProductId: "$_id",
// // //           stockTransactionId: 1,
// // //           buyingPrice: 1,
// // //           sellingPrice: 1,
// // //           quantityLeft: 1,
// // //           stockDate: 1,
// // //         },
// // //       },
// // //     ]);

// // //     return NextResponse.json(
// // //       {
// // //         success: true,
// // //         message: `Fetched oldest stock for ${oldestStocks.length} sub-products`,
// // //         data: oldestStocks,
// // //       },
// // //       { status: 200 }
// // //     );
// // //   } catch (error: any) {
// // //     console.error("Error fetching bulk oldest stocks:", error);
// // //     return NextResponse.json(
// // //       { success: false, message: "Internal server error", error: error.message },
// // //       { status: 500 }
// // //     );
// // //   }
// // // }