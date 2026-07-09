// types/pos.ts

import type { TransactionType } from '@/types'

// =============================================
// Base API Response Type
// =============================================
// export interface ApiResponse<T = unknown> {
//   success: boolean;
//   message?: string;
//   data?: T;
//   error?: {
//     code: string;
//     message: string;
//     details?: Record<string, unknown>;
//   };
//   metadata?: {
//     page?: number;
//     limit?: number;
//     totalCount?: number;
//     totalPages?: number;
//   };
// }

// =============================================
// Student Entity
// =============================================
export interface Student {
  _id: string;
  name: string;
  rollNumber: string;
  standard: string;
  year: string;
  mobileNo?: string;
  balance: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// =============================================
// Stock Types (FIFO Pattern)
// =============================================
export interface StockInfo {
  stockTransactionId: string;
  sellingPrice: number;
  quantityLeft: number;
  stockDate: string;
}

export interface StockFIFOItem {
  productId: string;
  currentStock: StockInfo | null;
}

export interface StockFIFOResponse {
  data: StockFIFOItem[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary?: {
    total: number;
    withStock: number;
    withoutStock: number;
  };
}

// =============================================
// Category Types
// =============================================
export interface Category {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CategoriesResponse {
  categories: Category[];
}

export interface CategoryRef {
  _id: string;
  name: string;
  description?: string;
}

// =============================================
// Product Types (Base Item - Merged with SubProduct)
// =============================================
export interface Product {
  _id: string;
  name: string;
  description?: string;
  categoryId: CategoryRef | string | null;
  priority: number;
  isActive: boolean;
  // Merged from SubProduct
  imageURL?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  lowStockThreshold: number;
  // Computed fields
  categoryName?: string;
  currentStock?: StockInfo | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Alias for backward compatibility
export type ProductWithStock = Product;

export interface ProductsInventoryResponse {
  products: Product[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================
// Search Types
// =============================================
export interface SearchResult {
  type: 'category' | 'product';
  id: string;
  name: string;
  description?: string;
  category?: CategoryRef;
  product?: Product;
  price?: number;
  stock?: number;
}

// =============================================
// Cart Types
// =============================================
export interface CartItem {
  itemKey: string;
  productId: string;
  categoryId?: string;
  name: string;
  size?: string;
  price: number;
  quantity: number;
  stock: number;
  stockTransactionId: string;
  imageURL?: string;
}

// =============================================
// Transaction Types
// =============================================

export interface TransactionItem {
  productId: string;
  categoryId?: string;
  quantity: number;
  price: number;
  stockTransactionId?: string;
}

export interface Transaction {
  _id: string;
  transactionId?: string;
  studentId: string;
  items: TransactionItem[];
  totalAmount: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
  type: TransactionType;
  createdBy?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TransactionData {
  student: string;
  amount: number;
  remainingBalance: number;
  _id: string;
  items: CartItem[];
}

export interface CreateTransactionPayload {
  studentId: string;
  items: TransactionItem[];
}

export interface TransactionApiResponse {
  transaction: Transaction;
}

// =============================================
// Utility Type Guards
// =============================================

/** Check if categoryId is a CategoryRef object */
export function isCategoryRef(
  categoryId: string | CategoryRef | null | undefined
): categoryId is CategoryRef {
  return (
    categoryId !== null &&
    categoryId !== undefined &&
    typeof categoryId === 'object' &&
    '_id' in categoryId
  );
}

/** Extract category name from product */
export function getCategoryName(product: Product): string {
  if (product.categoryName) {
    return product.categoryName;
  }
  if (isCategoryRef(product.categoryId)) {
    return product.categoryId.name;
  }
  return 'Uncategorized';
}

/** Extract category ID string from product */
export function getCategoryId(product: Product): string | null {
  if (typeof product.categoryId === 'string') {
    return product.categoryId;
  }
  if (isCategoryRef(product.categoryId)) {
    return product.categoryId._id;
  }
  return null;
}

/** Check if product has available stock */
export function hasAvailableStock(product: Product): boolean {
  return product.currentStock !== null &&
    product.currentStock !== undefined &&
    product.currentStock.quantityLeft > 0;
}

/** Check if product is low on stock */
export function isLowStock(product: Product): boolean {
  if (!product.currentStock) return true;
  return product.currentStock.quantityLeft <= product.lowStockThreshold;
}

/** Check if product is out of stock */
export function isOutOfStock(product: Product): boolean {
  return !product.currentStock || product.currentStock.quantityLeft <= 0;
}






// // types/pos.ts

// // =============================================
// // Base API Response Type
// // =============================================
// export interface ApiResponse<T = unknown> {
//   success: boolean;
//   message?: string;
//   data?: T;
//   error?: {
//     code: string;
//     message: string;
//     details?: Record<string, unknown>;
//   };
//   metadata?: {
//     page?: number;
//     limit?: number;
//     totalCount?: number;
//     totalPages?: number;
//   };
// }

// // =============================================
// // Student Entity
// // =============================================
// export interface Student {
//   _id: string;
//   name: string;
//   rollNumber: string;
//   standard: string;
//   year: string;
//   mobileNo?: string;
//   balance: number;
//   isActive: boolean;
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// // =============================================
// // Stock Types (FIFO Pattern)
// // =============================================
// export interface StockInfo {
//   stockTransactionId: string;
//   sellingPrice: number;
//   quantityLeft: number;
//   stockDate: string;
// }

// export interface StockFIFOItem {
//   subProductId: string;
//   currentStock: StockInfo | null;
// }

// export interface StockFIFOResponse {
//   data: StockFIFOItem[];
//   pagination?: {
//     total: number;
//     page: number;
//     limit: number;
//     totalPages: number;
//   };
//   summary?: {
//     total: number;
//     withStock: number;
//     withoutStock: number;
//   };
// }

// // =============================================
// // Category Types
// // =============================================
// export interface Category {
//   _id: string;
//   name: string;
//   description?: string;
//   isActive: boolean;
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// export interface CategoriesResponse {
//   categories: Category[];
// }

// export interface CategoryRef {
//   _id: string;
//   name: string;
//   description?: string;
// }

// // =============================================
// // SubProduct (Variant) Types
// // =============================================
// export interface SubProductWithStock {
//   _id: string;
//   productId: string;
//   name: string;
//   description?: string;
//   priority?: number;
//   imageURL?: string;
//   size?: string;
//   weight?: string;
//   volume?: string;
//   barcode?: string;
//   lowStockThreshold: number;
//   isActive: boolean;
//   createdAt: Date | string;
//   updatedAt: Date | string;
//   currentStock: StockInfo | null;
// }

// // =============================================
// // Product Types
// // =============================================
// export interface ProductWithVariants {
//   _id: string;
//   name: string;
//   description?: string;
//   categoryId: CategoryRef | null;
//   priority?: number;
//   isActive: boolean;
//   hasVariants: boolean;
//   variantCount: number;
//   categoryName?: string;
//   createdAt: Date | string;
//   updatedAt: Date | string;
//   variants?: SubProductWithStock[];
// }

// export interface ProductsInventoryResponse {
//   products: ProductWithVariants[];
//   pagination?: {
//     page: number;
//     limit: number;
//     total: number;
//     totalPages: number;
//   };
// }

// // =============================================
// // Cart Types
// // =============================================
// export type CartItemType = 'subProduct';

// export interface CartItem {
//   itemKey: string;
//   subProductId: string;
//   productId?: string;
//   name: string;
//   price: number;
//   quantity: number;
//   stock: number;
//   itemType: CartItemType;
//   stockTransactionId: string;
// }

// // =============================================
// // Transaction Types
// // =============================================
// export interface TransactionItem {
//   productId?: string;
//   subProductId: string;
//   quantity: number;
//   price: number;
//   stockTransactionId: string;
// }

// export interface Transaction {
//   _id: string;
//   transactionId: string;
//   studentId: string;
//   items: TransactionItem[];
//   totalAmount: number;
//   status: 'Pending' | 'Completed' | 'Cancelled' | 'Refunded';
//   transactionType: 'Purchase' | 'Refund' | 'Adjustment';
//   createdBy?: string;
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// export interface TransactionData {
//   student: string;
//   amount: number;
//   remainingBalance: number;
//   id: string;
//   items: CartItem[];
// }

// export interface CreateTransactionPayload {
//   studentId: string;
//   items: TransactionItem[];
// }

// // =============================================
// // Utility Type Guards
// // =============================================

// /** Check if categoryId is a CategoryRef object */
// export function isCategoryRef(
//   categoryId: string | CategoryRef | null | undefined
// ): categoryId is CategoryRef {
//   return (
//     categoryId !== null &&
//     categoryId !== undefined &&
//     typeof categoryId === 'object' &&
//     '_id' in categoryId
//   );
// }

// /** Extract category name from product */
// export function getCategoryName(product: ProductWithVariants): string {
//   if (product.categoryName) {
//     return product.categoryName;
//   }
//   if (isCategoryRef(product.categoryId)) {
//     return product.categoryId.name;
//   }
//   return 'Uncategorized';
// }

// /** Extract category ID string from product */
// export function getCategoryId(product: ProductWithVariants): string | null {
//   if (typeof product.categoryId === 'string') {
//     return product.categoryId;
//   }
//   if (isCategoryRef(product.categoryId)) {
//     return product.categoryId._id;
//   }
//   return null;
// }

// /** Check if variant has available stock */
// export function hasAvailableStock(variant: SubProductWithStock): boolean {
//   return variant.currentStock !== null && variant.currentStock.quantityLeft > 0;
// }

// /** Check if variant is low on stock */
// export function isLowStock(variant: SubProductWithStock): boolean {
//   if (!variant.currentStock) return true;
//   return variant.currentStock.quantityLeft <= variant.lowStockThreshold;
// }

// /** Check if variant is out of stock */
// export function isOutOfStock(variant: SubProductWithStock): boolean {
//   return !variant.currentStock || variant.currentStock.quantityLeft <= 0;
// }




// // // types/pos.ts

// // import type { ApiResponse } from './category';

// // export type { ApiResponse };

// // /** Student Entity */
// // export interface Student {
// //   _id: string;
// //   name: string;
// //   rollNumber: string;
// //   standard: string;
// //   year: string;
// //   mobileNo?: string;
// //   balance: number;
// //   isActive: boolean;
// //   createdAt: Date | string;
// //   updatedAt: Date | string;
// // }

// // /** Stock Info (FIFO) */
// // export interface StockInfo {
// //   stockTransactionId: string;
// //   sellingPrice: number;
// //   quantityLeft: number;
// //   stockDate: string;
// // }

// // /** SubProduct with Stock */
// // export interface SubProductWithStock {
// //   _id: string;
// //   productId: string;
// //   name: string;
// //   description?: string;
// //   size?: string;
// //   weight?: string;
// //   volume?: string;
// //   barcode?: string;
// //   imageURL?: string;
// //   lowStockThreshold: number;
// //   isActive: boolean;
// //   createdAt: Date | string;
// //   updatedAt: Date | string;
// //   currentStock: StockInfo | null;
// // }

// // /** Product with Variants */
// // export interface ProductWithVariants {
// //   _id: string;
// //   name: string;
// //   description?: string;
// //   categoryId: string | {
// //     id: string;
// //     name: string;
// //   };
// //   priority?: number;
// //   isActive: boolean;
// //   hasVariants: boolean;
// //   variantCount: number;
// //   categoryName?: string;
// //   createdAt: Date | string;
// //   updatedAt: Date | string;
// //   variants?: SubProductWithStock[];
// // }

// // /** Cart Item */
// // export interface CartItem {
// //   itemKey: string;
// //   subProductId: string;
// //   productId?: string;
// //   name: string;
// //   price: number;
// //   quantity: number;
// //   stock: number;
// //   itemType: 'subProduct';
// //   stockTransactionId: string;
// // }

// // /** Transaction Item */
// // export interface TransactionItem {
// //   productId?: string;
// //   subProductId: string;
// //   quantity: number;
// //   price: number;
// //   stockTransactionId: string;
// // }

// // /** Transaction Response */
// // export interface Transaction {
// //   _id: string;
// //   transactionId: string;
// //   studentId: string;
// //   items: TransactionItem[];
// //   totalAmount: number;
// //   status: string;
// //   transactionType: string;
// //   createdAt: Date | string;
// //   updatedAt: Date | string;
// // }

// // /** Transaction Data for Success Modal */
// // export interface TransactionData {
// //   student: string;
// //   amount: number;
// //   remainingBalance: number;
// //   id: string;
// //   items: CartItem[];
// // }

// // /** Products Response */
// // export interface ProductsInventoryResponse {
// //   products: ProductWithVariants[];
// // }

// // /** Stock FIFO Response */
// // export interface StockFIFOItem {
// //   subProductId: string;
// //   currentStock: StockInfo | null;
// // }

// // export interface StockFIFOResponse {
// //   data: StockFIFOItem[];
// //   summary?: {
// //     total: number;
// //     withStock: number;
// //     withoutStock: number;
// //   };
// // }