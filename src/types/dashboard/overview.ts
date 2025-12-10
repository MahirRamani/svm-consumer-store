// types/dashboard.ts

/** Base API Response Structure (matching your backend) */
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: {
    page?: number;
    limit?: number;
    totalCount?: number;
    totalPages?: number;
  };
}

/** Dashboard Statistics */
export interface DashboardStats {
  totalSales: number;
  totalSalesChange: number;
  lowStockCount: number;
  lowStockProducts: LowStockProduct[];
  topSoldProduct: TopSoldProduct | null;
  todaysSoldProducts: TodaysSoldProduct[];
  todaysProfit: number;
  todaysProfitMargin: number;
  yesterdayProfit: number;
}

export interface LowStockProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

export interface TopSoldProduct {
  id: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

export interface TodaysSoldProduct {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

/** Profit/Loss Chart Data */
export interface ProfitLossDataPoint {
  date: string;
  totalSales: number;
  totalCost: number;
  profit: number;
}

/** Analytics Chart Data */
export interface AnalyticsDataPoint {
  _id: string;
  name: string;
  sales: number;
  quantity: number;
}

/** Category Data */
export interface Category {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

/** Product Data */
export interface Product {
  _id: string;
  name: string;
  categoryId: string;
  isActive: boolean;
}

export type AnalyticsView = 'category' | 'product' | 'subproduct';

/** Chart Tooltip Props */
export interface TooltipPayload {
  value: number;
  name: string;
  color: string;
  dataKey: string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}