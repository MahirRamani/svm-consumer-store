// models/Product.ts
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IProduct extends Document {
  name: string;
  description?: string;
  categoryId: mongoose.Types.ObjectId;
  priority: number;
  isActive: boolean;
  imageURL?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  lowStockThreshold: number;
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
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      min: [0, "Priority cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Merged from SubProduct
    imageURL: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      trim: true,
      maxlength: [50, "Size cannot exceed 50 characters"],
    },
    weight: {
      type: String,
      trim: true,
      maxlength: [50, "Weight cannot exceed 50 characters"],
    },
    volume: {
      type: String,
      trim: true,
      maxlength: [50, "Volume cannot exceed 50 characters"],
    },
    barcode: {
      type: String,
      trim: true,
      maxlength: [100, "Barcode cannot exceed 100 characters"],
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, "Low stock threshold cannot be negative"],
    },
  },
  {
    timestamps: true,
    collection: "products",
  }
);

// Compound Unique Index: Product names unique within category (case-insensitive)
productSchema.index(
  { name: 1, categoryId: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    background: true,
  }
);

// Unique and Sparse Index: Barcode unique across all products if exists
productSchema.index(
  { barcode: 1 },
  { unique: true, sparse: true }
);

// Compound Query Index: Optimizes category + status + priority queries
productSchema.index({ categoryId: 1, isActive: 1, priority: -1 });

// Pre-save middleware for user-friendly duplicate errors
productSchema.pre("save", async function (next) {
  // Check name uniqueness in category
  if (this.isModified("name") || this.isModified("categoryId")) {
    const existingProduct = await mongoose.models.Product.findOne({
      name: { $regex: new RegExp(`^${this.name}$`, "i") },
      categoryId: this.categoryId,
      _id: { $ne: this._id },
    });

    if (existingProduct) {
      const error = new Error(
        `Product name "${this.name}" already exists in this category.`
      );
      error.name = "DuplicateError";
      return next(error);
    }
  }

  // Check barcode uniqueness
  if (this.isModified("barcode") && this.barcode) {
    const existingBarcode = await mongoose.models.Product.findOne({
      barcode: this.barcode,
      _id: { $ne: this._id },
    });

    if (existingBarcode) {
      const error = new Error(`Barcode "${this.barcode}" is already in use.`);
      error.name = "DuplicateError";
      return next(error);
    }
  }

  next();
});

// Static method to find active products by category
productSchema.statics.findActiveByCategory = function (categoryId: string) {
  return this.find({ categoryId, isActive: true }).sort({ priority: -1, name: 1 });
};

// Static method to find low stock products
productSchema.statics.findLowStock = function () {
  return this.find({ isActive: true })
    .where("lowStockThreshold")
    .gt(0)
    .populate("categoryId", "name")
    .sort({ name: 1 });
};

// Prevent model recompilation
export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", productSchema);






// // models/Product.ts
// import mongoose, { Document, Model, Schema } from "mongoose";

// export interface IProduct extends Document {
//   name: string;
//   description?: string;
//   categoryId: mongoose.Types.ObjectId;
//   priority: number;
//   isActive: boolean;
//   hasVariants: boolean; // This can be a virtual or managed by triggers
//   createdAt: Date;
//   updatedAt: Date;
// }

// const productSchema = new Schema<IProduct>(
//   {
//     name: {
//       type: String,
//       required: [true, "Product name is required"],
//       trim: true,
//       maxlength: [150, "Product name cannot exceed 150 characters"],
//     },
//     description: {
//       type: String,
//       trim: true,
//       maxlength: [1000, "Description cannot exceed 1000 characters"],
//       default: "",
//     },
//     categoryId: {
//       type: Schema.Types.ObjectId,
//       ref: "Category",
//       required: [true, "Category is required"],
//       index: true, // Index for efficient lookups by category
//     },
//     priority: {
//       type: Number,
//       default: 0,
//       min: [0, "Priority cannot be negative"],
//     },
//     isActive: {
//       type: Boolean,
//       default: true,
//       index: true, // Index for filtering by active status
//     },
//     hasVariants: {
//       type: Boolean,
//       default: true,
//     },
//   },
//   {
//     timestamps: true,
//     collection: "products",
//   }
// );

// // **Compound Unique Index:** Ensures product names are unique within a specific category.
// // Case-insensitive using collation for a better user experience.
// productSchema.index(
//   { name: 1, categoryId: 1 },
//   {
//     unique: true,
//     collation: { locale: "en", strength: 2 },
//     background: true,
//   }
// );

// // **Compound Query Index:** Optimizes common queries that filter by status and category, then sort.
// productSchema.index({ categoryId: 1, isActive: 1, priority: -1 });


// // **Pre-save Middleware for Unique Check:** Provides a user-friendly error message.
// productSchema.pre("save", async function (next) {
//   if (this.isModified("name") || this.isModified("categoryId")) {
//     const existingProduct = await mongoose.models.Product.findOne({
//       name: { $regex: new RegExp(`^${this.name}$`, "i") },
//       categoryId: this.categoryId,
//       _id: { $ne: this._id },
//     });

//     if (existingProduct) {
//       const error = new Error(`Product name "${this.name}" already exists in this category.`);
//       error.name = 'DuplicateError'; // Custom error name for the error handler to catch
//       return next(error);
//     }
//   }
//   next();
// });


// // **Static method to find active products by category**
// productSchema.statics.findActiveByCategory = function (categoryId: string) {
//   return this.find({ categoryId, isActive: true }).sort({ priority: -1, name: 1 });
// };

// // **Prevent model recompilation**
// export const Product: Model<IProduct> =
//   mongoose.models.Product || mongoose.model<IProduct>("Product", productSchema);