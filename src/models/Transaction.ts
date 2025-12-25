import mongoose, { Schema, type Document, type Model } from "mongoose";
import { ObjectId } from "mongoose";

// ============================================================================
// INTERFACES
// ============================================================================

export interface ITransactionItem {
  categoryId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  subProductId?: mongoose.Types.ObjectId;
  stockTransactionId?: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  totalPrice: number;
}

export interface ITransaction extends Document {
  studentId: mongoose.Types.ObjectId;
  items?: ITransactionItem[];
  totalAmount: number;
  status: "Pending" | "Completed" | "Cancelled";
  transactionType: "Purchase" | "Topup" | "Deduction";
  reason?: string;
  performedBy: ObjectId;
}

// ============================================================================
// SUB-SCHEMA
// ============================================================================

const TransactionItemSchema = new Schema<ITransactionItem>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
    subProductId: {
      type: Schema.Types.ObjectId,
      ref: "SubProduct",
    },
    stockTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "StockTransaction",
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, "Total price cannot be negative"],
    },
  },
  { _id: false }
);

// ============================================================================
// MAIN SCHEMA
// ============================================================================

const TransactionSchema = new Schema<ITransaction>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    items: {
      type: [TransactionItemSchema],
      required: false,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, "Total amount cannot be negative"],
    },
    status: {
      type: String,
      enum: {
        values: ["Pending", "Completed", "Cancelled"],
        message: "{VALUE} is not a valid status",
      },
      default: "Completed",
      index: true,
    },
    transactionType: {
      type: String,
      enum: {
        values: ["Purchase", "Topup", "Deduction"],
        message: "{VALUE} is not a valid transaction type",
      },
      default: "Purchase",
      index: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
    collection: "transactions",
  }
);

// ============================================================================
// INDEXES
// ============================================================================

// Compound indexes for common queries
TransactionSchema.index({ studentId: 1, createdAt: -1 });
TransactionSchema.index({ userId: 1, createdAt: -1 }); // Fixed: was "sellerId"
TransactionSchema.index({ status: 1, transactionType: 1 });
TransactionSchema.index({ createdAt: -1 });

// ============================================================================
// MIDDLEWARE - Data Validation
// ============================================================================

// Validate totalAmount matches sum of items for Purchase transactions
// Validate totalAmount matches sum of items for Purchase transactions
TransactionSchema.pre("save", function (next) {
  if (this.transactionType === "Purchase" && this.items && this.items.length > 0) {
    // First validate each item's totalPrice
    for (const item of this.items) {
      const expectedTotal = item.quantity * item.price;
      if (Math.abs(item.totalPrice - expectedTotal) > 0.01) {
        return next(
          new Error(
            `Item totalPrice mismatch: expected ${expectedTotal}, got ${item.totalPrice}`
          )
        );
      }
    }

    // Then validate the total amount
    const calculatedTotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    
    if (Math.abs(this.totalAmount - calculatedTotal) > 0.01) {
      return next(
        new Error(
          `Total amount mismatch: expected ${calculatedTotal}, got ${this.totalAmount}`
        )
      );
    }
  }
  next();
});

// Validate items are required for Purchase transactions
TransactionSchema.pre("save", function (next) {
  if (this.transactionType === "Purchase") {
    if (!this.items || this.items.length === 0) {
      return next(new Error("Items are required for Purchase transactions"));
    }
  }
  next();
});

// Validate reason is required for Deduction transactions
TransactionSchema.pre("save", function (next) {
  if (this.transactionType === "Deduction") {
    if (!this.reason || this.reason.trim().length === 0) {
      return next(new Error("Reason is required for Deduction transactions"));
    }
  }
  next();
});

// ============================================================================
// STATIC METHODS
// ============================================================================

