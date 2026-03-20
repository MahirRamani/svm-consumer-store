// models/AccountTransaction.ts
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IAccountTransaction extends Document {
  accountId: Types.ObjectId;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  note: string;
  billUrl?: string | null;
  balanceBefore: number;
  balanceAfter: number;
  performedBy: Types.ObjectId;
  enteredAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IAccountTransactionModel extends Model<IAccountTransaction> {
  findByAccount(accountId: Types.ObjectId): Promise<IAccountTransaction[]>;
  getLatestBalance(accountId: Types.ObjectId): Promise<number>;
  findByDateRange(
    accountId: Types.ObjectId,
    startDate: Date,
    endDate: Date
  ): Promise<IAccountTransaction[]>;
}

const accountTransactionSchema = new Schema<IAccountTransaction, IAccountTransactionModel>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['CREDIT', 'DEBIT'],
        message: 'Type must be either CREDIT or DEBIT',
      },
      required: [true, 'Transaction type is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
      default: '',
    },
    billUrl: {
      type: String,
      trim: true,
      maxlength: [2048, 'Bill URL cannot exceed 2048 characters'],
      default: null,
      validate: {
        validator: function (v: string | null) {
          if (!v) return true;
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid URL format',
      },
    },
    balanceBefore: {
      type: Number,
      required: [true, 'Balance before is required'],
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Balance after is required'],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Performed by user is required'],
      index: true,
    },
    enteredAt: {
      type: Date,
      default: Date.now,
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
    collection: 'account_transactions',
  }
);

// Compound indexes for common queries
accountTransactionSchema.index({ accountId: 1, isDeleted: 1, enteredAt: -1 });
accountTransactionSchema.index({ accountId: 1, type: 1, isDeleted: 1 });
accountTransactionSchema.index({ performedBy: 1, enteredAt: -1 });

// Pre-save: Auto-calculate balanceBefore and balanceAfter
accountTransactionSchema.pre('save', async function (next) {
  if (this.isNew) {
    // Get last transaction for THIS account
    const lastTransaction = await mongoose.models.AccountTransaction.findOne({
      accountId: this.accountId,
      isDeleted: false,
    })
      .sort({ enteredAt: -1, createdAt: -1 })
      .select('balanceAfter');

    const currentBalance = lastTransaction?.balanceAfter ?? 0;

    this.balanceBefore = currentBalance;
    this.balanceAfter =
      this.type === 'CREDIT'
        ? currentBalance + this.amount
        : currentBalance - this.amount;
  }
  next();
});

// Post-save: Update account's currentBalance
accountTransactionSchema.post('save', async function () {
  await mongoose.models.Account.findByIdAndUpdate(this.accountId, {
    currentBalance: this.balanceAfter,
  });
});

// Static methods
accountTransactionSchema.statics.findByAccount = function (accountId: Types.ObjectId) {
  return this.find({ accountId, isDeleted: false })
    .sort({ enteredAt: -1 })
    .populate('performedBy', 'name email');
};

accountTransactionSchema.statics.getLatestBalance = async function (accountId: Types.ObjectId) {
  const lastTransaction = await this.findOne({
    accountId,
    isDeleted: false,
  })
    .sort({ enteredAt: -1, createdAt: -1 })
    .select('balanceAfter');

  return lastTransaction?.balanceAfter ?? 0;
};

accountTransactionSchema.statics.findByDateRange = function (
  accountId: Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  return this.find({
    accountId,
    isDeleted: false,
    enteredAt: { $gte: startDate, $lte: endDate },
  })
    .sort({ enteredAt: -1 })
    .populate('performedBy', 'name email');
};

export const AccountTransaction: IAccountTransactionModel =
  (mongoose.models.AccountTransaction as IAccountTransactionModel) ||
  mongoose.model<IAccountTransaction, IAccountTransactionModel>(
    'AccountTransaction',
    accountTransactionSchema
  );