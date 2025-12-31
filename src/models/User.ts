// models/User.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ALL_TAB_IDS, type TabId } from '@/lib/config/tabs-registry';
import { ALL_ROLE_IDS, type AppRole } from '@/lib/config/rolesConfig';

export interface IUser extends Document {
  username: string;
  password: string;
  role: AppRole;
  allowedTabs: TabId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  hasTabAccess(tabId: TabId): boolean;
}

interface IUserModel extends Model<IUser> {
  findActive(): Promise<IUser[]>;
  findByRole(role: AppRole): Promise<IUser[]>;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [50, 'Username cannot exceed 50 characters'],
      match: [/^[A-Za-z0-9._-]+$/, 'Username can only contain letters, numbers, dots, hyphens, and underscores'],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false,
    },
    role: {
      type: String,
      enum: ALL_ROLE_IDS,
      required: [true, 'Role is required'],
      index: true,
    },
    allowedTabs: {
      type: [String],
      enum: ALL_TAB_IDS,
      validate: {
        validator: function (tabs: string[]) {
          return tabs.length > 0;
        },
        message: 'User must have at least one allowed tab',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Indexes
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ role: 1, isActive: 1 });

// Pre-save validation
UserSchema.pre('save', function (next) {
  if (!this.allowedTabs || this.allowedTabs.length === 0) {
    this.allowedTabs = ['overview'] as TabId[];
  }
  this.allowedTabs = [...new Set(this.allowedTabs)];
  next();
});

// Pre-update validation
UserSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as Partial<IUser>;

  if (update.allowedTabs) {
    if (update.allowedTabs.length === 0) {
      update.allowedTabs = ['overview'] as TabId[];
    }
    update.allowedTabs = [...new Set(update.allowedTabs)];
  }

  next();
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check tab access
UserSchema.methods.hasTabAccess = function (tabId: TabId): boolean {
  return this.allowedTabs.includes(tabId);
};

// Static method to find active users
UserSchema.statics.findActive = function () {
  return this.find({ isActive: true });
};

// Static method to find users by role
UserSchema.statics.findByRole = function (role: AppRole) {
  return this.find({ role, isActive: true });
};

export const User: IUserModel =
    (mongoose.models.User as IUserModel) || mongoose.model<IUser, IUserModel>('User', UserSchema);