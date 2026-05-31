// =============================================
// API Response Types
// =============================================

import { Category } from "@/lib/types/category"
import { Product } from "@/lib/types/product"

export type TransactionType = 
  | "Purchase" 
  | "Topup" 
  | "Deduction" 
  | "Partial Reverted" 
  | "Partial Revert" 
  | "Reverted" 
  | "Revert";

export interface ApiSuccessResponse<T = unknown> {
  success: true
  message?: string
  data: T
}

export interface ApiPaginatedResponse<T = unknown> {
  success: true
  data: T
  metadata: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

// =============================================
// Base Entity Types
// =============================================

export interface BaseEntity {
  _id: string
  createdAt: Date
  updatedAt: Date
}

// =============================================
// Category Types
// =============================================

// export interface Category extends BaseEntity {
//   name: string
//   description?: string
//   priority: number
//   isActive: boolean
// }

// export interface CreateCategoryDto {
//   name: string
//   description?: string
//   priority?: number
// }

// export interface UpdateCategoryDto {
//   name?: string
//   description?: string
//   priority?: number
//   isActive?: boolean
// }

// API Response Types for Categories
export type CategoriesListResponse = ApiPaginatedResponse<{
  categories: Category[]
}>

// export type CategoryResponse = ApiSuccessResponse<Category>

// =============================================
// Product Types
// =============================================

// export interface CategoryInfo {
//   id: string
//   name: string
//   description?: string
// }

// export interface Product extends BaseEntity {
//   name: string
//   description?: string
//   categoryId: string
//   category?: CategoryInfo | null
//   priority: number
//   isActive: boolean
//   hasVariants: boolean
//   variantCount?: number
// }

// export interface CreateProductDto {
//   name: string
//   description?: string
//   categoryId: string
//   hasVariants?: boolean
// }

// export interface UpdateProductDto {
//   name?: string
//   description?: string
//   categoryId?: string
//   hasVariants?: boolean
//   isActive?: boolean
//   priority?: number
// }

// API Response Types for Products
// export type ProductsListResponse = ApiPaginatedResponse<{
//   products: Product[]
// }>

// export type ProductResponse = ApiSuccessResponse<Product>

// =============================================
// SubProduct/Variant Types
// =============================================

// export interface SubProduct extends BaseEntity {
//   productId: string
//   name: string
//   description?: string
//   size?: string
//   priority: number
//   imageURL?: string
//   lowStockThreshold: number
//   weight?: string
//   volume?: string
//   barcode?: string
//   isActive: boolean
// }

// export interface SubProductWithProduct extends SubProduct {
//   product?: {
//     id: string
//     name: string
//     categoryId: string
//     category: CategoryInfo
//   }
// }

// export interface CreateSubProductDto {
//   productId: string
//   name: string
//   description?: string
//   size?: string
//   lowStockThreshold: number
//   weight?: string
//   volume?: string
//   barcode?: string
//   imageURL?: string
//   priority?: number
// }

// export interface UpdateSubProductDto {
//   name?: string
//   description?: string
//   size?: string
//   lowStockThreshold?: number
//   weight?: string
//   volume?: string
//   barcode?: string
//   imageURL?: string
//   isActive?: boolean
//   priority?: number
// }

// API Response Types for SubProducts
// export type SubProductsListResponse = ApiPaginatedResponse<{
//   subProducts: SubProduct[]
// }>

// export type SubProductResponse = ApiSuccessResponse<SubProduct>

// =============================================
// Product with Variants (for combined view)
// =============================================

// export interface ProductWithVariants extends Product {
//   variants: SubProduct[]
// }

// export type ProductsWithVariantsResponse = ApiSuccessResponse<{
//   products: ProductWithVariants[]
//   pagination: {
//     page: number
//     limit: number
//     total: number
//     totalPages: number
//   }
// }>

// =============================================
// Stock Transaction Types
// =============================================

// export interface StockTransaction extends BaseEntity {
//   subProductId: string
//   transactionType: 'Buy' | 'Sell' | 'Adjustment'
//   buyingPrice?: number
//   sellingPrice: number
//   initialQuantity: number
//   quantityLeft: number
//   reason?: string
//   description?: string
//   date: Date
//   createdBy: string
// }

// export interface CreateStockTransactionDto {
//   subProductId: string
//   transactionType: 'Buy' | 'Sell' | 'Adjustment'
//   buyingPrice?: number
//   sellingPrice: number
//   initialQuantity: number
//   quantityLeft?: number
//   reason?: string
//   description?: string
//   date?: Date
//   createdBy: string
// }

export interface UpdateStockTransactionDto {
  sellingPrice?: number
  reason?: string
  description?: string
}

// Stock Info Types
// export interface StockInfo {
//   stockTransactionId: string
//   subProductId: string
//   sellingPrice: number
//   quantityLeft: number
//   stockDate: Date
// }

// export interface SubProductWithStock {
//   subProductId: string
//   name: string
//   size: string
//   barcode: string
//   imageURL: string | null
//   lowStockThreshold: number
//   currentStock: StockInfo | null
// }

// export type SubProductsWithStockResponse = ApiSuccessResponse<{
//   data: SubProductWithStock[]
//   pagination: {
//     total: number
//     page: number
//     limit: number
//     totalPages: number
//   }
// }>

// Bulk Stock Request/Response
export interface BulkStockRequest {
  subProductIds: string[]
}

// export interface BulkStockItem {
//   subProductId: string
//   stock: StockInfo | null
// }

// export type BulkStockResponse = ApiSuccessResponse<{
//   data: BulkStockItem[]
//   summary: {
//     total: number
//     withStock: number
//     withoutStock: number
//   }
// }>

// =============================================
// Student Types
// =============================================

export interface Student extends BaseEntity {
  _id: string
  rollNumber: string
  id: number
  name: string
  standard: string
  year: number
  balance: number
  mobileNo?: string
  isActive: boolean
}

export interface CreateStudentDto {
  rollNumber: string
  id: number
  name: string
  mobileNo?: string
  standard: string
  year: number
  balance?: number
}

export interface UpdateStudentDto {
  _id: string
  rollNumber?: string
  id?: number
  name?: string
  mobileNo?: string
  standard?: string
  year?: number
  balance?: number
  isActive?: boolean
}

// API Response Types for Students
export type StudentsListResponse = ApiPaginatedResponse<{
  students: Student[]
}>

export type StudentResponse = ApiSuccessResponse<Student>

// =============================================
// User Types
// =============================================

export type UserRole = 'SUPERUSER'| 'ADMIN' | 'ACCOUNTANT' | 'SELLER'

export interface User extends BaseEntity {
  username: string
  role: UserRole
  allowedTabs: string[]
  isActive: boolean
}

export interface CreateUserDto {
  username: string
  password: string
  role: UserRole
  allowedTabs?: string[]
}

export interface UpdateUserDto {
  username?: string
  password?: string
  role?: UserRole
  allowedTabs?: string[]
  isActive?: boolean
}

// API Response Types for Users
export type UsersListResponse = ApiPaginatedResponse<{
  users: User[]
}>

export type UserResponse = ApiSuccessResponse<User>
export type CurrentUserResponse = ApiSuccessResponse<User>

// =============================================
// Transaction Types
// =============================================

export interface TransactionItem {
  categoryId: string
  productId: string
  stockTransactionId: string
  name: string
  quantity: number
  price: number
  totalPrice: number
}

export interface Transaction extends BaseEntity {
  id: string
  student: Student
  userId?: string
  items?: TransactionItem[]
  totalAmount: number
  status: 'Pending' | 'Completed' | 'Cancelled'
  type: TransactionType; 
  reason?: string
  performedBy?: string
}

export interface CreateTransactionDto {
  studentId: string
  items?: TransactionItem[]
  totalAmount: number
  type: TransactionType;
  reason?: string
}

// API Response Types for Transactions
export type TransactionsListResponse = ApiPaginatedResponse<{
  transactions: Transaction[]
}>

export type TransactionResponse = ApiSuccessResponse<Transaction>

// =============================================
// Dashboard Types
// =============================================

export interface LowStockProduct {
  id: string
  name: string
  category: string
  price: number
  stock: number
}

export interface TopSoldProduct {
  id: string
  name: string
  quantitySold: number
  revenue: number
}

export interface TodaysSoldProduct {
  id: string
  name: string
  quantity: number
  revenue: number
}

export interface DashboardStats {
  totalSales: number
  totalSalesChange: number
  lowStockCount: number
  lowStockProducts: LowStockProduct[]
  topSoldProduct: TopSoldProduct | null
  todaysSoldProducts: TodaysSoldProduct[]
  todaysProfit: number
  todaysProfitMargin: number
  yesterdayProfit: number
}

export type DashboardStatsResponse = ApiSuccessResponse<DashboardStats>

export interface AnalyticsDataItem {
  _id: string
  name: string
  sales: number
  quantity: number
}

export type AnalyticsResponse = ApiSuccessResponse<AnalyticsDataItem[]>

export interface ProfitLossDay {
  date: string
  totalSales: number
  totalCost: number
  profit: number
}

export type ProfitLossResponse = ApiSuccessResponse<ProfitLossDay[]>

// =============================================
// Filter and Query Types
// =============================================

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CategoryFilters extends PaginationParams {
  search?: string
  includeInactive?: boolean
}

export interface ProductFilters extends PaginationParams {
  search?: string
  categoryId?: string
  includeInactive?: boolean
}

export interface SubProductFilters extends PaginationParams {
  search?: string
  productId?: string
  includeInactive?: boolean
}

export interface StudentFilters extends PaginationParams {
  search?: string
  standard?: string
  year?: number
  isActive?: boolean
}

export interface TransactionFilters extends PaginationParams {
  studentId?: string
  type?: TransactionType
  status?: 'Pending' | 'Completed' | 'Cancelled'
  startDate?: string
  endDate?: string
}

// =============================================
// Form Types
// =============================================

export interface LoginCredentials {
  username: string
  password: string
}

export interface BalanceOperation {
  amount: number
  reason?: string
}

// =============================================
// UI State Types
// =============================================

export interface FilterState {
  searchTerm: string
  showInactive: boolean
}

// export interface CategoryFilterState extends FilterState {
//   // Add category-specific filters if needed
// }

// export interface ProductFilterState extends FilterState {
//   selectedCategory: string
// }

// =============================================
// Utility Types
// =============================================

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]


