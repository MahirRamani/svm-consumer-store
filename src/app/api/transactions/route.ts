// app/api/transactions/route.ts
import connectDB from '@/lib/config/db';
import { Transaction } from '@/models';
import { Student } from '@/models';
import { Product } from '@/models';
import { StockTransaction } from '@/models';
import { withErrorHandler, successResponse, ApiError } from '@/lib/api/base-handler';
import mongoose from 'mongoose';
import { z } from 'zod';

// =============================================
// Validation Schemas
// =============================================
const transactionItemSchema = z.object({
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  stockTransactionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  quantity: z.number().int().positive(),
  price: z.number().min(0),
});

const createPurchaseTransactionSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  performedBy: z.string().regex(/^[0-9a-fA-F]{24}$/),
  type: z.literal('Purchase').default('Purchase'),
  items: z.array(transactionItemSchema).min(1),
});

const createTopupTransactionSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  performedBy: z.string().regex(/^[0-9a-fA-F]{24}$/),
  type: z.literal('Topup'),
  totalAmount: z.number().positive(),
  reason: z.string(),
});

const createDeductionTransactionSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  performedBy: z.string().regex(/^[0-9a-fA-F]{24}$/),
  type: z.literal('Deduction'),
  totalAmount: z.number().positive(),
  reason: z.string().min(1),
});

type CreatePurchaseDto = z.infer<typeof createPurchaseTransactionSchema>;
type CreateTopupDto = z.infer<typeof createTopupTransactionSchema>;
type CreateDeductionDto = z.infer<typeof createDeductionTransactionSchema>;

// =============================================
// Helper: Validate Body (accepts already-parsed body)
// =============================================
function validateParsedBody<T extends z.ZodType>(
  body: unknown,
  schema: T
): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.issues.reduce((acc, err) => {
      const path = err.path.join('.');
      acc[path] = err.message;
      return acc;
    }, {} as Record<string, string>);

    throw new ApiError('Validation failed', 400, 'VALIDATION_ERROR', details);
  }
  return result.data;
}

// =============================================
// Helper: Deduct Stock by Transaction ID
// =============================================
async function deductStockByTransactionId(
  stockTransactionId: mongoose.Types.ObjectId,
  quantityToDeduct: number,
  session?: mongoose.ClientSession
): Promise<{
  stockTransactionId: mongoose.Types.ObjectId;
  deductedQuantity: number;
  remainingQuantity: number;
}> {
  const stockTransaction = await StockTransaction.findById(stockTransactionId).session(session ?? null);

  if (!stockTransaction) {
    throw new ApiError(`Stock transaction not found: ${stockTransactionId}`, 404);
  }

  if (stockTransaction.stockType !== 'Buy') {
    throw new ApiError(`Stock transaction ${stockTransactionId} is not a Buy transaction`, 400);
  }

  const availableQuantity = stockTransaction.quantityLeft || 0;
  if (availableQuantity < quantityToDeduct) {
    throw new ApiError(
      `Insufficient stock in transaction ${stockTransactionId}. Required: ${quantityToDeduct}, Available: ${availableQuantity}`,
      400
    );
  }

  // //NOTE - Old (X endAt)
  // const updatedStock = await StockTransaction.findByIdAndUpdate(
  //   stockTransactionId,
  //   { $inc: { quantityLeft: -quantityToDeduct } },
  //   { new: true }
  // );
  stockTransaction.quantityLeft -= quantityToDeduct;
  await stockTransaction.save();

  // return {
  //   stockTransactionId: stockTransaction._id,
  //   deductedQuantity: quantityToDeduct,
  //   remainingQuantity: updatedStock?.quantityLeft || 0,
  // };

  return {
    stockTransactionId: stockTransaction._id,
    deductedQuantity: quantityToDeduct,
    remainingQuantity: stockTransaction.quantityLeft,
  };
}

