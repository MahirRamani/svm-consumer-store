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
      default: ['overview'],
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





// // models/User.ts
// import mongoose, { Document, Model, Schema } from 'mongoose';
// import { ALL_TAB_IDS, type TabId } from '@/lib/config/tabs-registry';
// import { ALL_ROLE_IDS, type AppRole } from '@/lib/config/rolesConfig';

// export interface IUser extends Document {
//   username: string;
//   password: string;
//   role: AppRole;
//   allowedTabs: TabId[];
//   isActive: boolean;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const UserSchema = new Schema<IUser>(
//   {
//     username: {
//       type: String,
//       required: [true, 'Username is required'],
//       minlength: [3, 'Username must be at least 3 characters long'],
//       maxlength: [50, 'Username cannot exceed 50 characters'],
//       unique: true,
//       trim: true,
//       lowercase: true,
//     },
//     password: {
//       type: String,
//       required: [true, 'Password is required'],
//       minlength: [6, 'Password must be at least 6 characters long'],
//       select: false,
//     },
//     role: {
//       type: String,
//       enum: ALL_ROLE_IDS,
//       required: [true, 'Role is required'],
//       index: true,
//     },
//     allowedTabs: {
//       type: [String],
//       enum: ALL_TAB_IDS,
//       default: ['overview'],
//       validate: {
//         validator: function (tabs: string[]) {
//           return tabs.length > 0;
//         },
//         message: 'User must have at least one allowed tab',
//       },
//     },
//     isActive: {
//       type: Boolean,
//       default: true,
//       index: true,
//     },
//   },
//   {
//     timestamps: true,
//     collection: 'users',
//   }
// );

// // Indexes
// UserSchema.index({ username: 1 }, { unique: true });
// UserSchema.index({ role: 1, isActive: 1 });

// // Pre-save validation
// UserSchema.pre('save', function (next) {
//   if (!this.allowedTabs || this.allowedTabs.length === 0) {
//     this.allowedTabs = ['overview'] as TabId[];
//   }
//   this.allowedTabs = [...new Set(this.allowedTabs)];
//   next();
// });

// // Pre-update validation
// UserSchema.pre('findOneAndUpdate', function (next) {
//   const update = this.getUpdate() as Partial<IUser>;

//   if (update.allowedTabs) {
//     if (update.allowedTabs.length === 0) {
//       update.allowedTabs = ['overview'] as TabId[];
//     }
//     update.allowedTabs = [...new Set(update.allowedTabs)];
//   }

//   next();
// });

// // Instance method
// UserSchema.methods.hasTabAccess = function (tabId: TabId): boolean {
//   return this.allowedTabs.includes(tabId);
// };

// // Static methods
// UserSchema.statics.findActive = function () {
//   return this.find({ isActive: true });
// };

// UserSchema.statics.findByRole = function (role: AppRole) {
//   return this.find({ role, isActive: true });
// };

// export const User: Model<IUser> =
//     (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);

// // // models/User.ts
// // import mongoose, { Document, Model, Schema } from 'mongoose';
// // import { ALL_TAB_IDS, type TabId } from '@/lib/config/tabs-registry';
// // import { ROLES, type AppRole } from '@/lib/config/rolesConfig';

// // // Extract role IDs for MongoDB enum validation
// // const roleIds = Object.values(ROLES).map((role) => role.id);

// // export interface IUser extends Document {
// //   username: string;
// //   password: string;
// //   role: AppRole;
// //   allowedTabs: TabId[];
// //   isActive: boolean;
// //   createdAt: Date;
// //   updatedAt: Date;
// // }

