import mongoose, { Model, Schema, Types } from "mongoose"

// TODO: only Buy
export interface IStockTransaction extends Document {
  subProductId: Types.ObjectId
  transactionType: "Buy" | "Sell" | "Adjustment"
  buyingPrice: number
  sellingPrice: number
  initialQuantity: number
  quantityLeft?: number
  reason?: string
  description?: string
  date: Date
  createdBy: Types.ObjectId
}

const StockTransactionSchema = new Schema<IStockTransaction>({
  subProductId: {
    type: Schema.Types.ObjectId,
    ref: "SubProduct",
    required: true,
    index: true, // For better query performance
  },
  transactionType: {
    type: String,
    required: true,
    enum: ["Buy", "Sell", "Adjustment"],
    index: true,
  },
  buyingPrice: {
    type: Number,
    required: function(this: IStockTransaction) {
      return this.transactionType === "Buy"
    },
    min: [0, "Buying price cannot be negative"],
    validate: {
      validator: function(value: number) {
        return value >= 0
      },
      message: "Buying price must be a positive number"
    }
  },
  sellingPrice: {
    type: Number,
    required: function(this: IStockTransaction) {
      return this.transactionType === "Sell"
    },
    min: [0, "Selling price cannot be negative"],
    validate: {
      validator: function(value: number) {
        return value >= 0
      },
      message: "Selling price must be a positive number"
    }
  },
  initialQuantity: {
    type: Number,
    required: true,
    min: [1, "Quantity must be at least 1"],
    validate: {
      validator: function(value: number) {
        return Number.isInteger(value) && value > 0
      },
      message: "Quantity must be a positive integer"
    }
  },
  quantityLeft: {
    type: Number,
    // required: true,
    // min: [0, "Quantity left cannot be negative"],
    // validate: {
    //   validator: function(value: number) {
    //     return Number.isInteger(value) && value >= 0
    //   },
    //   message: "Quantity left must be a non-negative integer"
    // }
    default: function(this: IStockTransaction) {
      return this.initialQuantity
    }
  },
  reason: {
    type: String,
    // required: true,
    trim: true,
    maxlength: [100, "Reason cannot exceed 100 characters"],
    enum: {
      values: [
        "purchase",
        "sale", 
        "return",
        "damage",
        "expired",
        "adjustment",
        ""
      ],
      message: "Invalid reason provided"
    }
  },
  description: {
    type: String,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true, // For date-based queries
    validate: {
      validator: function(value: Date) {
        return value <= new Date()
      },
      message: "Transaction date cannot be in the future"
    }
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: false,
    index: true
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  // versionKey: false, // Removes __v field
})

// Compound indexes for better query performance
StockTransactionSchema.index({ subProductId: 1, date: -1 })
StockTransactionSchema.index({ transactionType: 1, date: -1 })
StockTransactionSchema.index({ createdBy: 1, date: -1 })

// Pre-save middleware for business logic validation
StockTransactionSchema.pre('save', function(next) {
  // Ensure quantityLeft doesn't exceed quantity for buy transactions
  // if (this.transactionType === 'Buy') {
  //   return next(new Error('Quantity left cannot exceed original quantity'))
  // }
  
  // For sell transactions, quantityLeft should be 0
  if (this.transactionType === 'Sell') {
    this.quantityLeft = 0
  }
  
  next()
})

// Instance methods
StockTransactionSchema.methods.toJSON = function() {
  const transaction = this.toObject()
  // Remove sensitive information if needed
  return transaction
}

// // Static methods
// StockTransactionSchema.statics.getTransactionsByProduct = function(subProductId: string) {
//   return this.find({ subProductId }).sort({ date: -1 }).populate('createdBy', 'username')
// }

// // StockTransactionSchema.statics.getStockSummary = function(subProductId: string) {
// //   return this.aggregate([
// //     { $match: { subProductId: new Types.ObjectId(subProductId) } },
// //     {
// //       $group: {
// //         _id: '$subProductId',
// //         totalBought: {
// //           $sum: {
// //             $cond: [{ $eq: ['$transactionType', 'buy'] }, '$quantity', 0]
// //           }
// //         },
// //         totalSold: {
// //           $sum: {
// //             $cond: [{ $eq: ['$transactionType', 'sell'] }, '$quantity', 0]
// //           }
// //         },
// //         currentStock: { $sum: '$quantityLeft' },
// //         averageBuyingPrice: {
// //           $avg: {
// //             $cond: [{ $eq: ['$transactionType', 'buy'] }, '$buyingPrice', null]
// //           }
// //         },
// //         averageSellingPrice: {
// //           $avg: {
// //             $cond: [{ $eq: ['$transactionType', 'sell'] }, '$sellingPrice', null]
// //           }
// //         }
// //       }
// //     }
// //   ])
// // }

// // Static method: Get available stock for a single product (FIFO)
// StockTransactionSchema.statics.getAvailableStock = async function(subProductId: string): Promise<AvailableStockItem[]> {
//   const transactions = await this.find({
//     subProductId: new Types.ObjectId(subProductId),
//     transactionType: 'Buy',
//     quantityLeft: { $gt: 0 },
//   })
//     .sort({ date: 1 }) // FIFO - oldest first
//     .select('_id sellingPrice quantityLeft date reason')
//     .lean<IStockTransaction[]>();

//   return transactions.map(t => ({
//     transactionId: t._id,
//     sellingPrice: t.sellingPrice || 0,
//     quantityLeft: t.quantityLeft,
//     date: t.date,
//     reason: t.reason,
//   }));
// };

// // =============================================
// // Stock Query Result Types (EXPORTED)
// // =============================================
// export interface AvailableStockItem {
//   transactionId: Types.ObjectId;
//   buyingPrice: number;
//   quantityLeft: number;
//   date: Date;
//   reason: string;
// }

// export interface BulkStockData {
//   [subProductId: string]: AvailableStockItem[];
// }

// export interface MultipleProductsStockData {
//   [subProductId: string]: AvailableStockItem[];
// }

// export interface StockSummary {
//   _id: Types.ObjectId;
//   totalBought: number;
//   totalSold: number;
//   currentStock: number;
//   averageBuyingPrice: number | null;
//   averageSellingPrice: number | null;
// }

// // =============================================
// // Static Methods Interface
// // =============================================
// interface IStockTransactionModel extends Model<IStockTransaction> {
//   getTransactionsByProduct(subProductId: string): Promise<IStockTransaction[]>;
//   getStockSummary(subProductId: string): Promise<StockSummary[]>;
//   getAvailableStock(subProductId: string): Promise<AvailableStockItem[]>;
//   getBulkAvailableStock(): Promise<BulkStockData>;
//   getMultipleProductsStock(subProductIds: string[]): Promise<MultipleProductsStockData>;
// }

// // Static method: Get bulk available stock for all products (FIFO)
// StockTransactionSchema.statics.getBulkAvailableStock = async function(): Promise<BulkStockData> {
//   // const transactions = await this.find({
//   //   transactionType: 'Buy',
//   //   quantityLeft: { $gt: 0 },
//   // })
//   //   .sort({ subProductId: 1, date: 1 }) // Group by product, then FIFO
//   //   .select('subProductId _id buyingPrice quantityLeft date reason')
//   //   .lean<IStockTransaction[]>();

//   // const bulkStock: BulkStockData = {};
  
//   // transactions.forEach(t => {
//   //   const productId = t.subProductId.toString();
//   //   if (!bulkStock[productId]) {
//   //     bulkStock[productId] = [];
//   //   }
//   //   bulkStock[productId].push({
//   //     transactionId: t._id,
//   //     buyingPrice: t.buyingPrice || 0,
//   //     quantityLeft: t.quantityLeft,
//   //     date: t.date,
//   //     reason: t.reason,
//   //   });
//   // });

//   // return bulkStock;

//   return {"hello":"World"};
// };

// // Static method: Get stock for multiple specific products (FIFO)
// StockTransactionSchema.statics.getMultipleProductsStock = async function(subProductIds: string[]): Promise<MultipleProductsStockData> {
//   const objectIds = subProductIds.map(id => new Types.ObjectId(id));
  
//   const transactions = await this.find({
//     subProductId: { $in: objectIds },
//     transactionType: 'Buy',
//     quantityLeft: { $gt: 0 },
//   })
//     .sort({ subProductId: 1, date: 1 }) // Group by product, then FIFO
//     .select('subProductId _id buyingPrice quantityLeft date reason')
//     .lean<IStockTransaction[]>();

//   const multipleStock: MultipleProductsStockData = {};
  
//   // Initialize all requested products with empty arrays
//   subProductIds.forEach(id => {
//     multipleStock[id] = [];
//   });
  
//   transactions.forEach(t => {
//     const productId = t.subProductId.toString();
//     multipleStock[productId].push({
//       transactionId: t._id,
//       buyingPrice: t.buyingPrice || 0,
//       quantityLeft: t.quantityLeft,
//       date: t.date,
//       reason: t.reason,
//     });
//   });

//   return multipleStock;
// };

export const StockTransaction = mongoose.models.StockTransaction || 
  mongoose.model<IStockTransaction>("StockTransaction", StockTransactionSchema)
