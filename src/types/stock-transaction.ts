// types/stock-transaction.ts

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

export interface StockTransaction {
  _id: string;
  productId: string;
  categoryId?: string;
  transactionType: "Buy" | "Sell" | "Adjustment";
  buyingPrice: number;
  sellingPrice: number;
  initialQuantity: number;
  quantityLeft: number;
  reason?: string;
  notes?: string;
  purchaseDate: Date | string;
  createdBy?: string;
  endedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Populated fields
  product?: {
    _id: string;
    name: string;
    size?: string;
    imageURL?: string;
  };
  category?: {
    _id: string;
    name: string;
  };
}

export interface CreateStockTransactionInput {
  productId: string;
  categoryId?: string;
  transactionType: "Buy" | "Sell" | "Adjustment";
  buyingPrice?: number;
  sellingPrice?: number;
  initialQuantity: number;
  quantityLeft?: number;
  reason?: string;
  notes?: string;
  purchaseDate?: Date;
  createdBy?: string;
}

export interface StockTransactionsResponse {
  transactions: StockTransaction[];
  totalCount: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
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