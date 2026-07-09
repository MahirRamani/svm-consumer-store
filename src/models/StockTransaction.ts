// models/StockTransaction.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IStockTransaction extends Document {
  productId: Types.ObjectId;
  categoryId: Types.ObjectId;
  stockType: "Buy" | "Sell" | "Adjustment";
  buyingPrice?: number;
  sellingPrice?: number;
  initialQuantity: number;
  quantityLeft: number;
  reason?: string;
  purchaseDate: Date;
  createdBy: Types.ObjectId;
  endedAt?: Date | null;  // Add null as possible type
  createdAt: Date;
  updatedAt: Date;
}

export interface IStockTransactionDocument extends Omit<Document, '_id'> {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  stockType: "Buy" | "Sell" | "Adjustment";
  buyingPrice?: mongoose.Types.Decimal128;
  sellingPrice?: mongoose.Types.Decimal128;
  initialQuantity: number;
  quantityLeft: number;
  reason?: string;
  notes?: string;
  purchaseDate: Date;
  createdBy: mongoose.Types.ObjectId;
  endedAt?: Date | null;  // Add null as possible type
  createdAt: Date;
  updatedAt: Date;
}

const StockTransactionSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: false,
      index: true,
    },
    stockType: {
      type: String,
      required: true,
      enum: ["Buy", "Sell", "Adjustment"],
      default: "Buy",
      index: true,
    },
    buyingPrice: {
      type: Schema.Types.Decimal128,
      required: function (this: any) {
        return this.stockType === "Buy";
      },
      validate: {
        validator: function (v: mongoose.Types.Decimal128) {
          if (!v) return true;
          return parseFloat(v.toString()) >= 0;
        },
        message: 'Buying price cannot be negative'
      },
      set: function (value: any) {
        if (!value && value !== 0) return value;
        if (value instanceof mongoose.Types.Decimal128) return value;
        return mongoose.Types.Decimal128.fromString(String(value));
      },
      get: function (value: mongoose.Types.Decimal128) {
        return value ? parseFloat(value.toString()) : 0;
      }
    },
    sellingPrice: {
      type: Schema.Types.Decimal128,
      required: function (this: any) {
        return this.stockType === "Sell";
      },
      validate: {
        validator: function (v: mongoose.Types.Decimal128) {
          if (!v) return true;
          return parseFloat(v.toString()) >= 0;
        },
        message: 'Selling price cannot be negative'
      },
      set: function (value: any) {
        if (!value && value !== 0) return value;
        if (value instanceof mongoose.Types.Decimal128) return value;
        return mongoose.Types.Decimal128.fromString(String(value));
      },
      get: function (value: mongoose.Types.Decimal128) {
        return value ? parseFloat(value.toString()) : undefined;
      }
    },
    initialQuantity: {
      type: Number,
      required: [true, "Initial quantity is required"],
      min: [1, "Quantity must be at least 1"],
      validate: {
        validator: function (value: number) {
          return Number.isInteger(value) && value > 0;
        },
        message: "Quantity must be a positive integer",
      },
    },
    quantityLeft: {
      type: Number,
      default: function (this: any) {
        return this.initialQuantity;
      },
      min: [0, "Quantity left cannot be negative"],
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [100, "Reason cannot exceed 100 characters"],
      enum: {
        values: ["purchase", "sale", "return", "damage", "expired", "adjustment", ""],
        message: "Invalid reason provided",
      },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
      validate: {
        validator: function (value: Date) {
          return value <= new Date();
        },
        message: "Purchase date cannot be in the future",
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    endedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "stock_transactions",
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// Compound indexes for better query performance
StockTransactionSchema.index({ productId: 1, purchaseDate: -1 });
StockTransactionSchema.index({ categoryId: 1, purchaseDate: -1 });
StockTransactionSchema.index({ stockType: 1, purchaseDate: -1 });
StockTransactionSchema.index({ createdBy: 1, purchaseDate: -1 });
StockTransactionSchema.index({ productId: 1, quantityLeft: 1 });

// Keep only this middleware
StockTransactionSchema.pre("save", function (next) {
  if (this.stockType === "Sell") {
    this.quantityLeft = 0;
    if (!this.endedAt) {
      this.endedAt = new Date();
    }
  }

  if (this.quantityLeft === 0 && !this.endedAt) {
    this.endedAt = new Date();
  }

  next();
});

export const StockTransaction: Model<IStockTransactionDocument> =
  mongoose.models.StockTransaction ||
  mongoose.model<IStockTransactionDocument>("StockTransaction", StockTransactionSchema);