// types/stock-transaction.ts

import type { ApiResponse } from './category';

/** Stock Transaction Entity */
export interface StockTransaction {
  _id: string;
  subProductId: string;
  buyingPrice: number;
  sellingPrice: number;
  initialQuantity: number;
  quantityLeft: number;
  purchaseDate: Date | string;
  transactionType: 'Buy' | 'Sell' | 'Adjustment';
  notes?: string;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Create Stock Transaction Input */
export interface CreateStockTransactionInput {
  subProductId: string;
  buyingPrice: number;
  sellingPrice: number;
  initialQuantity: number;
  quantityLeft?: number;
  purchaseDate: Date | string;
  transactionType: 'Buy' | 'Sell' | 'Adjustment';
  notes?: string;
  createdBy: string;
}

/** Stock Entry Form Data */
export interface StockEntryFormData {
  buyingPrice: string;
  sellingPrice: string;
  initialQuantity: string;
  purchaseDate: string;
  notes: string;
}

/** Stock Entry Form Errors - Add notes field */
export interface StockEntryFormErrors {
  buyingPrice?: string;
  sellingPrice?: string;
  initialQuantity?: string;
  purchaseDate?: string;
  notes?: string; // ✅ Added this
}