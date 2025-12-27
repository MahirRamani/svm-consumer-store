// models/Product.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IProduct extends Document {
  name: string;
  description?: string;
  categoryId: mongoose.Types.ObjectId;
  priority: number;
  isActive: boolean;
  hasVariants: boolean; // This can be a virtual or managed by triggers
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [150, "Product name cannot exceed 150 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true, // Index for efficient lookups by category
    },
    priority: {
      type: Number,
      default: 0,
      min: [0, "Priority cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Index for filtering by active status
    },
    hasVariants: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "products",
  }
);

// **Compound Unique Index:** Ensures product names are unique within a specific category.
// Case-insensitive using collation for a better user experience.
productSchema.index(
  { name: 1, categoryId: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    background: true,
  }
);

// **Compound Query Index:** Optimizes common queries that filter by status and category, then sort.
productSchema.index({ categoryId: 1, isActive: 1, priority: -1 });


// **Pre-save Middleware for Unique Check:** Provides a user-friendly error message.
productSchema.pre("save", async function (next) {
  if (this.isModified("name") || this.isModified("categoryId")) {
    const existingProduct = await mongoose.models.Product.findOne({
      name: { $regex: new RegExp(`^${this.name}$`, "i") },
      categoryId: this.categoryId,
      _id: { $ne: this._id },
    });

    if (existingProduct) {
      const error = new Error(`Product name "${this.name}" already exists in this category.`);
      error.name = 'DuplicateError'; // Custom error name for the error handler to catch
      return next(error);
    }
  }
  next();
});


// **Static method to find active products by category**
productSchema.statics.findActiveByCategory = function (categoryId: string) {
  return this.find({ categoryId, isActive: true }).sort({ priority: -1, name: 1 });
};

// **Prevent model recompilation**
export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", productSchema);