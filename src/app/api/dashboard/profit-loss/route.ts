// app/api/dashboard/profit-loss/route.ts
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
          type: 'Purchase',
          createdAt: { $gte: date, $lte: endDate },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'stock_transactions',  // ✅ FIXED: Added underscore
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