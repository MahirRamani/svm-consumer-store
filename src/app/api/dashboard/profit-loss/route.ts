import connectDB from '@/lib/config/db';
import { Transaction } from '@/models/Transaction';
import { withErrorHandler, successResponse } from '@/lib/api/base-handler';
import { withAuth, type AuthContext } from '@/lib/api/auth-helpers';

// =============================================
// Handler
// =============================================
const getProfitLossHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  // Get last 7 days of data
  const days = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Get transactions for this day
    const dayTransactions = await Transaction.aggregate([
      {
        $match: {
          status: 'Completed',
          transactionType: 'Purchase',
          createdAt: { $gte: date, $lte: endDate },
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
          totalSales: { $sum: '$items.totalPrice' },
          totalCost: {
            $sum: {
              $multiply: ['$items.quantity', { $ifNull: ['$stockTransaction.buyingPrice', 0] }],
            },
          },
        },
      },
    ]);

    days.push({
      date: date.toLocaleDateString('en', { weekday: 'short' }),
      totalSales: dayTransactions[0]?.totalSales || 0,
      totalCost: dayTransactions[0]?.totalCost || 0,
      profit: (dayTransactions[0]?.totalSales || 0) - (dayTransactions[0]?.totalCost || 0),
    });
  }

  return successResponse(days, 200, 'Profit/Loss data fetched successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withAuth(getProfitLossHandler));





// // app/api/dashboard/profit-loss/route.ts
// import { NextResponse } from "next/server"
// import connectDB from "@/lib/config/db"
// import {Transaction} from "@/models/Transaction"

// export async function GET() {
//   try {
//     await connectDB()

//     // Get last 7 days of data
//     const days = []
//     const today = new Date()
//     today.setHours(23, 59, 59, 999)

//     for (let i = 6; i >= 0; i--) {
//       const date = new Date(today)
//       date.setDate(date.getDate() - i)
//       date.setHours(0, 0, 0, 0)
//       const endDate = new Date(date)
//       endDate.setHours(23, 59, 59, 999)

//       // Get transactions for this day
//       const dayTransactions = await Transaction.aggregate([
//         {
//           $match: {
//             status: "Completed",
//             transactionType: "Purchase",
//             createdAt: { $gte: date, $lte: endDate }
//           }
//         },
//         { $unwind: "$items" },
//         {
//           $lookup: {
//             from: "stocktransactions",
//             localField: "items.stockTransactionId",
//             foreignField: "_id",
//             as: "stockTransaction"
//           }
//         },
//         { $unwind: { path: "$stockTransaction", preserveNullAndEmptyArrays: true } },
//         {
//           $group: {
//             _id: null,
//             totalSales: { $sum: "$items.totalPrice" }, // Total sales amount for the day
//             totalCost: { // Total buying cost of items sold that day
//               $sum: { 
//                 $multiply: ["$items.quantity", { $ifNull: ["$stockTransaction.buyingPrice", 0] }] 
//               } 
//             }
//           }
//         }
//       ])

//       days.push({
//         date: date.toLocaleDateString('en', { weekday: 'short' }),
//         totalSales: dayTransactions[0]?.totalSales || 0,
//         totalCost: dayTransactions[0]?.totalCost || 0
//       })
//     }

//     return NextResponse.json({ data: days })

//   } catch (error) {
//     console.error("Error fetching profit/loss data:", error)
//     return NextResponse.json(
//       { error: "Failed to fetch profit/loss data" },
//       { status: 500 }
//     )
//   }
// }
// // // app/api/dashboard/profit-loss/route.ts
// // import { NextResponse } from "next/server"
// // import connectDB from "@/lib/config/db"
// // import {Transaction} from "@/models/Transaction"

// // export async function GET() {
// //   try {
// //     await connectDB()

// //     // Get last 7 days of data
// //     const days = []
// //     const today = new Date()
// //     today.setHours(23, 59, 59, 999)

// //     for (let i = 6; i >= 0; i--) {
// //       const date = new Date(today)
// //       date.setDate(date.getDate() - i)
// //       date.setHours(0, 0, 0, 0)
// //       const endDate = new Date(date)
// //       endDate.setHours(23, 59, 59, 999)

// //       // Get transactions for this day
// //       const dayTransactions = await Transaction.aggregate([
// //         {
// //           $match: {
// //             status: "Completed",
// //             transactionType: "Purchase",
// //             createdAt: { $gte: date, $lte: endDate }
// //           }
// //         },
// //         { $unwind: "$items" },
// //         {
// //           $lookup: {
// //             from: "stocktransactions",
// //             localField: "items.stockTransactionId",
// //             foreignField: "_id",
// //             as: "stockTransaction"
// //           }
// //         },
// //         { $unwind: { path: "$stockTransaction", preserveNullAndEmptyArrays: true } },
// //         {
// //           $group: {
// //             _id: null,
// //             totalSales: { $sum: "$items.totalPrice" }, // Total sales amount
// //             totalCost: { // Total cost/buying price of sold items
// //               $sum: { 
// //                 $multiply: ["$items.quantity", { $ifNull: ["$stockTransaction.costPrice", 0] }] 
// //               } 
// //             }
// //           }
// //         }
// //       ])

// //       days.push({
// //         date: date.toLocaleDateString('en', { weekday: 'short' }),
// //         totalSales: dayTransactions[0]?.totalSales || 0,
// //         totalCost: dayTransactions[0]?.totalCost || 0
// //       })
// //     }

// //     return NextResponse.json({ data: days })

// //   } catch (error) {
// //     console.error("Error fetching profit/loss data:", error)
// //     return NextResponse.json(
// //       { error: "Failed to fetch profit/loss data" },
// //       { status: 500 }
// //     )
// //   }
// // }

// // // // app/api/dashboard/profit-loss/route.ts
// // // import { NextResponse } from "next/server"
// // // import connectDB from "@/lib/config/db"
// // // import {Transaction} from "@/models/Transaction"

// // // export async function GET() {
// // //   try {
// // //     await connectDB()

// // //     // Get last 7 days of data
// // //     const days = []
// // //     const today = new Date()
// // //     today.setHours(23, 59, 59, 999)

// // //     for (let i = 6; i >= 0; i--) {
// // //       const date = new Date(today)
// // //       date.setDate(date.getDate() - i)
// // //       date.setHours(0, 0, 0, 0)
// // //       const endDate = new Date(date)
// // //       endDate.setHours(23, 59, 59, 999)

// // //       // Get transactions for this day
// // //       const dayTransactions = await Transaction.aggregate([
// // //         {
// // //           $match: {
// // //             status: "Completed",
// // //             transactionType: "Purchase",
// // //             createdAt: { $gte: date, $lte: endDate }
// // //           }
// // //         },
// // //         { $unwind: "$items" },
// // //         {
// // //           $lookup: {
// // //             from: "stocktransactions",
// // //             localField: "items.stockTransactionId",
// // //             foreignField: "_id",
// // //             as: "stockTransaction"
// // //           }
// // //         },
// // //         { $unwind: "$stockTransaction" },
// // //         {
// // //           $group: {
// // //             _id: null,
// // //             sellingPrice: { $sum: "$items.totalPrice" },
// // //             buyingPrice: { 
// // //               $sum: { 
// // //                 $multiply: ["$items.quantity", "$stockTransaction.costPrice"] 
// // //               } 
// // //             }
// // //           }
// // //         }
// // //       ])

// // //       days.push({
// // //         date: date.toLocaleDateString('en', { weekday: 'short' }),
// // //         buyingPrice: dayTransactions[0]?.buyingPrice || 0,
// // //         sellingPrice: dayTransactions[0]?.sellingPrice || 0
// // //       })
// // //     }

// // //     return NextResponse.json({ data: days })

// // //   } catch (error) {
// // //     console.error("Error fetching profit/loss data:", error)
// // //     return NextResponse.json(
// // //       { error: "Failed to fetch profit/loss data" },
// // //       { status: 500 }
// // //     )
// // //   }
// // // }