// // const UserSchema = new Schema<IUser>(
// //   {
// //     username: {
// //       type: String,
// //       required: [true, 'Username is required'],
// //       minlength: [3, 'Username must be at least 3 characters long'],
// //       maxlength: [50, 'Username cannot exceed 50 characters'],
// //       unique: true,
// //       trim: true,
// //       lowercase: true,
// //     },
// //     password: {
// //       type: String,
// //       required: [true, 'Password is required'],
// //       minlength: [6, 'Password must be at least 6 characters long'],
// //       select: false, // Don't include password in queries by default
// //     },
// //     role: {
// //       type: String,
// //       enum: {
// //         values: roleIds,
// //         message: '{VALUE} is not a valid role',
// //       },
// //       required: [true, 'Role is required'],
// //       index: true,
// //     },
// //     allowedTabs: {
// //       type: [String],
// //       enum: {
// //         values: ALL_TAB_IDS,
// //         message: '{VALUE} is not a valid tab',
// //       },
// //       default: ['overview'], // Default to overview tab
// //       validate: {
// //         validator: function (tabs: string[]) {
// //           return tabs.length > 0;
// //         },
// //         message: 'User must have at least one allowed tab',
// //       },
// //     },
// //     isActive: {
// //       type: Boolean,
// //       default: true,
// //       index: true,
// //     },
// //   },
// //   {
// //     timestamps: true,
// //     collection: 'users',
// //   }
// // );

// // // Indexes for performance
// // UserSchema.index({ username: 1 }, { unique: true });
// // UserSchema.index({ role: 1, isActive: 1 });

// // // Pre-save validation
// // UserSchema.pre('save', function (next) {
// //   // Ensure at least one tab is assigned
// //   if (!this.allowedTabs || this.allowedTabs.length === 0) {
// //     this.allowedTabs = ['overview']; // Fallback to overview
// //   }

// //   // Remove duplicate tabs
// //   this.allowedTabs = [...new Set(this.allowedTabs)];

// //   next();
// // });

// // // Pre-update validation
// // UserSchema.pre('findOneAndUpdate', function (next) {
// //   const update = this.getUpdate() as { allowedTabs?: TabId[] };

// //   if (update.allowedTabs) {
// //     // Ensure at least one tab
// //     if (update.allowedTabs.length === 0) {
// //       update.allowedTabs = ['overview'];
// //     }

// //     // Remove duplicates
// //     update.allowedTabs = [...new Set(update.allowedTabs)];
// //   }

// //   next();
// // });

// // // Instance method to check if user has access to a tab
// // UserSchema.methods.hasTabAccess = function (tabId: TabId): boolean {
// //   return this.allowedTabs.includes(tabId);
// // };

// // // Static method to find active users
// // UserSchema.statics.findActive = function () {
// //   return this.find({ isActive: true });
// // };

// // // Static method to find users by role
// // UserSchema.statics.findByRole = function (role: AppRole) {
// //   return this.find({ role, isActive: true });
// // };

// // // Prevent model recompilation
// // export const User: Model<IUser> =
// //     (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema);



// // // import mongoose, { Document, Model, Schema } from 'mongoose';
// // // import { DASHBOARD_TABS, ALL_TAB_IDS, AdminTabId } from '@/lib/config/tabs-registry';
// // // import { ROLES, AppRole } from '@/lib/config/rolesConfig';

// // // // Extract role IDs for MongoDB enum validation
// // // const roleIds = Object.values(ROLES).map(role => role.id);

// // // export interface IUser extends Document {
// // //     username: string;
// // //     password: string;
// // //     role: AppRole;
// // //     allowedTabs: AdminTabId[];
// // //     isActive: boolean;
// // // }

// // // const UserSchema = new Schema<IUser>({
// // //     username: {
// // //         type: String,
// // //         required: true,
// // //         minlength: [3, "Username must be at least 3 characters long."],
// // //         unique: true
// // //     },

// // //     password: {
// // //         type: String,
// // //         required: true,
// // //         minlength: [6, "Password must be at least 6 characters long."]
// // //     },

// // //     role: {
// // //         type: String,
// // //         enum: roleIds,
// // //         required: true
// // //     },

// // //     allowedTabs: [{
// // //         type: String,
// // //         enum: ALL_TAB_IDS
// // //     }],

// // //     isActive: {
// // //         type: Boolean,
// // //         default: true
// // //     }
// // // });

// // // // Validation to ensure at least one tab
// // // UserSchema.pre('save', function (next) {
// // //     if (this.allowedTabs.length === 0) {
// // //         return next(new Error("User must have at least one allowed tab."));
// // //     }
// // //     next();
// // // });

// // // // export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
// // // export const User: Model<IUser> = (mongoose.models?.User as Model<IUser>) || mongoose.model<IUser>("User", UserSchema);