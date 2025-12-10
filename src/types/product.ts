// types/product.ts

import type { ApiResponse } from './category';

export type { ApiResponse };

/** Product Entity (as returned from API) */
export interface Product {
  _id: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    description?: string;
  } | null;
  priority?: number;
  isActive: boolean;
  hasVariants: boolean;
  variantCount?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Products List Response */
export interface ProductsResponse {
  products: Product[];
  totalCount?: number;
  activeCount?: number;
  inactiveCount?: number;
}

/** Create Product Input */
export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId: string;
  priority?: number;
}

/** Update Product Input */
export interface UpdateProductInput {
  _id: string;
  name?: string;
  description?: string;
  categoryId?: string;
  priority?: number;
  isActive?: boolean;
  hasVariants?: boolean;
}

/** Filter State */
export interface ProductFilterState {
  searchTerm: string;
  selectedCategory: string;
  showInactive: boolean;
}

/** Form Data */
export interface ProductFormData {
  name: string;
  description: string;
  categoryId: string;
  priority: string;
  hasVariants: boolean;
}

/** Form Errors */
export interface ProductFormErrors {
  name?: string;
  description?: string;
  categoryId?: string;
  priority?: string;
}