// // types/index.ts
// export interface Category {
//   id: string;
//   name: string;
//   description?: string;
//   priority?: number;
//   isActive: boolean;
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// export interface Product {
//   id: string;
//   name: string;
//   description?: string;
//   categoryId: string;
//   category?: Category | { id: string; name: string };
//   priority?: number;
//   isActive: boolean;
//   hasVariants: boolean;
//   variantCount?: number;
//   variants?: SubProduct[];
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// export interface SubProduct {
//   id: string;
//   productId: string;
//   parentProduct?: Product;
//   name: string;
//   description?: string;
//   size?: string;
//   price?: number;
//   stock?: number;
//   lowStockThreshold: number;
//   weight?: string;
//   volume?: string;
//   barcode?: string;
//   imageURL?: string;
//   isActive: boolean;
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// export interface Student {
//   id: string;
//   name: string;
//   rollNumber: string;
//   balance: number;
//   mobileNo?: string;
//   standard: string;
//   year: number;
//   isActive: boolean;
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// // API Response Types
// export interface ApiResponse<T> {
//   success: boolean;
//   data?: T;
//   message?: string;
//   error?: {
//     code: string;
//     message: string;
//     details?: Record<string, unknown>;
//   };
//   metadata?: ApiPaginationMetadata;
// }

