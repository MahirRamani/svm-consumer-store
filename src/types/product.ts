// types/product.ts

import type { ApiResponse } from './category';

export type { ApiResponse };

// =============================================
// Base Entity Interface
// =============================================
export interface BaseEntity {
  _id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// =============================================
// Category Info (for populated fields)
// =============================================
export interface CategoryInfo {
  _id: string;
  name: string;
  description?: string;
}

export interface StockEntry {
  _id: string;
  quantity: number;
  purchaseDate: string;
  createdAt: string;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  categoryId: string;
  priority: number;
  category?: { 
    _id: string; 
    name: string; 
    description?: string 
  } | null;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  imageURL?: string;
  isActive: boolean;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
  // Stock data
  stockEntries?: StockEntry[];
  totalStock?: number;
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ProductFilterState {
  searchTerm: string;
  selectedCategory: string;
  showInactive: boolean;
}

// export interface ApiResponse<T> {
//   success: boolean;
//   data?: T;
//   error?: {
//     message: string;
//     code?: string;
//   };
// }

// =============================================
// Product Entity (Merged with SubProduct)
// =============================================
// export interface Product extends BaseEntity {
//   name: string;
//   description?: string;
//   categoryId: string;
//   category?: CategoryInfo | null;
//   priority: number;
//   isActive: boolean;
//   // Merged from SubProduct
//   imageURL?: string;
//   size?: string;
//   weight?: string;
//   volume?: string;
//   barcode?: string;
//   lowStockThreshold: number;
// }

// =============================================
// Products List Response
// =============================================
// export interface ProductsResponse {
//   products: Product[];
//   totalCount: number;
//   pagination?: {
//     page: number;
//     limit: number;
//     total: number;
//     pages: number;
//   };
// }

// =============================================
// Create Product Input
// =============================================
export interface CreateProductInput {
  name: string;
  categoryId: string;
  description?: string;
  priority?: number;
  // Merged from SubProduct
  imageURL?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  lowStockThreshold?: number;
}

// =============================================
// Update Product Input
// =============================================
export interface UpdateProductInput {
  _id: string;
  name?: string;
  categoryId?: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
  // Merged from SubProduct
  imageURL?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  lowStockThreshold?: number;
}

// =============================================
// Filter State
// =============================================
export interface ProductFilterState {
  searchTerm: string;
  selectedCategory: string;
  showInactive: boolean;
}

// =============================================
// Form Data (all string for form inputs)
// =============================================
export interface ProductFormData {
  name: string;
  description: string;
  categoryId: string;
  priority: string;
  // Merged from SubProduct
  imageURL: string;
  size: string;
  weight: string;
  volume: string;
  barcode: string;
  lowStockThreshold: string;
}

// =============================================
// Form Errors (matching ProductFormData keys)
// =============================================
export interface ProductFormErrors {
  name?: string;
  description?: string;
  categoryId?: string;
  priority?: string;
  // Merged from SubProduct
  imageURL?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  lowStockThreshold?: string;
  // Special error for image upload
  image?: string;
}

// =============================================
// Validatable Fields (fields that need validation)
// =============================================
export type ValidatableField = keyof Omit<ProductFormData, 'imageURL'>;

// =============================================
// Image Upload Types
// =============================================
export interface ImageUploadResponse {
  success: boolean;
  data?: {
    secure_url: string;
    public_id: string;
    width: number;
    height: number;
    format: string;
  };
  error?: string;
}

// =============================================
// Utility Types
// =============================================
export type ProductSortField = 'name' | 'priority' | 'createdAt' | 'size';
export type SortOrder = 'asc' | 'desc';


// // types/product.ts

// import type { ApiResponse } from './category';

// export type { ApiResponse };

// /** Product Entity (as returned from API) */
// export interface Product {
//   _id: string;
//   name: string;
//   description?: string;
//   categoryId: string;
//   category?: {
//     id: string;
//     name: string;
//     description?: string;
//   } | null;
//   priority?: number;
//   isActive: boolean;
//   hasVariants: boolean;
//   variantCount?: number;
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// /** Products List Response */
// export interface ProductsResponse {
//   products: Product[];
//   totalCount?: number;
//   activeCount?: number;
//   inactiveCount?: number;
// }

// /** Create Product Input */
// export interface CreateProductInput {
//   name: string;
//   description?: string;
//   categoryId: string;
//   priority?: number;
// }

// /** Update Product Input */
// export interface UpdateProductInput {
//   _id: string;
//   name?: string;
//   description?: string;
//   categoryId?: string;
//   priority?: number;
//   isActive?: boolean;
//   hasVariants?: boolean;
// }

// /** Filter State */
// export interface ProductFilterState {
//   searchTerm: string;
//   selectedCategory: string;
//   showInactive: boolean;
// }

// /** Form Data */
// export interface ProductFormData {
//   name: string;
//   description: string;
//   categoryId: string;
//   priority: string;
//   hasVariants: boolean;
// }

// /** Form Errors */
// export interface ProductFormErrors {
//   name?: string;
//   description?: string;
//   categoryId?: string;
//   priority?: string;
// }