// =============================================
// Helper: Deduct Stock FIFO (Updated for Product)
// =============================================
async function deductStockFIFO(
  productId: mongoose.Types.ObjectId,
  quantityToDeduct: number,
  session?: mongoose.ClientSession
): Promise<Array<{
  stockTransactionId: mongoose.Types.ObjectId;
  deductedQuantity: number;
  remainingQuantity: number;
}>> {
  const availableStock = await StockTransaction.find({
    productId, // Changed from subProductId
    stockType: 'Buy',
    quantityLeft: { $gt: 0 },
  }).sort({ purchaseDate: 1, createdAt: 1 }).session(session ?? null);

  const totalAvailable = availableStock.reduce(
    (sum, stock) => sum + (stock.quantityLeft || 0),
    0
  );

  if (totalAvailable < quantityToDeduct) {
    throw new ApiError(
      `Insufficient stock. Required: ${quantityToDeduct}, Available: ${totalAvailable}`,
      400
    );
  }

  let remainingToDeduct = quantityToDeduct;
  const deductions = [];

  for (const stock of availableStock) {
    if (remainingToDeduct <= 0) break;

    const availableInThisStock = stock.quantityLeft || 0;
    const deductFromThis = Math.min(availableInThisStock, remainingToDeduct);

    // //NOTE - Old (X endAt)
    // const updated = await StockTransaction.findByIdAndUpdate(
    //   stock._id,
    //   { $inc: { quantityLeft: -deductFromThis } },
    //   { new: true }
    // );
    stock.quantityLeft -= deductFromThis;
    await stock.save();

    // deductions.push({
    //   stockTransactionId: stock._id,
    //   deductedQuantity: deductFromThis,
    //   remainingQuantity: updated?.quantityLeft || 0,
    // });

    deductions.push({
      stockTransactionId: stock._id,
      deductedQuantity: deductFromThis,
      remainingQuantity: stock.quantityLeft,
    });

    remainingToDeduct -= deductFromThis;
  }

  return deductions;
}

// =============================================
// POST - Create Purchase Transaction
// =============================================
//NOTE - Without Session
// const createPurchaseHandler = async (data: CreatePurchaseDto) => {
//   const studentId = new mongoose.Types.ObjectId(data.studentId);

//   const performedBy = data.performedBy
//     ? new mongoose.Types.ObjectId(data.performedBy)
//     : undefined;

//   const student = await Student.findById(studentId);
//   if (!student) {
//     throw new ApiError('Student not found', 404);
//   }

//   if (!student.isActive) {
//     throw new ApiError('Student account is inactive', 400);
//   }

//   const processedItems = await Promise.all(
//     data.items.map(async (item) => {
//       const productId = new mongoose.Types.ObjectId(item.productId);

//       // Verify product exists
//       const product = await Product.findById(productId);
//       if (!product) {
//         throw new ApiError(`Product not found: ${item.productId}`, 404);
//       }

//       if (!product.isActive) {
//         throw new ApiError(`Product is inactive: ${product.name}`, 400);
//       }

//       const totalPrice = item.quantity * item.price;

//       let stockDeduction;
//       let primaryStockTransactionId;

//       if (item.stockTransactionId) {
//         const stockTransactionId = new mongoose.Types.ObjectId(item.stockTransactionId);
//         stockDeduction = await deductStockByTransactionId(stockTransactionId, item.quantity);
//         primaryStockTransactionId = stockTransactionId;
//       } else {
//         const fifoDeductions = await deductStockFIFO(productId, item.quantity);
//         stockDeduction = fifoDeductions;
//         primaryStockTransactionId = fifoDeductions[0]?.stockTransactionId;
//       }

//       return {
//         categoryId: item.categoryId
//           ? new mongoose.Types.ObjectId(item.categoryId)
//           : product.categoryId,
//         productId,
//         stockTransactionId: primaryStockTransactionId,
//         quantity: item.quantity,
//         price: item.price,
//         totalPrice,
//         _deduction: stockDeduction,
//       };
//     })
//   );

//   const totalAmount = processedItems.reduce((sum, item) => sum + item.totalPrice, 0);

//   if (student.balance < totalAmount && !WILD_ROLL_NUMBERS.includes(student.rollNumber)) {
//     throw new ApiError(
//       `Insufficient balance. Required: ₹${totalAmount}, Available: ₹${student.balance}`,
//       400
//     );
//   }

//   const updatedStudent = await Student.findByIdAndUpdate(
//     studentId,
//     { $inc: { balance: -totalAmount } },
//     { new: true, runValidators: true }
//   );