// export interface ApiPaginationMetadata {
//   page: number;
//   limit: number;
//   totalCount: number;
//   totalPages: number;
// }

// export interface CategoriesResponse {
//   categories: Category[];
//   totalCount?: number;
//   activeCount?: number;
//   inactiveCount?: number;
// }

// export interface ProductsResponse {
//   products: Product[];
//   pagination?: PaginationMetadata;
// }

// export interface SubProductsResponse {
//   subProducts: SubProduct[];
//   pagination?: PaginationMetadata;
// }

// // Dashboard Types
// export interface DashboardStats {
//   totalSales: number;
//   totalSalesChange: number;
//   lowStockCount: number;
//   lowStockProducts: Array<{
//     id: string;
//     name: string;
//     category: string;
//     price: number;
//     stock: number;
//   }>;
//   topSoldProduct: {
//     id: string;
//     name: string;
//     quantitySold: number;
//     revenue: number;
//   } | null;
//   todaysSoldProducts: Array<{
//     id: string;
//     name: string;
//     quantity: number;
//     revenue: number;
//   }>;
//   todaysProfit: number;
//   todaysProfitMargin: number;
//   yesterdayProfit: number;
// }

// // Form Data Types
// export interface CreateCategoryInput {
//   name: string;
//   description?: string;
//   priority?: number;
// }

// export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
//   id: string;
//   isActive?: boolean;
// }

// export interface CreateProductInput {
//   name: string;
//   description?: string;
//   categoryId: string;
//   priority?: number;
// }

