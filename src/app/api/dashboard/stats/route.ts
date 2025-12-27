// app/api/dashboard/stats/route.ts
import connectDB from '@/lib/config/db';
import { Transaction } from '@/models/Transaction';
import { SubProduct } from '@/models/SubProduct';
import { Student } from '@/models/Student';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';
import type { 
  AdminDashboardStats, 
  SellerDashboardStats,
  LowStockProduct,
  LowBalanceStudent,
  TopSoldProduct,
  HighestPurchasedStudent,
  TodaysSoldProduct
} from '@/types/dashboard/overview';

// =============================================
// Helper Types for Internal Use
// =============================================

interface StockInfo {
  currentStock: number;
  latestPrice: number;
}

interface SubProductWithStock {
  _id: unknown;
  name: string;
  lowStockThreshold: number;
  stockInfo?: StockInfo;
  currentStock: number;
  price: number;
  product?: {
    categoryId: unknown;
  };
  category?: {
    _id: unknown;
    name: string;
  };
}

interface TopSoldAggregateResult {
  _id: unknown;
  quantitySold: number;
  revenue: number;
  subProduct: {
    name: string;
  };
}

interface HighestPurchasedAggregateResult {
  _id: unknown;
  totalPurchase: number;
  transactionCount: number;
  student: {
    name: string;
    rollNumber: string;
    standard: string;
  };
}

interface TodaysSoldAggregateResult {
  _id: unknown;
  quantity: number;
  revenue: number;
  subProduct: {
    name: string;
  };
}

interface ProfitAggregateResult {
  _id: null;
  totalSellingPrice: number;
  totalBuyingPrice: number;
}

