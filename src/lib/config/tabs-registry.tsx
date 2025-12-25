// lib/config/tabs-registry.tsx
// 'use client';

import dynamic from 'next/dynamic';
import { BarChart3, Package, Warehouse, Receipt, Tag, ShoppingCart, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Loading component
const LoadingSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gray-200 rounded w-64" />
    <div className="h-64 bg-gray-200 rounded" />
  </div>
);

// ============================================================================
// 🎯 SINGLE SOURCE OF TRUTH - ONLY EDIT THIS LIST TO ADD/REMOVE TABS
// ============================================================================
export const TABS_REGISTRY = {
  overview: {
    label: 'Overview',
    icon: BarChart3,
    component: dynamic(() => import('@/components/dashboard/tabs/overview-tab'), {
      loading: () => <LoadingSkeleton />,
    }),
  },
  categories: {
    label: 'Categories',
    icon: Tag,
    component: dynamic(() => import('@/components/dashboard/tabs/categories-tab'), {
      loading: () => <LoadingSkeleton />,
    }),
  },
  products: {
    label: 'Products',
    icon: Package,
    component: dynamic(() => import('@/components/dashboard/tabs/products-tab'), {
      loading: () => <LoadingSkeleton />,
    }),
  },
  subproducts: {
    label: 'Sub-Products',
    icon: Layers,
    component: dynamic(() => import('@/components/dashboard/tabs/subproducts-tab'), {
      loading: () => <LoadingSkeleton />,
    }),
  },
  // stocks: {
  //   label: 'Stocks',
  //   icon: Warehouse,
  //   component: dynamic(() => import('@/components/dashboard/tabs/stock-tab'), {
  //     loading: () => <LoadingSkeleton />,
  //   }),
  // },
  inventory: {
    label: 'Inventory',
    icon: Warehouse,
    component: dynamic(() => import('@/components/dashboard/tabs/inventory-tab'), {
      loading: () => <LoadingSkeleton />,
    }),
  },
  selling: {
    label: 'Selling',
    icon: ShoppingCart,
    component: dynamic(() => import('@/components/dashboard/tabs/selling-tab'), {
      loading: () => <LoadingSkeleton />,
    }),
  },
  'school-selling': {
    label: 'School Selling',
    icon: ShoppingCart,
    component: dynamic(() => import('@/components/dashboard/tabs/school-selling-tab'), {
      loading: () => <LoadingSkeleton />,
    }),
  },
  transactions: {
    label: 'Transactions',
    icon: Receipt,
    component: dynamic(() => import('@/components/dashboard/tabs/transactions-tab'), {
      loading: () => <LoadingSkeleton />,
    }),
  },
  students: {
    label: 'Students',
    icon: Package,
    component: dynamic(() => import('@/components/dashboard/tabs/student-management'), {
      loading: () => <LoadingSkeleton />,
    }),
  },
  users: {
    label: 'Users',
    icon: Package,
    component: dynamic(() => import('@/components/dashboard/tabs/users-tab'), {
      loading: () => <LoadingSkeleton />,
    }),
  },

} as const;

// ============================================================================
// Auto-generated types and helpers (DO NOT EDIT - Auto-updates from registry)
// ============================================================================

// Auto-generated type from registry keys
export type TabId = keyof typeof TABS_REGISTRY;

// Auto-generated array of all tab IDs
export const ALL_TAB_IDS = Object.keys(TABS_REGISTRY) as TabId[];

// Tab metadata interface
export interface TabInfo {
  id: TabId;
  label: string;
  icon: LucideIcon;
  component: React.ComponentType;
}

// Get tab info by ID
export function getTabInfo(tabId: TabId): TabInfo {
  const tab = TABS_REGISTRY[tabId];
  return {
    id: tabId,
    label: tab?.label,
    icon: tab?.icon,
    component: tab?.component,
  };
}

// Get all tabs that user has access to
export function getAccessibleTabs(allowedTabIds: TabId[]): TabInfo[] {
  return allowedTabIds.map(getTabInfo);
}

// Check if user has access to a tab
export function hasTabAccess(tabId: TabId, allowedTabIds: TabId[]): boolean {
  return allowedTabIds.includes(tabId);
}

// Helper to validate tab at runtime
export function isValidTab(tab: string): tab is TabId {
  return tab in TABS_REGISTRY;
}