//   const transactionItems = processedItems.map((item) => {
//     const { _deduction, ...rest } = item;
//     return rest;
//   });

//   const transaction = await Transaction.create({
//     studentId,
//     year: student.year,
//     rollNumber: student.rollNumber,
//     items: transactionItems,
//     totalAmount,
//     status: 'Completed',
//     type: 'Purchase',
//     performedBy,
//   });

//   return successResponse(
//     {
//       transaction,
//       student: {
//         id: updatedStudent?._id,
//         name: updatedStudent?.name,
//         rollNumber: updatedStudent?.rollNumber,
//         previousBalance: student.balance,
//         newBalance: updatedStudent?.balance,
//         amountDeducted: totalAmount,
//       },
//       stockDeductions: processedItems.map((item) => ({
//         productId: item.productId,
//         stockTransactionId: item.stockTransactionId,
//         quantity: item.quantity,
//         deductionDetails: item._deduction,
//       })),
//     },
//     201,
//     'Purchase transaction created successfully'
//   );
// };

//NOTE - With Session
const createPurchaseHandler = async (data: CreatePurchaseDto) => {
  const session = await mongoose.startSession();

  try {
    // Everything inside here is atomic — if anything throws,
    // ALL changes (balance + transaction) are rolled back
    const result = await session.withTransaction(async () => {
      const studentId = new mongoose.Types.ObjectId(data.studentId);
      const performedBy = data.performedBy
        ? new mongoose.Types.ObjectId(data.performedBy)
        : undefined;

      const student = await Student.findById(studentId).session(session);
      if (!student) throw new ApiError('Student not found', 404);
      if (!student.isActive) throw new ApiError('Student account is inactive', 400);

      const processedItems = await Promise.all(
        data.items.map(async (item) => {
          const productId = new mongoose.Types.ObjectId(item.productId);

          const product = await Product.findById(productId).session(session);
          if (!product) throw new ApiError(`Product not found: ${item.productId}`, 404);
          if (!product.isActive) throw new ApiError(`Product is inactive: ${product.name}`, 400);

          const totalPrice = item.quantity * item.price;

          let stockDeduction;
          let primaryStockTransactionId;

          if (item.stockTransactionId) {
            const stockTransactionId = new mongoose.Types.ObjectId(item.stockTransactionId);
            // ⚠️ Pass session into your stock helpers too (see note below)
            stockDeduction = await deductStockByTransactionId(stockTransactionId, item.quantity, session);
            primaryStockTransactionId = stockTransactionId;
          } else {
            const fifoDeductions = await deductStockFIFO(productId, item.quantity, session);
            stockDeduction = fifoDeductions;
            primaryStockTransactionId = fifoDeductions[0]?.stockTransactionId;
          }

          return {
            categoryId: item.categoryId
              ? new mongoose.Types.ObjectId(item.categoryId)
              : product.categoryId,
            productId,
            stockTransactionId: primaryStockTransactionId,
            quantity: item.quantity,
            price: item.price,
            totalPrice,
            _deduction: stockDeduction,
          };
        })
      );

      const totalAmount = processedItems.reduce((sum, item) => sum + item.totalPrice, 0);

      if (student.balance < totalAmount && !WILD_ROLL_NUMBERS.includes(student.rollNumber)) {
        throw new ApiError(
          `Insufficient balance. Required: ₹${totalAmount}, Available: ₹${student.balance}`,
          400
        );
      }

      // 1. Deduct balance
      const updatedStudent = await Student.findByIdAndUpdate(
        studentId,
        { $inc: { balance: -totalAmount } },
        { new: true, runValidators: true, session } // 👈 session here
      );

      // 2. Create transaction (same atomic unit as the balance deduction)
      const transactionItems = processedItems.map(({ _deduction, ...rest }) => rest);

      const [transaction] = await Transaction.create(
        [
          {
            studentId,
            id: student.id,
            year: student.year,
            rollNumber: student.rollNumber,
            items: transactionItems,
            totalAmount,
            status: 'Completed',
            type: 'Purchase',
            performedBy,
          },
        ],
        { session } // 👈 session here — note: create() needs array + options when using sessions
      );

      return {
        transaction,
        updatedStudent,
        student,
        totalAmount,
        processedItems,
      };
    });

    const { transaction, updatedStudent, student, totalAmount, processedItems } = result;

    return successResponse(
      {
        transaction,
        student: {
          id: updatedStudent?._id,
          name: updatedStudent?.name,
          rollNumber: updatedStudent?.rollNumber,
          previousBalance: student.balance,
          newBalance: updatedStudent?.balance,
          amountDeducted: totalAmount,
        },
        stockDeductions: processedItems.map((item) => ({
          productId: item.productId,
          stockTransactionId: item.stockTransactionId,
          quantity: item.quantity,
          deductionDetails: item._deduction,
        })),
      },
      201,
      'Purchase transaction created successfully'
    );
  } finally {
    session.endSession(); // Always clean up
  }
};
// =============================================
// POST - Create Topup Transaction
// =============================================
const createTopupHandler = async (data: CreateTopupDto) => {
  const studentId = new mongoose.Types.ObjectId(data.studentId);
  const performedBy = data.performedBy
    ? new mongoose.Types.ObjectId(data.performedBy)
    : undefined;

  const student = await Student.findById(studentId);
  if (!student) {
    throw new ApiError('Student not found', 404);
  }

  const previousBalance = student.balance;

  const updatedStudent = await Student.findByIdAndUpdate(
    studentId,
    { $inc: { balance: data.totalAmount } },
    { new: true, runValidators: true }
  );

  const transaction = await Transaction.create({
    studentId,
    id: student.id,
    year: student.year,
    rollNumber: student.rollNumber,
    items: [],
    totalAmount: data.totalAmount,
    status: 'Completed',
    type: 'Topup',
    performedBy,
    reason: data.reason,
  });

  return successResponse(
    {
      transaction,
      student: {
        id: updatedStudent?._id,
        name: updatedStudent?.name,
        rollNumber: updatedStudent?.rollNumber,
        previousBalance,
        newBalance: updatedStudent?.balance,
        amountAdded: data.totalAmount,
      },
    },
    201,
    'Topup transaction created successfully'
  );
};

