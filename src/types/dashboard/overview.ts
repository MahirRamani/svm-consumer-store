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
  size?: string;
  category: string;
  price: number;
  stock: number;
}

export interface TopSoldProduct {
  id: string;
  name: string;
  size?: string;
  quantitySold: number;
  revenue: number;
}

export interface TodaysSoldProduct {
  id: string;
  name: string;
  size?: string;
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

/** Product Data (Base Item - merged with SubProduct) */
export interface Product {
  _id: string;
  name: string;
  categoryId: string;
  isActive: boolean;
  // Merged from SubProduct
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  imageURL?: string;
  lowStockThreshold: number;
}

export type AnalyticsView = 'category' | 'product';

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

/** Low Balance Student Data */
export interface LowBalanceStudent {
  id: string;
  name: string;
  rollNumber: string;
  standard: string;
  balance: number;
  mobileNo?: string;
}

/** Highest Purchased Student Data */
export interface HighestPurchasedStudent {
  id: string;
  name: string;
  rollNumber: string;
  standard: string;
  totalPurchase: number;
  transactionCount: number;
}

/** Admin Dashboard Statistics (Full access) */
export interface AdminDashboardStats {
  // Common stats (available to all roles)
  lowStockCount: number;
  lowStockProducts: LowStockProduct[];
  lowBalanceCount: number;
  lowBalanceStudents: LowBalanceStudent[];
  topSoldProduct: TopSoldProduct | null;
  highestPurchasedStudent: HighestPurchasedStudent | null;
  
  // Admin-only stats
  totalSales: number;
  totalSalesChange: number;
  todaysSoldProducts: TodaysSoldProduct[];
  todaysProfit: number;
  todaysProfitMargin: number;
  yesterdayProfit: number;
}

/** Seller Dashboard Statistics (Limited access) */
export interface SellerDashboardStats {
  lowStockCount: number;
  lowStockProducts: LowStockProduct[];
  lowBalanceCount: number;
  lowBalanceStudents: LowBalanceStudent[];
  topSoldProduct: TopSoldProduct | null;
  highestPurchasedStudent: HighestPurchasedStudent | null;
}

/** 
 * Combined Dashboard Stats Type 
 * The API returns different structures based on user role
 */
export type DashboardStatsResponse = AdminDashboardStats | SellerDashboardStats;

/**
 * Type guard to check if stats are admin stats
 */
export function isAdminStats(stats: DashboardStatsResponse): stats is AdminDashboardStats {
  return 'totalSales' in stats && 'todaysProfit' in stats;
}






// // types/dashboard.ts

// /** Base API Response Structure (matching your backend) */
// export interface ApiResponse<T> {
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

// /** Dashboard Statistics */
// export interface DashboardStats {
//   totalSales: number;
//   totalSalesChange: number;
//   lowStockCount: number;
//   lowStockProducts: LowStockProduct[];
//   topSoldProduct: TopSoldProduct | null;
//   todaysSoldProducts: TodaysSoldProduct[];
//   todaysProfit: number;
//   todaysProfitMargin: number;
//   yesterdayProfit: number;
// }

// export interface LowStockProduct {
//   id: string;
//   name: string;
//   category: string;
//   price: number;
//   stock: number;
// }

// export interface TopSoldProduct {
//   id: string;
//   name: string;
//   quantitySold: number;
//   revenue: number;
// }

// export interface TodaysSoldProduct {
//   id: string;
//   name: string;
//   quantity: number;
//   revenue: number;
// }

// /** Profit/Loss Chart Data */
// export interface ProfitLossDataPoint {
//   date: string;
//   totalSales: number;
//   totalCost: number;
//   profit: number;
// }

// /** Analytics Chart Data */
// export interface AnalyticsDataPoint {
//   _id: string;
//   name: string;
//   sales: number;
//   quantity: number;
// }

// /** Category Data */
// export interface Category {
//   _id: string;
//   name: string;
//   description?: string;
//   isActive: boolean;
// }

// /** Product Data */
// export interface Product {
//   _id: string;
//   name: string;
//   categoryId: string;
//   isActive: boolean;
// }

// export type AnalyticsView = 'category' | 'product' | 'subproduct';

// /** Chart Tooltip Props */
// export interface TooltipPayload {
//   value: number;
//   name: string;
//   color: string;
//   dataKey: string;
// }

// export interface CustomTooltipProps {
//   active?: boolean;
//   payload?: TooltipPayload[];
//   label?: string;
// }



// // types/dashboard.ts
// // ADD THESE NEW TYPES TO YOUR EXISTING FILE

// /** Low Balance Student Data */
// export interface LowBalanceStudent {
//   id: string;
//   name: string;
//   rollNumber: string;
//   standard: string;
//   balance: number;
//   mobileNo?: string;
// }

// /** Highest Purchased Student Data */
// export interface HighestPurchasedStudent {
//   id: string;
//   name: string;
//   rollNumber: string;
//   standard: string;
//   totalPurchase: number;
//   transactionCount: number;
// }

// /** Admin Dashboard Statistics (Full access) */
// export interface AdminDashboardStats {
//   // Common stats (available to all roles)
//   lowStockCount: number;
//   lowStockProducts: LowStockProduct[];
//   lowBalanceCount: number;
//   lowBalanceStudents: LowBalanceStudent[];
//   topSoldProduct: TopSoldProduct | null;
//   highestPurchasedStudent: HighestPurchasedStudent | null;
  
//   // Admin-only stats
//   totalSales: number;
//   totalSalesChange: number;
//   todaysSoldProducts: TodaysSoldProduct[];
//   todaysProfit: number;
//   todaysProfitMargin: number;
//   yesterdayProfit: number;
// }

// /** Seller Dashboard Statistics (Limited access) */
// export interface SellerDashboardStats {
//   lowStockCount: number;
//   lowStockProducts: LowStockProduct[];
//   lowBalanceCount: number;
//   lowBalanceStudents: LowBalanceStudent[];
//   topSoldProduct: TopSoldProduct | null;
//   highestPurchasedStudent: HighestPurchasedStudent | null;
// }

// /** 
//  * Combined Dashboard Stats Type 
//  * The API returns different structures based on user role
//  */
// export type DashboardStatsResponse = AdminDashboardStats | SellerDashboardStats;

// /**
//  * Type guard to check if stats are admin stats
//  */
// export function isAdminStats(stats: DashboardStatsResponse): stats is AdminDashboardStats {
//   return 'totalSales' in stats && 'todaysProfit' in stats;
// }

// // NOTE: Your existing DashboardStats interface can be kept for backward compatibility
// // or you can replace it with DashboardStatsResponse based on your needs