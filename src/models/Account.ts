// models/Account.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IAccount extends Document {
  ownerId: Types.ObjectId;
  name: string;
  description?: string;
  currentBalance: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IAccountModel extends Model<IAccount> {
  findByOwner(ownerId: Types.ObjectId): Promise<IAccount[]>;
  findActive(): Promise<IAccount[]>;
}

const accountSchema = new Schema<IAccount, IAccountModel>(
  {
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      maxlength: [100, 'Account name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
      index: true,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'accounts',
  }
);

// Compound indexes
accountSchema.index({ ownerId: 1, isDeleted: 1, isActive: 1 });
accountSchema.index({ ownerId: 1, name: 1 }, { unique: true });

// Prevent duplicate account names per owner
accountSchema.pre('save', async function (next) {
  if (this.isModified('name')) {
    const existing = await mongoose.models.Account.findOne({
      ownerId: this.ownerId,
      name: { $regex: new RegExp(`^${this.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      _id: { $ne: this._id },
      isDeleted: false,
    });

    if (existing) {
      const error = new Error(`Account "${this.name}" already exists`);
      error.name = 'DuplicateError';
      throw error;
    }
  }
  next();
});

// Static methods
accountSchema.statics.findByOwner = function (ownerId: Types.ObjectId) {
  return this.find({ ownerId, isDeleted: false, isActive: true })
    .sort({ name: 1 });
};

accountSchema.statics.findActive = function () {
  return this.find({ isDeleted: false, isActive: true })
    .populate('ownerId', 'name email')
    .sort({ name: 1 });
};

export const Account: IAccountModel =
  (mongoose.models.Account as IAccountModel) ||
  mongoose.model<IAccount, IAccountModel>('Account', accountSchema);