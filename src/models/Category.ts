// models/Category.ts
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  description?: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    priority: {
      type: Number,
      default: 0,
      min: [0, 'Priority cannot be negative'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'categories',
  }
);

// Unique case-insensitive index
categorySchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: 'en', strength: 2 },
    background: true,
  }
);

// Compound index for common queries
categorySchema.index({ isActive: 1, priority: -1, name: 1 });

// Pre-save duplicate check
categorySchema.pre('save', async function (next) {
  if (this.isModified('name')) {
    const existingCategory = await mongoose.models.Category.findOne({
      name: { $regex: new RegExp(`^${this.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      _id: { $ne: this._id },
    });

    if (existingCategory) {
      const error = new Error(`Category name "${this.name}" already exists`);
      error.name = 'DuplicateError';
      throw error;
    }
  }
  next();
});

// Pre-update duplicate check
categorySchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() as any;

  if (update.name || update.$set?.name) {
    const newName = update.name || update.$set?.name;
    const docId = this.getQuery()._id;

    const existingCategory = await mongoose.models.Category.findOne({
      name: { $regex: new RegExp(`^${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      _id: { $ne: docId },
    });

    if (existingCategory) {
      const error = new Error(`Category name "${newName}" already exists`);
      error.name = 'DuplicateError';
      throw error;
    }
  }
  next();
});

// Static methods
categorySchema.statics.findActive = function () {
  return this.find({ isActive: true }).sort({ priority: -1, name: 1 });
};

categorySchema.statics.findByName = function (name: string) {
  return this.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  });
};

export const Category: Model<ICategory> =
  mongoose.models.Category || mongoose.model<ICategory>('Category', categorySchema);