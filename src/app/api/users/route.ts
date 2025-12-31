// app/api/users/route.ts
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/config/db';
import { User, type IUser } from '@/models/User';
import { withErrorHandler, successResponse, paginatedResponse, ApiError } from '@/lib/api/base-handler';
import { validateBody, validateQuery } from '@/lib/api/validation-helpers';
import { withRole, type AuthContext } from '@/lib/api/auth-helpers';
import {
  createUserSchema,
  getUsersQuerySchema,
  type CreateUserDto,
  type GetUsersQueryDto,
} from '@/lib/validations/user';
import type { FilterQuery } from 'mongoose';

// =============================================
// GET - List Users (Admin only)
// =============================================
const getUsersHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const query = validateQuery(req, getUsersQuerySchema);
  const { page, limit, sortBy, sortOrder, search, role, isActive } = query;

  // Build filter
  const filter: FilterQuery<IUser> = {};

  if (role) {
    filter.role = role;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive;
  }

  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === 'desc' ? -1 : 1,
  };

  const [users, totalCount] = await Promise.all([
    User.find(filter)
      .select('-password') // Never return passwords
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return paginatedResponse('users', users, { page, limit, totalCount });
};

// =============================================
// POST - Create User (Admin only)
// =============================================
const createUserHandler = async (req: Request, authContext: AuthContext) => {
  await connectDB();

  const data = await validateBody(req, createUserSchema);
  

  // // Check if username already exists
  // const existingUser = await User.findOne({ username: data.username });
  // if (existingUser) {
  //   throw new ApiError('Username already exists', 409);
  // }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 12);

  // Create user
  const user = await User.create({
    ...data,
    password: hashedPassword,
  });

  // Return user without password
  const userResponse = await User.findById(user._id).select('-password').lean();

  return successResponse(userResponse, 201, 'User created successfully');
};

// =============================================
// Export Routes
// =============================================
export const GET = withErrorHandler(withRole(['SUPERUSER'])(getUsersHandler));
export const POST = withErrorHandler(withRole(['SUPERUSER'])(createUserHandler));