// =============================================
// POST - Create Deduction Transaction
// =============================================
const createDeductionHandler = async (data: CreateDeductionDto) => {
  const studentId = new mongoose.Types.ObjectId(data.studentId);
  const performedBy = data.performedBy
    ? new mongoose.Types.ObjectId(data.performedBy)
    : undefined;

  const student = await Student.findById(studentId);
  if (!student) {
    throw new ApiError('Student not found', 404);
  }

  if (student.balance < data.totalAmount) {
    throw new ApiError(
      `Insufficient balance. Required: ₹${data.totalAmount}, Available: ₹${student.balance}`,
      400
    );
  }

  const previousBalance = student.balance;

  const updatedStudent = await Student.findByIdAndUpdate(
    studentId,
    { $inc: { balance: -data.totalAmount } },
    { new: true, runValidators: true }
  );

  const transaction = await Transaction.create({
    studentId,
    id: student.id,
    year: student.year,
    rollNumber: student.rollNumber,
    items: [],
    totalAmount: data.totalAmount,
    status: 'Completed',
    type: 'Deduction',
    performedBy,
    reason: data.reason,
  });

  return successResponse(
    {
      transaction,
      student: {
        id: updatedStudent?._id,
        name: updatedStudent?.name,
        rollNumber: updatedStudent?.rollNumber,
        previousBalance,
        newBalance: updatedStudent?.balance,
        amountDeducted: data.totalAmount,
      },
    },
    201,
    'Deduction transaction created successfully'
  );
};