TransactionSchema.statics.getStudentBalance = async function (
  studentId: mongoose.Types.ObjectId
): Promise<number> {
  const result = await this.aggregate([
    {
      $match: {
        studentId: new mongoose.Types.ObjectId(studentId),
        status: "Completed",
      },
    },
    {
      $group: {
        _id: "$transactionType",
        total: { $sum: "$totalAmount" },
      },
    },
  ]);

  let balance = 0;
  result.forEach((item) => {
    if (item._id === "Topup") balance += item.total;
    if (item._id === "Purchase" || item._id === "Deduction") balance -= item.total;
  });

  return Math.max(0, balance);
};

TransactionSchema.statics.getStudentTransactionHistory = async function (
  studentId: mongoose.Types.ObjectId,
  limit: number = 50
) {
  return await this.find({ studentId, status: "Completed" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("items.subProductId", "name size")
    .populate("items.productId", "name")
    .lean();
};

// ============================================================================
// MODEL EXPORT
// ============================================================================

interface ITransactionModel extends Model<ITransaction> {
  getStudentBalance(studentId: mongoose.Types.ObjectId): Promise<number>;
  getStudentTransactionHistory(
    studentId: mongoose.Types.ObjectId,
    limit?: number
  ): Promise<any[]>;
}

export const Transaction: ITransactionModel =
  (mongoose.models.Transaction as ITransactionModel) ||
  mongoose.model<ITransaction, ITransactionModel>("Transaction", TransactionSchema);

// import mongoose, { Schema, type Document } from "mongoose"

// export interface ITransactionItem {
//   categoryId?: mongoose.Types.ObjectId
//   productId?: mongoose.Types.ObjectId
//   subProductId?: mongoose.Types.ObjectId
//   quantity: number
//   price: number
//   totalPrice: number
// }

// export interface ITransaction extends Document {
//   studentId: mongoose.Types.ObjectId
//   userId: mongoose.Types.ObjectId
//   items?: ITransactionItem[]
//   totalAmount: number
//   status: "Pending" | "Completed" | "Cancelled"
//   transactionType: "Purchase" | "Topup" | "Deduction"
//   reason?: string
//   performedBy: "Seller" | "Admin" | "Accountant"
//   createdAt: Date
//   updatedAt: Date
// }

// const TransactionItemSchema = new Schema<ITransactionItem>({
//   categoryId: {
//     type: Schema.Types.ObjectId,
//     ref: "Category",
//   },
//   productId: {
//     type: Schema.Types.ObjectId,
//     ref: "Product",
//   },
//   subProductId: {
//     type: Schema.Types.ObjectId,
//     ref: "SubProduct",
//   },
//   quantity: {
//     type: Number,
//     required: true,
//     min: 1,
//   },
//   price: {
//     type: Number,
//     required: true,
//     min: 0,
//   },
//   totalPrice: {
//     type: Number,
//     required: true,
//     min: 0,
//   },
// })

// const TransactionSchema = new Schema<ITransaction>(
//   {
//     studentId: {
//       type: Schema.Types.ObjectId,
//       ref: "Student",
//       required: true,
//     },
//     userId: {
//       type: Schema.Types.ObjectId,
//       ref: "User",
//     },
//     items: {
//       type: [TransactionItemSchema],
//       required: false,
//     },
//     totalAmount: {
//       type: Number,
//       required: true,
//       min: 0,
//     },
//     status: {
//       type: String,
//       enum: ["Pending", "Completed", "Cancelled"],
//       default: "Completed",
//     },
//     transactionType: {
//       type: String,
//       enum: ["Purchase", "Topup", "Deduction"],
//       default: "Purchase",
//     },
//     reason: {
//       type: String,
//       trim: true,
//     },
//     performedBy: {
//       type: String,
//       enum: ["Seller", "Admin", "accountant"],
//       default: "Seller",
//     },
//   },
//   {
//     timestamps: true,
//   },
// )

// // Create indexes
// TransactionSchema.index({ studentId: 1 })
// TransactionSchema.index({ sellerId: 1 })
// TransactionSchema.index({ status: 1 })
// TransactionSchema.index({ transactionType: 1 })
// TransactionSchema.index({ createdAt: -1 })

// export const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>("Transaction", TransactionSchema)