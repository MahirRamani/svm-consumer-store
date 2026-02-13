// ============================================================================
// types/reports.ts
// ============================================================================

// ── Shared ────────────────────────────────────────────────────────────────────

export type StockStatus = "ok" | "low" | "empty";

// ── Sold Products Report ─────────────────────────────────────────────────────

export interface SoldBatch {
  batchId: string;
  purchaseDate: string;
  buyingPrice: number;
  qtySold: number;
  revenue: number;
}

export interface SoldProduct {
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  totalQtySold: number;
  totalRevenue: number;
  batches: SoldBatch[];
}

export interface SoldReportSummary {
  totalProducts: number;
  totalUnitsSold: number;
  totalRevenue: number;
  date: string;
}

export interface SoldReportResponse {
  data: SoldProduct[];
  summary: SoldReportSummary;
}

// ── Stock Report ─────────────────────────────────────────────────────────────

export interface StockBatch {
  batchId: string;
  purchaseDate: string;
  buyingPrice: number;
  initialQuantity: number;
  quantityLeft: number;
  soldQuantity: number;
  endedAt: string | null;
  status: StockStatus;
}

export interface StockProduct {
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  lowStockThreshold: number;
  totalInitial: number;
  totalLeft: number;
  totalSold: number;
  stockStatus: StockStatus;
  batches: StockBatch[];
}

export interface StockReportSummary {
  totalProducts: number;
  totalUnitsLeft: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface StockReportResponse {
  data: StockProduct[];
  summary: StockReportSummary;
}

// ── API Query Params ─────────────────────────────────────────────────────────

export interface SoldReportParams {
  date: string;           // ISO date string YYYY-MM-DD
  categoryId?: string;    // optional filter
}

export interface StockReportParams {
  categoryId?: string;    // optional filter
}

// ── Category (for filter dropdown) ───────────────────────────────────────────

export interface CategoryOption {
  _id: string;
  name: string;
}