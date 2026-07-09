// types/stock-transaction.ts

import { BaseEntity, PaginationMetadata } from '..';

export interface StockEntryFormData {
  buyingPrice: string;
  sellingPrice: string;
  initialQuantity: string;
  purchaseDate: string;
  notes: string;
}

export interface StockEntryFormErrors {
  buyingPrice?: string;
  sellingPrice?: string;
  initialQuantity?: string;
  purchaseDate?: string;
  notes?: string;
}

export type StockTransactionReason = 'Adjustment' | 'Return' | 'Damage' | 'Expired' | 'Loss';

export interface StockTransaction extends BaseEntity {
  productId: {
    _id: string;
    name: string;
    size?: string;
    imageURL?: string;
  };
  categoryId: {
    _id: string;
    name: string;
  };
  stockType: "Buy" | "Sell" | "Adjustment";
  buyingPrice?: number;
  sellingPrice: number;
  initialQuantity: number;
  quantityLeft: number;
  reason?: string;
  notes?: string;
  purchaseDate: Date | string;
  date?: Date | string; // Legacy field for backward compatibility
  createdBy: {
    _id: string;
    username: string;
  };
  endedAt?: Date | string | null;
}

export interface CreateStockTransactionInput {
  productId: string;
  categoryId?: string;
  stockType: "Buy" | "Sell" | "Adjustment";
  buyingPrice?: number;
  sellingPrice?: number;
  initialQuantity: number;
  quantityLeft?: number;
  reason?: string;
  notes?: string;
  purchaseDate?: Date;
  createdBy?: string;
}

// export interface StockTransactionsResponse {
//   transactions: StockTransaction[];
//   totalCount: number;
//   pagination?: {
//     page: number;
//     limit: number;
//     total: number;
//     pages: number;
//   };
// }

export interface StockTransactionFormData {
  sellingPrice: string;
  buyingPrice: string;
  initialQuantity: string;
  quantityLeft: string;
  reason: StockTransactionReason;
  notes: string;
}

export interface StockTransactionFormErrors {
  sellingPrice?: string;
  buyingPrice?: string;
  initialQuantity?: string;
  quantityLeft?: string;
  reason?: string;
  notes?: string;
}

// // types/stock-transaction.ts

// import type { ApiResponse } from './category';

// /** Stock Transaction Entity */
// export interface StockTransaction {
//   _id: string;
//   subProductId: string;
//   buyingPrice: number;
//   sellingPrice: number;
//   initialQuantity: number;
//   quantityLeft: number;
//   purchaseDate: Date | string;
//   transactionType: 'Buy' | 'Sell' | 'Adjustment';
//   notes?: string;
//   createdBy: string;
//   createdAt: Date | string;
//   updatedAt: Date | string;
// }

// /** Create Stock Transaction Input */
// export interface CreateStockTransactionInput {
//   subProductId: string;
//   productId: string, // Add this
//   categoryId: string, // Add this
//   buyingPrice: number;
//   sellingPrice: number;
//   initialQuantity: number;
//   quantityLeft?: number;
//   purchaseDate: Date | string;
//   transactionType: 'Buy' | 'Sell' | 'Adjustment';
//   notes?: string;
//   createdBy: string;
// }

// /** Stock Entry Form Data */
// export interface StockEntryFormData {
//   buyingPrice: string;
//   sellingPrice: string;
//   initialQuantity: string;
//   purchaseDate: string;
//   notes: string;
// }

// /** Stock Entry Form Errors - Add notes field */
// export interface StockEntryFormErrors {
//   buyingPrice?: string;
//   sellingPrice?: string;
//   initialQuantity?: string;
//   purchaseDate?: string;
//   notes?: string; // ✅ Added this
// }

export interface StockTransactionsResponse {
  success: true;
  data: {
    transactions: StockTransaction[];
  };
  pagination: PaginationMetadata;
  // metadata: {
  //   page: number;
  //   limit: number;
  //   totalCount: number;
  //   totalPages: number;
  // };
}