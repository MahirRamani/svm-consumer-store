import mongoose, { Model, Schema, Types } from "mongoose"

// TODO: only Buy
export interface IStockTransaction extends Document {
  subProductId: Types.ObjectId
  productId: Types.ObjectId
  categoryId: Types.ObjectId
  transactionType: "Buy" | "Sell" | "Adjustment"
  buyingPrice: number
  sellingPrice: number
  initialQuantity: number
  quantityLeft?: number
  reason?: string
  description?: string
  date: Date
  createdBy: Types.ObjectId
  endedAt?: Date
}

const StockTransactionSchema = new Schema<IStockTransaction>({
  subProductId: {
    type: Schema.Types.ObjectId,
    ref: "SubProduct",
    required: true,
    index: true, // For better query performance
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: false,
    index: true, // For better query performance
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: false,
    index: true, // For better query performance
  },
  transactionType: {
    type: String,
    required: true,
    enum: ["Buy"],
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
  },
  endedAt: {
    type: Date,
    default: null,
    index: true, // For date-based queries
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

export const StockTransaction = mongoose.models.StockTransaction || 
  mongoose.model<IStockTransaction>("StockTransaction", StockTransactionSchema)