// =============================================
// Main POST Handler
// =============================================
const createTransactionHandler = async (req: Request) => {
  await connectDB();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError('Invalid JSON in request body', 400, 'INVALID_JSON');
  }

  if (!body || typeof body !== 'object') {
    throw new ApiError('Request body must be an object', 400);
  }

  const bodyObj = body as Record<string, unknown>;
  const type = bodyObj.type || (bodyObj.items ? 'Purchase' : undefined);

  if (type === 'Purchase' || bodyObj.items) {
    const data = validateParsedBody(body, createPurchaseTransactionSchema);
    return createPurchaseHandler(data);
  } else if (type === 'Topup') {
    const data = validateParsedBody(body, createTopupTransactionSchema);
    return createTopupHandler(data);
  } else if (type === 'Deduction') {
    const data = validateParsedBody(body, createDeductionTransactionSchema);
    return createDeductionHandler(data);
  }

  throw new ApiError(
    'Invalid transaction type. Must be Purchase, Topup, or Deduction',
    400,
    'INVALID_TRANSACTION_TYPE'
  );
};

// =============================================
// Export Route
// =============================================
export const POST = withErrorHandler(createTransactionHandler);

// app/api/transactions/route.ts (add this GET handler)
// import { Product } from '@/models';
import { Category } from '@/models';
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/config/db';
import { WILD_ROLL_NUMBERS } from '@/lib/constant';
import { TransactionType } from '@/types';

// =============================================
// Type Definitions
// =============================================
interface TransactionFilter {
  type?: string;
  status?: string;
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
}

// interface SearchFilter {
//   $or?: Array<{
//     _id?: { $regex: string; $options: string };
//     studentId?: { $in: mongoose.Types.ObjectId[] };
//   }>;
// }

type SearchFilter = Record<string, unknown>;


interface DateFilter {
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
}

interface StatusMap {
  completed: string;
  failed: string;
  refunded: string;
  [key: string]: string;
}

interface TransactionItem {
  categoryId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  stockTransactionId?: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  totalPrice: number;
}

interface AggregatedTransaction {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  status: string;
  type: string;
  reason?: string;
  performedBy?: { username: string };
  totalAmount: number;
  student?: {
    name: string;
    id: number;
    rollNumber: number;
  };
  items: TransactionItem[];
}

interface ProcessedItem {
  categoryId?: string;
  productId: string;
  stockTransactionId?: string;
  name: string;
  size?: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

interface FormattedTransaction {
  _id: string;
  student: {
    name: string;
    id: number | null;
    rollNumber: number | null;
  };
  items: ProcessedItem[];
  totalAmount: string;
  status: string;
  reason?: string;
  createdAt: Date;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

// =============================================
// GET - Fetch Transactions with Filters
// =============================================
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;

    // const search = searchParams.get("search") || "";
    // const status = searchParams.get("status") || "all";
    // const dateRange = searchParams.get("dateRange") || "all";
    // const startDate = searchParams.get("startDate");
    // const endDate = searchParams.get("endDate");
    // const page = parseInt(searchParams.get("page") || "1");
    // const limit = parseInt(searchParams.get("limit") || "10");

    // // Build filter query
    // const filter: TransactionFilter = {
    //   type: "Purchase"
    // };

    // // Status filter
    // if (status !== "all") {
    //   const statusMap: StatusMap = {
    //     completed: "Completed",
    //     failed: "Cancelled",
    //     refunded: "Cancelled",
    //   };
    //   filter.status = statusMap[status] || status;
    // }

    // // Date range filter
    // const now = new Date();
    // let dateFilter: DateFilter = {};

    // switch (dateRange) {
    //   case "today": {
    //     const todayStart = new Date(now);
    //     todayStart.setHours(0, 0, 0, 0);
    //     const todayEnd = new Date(now);
    //     todayEnd.setHours(23, 59, 59, 999);
    //     dateFilter = { createdAt: { $gte: todayStart, $lte: todayEnd } };
    //     break;
    //   }

    //   case "week": {
    //     const weekStart = new Date(now);
    //     weekStart.setDate(now.getDate() - now.getDay());
    //     weekStart.setHours(0, 0, 0, 0);
    //     dateFilter = { createdAt: { $gte: weekStart } };
    //     break;
    //   }

    //   case "month": {
    //     const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    //     monthStart.setHours(0, 0, 0, 0);
    //     dateFilter = { createdAt: { $gte: monthStart } };
    //     break;
    //   }

    //   case "custom": {
    //     if (startDate && endDate) {
    //       const start = new Date(startDate);
    //       start.setHours(0, 0, 0, 0);
    //       const end = new Date(endDate);
    //       end.setHours(23, 59, 59, 999);
    //       dateFilter = { createdAt: { $gte: start, $lte: end } };
    //     }
    //     break;
    //   }