// export interface UpdateProductInput extends Partial<CreateProductInput> {
//   isActive?: boolean;
//   hasVariants?: boolean;
// }

// export interface CreateSubProductInput {
//   productId: string;
//   name: string;
//   size?: string;
//   weight?: string;
//   volume?: string;
//   barcode?: string;
//   description?: string;
//   image?: string;
//   lowStockThreshold?: number;
// }

// export interface UpdateSubProductInput extends Partial<CreateSubProductInput> {
//   isActive?: boolean;
// }

// // // Cart Types
// // export interface CartItem {
// //   itemKey: string;
// //   productId?: string;
// //   subProductId?: string;
// //   name: string;
// //   quantity: number;
// //   stock: number;
// //   itemType: 'subproduct';
// // }

// // types/index.ts - Update the CartItem interface

// export interface CartItem {
//   itemKey: string;
//   productId?: string;
//   subProductId?: string;
//   name: string;
//   price?: number; // Add this
//   quantity: number;
//   stock: number;
//   itemType: 'subproduct';
//   stockTransactionId?: string; // Add this
// }

// // types/index.ts
// import type { TabId } from '@/lib/config/tabs-registry';
// import type { AppRole } from '@/lib/config/rolesConfig';

// // User type for client-side (no password)
// export interface User {
//   _id: string;
//   username: string;
//   role: AppRole;
//   allowedTabs: TabId[];
//   isActive: boolean;
//   createdAt: string;
//   updatedAt: string;
// }

// // User type with password (for server-side only)
// export interface UserWithPassword extends User {
//   password: string;
// }

export interface CreateStudentInput {
  name: string;
  rollNumber: string;
  standard: string;
  year: number;
  balance?: number;
  mobileNo?: string;
}

export interface UpdateStudentInput extends Partial<CreateStudentInput> {
  _id: string;
  isActive?: boolean;
}

export interface BalanceUpdateInput {
  studentId: string;
  amount: number;
  reason?: string;
}
















// // // types/index.ts
// // import type { TabId } from '@/lib/config/tabs-registry';
// // import type { AppRole } from '@/lib/config/rolesConfig';

// // // ============================================================================
// // // CORE ENTITY TYPES
// // // ============================================================================

// // export interface Category {
// //   id: string;
// //   name: string;
// //   description?: string;
// //   priority?: number;
// //   isActive: boolean;
// //   createdAt: Date | string;
// //   updatedAt: Date | string;
// // }

// // export interface Product {
// //   id: string;
// //   name: string;
// //   description?: string;
// //   categoryId: string;
// //   category?: Category | { id: string; name: string };
// //   priority?: number;
// //   isActive: boolean;
// //   hasVariants: boolean;
// //   variantCount?: number;
// //   variants?: SubProduct[];
// //   createdAt: Date | string;
// //   updatedAt: Date | string;
// // }

// // export interface SubProduct {
// //   id: string;
// //   productId: string;
// //   parentProduct?: Product;
// //   name: string;
// //   description?: string;
// //   size?: string;
// //   price?: number;
// //   stock?: number;
// //   lowStockThreshold: number;
// //   weight?: string;
// //   volume?: string;
// //   barcode?: string;
// //   imageURL?: string;
// //   isActive: boolean;
// //   createdAt: Date | string;
// //   updatedAt: Date | string;
// // }

// // export interface Student {
// //   id: string;
// //   name: string;
// //   rollNumber: string;
// //   balance: number;
// //   mobileNo?: string;
// //   standard: string;
// //   year: number;
// //   isActive: boolean;
// //   createdAt: Date | string;
// //   updatedAt: Date | string;
// // }

// // export interface User {
// //   _id: string;
// //   username: string;
// //   role: AppRole;
// //   allowedTabs: TabId[];
// //   isActive: boolean;
// //   createdAt: string;
// //   updatedAt: string;
// // }

// // export interface UserWithPassword extends User {
// //   password: string;
// // }

// // ============================================================================
// // TRANSACTION TYPES
// // ============================================================================

// export interface TransactionItem {
//   categoryId?: string;
//   productId?: string;
//   subProductId?: string;
//   stockTransactionId?: string;
//   quantity: number;
//   price: number;
//   totalPrice: number;
//   name?: string; // For display purposes
// }

