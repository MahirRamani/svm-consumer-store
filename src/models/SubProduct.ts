// models/SubProduct.ts
import mongoose, { Document, Model, Schema } from "mongoose";
import { Product } from "./Product"; // Import parent model for hooks

export interface ISubProduct extends Document {
  productId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  priority: number;
  imageURL: string;
  size?: string;
  lowStockThreshold: number;
  weight?: string;
  volume?: string;
  barcode?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subProductSchema = new Schema<ISubProduct>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Parent product ID is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Variant name is required"],
      trim: true,
      maxlength: [100, "Variant name cannot exceed 100 characters"],
    },
    description: { type: String, trim: true, maxlength: 500 },
    priority: { type: Number, default: 0, min: [0, "Priority cannot be negative"], },
    imageURL: { type: String, trim: true },
    size: { type: String, trim: true, maxlength: 50 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 10 },
    weight: { type: String, trim: true, maxlength: 50 },
    volume: { type: String, trim: true, maxlength: 50 },
    barcode: { type: String, trim: true, maxlength: 100 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "subproducts" }
);

// **Compound Unique Index:** Ensures a variant name (e.g., "Large") is unique for its parent product.
subProductSchema.index(
  { name: 1, productId: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } } // Case-insensitive
);

// **Unique and Sparse Index:** Ensures barcode is unique across all variants if it exists.
subProductSchema.index({ barcode: 1 }, { unique: true, sparse: true });

// **Middleware for user-friendly duplicate errors.**
subProductSchema.pre("save", async function (next) {
    if (this.isModified("barcode") && this.barcode) {
        const existing = await mongoose.models.SubProduct.findOne({
            barcode: this.barcode,
            _id: { $ne: this._id }
        });
        if (existing) {
            const error = new Error(`Barcode "${this.barcode}" is already in use.`);
            error.name = 'DuplicateError';
            return next(error);
        }
    }
    next();
});

// **Post-Save/Delete Hooks (Triggers):** This is the core business logic.
// It automatically keeps the parent product's `hasVariants` flag in sync.
const updateParentProductVariantsFlag = async function(doc: ISubProduct) {
    try {
        const variantCount = await mongoose.models.SubProduct.countDocuments({ productId: doc.productId });
        await Product.findByIdAndUpdate(doc.productId, { hasVariants: variantCount > 0 });
    } catch (error) {
        // In a real application, you would add more robust logging here.
        console.error("Failed to update parent product hasVariants flag:", error);
    }
};

subProductSchema.post("save", async function() {
    await updateParentProductVariantsFlag(this);
});

// Hook for findByIdAndDelete, remove, etc.
subProductSchema.post("findOneAndDelete", async function(doc) {
    if (doc) await updateParentProductVariantsFlag(doc);
});

// Prevent model recompilation
export const SubProduct: Model<ISubProduct> =
  mongoose.models.SubProduct || mongoose.model<ISubProduct>("SubProduct", subProductSchema);