    //   default:
    //     break;
    // }

    // if (Object.keys(dateFilter).length > 0) {
    //   Object.assign(filter, dateFilter);
    // }

    // // Search filter
    // let searchFilter: SearchFilter = {};
    // if (search) {
    //   const students = await Student.find({
    //     $or: [
    //       { name: { $regex: search, $options: "i" } },
    //       { rollNumber: { $regex: search, $options: "i" } }
    //     ]
    //   }).select("_id");

    //   const studentIds = students.map(s => s._id as mongoose.Types.ObjectId);

    //   // Build search conditions array
    //   const searchConditions: Array<Record<string, unknown>> = [];

    //   // Add student search if we found matching students
    //   if (studentIds.length > 0) {
    //     searchConditions.push({ studentId: { $in: studentIds } });
    //   }

    //   // Only search by _id if it's a valid ObjectId (24 hex characters)
    //   if (mongoose.Types.ObjectId.isValid(search) && search.length === 24) {
    //     searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
    //   }

    //   // Only apply search filter if we have conditions
    //   if (searchConditions.length > 0) {
    //     searchFilter = { $or: searchConditions };
    //   }
    // }

    // // Combine all filters
    // const finalFilter = {
    //   ...filter,
    //   ...(Object.keys(searchFilter).length > 0 ? searchFilter : {})
    // };

    // // Calculate pagination
    // const skip = (page - 1) * limit;
    // const totalCount = await Transaction.countDocuments(finalFilter);
    // const totalPages = Math.ceil(totalCount / limit);

    // // Fetch transactions with populated data
    // const transactions = await Transaction.aggregate<AggregatedTransaction>([
    //   { $match: finalFilter },
    //   { $sort: { createdAt: -1 } },
    //   { $skip: skip },
    //   { $limit: limit },

    //   // Lookup student data
    //   {
    //     $lookup: {
    //       from: "students",
    //       localField: "studentId",
    //       foreignField: "_id",
    //       as: "student"
    //     }
    //   },
    //   { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },

    //   // Process items array
    //   {
    //     $addFields: {
    //       itemsWithDetails: {
    //         $map: {
    //           input: { $ifNull: ["$items", []] },
    //           as: "item",
    //           in: {
    //             categoryId: "$$item.categoryId",
    //             productId: "$$item.productId",
    //             stockTransactionId: "$$item.stockTransactionId",
    //             quantity: "$$item.quantity",
    //             price: "$$item.price",
    //             totalPrice: "$$item.totalPrice"
    //           }
    //         }
    //       }
    //     }
    //   }
    // ]);

    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const startDate = searchParams.get("startDate"); // Already UTC ISO string from client
    const endDate = searchParams.get("endDate");     // Already UTC ISO string from client
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    // const filter: TransactionFilter = { type: "Purchase" };

    const filter: TransactionFilter = {};

    const typeParam = searchParams.get("type"); // or however you read query params

    if (typeParam) {
      filter.type = typeParam as TransactionType;
    }

    // Status filter
    if (status !== "all") {
      const statusMap: StatusMap = {
        completed: "Completed",
        failed: "Cancelled",
        refunded: "Cancelled",
      };
      filter.status = statusMap[status] || status;
    }

