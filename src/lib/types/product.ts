// types/product.ts

import type { ApiResponse } from '@/types/category';

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

// =============================================
// Product Entity (Merged with SubProduct)
// =============================================
export interface Product extends BaseEntity {
  name: string;
  description?: string;
  categoryId: string;
  category?: CategoryInfo | null;
  priority: number;
  isActive: boolean;
  // Merged from SubProduct
  imageURL?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  lowStockThreshold: number;
}

// =============================================
// Products List Response
// =============================================
export interface ProductsResponse {
  products: Product[];
  totalCount: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

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
// Form Data
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
// Form Errors
// =============================================
export interface ProductFormErrors {
  name?: string;
  description?: string;
  categoryId?: string;
  priority?: string;
  // Merged from SubProduct
  image?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  lowStockThreshold?: string;
}

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




// import type { BaseEntity, CategoryInfo } from "@/types"

// // =============================================
// // Product Entity
// // =============================================
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

// // =============================================
// // Product Input Types
// // =============================================
// export interface CreateProductInput {
//   name: string
//   categoryId: string
//   description?: string
//   hasVariants?: boolean
//   priority?: number
// }

// export interface UpdateProductInput {
//   id: string
//   name?: string
//   categoryId?: string
//   description?: string
//   hasVariants?: boolean
//   isActive?: boolean
//   priority?: number
// }




// // import type { BaseEntity, CategoryInfo } from "@/types"

// // // =============================================
// // // Product Entity
// // // =============================================
// // export interface Product extends BaseEntity {
// //   name: string
// //   description?: string
// //   categoryId: string
// //   category?: CategoryInfo | null
// //   priority: number
// //   isActive: boolean
// //   hasVariants: boolean
// //   variantCount?: number
// // }

// // // =============================================
// // // Product DTOs
// // // =============================================
// // export type CreateProductDto = Omit<
// //   Product,
// //   "id" | "isActive" | "createdAt" | "updatedAt" | "category" | "variantCount" | "priority"
// // > & {
// //   priority?: number
// //   hasVariants?: boolean
// // }

// // export type UpdateProductDto = Partial<
// //   Omit<CreateProductDto, "categoryId">
// // > & {
// //   id: string
// //   categoryId?: string
// //   isActive?: boolean
// // }

// // // Alternative: More explicit input types
// // export interface CreateProductInput {
// //   name: string
// //   categoryId: string
// //   description?: string
// //   hasVariants?: boolean
// //   priority?: number
// // }

// // export interface UpdateProductInput {
// //   id: string
// //   name?: string
// //   categoryId?: string
// //   description?: string
// //   hasVariants?: boolean
// //   isActive?: boolean
// //   priority?: number
// // }