// =============================================
// Handler
// =============================================
const getDashboardStatsHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const userRole = authContext.user.role;
  console.log("🚀 ~ getDashboardStatsHandler ~ userRole:", userRole)
  
  const isAdmin = userRole === "SUPERUSER";
  console.log("🚀 ~ getDashboardStatsHandler ~ isAdmin:", isAdmin)
  console.log("🚀 ~ getDashboardStatsHandler ~ userRole:", userRole)

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get yesterday's date range
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Get start of month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // =============================================
  // COMMON DATA (Both Admin & Seller)
  // =============================================

  // 1. Low Stock Subproducts
  const lowStockProductsRaw = await SubProduct.aggregate<SubProductWithStock>([
    {
      $lookup: {
        from: 'stocktransactions',
        let: { subProductId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$subProductId', '$$subProductId'] },
            },
          },
          {
            $group: {
              _id: null,
              currentStock: {
                $sum: {
                  $cond: [{ $eq: ['$transactionType', 'Buy'] }, '$quantityLeft', 0],
                },
              },
              latestPrice: { $last: '$sellingPrice' },
            },
          },
        ],
        as: 'stockInfo',
      },
    },
    {
      $unwind: { path: '$stockInfo', preserveNullAndEmptyArrays: true },
    },
    {
      $addFields: {
        currentStock: { $ifNull: ['$stockInfo.currentStock', 0] },
        price: { $ifNull: ['$stockInfo.latestPrice', 0] },
      },
    },
    {
      $match: {
        $expr: { $lte: ['$currentStock', '$lowStockThreshold'] },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'categories',
        localField: 'product.categoryId',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        name: 1,
        category: 1,
        price: 1,
        currentStock: 1,
      },
    },
    // { $limit: 10 },
  ]);

  const lowStockProducts: LowStockProduct[] = lowStockProductsRaw.map(product => ({
    id: String(product._id),
    name: product.name,
    category: product.category?.name || 'Uncategorized',
    price: product.price,
    stock: product.currentStock,
  }));

  // 2. Top Sold Subproduct (today)
  const topSoldResult = await Transaction.aggregate<TopSoldAggregateResult>([
    {
      $match: {
        status: 'Completed',
        transactionType: 'Purchase',
        createdAt: { $gte: today, $lt: tomorrow },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.subProductId',
        quantitySold: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.totalPrice' },
      },
    },
    { $sort: { quantitySold: -1 } },
    { $limit: 1 },
    {
      $lookup: {
        from: 'subproducts',
        localField: '_id',
        foreignField: '_id',
        as: 'subProduct',
      },
    },
    { $unwind: '$subProduct' },
  ]);

  const topSoldProduct: TopSoldProduct | null = topSoldResult[0]
    ? {
        id: String(topSoldResult[0]._id),
        name: topSoldResult[0].subProduct.name,
        quantitySold: topSoldResult[0].quantitySold,
        revenue: topSoldResult[0].revenue,
      }
    : null;

  // 3. Low Balance Students (threshold: 500)
  const lowBalanceStudentsRaw = await Student.aggregate<{
    _id: unknown;
    name: string;
    rollNumber: string;
    standard: string;
    balance: number;
    mobileNo?: string;
  }>([
    {
      $match: {
        isActive: true,
        balance: { $lt: 500 },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        rollNumber: 1,
        standard: 1,
        balance: 1,
        mobileNo: 1,
      },
    },
    { $sort: { balance: 1 } },
    // { $limit: 10 },
  ]);

  const lowBalanceStudents: LowBalanceStudent[] = lowBalanceStudentsRaw.map(student => ({
    id: String(student._id),
    name: student.name,
    rollNumber: student.rollNumber,
    standard: student.standard,
    balance: student.balance,
    mobileNo: student.mobileNo,
  }));

  // 4. Highest Purchased Student (today by total amount)
  const highestPurchasedResult = await Transaction.aggregate<HighestPurchasedAggregateResult>([
    {
      $match: {
        status: 'Completed',
        transactionType: 'Purchase',
        createdAt: { $gte: today, $lt: tomorrow },
      },
    },
    {
      $group: {
        _id: '$studentId',
        totalPurchase: { $sum: '$totalAmount' },
        transactionCount: { $sum: 1 },
      },
    },
    { $sort: { totalPurchase: -1 } },
    { $limit: 1 },
    {
      $lookup: {
        from: 'students',
        localField: '_id',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: '$student' },
  ]);

  const highestPurchasedStudent: HighestPurchasedStudent | null = highestPurchasedResult[0]
    ? {
        id: String(highestPurchasedResult[0]._id),
        name: highestPurchasedResult[0].student.name,
        rollNumber: highestPurchasedResult[0].student.rollNumber,
        standard: highestPurchasedResult[0].student.standard,
        totalPurchase: highestPurchasedResult[0].totalPurchase,
        transactionCount: highestPurchasedResult[0].transactionCount,
      }
    : null;

  // Build common response data
  const commonData = {
    lowStockCount: lowStockProducts.length,
    lowStockProducts,
    lowBalanceCount: lowBalanceStudents.length,
    lowBalanceStudents,
    topSoldProduct,
    highestPurchasedStudent,
  };

  // =============================================
  // SELLER RESPONSE (Common data only)
  // =============================================
  if (!isAdmin) {
    const sellerResponse: SellerDashboardStats = commonData;
    return successResponse(sellerResponse, 200, 'Dashboard stats fetched successfully');
  }

  // =============================================
  // ADMIN-ONLY DATA
  // =============================================

  // 1. Total Sales (current month)
  const totalSalesResult = await Transaction.aggregate<{ _id: null; totalSales: number }>([
    {
      $match: {
        status: 'Completed',
        transactionType: 'Purchase',
        createdAt: { $gte: startOfMonth },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalAmount' },
      },
    },
  ]);

  // Last month's sales
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const lastMonthSalesResult = await Transaction.aggregate<{ _id: null; totalSales: number }>([
    {
      $match: {
        status: 'Completed',
        transactionType: 'Purchase',
        createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalAmount' },
      },
    },
  ]);

  const totalSales = totalSalesResult[0]?.totalSales || 0;
  const lastMonthSales = lastMonthSalesResult[0]?.totalSales || 0;
  const totalSalesChange =
    lastMonthSales > 0 ? ((totalSales - lastMonthSales) / lastMonthSales) * 100 : 0;

  // 2. Today's Sold Products
  const todaysSoldResult = await Transaction.aggregate<TodaysSoldAggregateResult>([
    {
      $match: {
        status: 'Completed',
        transactionType: 'Purchase',
        createdAt: { $gte: today, $lt: tomorrow },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.subProductId',
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.totalPrice' },
      },
    },
    {
      $lookup: {
        from: 'subproducts',
        localField: '_id',
        foreignField: '_id',
        as: 'subProduct',
      },
    },
    { $unwind: '$subProduct' },
  ]);

  const todaysSoldProducts: TodaysSoldProduct[] = todaysSoldResult.map(item => ({
    id: String(item._id),
    name: item.subProduct.name,
    quantity: item.quantity,
    revenue: item.revenue,
  }));

  // 3. Today's Profit
  const todaysTransactions = await Transaction.aggregate<ProfitAggregateResult>([
    {
      $match: {
        status: 'Completed',
        transactionType: 'Purchase',
        createdAt: { $gte: today, $lt: tomorrow },
      },
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'stocktransactions',
        localField: 'items.stockTransactionId',
        foreignField: '_id',
        as: 'stockTransaction',
      },
    },
    { $unwind: { path: '$stockTransaction', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        totalSellingPrice: { $sum: '$items.totalPrice' },
        totalBuyingPrice: {
          $sum: {
            $multiply: ['$items.quantity', { $ifNull: ['$stockTransaction.buyingPrice', 0] }],
          },
        },
      },
    },
  ]);

  const todaysProfit = todaysTransactions[0]
    ? todaysTransactions[0].totalSellingPrice - todaysTransactions[0].totalBuyingPrice
    : 0;

  const todaysProfitMargin =
    todaysTransactions[0] && todaysTransactions[0].totalSellingPrice > 0
      ? (todaysProfit / todaysTransactions[0].totalSellingPrice) * 100
      : 0;

  // Yesterday's profit
  const yesterdaysTransactions = await Transaction.aggregate<ProfitAggregateResult>([
    {
      $match: {
        status: 'Completed',
        transactionType: 'Purchase',
        createdAt: { $gte: yesterday, $lt: today },
      },
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'stocktransactions',
        localField: 'items.stockTransactionId',
        foreignField: '_id',
        as: 'stockTransaction',
      },
    },
    { $unwind: { path: '$stockTransaction', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        totalSellingPrice: { $sum: '$items.totalPrice' },
        totalBuyingPrice: {
          $sum: {
            $multiply: ['$items.quantity', { $ifNull: ['$stockTransaction.buyingPrice', 0] }],
          },
        },
      },
    },
  ]);

  const yesterdayProfit = yesterdaysTransactions[0]
    ? yesterdaysTransactions[0].totalSellingPrice - yesterdaysTransactions[0].totalBuyingPrice
    : 0;

  // Build admin response
  const adminResponse: AdminDashboardStats = {
    ...commonData,
    totalSales,
    totalSalesChange: parseFloat(totalSalesChange.toFixed(1)),
    todaysSoldProducts,
    todaysProfit,
    todaysProfitMargin: parseFloat(todaysProfitMargin.toFixed(2)),
    yesterdayProfit,
  };

  return successResponse(adminResponse, 200, 'Dashboard stats fetched successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getDashboardStatsHandler));


// import connectDB from '@/lib/config/db';
// import { Transaction } from '@/models/Transaction';
// import { SubProduct } from '@/models/SubProduct';
// import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
// import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';

// // =============================================
// // Handler
// // =============================================
// const getDashboardStatsHandler = async (req: Request, authContext: AuthContext) => {
//   await connectDB();

//   // Get today's date range
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
//   const tomorrow = new Date(today);
//   tomorrow.setDate(tomorrow.getDate() + 1);

//   // Get yesterday's date range
//   const yesterday = new Date(today);
//   yesterday.setDate(yesterday.getDate() - 1);

//   // Get start of month
//   const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

//   // 1. Total Sales (current month)
//   const totalSalesResult = await Transaction.aggregate([
//     {
//       $match: {
//         status: 'Completed',
//         transactionType: 'Purchase',
//         createdAt: { $gte: startOfMonth },
//       },
//     },
//     {
//       $group: {
//         _id: null,
//         totalSales: { $sum: '$totalAmount' },
//       },
//     },
//   ]);

//   // Last month's sales
//   const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
//   const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

//   const lastMonthSalesResult = await Transaction.aggregate([
//     {
//       $match: {
//         status: 'Completed',
//         transactionType: 'Purchase',
//         createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
//       },
//     },
//     {
//       $group: {
//         _id: null,
//         totalSales: { $sum: '$totalAmount' },
//       },
//     },
//   ]);

//   const totalSales = totalSalesResult[0]?.totalSales || 0;
//   const lastMonthSales = lastMonthSalesResult[0]?.totalSales || 0;
//   const totalSalesChange =
//     lastMonthSales > 0 ? ((totalSales - lastMonthSales) / lastMonthSales) * 100 : 0;

//   // 2. Low Stock Subproducts
//   const lowStockProducts = await SubProduct.aggregate([
//     {
//       $lookup: {
//         from: 'stocktransactions',
//         let: { subProductId: '$_id' },
//         pipeline: [
//           {
//             $match: {
//               $expr: { $eq: ['$subProductId', '$$subProductId'] },
//             },
//           },
//           {
//             $group: {
//               _id: null,
//               currentStock: {
//                 $sum: {
//                   $cond: [{ $eq: ['$transactionType', 'Buy'] }, '$quantityLeft', 0],
//                 },
//               },
//               latestPrice: { $last: '$sellingPrice' },
//             },
//           },
//         ],
//         as: 'stockInfo',
//       },
//     },
//     {
//       $unwind: { path: '$stockInfo', preserveNullAndEmptyArrays: true },
//     },
//     {
//       $addFields: {
//         currentStock: { $ifNull: ['$stockInfo.currentStock', 0] },
//         price: { $ifNull: ['$stockInfo.latestPrice', 0] },
//       },
//     },
//     {
//       $match: {
//         $expr: { $lte: ['$currentStock', '$lowStockThreshold'] },
//       },
//     },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'productId',
//         foreignField: '_id',
//         as: 'product',
//       },
//     },
//     { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
//     {
//       $lookup: {
//         from: 'categories',
//         localField: 'product.categoryId',
//         foreignField: '_id',
//         as: 'category',
//       },
//     },
//     { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
//     {
//       $project: {
//         id: { $toString: '$_id' },
//         name: 1,
//         category: { $ifNull: ['$category.name', 'Uncategorized'] },
//         price: 1,
//         stock: '$currentStock',
//       },
//     },
//     { $limit: 10 },
//   ]);

//   // 3. Top Sold Subproduct (today)
//   const topSoldResult = await Transaction.aggregate([
//     {
//       $match: {
//         status: 'Completed',
//         transactionType: 'Purchase',
//         createdAt: { $gte: today, $lt: tomorrow },
//       },
//     },
//     { $unwind: '$items' },
//     {
//       $group: {
//         _id: '$items.subProductId',
//         quantitySold: { $sum: '$items.quantity' },
//         revenue: { $sum: '$items.totalPrice' },
//       },
//     },
//     { $sort: { quantitySold: -1 } },
//     { $limit: 1 },
//     {
//       $lookup: {
//         from: 'subproducts',
//         localField: '_id',
//         foreignField: '_id',
//         as: 'subProduct',
//       },
//     },
//     { $unwind: '$subProduct' },
//   ]);

//   const topSoldProduct = topSoldResult[0]
//     ? {
//         id: topSoldResult[0]._id,
//         name: topSoldResult[0].subProduct.name,
//         quantitySold: topSoldResult[0].quantitySold,
//         revenue: topSoldResult[0].revenue,
//       }
//     : null;

//   // 4. Today's Sold Products
//   const todaysSoldResult = await Transaction.aggregate([
//     {
//       $match: {
//         status: 'Completed',
//         transactionType: 'Purchase',
//         createdAt: { $gte: today, $lt: tomorrow },
//       },
//     },
//     { $unwind: '$items' },
//     {
//       $group: {
//         _id: '$items.subProductId',
//         quantity: { $sum: '$items.quantity' },
//         revenue: { $sum: '$items.totalPrice' },
//       },
//     },
//     {
//       $lookup: {
//         from: 'subproducts',
//         localField: '_id',
//         foreignField: '_id',
//         as: 'subProduct',
//       },
//     },
//     { $unwind: '$subProduct' },
//     {
//       $project: {
//         id: { $toString: '$_id' },
//         name: '$subProduct.name',
//         quantity: 1,
//         revenue: 1,
//       },
//     },
//   ]);

//   // 5. Today's Profit
//   const todaysTransactions = await Transaction.aggregate([
//     {
//       $match: {
//         status: 'Completed',
//         transactionType: 'Purchase',
//         createdAt: { $gte: today, $lt: tomorrow },
//       },
//     },
//     { $unwind: '$items' },
//     {
//       $lookup: {
//         from: 'stocktransactions',
//         localField: 'items.stockTransactionId',
//         foreignField: '_id',
//         as: 'stockTransaction',
//       },
//     },
//     { $unwind: { path: '$stockTransaction', preserveNullAndEmptyArrays: true } },
//     {
//       $group: {
//         _id: null,
//         totalSellingPrice: { $sum: '$items.totalPrice' },
//         totalBuyingPrice: {
//           $sum: {
//             $multiply: ['$items.quantity', { $ifNull: ['$stockTransaction.buyingPrice', 0] }],
//           },
//         },
//       },
//     },
//   ]);

//   const todaysProfit = todaysTransactions[0]
//     ? todaysTransactions[0].totalSellingPrice - todaysTransactions[0].totalBuyingPrice
//     : 0;

//   const todaysProfitMargin =
//     todaysTransactions[0] && todaysTransactions[0].totalSellingPrice > 0
//       ? (todaysProfit / todaysTransactions[0].totalSellingPrice) * 100
//       : 0;

//   // Yesterday's profit
//   const yesterdaysTransactions = await Transaction.aggregate([
//     {
//       $match: {
//         status: 'Completed',
//         transactionType: 'Purchase',
//         createdAt: { $gte: yesterday, $lt: today },
//       },
//     },
//     { $unwind: '$items' },
//     {
//       $lookup: {
//         from: 'stocktransactions',
//         localField: 'items.stockTransactionId',
//         foreignField: '_id',
//         as: 'stockTransaction',
//       },
//     },
//     { $unwind: { path: '$stockTransaction', preserveNullAndEmptyArrays: true } },
//     {
//       $group: {
//         _id: null,
//         totalSellingPrice: { $sum: '$items.totalPrice' },
//         totalBuyingPrice: {
//           $sum: {
//             $multiply: ['$items.quantity', { $ifNull: ['$stockTransaction.buyingPrice', 0] }],
//           },
//         },
//       },
//     },
//   ]);

//   const yesterdayProfit = yesterdaysTransactions[0]
//     ? yesterdaysTransactions[0].totalSellingPrice - yesterdaysTransactions[0].totalBuyingPrice
//     : 0;

//   return successResponse(
//     {
//       totalSales,
//       totalSalesChange: parseFloat(totalSalesChange.toFixed(1)),
//       lowStockCount: lowStockProducts.length,
//       lowStockProducts,
//       topSoldProduct,
//       todaysSoldProducts: todaysSoldResult,
//       todaysProfit,
//       todaysProfitMargin: parseFloat(todaysProfitMargin.toFixed(2)),
//       yesterdayProfit,
//     },
//     200,
//     'Dashboard stats fetched successfully'
//   );
// };

// // =============================================
// // Export Routes
// // =============================================
// export const GET = withErrorHandler(withAuth(getDashboardStatsHandler));




// // // app/api/dashboard/stats/route.ts
// // import { NextResponse } from "next/server"
// // import connectDB from "@/lib/config/db"
// // import {Transaction} from "@/models/Transaction"
// // import {SubProduct} from "@/models/SubProduct"
// // // import StockTransaction from "@/models/StockTransaction"
// // // import Product from "@/models/Product"
// // // import Category from "@/models/Category"

// // export async function GET() {
// //   try {
// //     await connectDB()

// //     // Get today's date range
// //     const today = new Date()
// //     today.setHours(0, 0, 0, 0)
// //     const tomorrow = new Date(today)
// //     tomorrow.setDate(tomorrow.getDate() + 1)

// //     // Get yesterday's date range for comparison
// //     const yesterday = new Date(today)
// //     yesterday.setDate(yesterday.getDate() - 1)

// //     // Get start of month for total sales
// //     const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

// //     // 1. Total Sales (current month)
// //     const totalSalesResult = await Transaction.aggregate([
// //       {
// //         $match: {
// //           status: "Completed",
// //           transactionType: "Purchase",
// //           createdAt: { $gte: startOfMonth }
// //         }
// //       },
// //       {
// //         $group: {
// //           _id: null,
// //           totalSales: { $sum: "$totalAmount" }
// //         }
// //       }
// //     ])

// //     // Get last month's sales for comparison
// //     const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
// //     const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    
// //     const lastMonthSalesResult = await Transaction.aggregate([
// //       {
// //         $match: {
// //           status: "Completed",
// //           transactionType: "Purchase",
// //           createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
// //         }
// //       },
// //       {
// //         $group: {
// //           _id: null,
// //           totalSales: { $sum: "$totalAmount" }
// //         }
// //       }
// //     ])

// //     const totalSales = totalSalesResult[0]?.totalSales || 0
// //     const lastMonthSales = lastMonthSalesResult[0]?.totalSales || 0
// //     const totalSalesChange = lastMonthSales > 0 
// //       ? ((totalSales - lastMonthSales) / lastMonthSales * 100).toFixed(1)
// //       : 0

// //     // 2. Low Stock Subproducts - Calculate current stock from StockTransaction
// //     const lowStockProducts = await SubProduct.aggregate([
// //       {
// //         $lookup: {
// //           from: "stocktransactions",
// //           let: { subProductId: "$_id" },
// //           pipeline: [
// //             {
// //               $match: {
// //                 $expr: { $eq: ["$subProductId", "$$subProductId"] }
// //               }
// //             },
// //             {
// //               $group: {
// //                 _id: null,
// //                 currentStock: {
// //                   $sum: {
// //                     $cond: [
// //                       { $eq: ["$transactionType", "Buy"] },
// //                       "$quantityLeft",
// //                       0
// //                     ]
// //                   }
// //                 },
// //                 latestPrice: { $last: "$sellingPrice" }
// //               }
// //             }
// //           ],
// //           as: "stockInfo"
// //         }
// //       },
// //       {
// //         $unwind: { path: "$stockInfo", preserveNullAndEmptyArrays: true }
// //       },
// //       {
// //         $addFields: {
// //           currentStock: { $ifNull: ["$stockInfo.currentStock", 0] },
// //           price: { $ifNull: ["$stockInfo.latestPrice", 0] }
// //         }
// //       },
// //       {
// //         $match: {
// //           $expr: { $lte: ["$currentStock", "$lowStockThreshold"] }
// //         }
// //       },
// //       {
// //         $lookup: {
// //           from: "products",
// //           localField: "productId",
// //           foreignField: "_id",
// //           as: "product"
// //         }
// //       },
// //       { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
// //       {
// //         $lookup: {
// //           from: "categories",
// //           localField: "product.categoryId",
// //           foreignField: "_id",
// //           as: "category"
// //         }
// //       },
// //       { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
// //       {
// //         $project: {
// //           id: { $toString: "$_id" },
// //           name: 1,
// //           category: { $ifNull: ["$category.name", "Uncategorized"] },
// //           price: 1,
// //           stock: "$currentStock"
// //         }
// //       },
// //       { $limit: 10 }
// //     ])

// //     // 3. Top Sold Subproduct (today)
// //     const topSoldResult = await Transaction.aggregate([
// //       {
// //         $match: {
// //           status: "Completed",
// //           transactionType: "Purchase",
// //           createdAt: { $gte: today, $lt: tomorrow }
// //         }
// //       },
// //       { $unwind: "$items" },
// //       {
// //         $group: {
// //           _id: "$items.subProductId",
// //           quantitySold: { $sum: "$items.quantity" },
// //           revenue: { $sum: "$items.totalPrice" }
// //         }
// //       },
// //       { $sort: { quantitySold: -1 } },
// //       { $limit: 1 },
// //       {
// //         $lookup: {
// //           from: "subproducts",
// //           localField: "_id",
// //           foreignField: "_id",
// //           as: "subProduct"
// //         }
// //       },
// //       { $unwind: "$subProduct" }
// //     ])

// //     const topSoldProduct = topSoldResult[0] ? {
// //       id: topSoldResult[0]._id,
// //       name: topSoldResult[0].subProduct.name,
// //       quantitySold: topSoldResult[0].quantitySold,
// //       revenue: topSoldResult[0].revenue
// //     } : null

// //     // 4. Today's Sold Products with quantity
// //     const todaysSoldResult = await Transaction.aggregate([
// //       {
// //         $match: {
// //           status: "Completed",
// //           transactionType: "Purchase",
// //           createdAt: { $gte: today, $lt: tomorrow }
// //         }
// //       },
// //       { $unwind: "$items" },
// //       {
// //         $group: {
// //           _id: "$items.subProductId",
// //           quantity: { $sum: "$items.quantity" },
// //           revenue: { $sum: "$items.totalPrice" }
// //         }
// //       },
// //       {
// //         $lookup: {
// //           from: "subproducts",
// //           localField: "_id",
// //           foreignField: "_id",
// //           as: "subProduct"
// //         }
// //       },
// //       { $unwind: "$subProduct" },
// //       {
// //         $project: {
// //           id: { $toString: "$_id" },
// //           name: "$subProduct.name",
// //           quantity: 1,
// //           revenue: 1
// //         }
// //       }
// //     ])

// //     // 5. Calculate Today's Profit
// //     const todaysTransactions = await Transaction.aggregate([
// //       {
// //         $match: {
// //           status: "Completed",
// //           transactionType: "Purchase",
// //           createdAt: { $gte: today, $lt: tomorrow }
// //         }
// //       },
// //       { $unwind: "$items" },
// //       {
// //         $lookup: {
// //           from: "stocktransactions",
// //           localField: "items.stockTransactionId",
// //           foreignField: "_id",
// //           as: "stockTransaction"
// //         }
// //       },
// //       { $unwind: { path: "$stockTransaction", preserveNullAndEmptyArrays: true } },
// //       {
// //         $group: {
// //           _id: null,
// //           totalSellingPrice: { $sum: "$items.totalPrice" },
// //           totalBuyingPrice: { 
// //             $sum: { 
// //               $multiply: ["$items.quantity", { $ifNull: ["$stockTransaction.buyingPrice", 0] }] 
// //             } 
// //           }
// //         }
// //       }
// //     ])

// //     const todaysProfit = todaysTransactions[0] 
// //       ? todaysTransactions[0].totalSellingPrice - todaysTransactions[0].totalBuyingPrice
// //       : 0

// //     const todaysProfitMargin = todaysTransactions[0] && todaysTransactions[0].totalSellingPrice > 0
// //       ? (todaysProfit / todaysTransactions[0].totalSellingPrice * 100)
// //       : 0

// //     // Calculate yesterday's profit for comparison
// //     const yesterdaysTransactions = await Transaction.aggregate([
// //       {
// //         $match: {
// //           status: "Completed",
// //           transactionType: "Purchase",
// //           createdAt: { $gte: yesterday, $lt: today }
// //         }
// //       },
// //       { $unwind: "$items" },
// //       {
// //         $lookup: {
// //           from: "stocktransactions",
// //           localField: "items.stockTransactionId",
// //           foreignField: "_id",
// //           as: "stockTransaction"
// //         }
// //       },
// //       { $unwind: { path: "$stockTransaction", preserveNullAndEmptyArrays: true } },
// //       {
// //         $group: {
// //           _id: null,
// //           totalSellingPrice: { $sum: "$items.totalPrice" },
// //           totalBuyingPrice: { 
// //             $sum: { 
// //               $multiply: ["$items.quantity", { $ifNull: ["$stockTransaction.buyingPrice", 0] }] 
// //             } 
// //           }
// //         }
// //       }
// //     ])

// //     const yesterdayProfit = yesterdaysTransactions[0] 
// //       ? yesterdaysTransactions[0].totalSellingPrice - yesterdaysTransactions[0].totalBuyingPrice
// //       : 0

// //     return NextResponse.json({
// //       totalSales,
// //       totalSalesChange,
// //       lowStockCount: lowStockProducts.length,
// //       lowStockProducts,
// //       topSoldProduct,
// //       todaysSoldProducts: todaysSoldResult,
// //       todaysProfit,
// //       todaysProfitMargin,
// //       yesterdayProfit
// //     })

// //   } catch (error) {
// //     console.error("Error fetching dashboard stats:", error)
// //     return NextResponse.json(
// //       { error: "Failed to fetch dashboard stats" },
// //       { status: 500 }
// //     )
// //   }
// // }
// // // // app/api/dashboard/stats/route.ts
// // // import { NextResponse } from "next/server"
// // // import connectDB from "@/lib/config/db"
// // // import {Transaction} from "@/models/Transaction"
// // // import {SubProduct} from "@/models/SubProduct"
// // // // import StockTransaction from "@/models/StockTransaction"
// // // // import Product from "@/models/Product"
// // // // import Category from "@/models/Category"

// // // export async function GET() {
// // //   try {
// // //     await connectDB()

// // //     // Get today's date range
// // //     const today = new Date()
// // //     today.setHours(0, 0, 0, 0)
// // //     const tomorrow = new Date(today)
// // //     tomorrow.setDate(tomorrow.getDate() + 1)

// // //     // Get yesterday's date range for comparison
// // //     const yesterday = new Date(today)
// // //     yesterday.setDate(yesterday.getDate() - 1)

// // //     // Get start of month for total sales
// // //     const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

// // //     // 1. Total Sales (current month)
// // //     const totalSalesResult = await Transaction.aggregate([
// // //       {
// // //         $match: {
// // //           status: "Completed",
// // //           transactionType: "Purchase",
// // //           createdAt: { $gte: startOfMonth }
// // //         }
// // //       },
// // //       {
// // //         $group: {
// // //           _id: null,
// // //           totalSales: { $sum: "$totalAmount" }
// // //         }
// // //       }
// // //     ])

// // //     // Get last month's sales for comparison
// // //     const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
// // //     const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    
// // //     const lastMonthSalesResult = await Transaction.aggregate([
// // //       {
// // //         $match: {
// // //           status: "Completed",
// // //           transactionType: "Purchase",
// // //           createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
// // //         }
// // //       },
// // //       {
// // //         $group: {
// // //           _id: null,
// // //           totalSales: { $sum: "$totalAmount" }
// // //         }
// // //       }
// // //     ])

// // //     const totalSales = totalSalesResult[0]?.totalSales || 0
// // //     const lastMonthSales = lastMonthSalesResult[0]?.totalSales || 0
// // //     const totalSalesChange = lastMonthSales > 0 
// // //       ? ((totalSales - lastMonthSales) / lastMonthSales * 100).toFixed(1)
// // //       : 0

// // //     // 2. Low Stock Subproducts - Calculate current stock from StockTransaction
// // //     const lowStockProducts = await SubProduct.aggregate([
// // //       {
// // //         $lookup: {
// // //           from: "stocktransactions",
// // //           let: { subProductId: "$_id" },
// // //           pipeline: [
// // //             {
// // //               $match: {
// // //                 $expr: { $eq: ["$subProductId", "$$subProductId"] }
// // //               }
// // //             },
// // //             {
// // //               $group: {
// // //                 _id: null,
// // //                 currentStock: {
// // //                   $sum: {
// // //                     $cond: [
// // //                       { $eq: ["$transactionType", "Buy"] },
// // //                       "$quantityLeft",
// // //                       0
// // //                     ]
// // //                   }
// // //                 },
// // //                 latestPrice: { $last: "$sellingPrice" }
// // //               }
// // //             }
// // //           ],
// // //           as: "stockInfo"
// // //         }
// // //       },
// // //       {
// // //         $unwind: { path: "$stockInfo", preserveNullAndEmptyArrays: true }
// // //       },
// // //       {
// // //         $addFields: {
// // //           currentStock: { $ifNull: ["$stockInfo.currentStock", 0] },
// // //           price: { $ifNull: ["$stockInfo.latestPrice", 0] }
// // //         }
// // //       },
// // //       {
// // //         $match: {
// // //           $expr: { $lte: ["$currentStock", "$lowStockThreshold"] }
// // //         }
// // //       },
// // //       {
// // //         $lookup: {
// // //           from: "products",
// // //           localField: "productId",
// // //           foreignField: "_id",
// // //           as: "product"
// // //         }
// // //       },
// // //       { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
// // //       {
// // //         $lookup: {
// // //           from: "categories",
// // //           localField: "product.categoryId",
// // //           foreignField: "_id",
// // //           as: "category"
// // //         }
// // //       },
// // //       { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
// // //       {
// // //         $project: {
// // //           id: { $toString: "$_id" },
// // //           name: 1,
// // //           category: { $ifNull: ["$category.name", "Uncategorized"] },
// // //           price: 1,
// // //           stock: "$currentStock"
// // //         }
// // //       },
// // //       { $limit: 10 }
// // //     ])

// // //     // 3. Top Sold Subproduct (today)
// // //     const topSoldResult = await Transaction.aggregate([
// // //       {
// // //         $match: {
// // //           status: "Completed",
// // //           transactionType: "Purchase",
// // //           createdAt: { $gte: today, $lt: tomorrow }
// // //         }
// // //       },
// // //       { $unwind: "$items" },
// // //       {
// // //         $group: {
// // //           _id: "$items.subProductId",
// // //           quantitySold: { $sum: "$items.quantity" },
// // //           revenue: { $sum: "$items.totalPrice" }
// // //         }
// // //       },
// // //       { $sort: { quantitySold: -1 } },
// // //       { $limit: 1 },
// // //       {
// // //         $lookup: {
// // //           from: "subproducts",
// // //           localField: "_id",
// // //           foreignField: "_id",
// // //           as: "subProduct"
// // //         }
// // //       },
// // //       { $unwind: "$subProduct" }
// // //     ])

// // //     const topSoldProduct = topSoldResult[0] ? {
// // //       id: topSoldResult[0]._id,
// // //       name: topSoldResult[0].subProduct.name,
// // //       quantitySold: topSoldResult[0].quantitySold,
// // //       revenue: topSoldResult[0].revenue
// // //     } : null

// // //     // 4. Today's Sold Products with quantity
// // //     const todaysSoldResult = await Transaction.aggregate([
// // //       {
// // //         $match: {
// // //           status: "Completed",
// // //           transactionType: "Purchase",
// // //           createdAt: { $gte: today, $lt: tomorrow }
// // //         }
// // //       },
// // //       { $unwind: "$items" },
// // //       {
// // //         $group: {
// // //           _id: "$items.subProductId",
// // //           quantity: { $sum: "$items.quantity" },
// // //           revenue: { $sum: "$items.totalPrice" }
// // //         }
// // //       },
// // //       {
// // //         $lookup: {
// // //           from: "subproducts",
// // //           localField: "_id",
// // //           foreignField: "_id",
// // //           as: "subProduct"
// // //         }
// // //       },
// // //       { $unwind: "$subProduct" },
// // //       {
// // //         $project: {
// // //           id: { $toString: "$_id" },
// // //           name: "$subProduct.name",
// // //           quantity: 1,
// // //           revenue: 1
// // //         }
// // //       }
// // //     ])

// // //     // 5. Calculate Today's Profit
// // //     const todaysTransactions = await Transaction.aggregate([
// // //       {
// // //         $match: {
// // //           status: "Completed",
// // //           transactionType: "Purchase",
// // //           createdAt: { $gte: today, $lt: tomorrow }
// // //         }
// // //       },
// // //       { $unwind: "$items" },
// // //       {
// // //         $lookup: {
// // //           from: "stocktransactions",
// // //           localField: "items.stockTransactionId",
// // //           foreignField: "_id",
// // //           as: "stockTransaction"
// // //         }
// // //       },
// // //       { $unwind: { path: "$stockTransaction", preserveNullAndEmptyArrays: true } },
// // //       {
// // //         $group: {
// // //           _id: null,
// // //           totalSellingPrice: { $sum: "$items.totalPrice" },
// // //           totalBuyingPrice: { 
// // //             $sum: { 
// // //               $multiply: ["$items.quantity", { $ifNull: ["$stockTransaction.buyingPrice", 0] }] 
// // //             } 
// // //           }
// // //         }
// // //       }
// // //     ])

// // //     const todaysProfit = todaysTransactions[0] 
// // //       ? todaysTransactions[0].totalSellingPrice - todaysTransactions[0].totalBuyingPrice
// // //       : 0

// // //     const todaysProfitMargin = todaysTransactions[0] && todaysTransactions[0].totalSellingPrice > 0
// // //       ? (todaysProfit / todaysTransactions[0].totalSellingPrice * 100)
// // //       : 0

// // //     // Calculate yesterday's profit for comparison
// // //     const yesterdaysTransactions = await Transaction.aggregate([
// // //       {
// // //         $match: {
// // //           status: "Completed",
// // //           transactionType: "Purchase",
// // //           createdAt: { $gte: yesterday, $lt: today }
// // //         }
// // //       },
// // //       { $unwind: "$items" },
// // //       {
// // //         $lookup: {
// // //           from: "stocktransactions",
// // //           localField: "items.stockTransactionId",
// // //           foreignField: "_id",
// // //           as: "stockTransaction"
// // //         }
// // //       },
// // //       { $unwind: { path: "$stockTransaction", preserveNullAndEmptyArrays: true } },
// // //       {
// // //         $group: {
// // //           _id: null,
// // //           totalSellingPrice: { $sum: "$items.totalPrice" },
// // //           totalBuyingPrice: { 
// // //             $sum: { 
// // //               $multiply: ["$items.quantity", { $ifNull: ["$stockTransaction.buyingPrice", 0] }] 
// // //             } 
// // //           }
// // //         }
// // //       }
// // //     ])

// // //     const yesterdayProfit = yesterdaysTransactions[0] 
// // //       ? yesterdaysTransactions[0].totalSellingPrice - yesterdaysTransactions[0].totalBuyingPrice
// // //       : 0

// // //     return NextResponse.json({
// // //       totalSales,
// // //       totalSalesChange,
// // //       lowStockCount: lowStockProducts.length,
// // //       lowStockProducts,
// // //       topSoldProduct,
// // //       todaysSoldProducts: todaysSoldResult,
// // //       todaysProfit,
// // //       todaysProfitMargin,
// // //       yesterdayProfit
// // //     })

// // //   } catch (error) {
// // //     console.error("Error fetching dashboard stats:", error)
// // //     return NextResponse.json(
// // //       { error: "Failed to fetch dashboard stats" },
// // //       { status: 500 }
// // //     )
// // //   }
// // // }



// // // // // app/api/dashboard/stats/route.ts
// // // // import { NextResponse } from "next/server"
// // // // import connectDB from "@/lib/config/db"
// // // // import {Transaction} from "@/models/Transaction"
// // // // import {SubProduct} from "@/models/SubProduct"
// // // // import {StockTransaction} from "@/models/StockTransaction"

// // // // export async function GET() {
// // // //   try {
// // // //     await connectDB()

// // // //     // Get today's date range
// // // //     const today = new Date()
// // // //     today.setHours(0, 0, 0, 0)
// // // //     const tomorrow = new Date(today)
// // // //     tomorrow.setDate(tomorrow.getDate() + 1)

// // // //     // Get yesterday's date range for comparison
// // // //     const yesterday = new Date(today)
// // // //     yesterday.setDate(yesterday.getDate() - 1)

// // // //     // Get start of month for total sales
// // // //     const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

// // // //     // 1. Total Sales (current month)
// // // //     const totalSalesResult = await Transaction.aggregate([
// // // //       {
// // // //         $match: {
// // // //           status: "Completed",
// // // //           transactionType: "Purchase",
// // // //           createdAt: { $gte: startOfMonth }
// // // //         }
// // // //       },
// // // //       {
// // // //         $group: {
// // // //           _id: null,
// // // //           totalSales: { $sum: "$totalAmount" }
// // // //         }
// // // //       }
// // // //     ])

// // // //     // Get last month's sales for comparison
// // // //     const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
// // // //     const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    
// // // //     const lastMonthSalesResult = await Transaction.aggregate([
// // // //       {
// // // //         $match: {
// // // //           status: "Completed",
// // // //           transactionType: "Purchase",
// // // //           createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
// // // //         }
// // // //       },
// // // //       {
// // // //         $group: {
// // // //           _id: null,
// // // //           totalSales: { $sum: "$totalAmount" }
// // // //         }
// // // //       }
// // // //     ])

// // // //     const totalSales = totalSalesResult[0]?.totalSales || 0
// // // //     const lastMonthSales = lastMonthSalesResult[0]?.totalSales || 0
// // // //     const totalSalesChange = lastMonthSales > 0 
// // // //       ? ((totalSales - lastMonthSales) / lastMonthSales * 100).toFixed(1)
// // // //       : 0

// // // //     // 2. Low Stock Subproducts
// // // //     const lowStockProducts = await SubProduct.find({
// // // //       $expr: { $lte: ["$currentStock", "$minStock"] }
// // // //     }).limit(10).lean()

// // // //     // 3. Top Sold Subproduct (today)
// // // //     const topSoldResult = await Transaction.aggregate([
// // // //       {
// // // //         $match: {
// // // //           status: "Completed",
// // // //           transactionType: "Purchase",
// // // //           createdAt: { $gte: today, $lt: tomorrow }
// // // //         }
// // // //       },
// // // //       { $unwind: "$items" },
// // // //       {
// // // //         $group: {
// // // //           _id: "$items.subProductId",
// // // //           quantitySold: { $sum: "$items.quantity" },
// // // //           revenue: { $sum: "$items.totalPrice" }
// // // //         }
// // // //       },
// // // //       { $sort: { quantitySold: -1 } },
// // // //       { $limit: 1 },
// // // //       {
// // // //         $lookup: {
// // // //           from: "subproducts",
// // // //           localField: "_id",
// // // //           foreignField: "_id",
// // // //           as: "subProduct"
// // // //         }
// // // //       },
// // // //       { $unwind: "$subProduct" }
// // // //     ])

// // // //     const topSoldProduct = topSoldResult[0] ? {
// // // //       id: topSoldResult[0]._id,
// // // //       name: topSoldResult[0].subProduct.name,
// // // //       quantitySold: topSoldResult[0].quantitySold,
// // // //       revenue: topSoldResult[0].revenue
// // // //     } : null

// // // //     // 4. Today's Sold Products with quantity
// // // //     const todaysSoldResult = await Transaction.aggregate([
// // // //       {
// // // //         $match: {
// // // //           status: "Completed",
// // // //           transactionType: "Purchase",
// // // //           createdAt: { $gte: today, $lt: tomorrow }
// // // //         }
// // // //       },
// // // //       { $unwind: "$items" },
// // // //       {
// // // //         $group: {
// // // //           _id: "$items.subProductId",
// // // //           quantity: { $sum: "$items.quantity" },
// // // //           revenue: { $sum: "$items.totalPrice" }
// // // //         }
// // // //       },
// // // //       {
// // // //         $lookup: {
// // // //           from: "subproducts",
// // // //           localField: "_id",
// // // //           foreignField: "_id",
// // // //           as: "subProduct"
// // // //         }
// // // //       },
// // // //       { $unwind: "$subProduct" },
// // // //       {
// // // //         $project: {
// // // //           id: "$_id",
// // // //           name: "$subProduct.name",
// // // //           quantity: 1,
// // // //           revenue: 1
// // // //         }
// // // //       }
// // // //     ])

// // // //     // 5. Calculate Today's Profit
// // // //     // Get today's transactions with stock transaction details
// // // //     const todaysTransactions = await Transaction.aggregate([
// // // //       {
// // // //         $match: {
// // // //           status: "Completed",
// // // //           transactionType: "Purchase",
// // // //           createdAt: { $gte: today, $lt: tomorrow }
// // // //         }
// // // //       },
// // // //       { $unwind: "$items" },
// // // //       {
// // // //         $lookup: {
// // // //           from: "stocktransactions",
// // // //           localField: "items.stockTransactionId",
// // // //           foreignField: "_id",
// // // //           as: "stockTransaction"
// // // //         }
// // // //       },
// // // //       { $unwind: "$stockTransaction" },
// // // //       {
// // // //         $group: {
// // // //           _id: null,
// // // //           totalSellingPrice: { $sum: "$items.totalPrice" },
// // // //           totalBuyingPrice: { 
// // // //             $sum: { 
// // // //               $multiply: ["$items.quantity", "$stockTransaction.costPrice"] 
// // // //             } 
// // // //           }
// // // //         }
// // // //       }
// // // //     ])

// // // //     const todaysProfit = todaysTransactions[0] 
// // // //       ? todaysTransactions[0].totalSellingPrice - todaysTransactions[0].totalBuyingPrice
// // // //       : 0

// // // //     const todaysProfitMargin = todaysTransactions[0] && todaysTransactions[0].totalSellingPrice > 0
// // // //       ? (todaysProfit / todaysTransactions[0].totalSellingPrice * 100)
// // // //       : 0

// // // //     // Calculate yesterday's profit for comparison
// // // //     const yesterdaysTransactions = await Transaction.aggregate([
// // // //       {
// // // //         $match: {
// // // //           status: "Completed",
// // // //           transactionType: "Purchase",
// // // //           createdAt: { $gte: yesterday, $lt: today }
// // // //         }
// // // //       },
// // // //       { $unwind: "$items" },
// // // //       {
// // // //         $lookup: {
// // // //           from: "stocktransactions",
// // // //           localField: "items.stockTransactionId",
// // // //           foreignField: "_id",
// // // //           as: "stockTransaction"
// // // //         }
// // // //       },
// // // //       { $unwind: "$stockTransaction" },
// // // //       {
// // // //         $group: {
// // // //           _id: null,
// // // //           totalSellingPrice: { $sum: "$items.totalPrice" },
// // // //           totalBuyingPrice: { 
// // // //             $sum: { 
// // // //               $multiply: ["$items.quantity", "$stockTransaction.costPrice"] 
// // // //             } 
// // // //           }
// // // //         }
// // // //       }
// // // //     ])

// // // //     const yesterdayProfit = yesterdaysTransactions[0] 
// // // //       ? yesterdaysTransactions[0].totalSellingPrice - yesterdaysTransactions[0].totalBuyingPrice
// // // //       : 0

// // // //     return NextResponse.json({
// // // //       totalSales,
// // // //       totalSalesChange,
// // // //       lowStockCount: lowStockProducts.length,
// // // //       lowStockProducts: lowStockProducts.map(p => ({
// // // //         id: p._id,
// // // //         name: p.name,
// // // //         currentStock: p.currentStock,
// // // //         minStock: p.minStock
// // // //       })),
// // // //       topSoldProduct,
// // // //       todaysSoldProducts: todaysSoldResult,
// // // //       todaysProfit,
// // // //       todaysProfitMargin,
// // // //       yesterdayProfit
// // // //     })

// // // //   } catch (error) {
// // // //     console.error("Error fetching dashboard stats:", error)
// // // //     return NextResponse.json(
// // // //       { error: "Failed to fetch dashboard stats" },
// // // //       { status: 500 }
// // // //     )
// // // //   }
// // // // }