    // ✅ Date filter — dead simple, no timezone logic needed
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate), // Client already sent correct UTC
        $lte: new Date(endDate),
      };
    }

    // // Search filter
    // let searchFilter: SearchFilter = {};
    // if (search) {
    //   const students = await Student.find({
    //     $or: [
    //       { name: { $regex: search, $options: "i" } },
    //       { rollNumber: { $regex: search, $options: "i" } },
    //     ],
    //   }).select("_id");

    //   const studentIds = students.map((s) => s._id as mongoose.Types.ObjectId);
    //   const searchConditions: Array<Record<string, unknown>> = [];

    //   if (studentIds.length > 0) {
    //     searchConditions.push({ studentId: { $in: studentIds } });
    //   }

    //   if (mongoose.Types.ObjectId.isValid(search) && search.length === 24) {
    //     searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
    //   }

    //   if (searchConditions.length > 0) {
    //     searchFilter = { $or: searchConditions };
    //   }
    // }

    // const finalFilter = {
    //   ...filter,
    //   ...(Object.keys(searchFilter).length > 0 ? searchFilter : {}),
    // };

    // Search filter
    // let searchFilter: SearchFilter = {};
    let searchFilter: Record<string, unknown> = {};
    if (search) {
      const trimmedSearch = search.trim(); // ✅ trim whitespace
      const rollNumberAsInt = parseInt(trimmedSearch); // ✅ parse for Int comparison
      const isValidRollNumber = !isNaN(rollNumberAsInt);

      const students = await Student.find({
        $or: [
          { name: { $regex: trimmedSearch, $options: "i" } },           // ✅ partial match for name
          ...(isValidRollNumber ? [{ rollNumber: rollNumberAsInt }] : []) // ✅ case-insensitive exact
        ],
      }).select("_id");

      const studentIds = students.map((s) => s._id as mongoose.Types.ObjectId);
      const searchConditions: Array<Record<string, unknown>> = [];

      if (studentIds.length > 0) {
        searchConditions.push({ studentId: { $in: studentIds } });
      }

      if (mongoose.Types.ObjectId.isValid(trimmedSearch) && trimmedSearch.length === 24) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(trimmedSearch) });
      }

      // ✅ If search was provided but nothing matched, return empty — not all transactions
      if (searchConditions.length === 0) {
        searchFilter = { _id: new mongoose.Types.ObjectId("000000000000000000000000") }; // guaranteed no match
      } else {
        searchFilter = { $or: searchConditions };
      }
    }

    // ✅ Properly merge $or filters without conflict
    const finalFilter: Record<string, unknown> = { ...filter };

    if (Object.keys(searchFilter).length > 0) {
      // If filter already has $or (unlikely here but safe), combine with $and
      if (finalFilter.$or) {
        finalFilter.$and = [
          { $or: finalFilter.$or as unknown[] },
          searchFilter,
        ];
        delete finalFilter.$or;
      } else {
        Object.assign(finalFilter, searchFilter);
      }
    }

    const skip = (page - 1) * limit;
    const totalCount = await Transaction.countDocuments(finalFilter);
    const totalPages = Math.ceil(totalCount / limit);

    const transactions = await Transaction.aggregate<AggregatedTransaction>([
      { $match: finalFilter },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users", // your users collection name
          localField: "performedBy",
          foreignField: "_id",
          as: "performedBy",
        },
      },
      { $unwind: { path: "$performedBy", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          itemsWithDetails: {
            $map: {
              input: { $ifNull: ["$items", []] },
              as: "item",
              in: {
                categoryId: "$$item.categoryId",
                productId: "$$item.productId",
                stockTransactionId: "$$item.stockTransactionId",
                quantity: "$$item.quantity",
                price: "$$item.price",
                totalPrice: "$$item.totalPrice",
              },
            },
          },
        },
      },
    ]);

    // Fetch detailed information for items
    // const transactionsWithItemDetails: FormattedTransaction[] = await Promise.all(
    //   transactions.map(async (transaction) => {
    //     // //NOTE - Enough to handle Full Revert
    //     // const itemsWithNames: ProcessedItem[] = await Promise.all(
    //     //   (transaction.items || []).map(async (item): Promise<ProcessedItem> => {
    //     //     let name = "Unknown Item";
    //     //     let size: string | undefined;

    //     //     // Get name from Product (which is now the base item)
    //     //     if (item.productId) {
    //     //       const product = await Product.findById(item.productId).select("name size");
    //     //       if (product) {
    //     //         name = product.name;
    //     //         size = product.size;
    //     //       }
    //     //     } else if (item.categoryId) {
    //     //       // Fallback to Category
    //     //       const category = await Category.findById(item.categoryId).select("name");
    //     //       if (category) {
    //     //         name = category.name;
    //     //       }
    //     //     }

    //     //     return {
    //     //       name,
    //     //       size,
    //     //       quantity: item.quantity,
    //     //       price: item.price.toString(),
    //     //       totalPrice: item.totalPrice.toString()
    //     //     };
    //     //   })
    //     // );

    //     // //NOTE - to handle Partial and Full both Revert
    //     const itemsWithNames: ProcessedItem[] = await Promise.all(
    //       (transaction.items || []).map(async (item): Promise<ProcessedItem> => {
    //         let name = "Unknown Item";
    //         let size: string | undefined;

    //         // Get name from Product (which is now the base item)
    //         if (item.productId) {
    //           const product = await Product.findById(item.productId).select("name size");
    //           if (product) {
    //             name = product.name;
    //             size = product.size;
    //           }
    //         } else if (item.categoryId) {
    //           // Fallback to Category
    //           const category = await Category.findById(item.categoryId).select("name");
    //           if (category) {
    //             name = category.name;
    //           }
    //         }

    //         return {
    //           categoryId: item.categoryId?.toString(),
    //           productId: item.productId?.toString(),
    //           stockTransactionId: item.stockTransactionId?.toString(),
    //           name,
    //           size,
    //           quantity: item.quantity,
    //           price: item.price,
    //           totalPrice: item.totalPrice
    //         };
    //       })
    //     );

    //     return {
    //       _id: transaction._id.toString(),
    //       student: {
    //         name: transaction.student?.name || "Unknown",
    //         id: transaction.student?.id.toString(),
    //         rollNumber: transaction.student?.rollNumber || "N/A"
    //       },
    //       items: JSON.stringify(itemsWithNames),
    //       totalAmount: transaction.totalAmount.toString(),
    //       status: transaction.status,
    //       type: transaction.type,
    //       performedBy: transaction.performedBy?.username ?? null,
    //       reason: transaction?.reason,
    //       createdAt: transaction.createdAt
    //     };
    //   })
    // );

    // ✅ Step 1: Collect all IDs BEFORE the map — add this block here
    const productIds = transactions
      .flatMap(t => (t.items || []).map(i => i.productId).filter(Boolean));
    const categoryIds = transactions
      .flatMap(t => (t.items || []).map(i => i.categoryId).filter(Boolean));

    const [products, categories] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).select("name size"),
      Category.find({ _id: { $in: categoryIds } }).select("name"),
    ]);

    const productMap = Object.fromEntries(products.map(p => [p._id.toString(), p]));
    const categoryMap = Object.fromEntries(categories.map(c => [c._id.toString(), c]));

    // ✅ Step 2: Replace the existing Promise.all map below
    const transactionsWithItemDetails: FormattedTransaction[] = await Promise.all(
      transactions.map(async (transaction) => {
        const itemsWithNames: ProcessedItem[] = (transaction.items || []).map((item): ProcessedItem => {
          let name = "Unknown Item";
          let size: string | undefined;

          // ✅ No DB calls — just map lookups now
          if (item.productId) {
            const product = productMap[item.productId.toString()];
            if (product) {
              name = product.name;
              size = product.size;
            }
          } else if (item.categoryId) {
            const category = categoryMap[item.categoryId.toString()];
            if (category) name = category.name;
          }

          return {
            categoryId: item.categoryId?.toString(),
            productId: item.productId?.toString(),
            stockTransactionId: item.stockTransactionId?.toString(),
            name,
            size,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice,
          };
        });

        return {
          _id: transaction._id.toString(),
          student: {
            name: transaction.student?.name || "Unknown",
            id: transaction.student?.id ?? null,           // ✅ keep as number | null, not toString()
            rollNumber: transaction.student?.rollNumber ?? null  // ✅ keep as number | null
          },
          items: itemsWithNames,
          totalAmount: transaction.totalAmount.toString(),
          status: transaction.status,
          type: transaction.type,
          performedBy: transaction.performedBy?.username ?? null,
          reason: transaction?.reason,
          createdAt: transaction.createdAt
        };
      })
    );
    // Calculate pagination info
    const startIndex = totalCount === 0 ? 0 : skip + 1;
    const endIndex = Math.min(skip + limit, totalCount);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    const paginationInfo: PaginationInfo = {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNextPage,
      hasPreviousPage,
      startIndex,
      endIndex
    };

    return NextResponse.json({
      data: transactionsWithItemDetails,
      pagination: paginationInfo
    });

  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}