// export interface Transaction {
//   id: string;
//   studentId: string;
//   student?: {
//     id: string;
//     name: string;
//     rollNumber: string;
//     standard?: string;
//   };
//   userId?: string;
//   items: TransactionItem[];
//   totalAmount: number;
//   status: "Pending" | "Completed" | "Cancelled";
//   transactionType: "Purchase" | "Topup" | "Deduction";
//   reason?: string;
//   performedBy?: string;
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// // // ============================================================================
// // // PAGINATION & API RESPONSE TYPES
// // // ============================================================================

export interface PaginationMetadata {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
}

// // export interface ApiResponse<T> {
// //   success: boolean;
// //   data?: T;
// //   message?: string;
// //   error?: {
// //     code: string;
// //     message: string;
// //     details?: Record<string, unknown>;
// //   };
// //   metadata?: PaginationMetadata;
// // }

// // export interface CategoriesResponse {
// //   categories: Category[];
// //   totalCount?: number;
// //   activeCount?: number;
// //   inactiveCount?: number;
// // }

// // export interface ProductsResponse {
// //   products: Product[];
// //   pagination?: PaginationMetadata;
// // }

// // export interface SubProductsResponse {
// //   subProducts: SubProduct[];
// //   pagination?: PaginationMetadata;
// // }

export interface TransactionsResponse {
  data: Transaction[];
  pagination: PaginationMetadata;
}

// export interface StudentsResponse {
//   students: Student[];
//   pagination?: PaginationMetadata;
// }

// // // ============================================================================
// // // FORM INPUT TYPES
// // // ============================================================================

// // export interface CreateCategoryInput {
// //   name: string;
// //   description?: string;
// //   priority?: number;
// // }

// // export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
// //   id: string;
// //   isActive?: boolean;
// // }

// // export interface CreateProductInput {
// //   name: string;
// //   description?: string;
// //   categoryId: string;
// //   priority?: number;
// // }

// // export interface UpdateProductInput extends Partial<CreateProductInput> {
// //   id: string;
// //   isActive?: boolean;
// //   hasVariants?: boolean;
// // }

// // export interface CreateSubProductInput {
// //   productId: string;
// //   name: string;
// //   size?: string;
// //   weight?: string;
// //   volume?: string;
// //   barcode?: string;
// //   description?: string;
// //   image?: string;
// //   lowStockThreshold?: number;
// // }

// // export interface UpdateSubProductInput extends Partial<CreateSubProductInput> {
// //   id: string;
// //   isActive?: boolean;
// // }

// // export interface CreateStudentInput {
// //   name: string;
// //   rollNumber: string;
// //   standard: string;
// //   year: number;
// //   balance?: number;
// //   mobileNo?: string;
// // }

// // export interface UpdateStudentInput extends Partial<CreateStudentInput> {
// //   id: string;
// //   isActive?: boolean;
// // }

// // export interface BalanceUpdateInput {
// //   studentId: string;
// //   amount: number;
// //   reason?: string;
// // }

// // // ============================================================================
// // // CART TYPES
// // // ============================================================================

// // export interface CartItem {
// //   itemKey: string;
// //   productId?: string;
// //   subProductId?: string;
// //   name: string;
// //   quantity: number;
// //   stock: number;
// //   price?: number;
// //   itemType: 'subproduct';
// // }

// // // ============================================================================
// // // DASHBOARD TYPES
// // // ============================================================================

// // export interface DashboardStats {
// //   totalSales: number;
// //   totalSalesChange: number;
// //   lowStockCount: number;
// //   lowStockProducts: Array<{
// //     id: string;
// //     name: string;
// //     category: string;
// //     price: number;
// //     stock: number;
// //   }>;
// //   topSoldProduct: {
// //     id: string;
// //     name: string;
// //     quantitySold: number;
// //     revenue: number;
// //   } | null;
// //   todaysSoldProducts: Array<{
// //     id: string;
// //     name: string;
// //     quantity: number;
// //     revenue: number;
// //   }>;
// //   todaysProfit: number;
// //   todaysProfitMargin: number;
// //   yesterdayProfit: number;
// // }

type StockType = 'Buy' | 'Sell' | 'Adjustment';

// export interface StockTransaction {
//   _id: string;
//   productId: Product;
//   subProductId: string;
//   categoryId: Category;
//   transactionType: TransactionType;
//   initialQuantity: number;
//   quantityLeft: number;
//   buyingPrice?: number;
//   sellingPrice: number;
//   date: string;
//   reason?: string;
//   notes?: string;
//   createdBy: User;
//   updatedBy?: User;
//   createdAt: string;
//   updatedAt: string;
// }

export type { Category }
