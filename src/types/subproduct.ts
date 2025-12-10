// types/subproduct.ts

import type { ApiResponse } from './category';

export type { ApiResponse };

/** SubProduct Entity (as returned from API) - NO PRICE FIELD */
export interface SubProduct {
  _id: string;
  productId: string;
  name: string;
  description?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  imageURL?: string;
  lowStockThreshold: number;
  priority?: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Populated fields
  parentProduct?: {
    _id: string;
    name: string;
    category?: {
      _id: string;
      name: string;
    };
  };
}

/** SubProducts List Response */
export interface SubProductsResponse {
  subProducts: SubProduct[];
  totalCount?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/** Create SubProduct Input */
export interface CreateSubProductInput {
  productId: string;
  name: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  description?: string;
  imageURL?: string;
  lowStockThreshold?: number;
  priority?: number;
}

/** Update SubProduct Input */
export interface UpdateSubProductInput {
  _id: string;
  productId?: string;
  name?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  description?: string;
  imageURL?: string;
  lowStockThreshold?: number;
  priority?: number;
  isActive?: boolean;
}

/** Filter State */
export interface SubProductFilterState {
  searchTerm: string;
  selectedProduct: string;
  showInactive: boolean;
}

/** Form Data */
export interface SubProductFormData {
  productId: string;
  name: string;
  size: string;
  weight: string;
  volume: string;
  barcode: string;
  description: string;
  lowStockThreshold: string;
  priority: string;
}

/** Form Errors */
export interface SubProductFormErrors {
  productId?: string;
  name?: string;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  description?: string;
  lowStockThreshold?: string;
  priority?: string;
  image?: string;
}

/** Image Upload Response */
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

/** Stock Modal State */
export interface StockModalState {
  open: boolean;
  subProductId: string;
  subProductName: string;
  currentSellingPrice: number;
}