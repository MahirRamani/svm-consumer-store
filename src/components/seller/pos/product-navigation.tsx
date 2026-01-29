// components/admin/pos/product-navigation.tsx
"use client";

import { useState, useCallback, useMemo, useEffect, JSX } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Package,
  AlertTriangle,
  ShoppingCart,
  Plus,
  Minus,
  RefreshCw,
  Loader2,
  Home,
  ChevronRight,
  Layers,
  Search,
  X,
  TrendingUp,
  Flame,
  RefreshCcw,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import type {
  ApiResponse,
  CartItem,
  Product,
  StockInfo,
  ProductsInventoryResponse,
  StockFIFOResponse,
  CategoryRef,
  SearchResult,
} from "@/types/pos";
import type { Category, CategoriesResponse } from "@/types/category";

// =============================================
// Types
// =============================================
type NavigationView = "categories" | "products";

interface NavigationState {
  view: NavigationView;
  selectedCategory: Category | null;
}

interface ProductNavigationProps {
  onAddToCart: (item: CartItem) => void;
  cartItems: CartItem[];
  resetTrigger?: number;
}

interface TopSellingProduct {
  productId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  size?: string;
  imageURL?: string;
  totalQuantitySold: number;
  totalRevenue: number;
  transactionCount: number;
  isActive: boolean;
  lowStockThreshold: number;
}

interface TopSellingResponse {
  products: TopSellingProduct[];
  totalCount: number;
  period: string;
}

// =============================================
// Custom Hook for Debounce
// =============================================
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// =============================================
// Helper Functions
// =============================================
function isCategoryRef(
  categoryId: CategoryRef | string | null | undefined
): categoryId is CategoryRef {
  return (
    categoryId !== null &&
    categoryId !== undefined &&
    typeof categoryId === "object" &&
    "_id" in categoryId
  );
}

function extractCategoryId(
  categoryId: CategoryRef | string | null | undefined
): string | null {
  if (!categoryId) return null;
  if (typeof categoryId === "string") return categoryId;
  if (isCategoryRef(categoryId)) return categoryId._id;
  return null;
}

function extractCategoryName(
  categoryId: CategoryRef | string | null | undefined
): string | null {
  if (isCategoryRef(categoryId)) return categoryId.name;
  return null;
}

// Highlight matching text
function highlightMatch(text: string, query: string): JSX.Element {
  if (!query.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <mark key={index} className="bg-yellow-200 text-gray-900 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

// =============================================
// Component
// =============================================
export default function ProductNavigation({
  onAddToCart,
  cartItems,
  resetTrigger = 0,
}: ProductNavigationProps): JSX.Element {
  const queryClient = useQueryClient();

  const [navigation, setNavigation] = useState<NavigationState>({
    view: "categories",
    selectedCategory: null,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());
  const [isRefreshingAllStocks, setIsRefreshingAllStocks] = useState(false);

  // Debounced search term (200ms delay for fast response)
  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  // Track if we're in search mode
  const isSearchMode = debouncedSearchTerm.trim().length >= 2;

  useEffect(() => {
    if (resetTrigger > 0) {
      // Reset navigation to categories view
      setNavigation({ view: "categories", selectedCategory: null });
      // Clear all selection states
      setSelectedProductIds({});
      setQuantities({});
      setSearchTerm("");
      setEditingProductId(null);
      setEditingValue("");
    }
  }, [resetTrigger]);
  // =============================================
  // Data Fetching
  // =============================================
  const { data: productsResponse, isLoading: productsLoading } = useQuery<
    ApiResponse<ProductsInventoryResponse>,
    Error
  >({
    queryKey: ["products-inventory"],
    queryFn: async () => {
      const response = await fetch("/api/products?includeInactive=false");
      if (!response.ok) throw new Error("Failed to fetch products");
      const data: ApiResponse<ProductsInventoryResponse> = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch products");
      }
      return data;
    },
  });

  const { data: categoriesResponse, isLoading: categoriesLoading } = useQuery<
    ApiResponse<CategoriesResponse>,
    Error
  >({
    queryKey: ["categories-active"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data: ApiResponse<CategoriesResponse> = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch categories");
      }
      return data;
    },
  });

  const { data: stocksResponse, isLoading: stocksLoading } = useQuery<ApiResponse<StockFIFOResponse>, Error>({
    queryKey: ["fifo-stocks"],
    queryFn: async () => {
      const response = await fetch("/api/stock/fifo/oldest-all");
      if (!response.ok) throw new Error("Failed to fetch stocks");
      const data: ApiResponse<StockFIFOResponse> = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch stocks");
      }
      return data;
    },
    enabled: !!productsResponse,
    staleTime: 0,
  });

  const { data: topSellingResponse, isLoading: topSellingLoading } = useQuery<
    ApiResponse<TopSellingResponse>,
    Error
  >({
    queryKey: ["top-selling-products"],
    queryFn: async () => {
      const response = await fetch("/api/products/top-selling?limit=20&period=all");
      if (!response.ok) throw new Error("Failed to fetch top selling products");
      const data: ApiResponse<TopSellingResponse> = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch top selling products");
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // =============================================
  // Memoized Data
  // =============================================
  const productStocks = useMemo((): Map<string, StockInfo> => {
    const stocksMap = new Map<string, StockInfo>();
    if (stocksResponse?.data?.data) {
      stocksResponse.data.data.forEach((item) => {
        if (item.currentStock) {
          stocksMap.set(item.productId, item.currentStock);
        }
      });
    }
    return stocksMap;
  }, [stocksResponse]);

  const categories = useMemo((): Category[] => {
    return categoriesResponse?.data?.categories?.filter((cat) => cat.isActive) || [];
  }, [categoriesResponse]);

  const topSellingProducts = useMemo((): TopSellingProduct[] => {
    return topSellingResponse?.data?.products || [];
  }, [topSellingResponse]);

  const getCategoryNameById = useCallback(
    (categoryId: string | null): string => {
      if (!categoryId) return "Uncategorized";
      const category = categories.find((cat) => cat._id === categoryId);
      return category?.name || "Uncategorized";
    },
    [categories]
  );

  const getCategoryById = useCallback(
    (categoryId: string | null): Category | null => {
      if (!categoryId) return null;
      return categories.find((cat) => cat._id === categoryId) || null;
    },
    [categories]
  );

  const products = useMemo((): Product[] => {
    if (!productsResponse?.data?.products) return [];
    return productsResponse.data.products
      .filter((product) => product.isActive)
      .map((product): Product => {
        const categoryName =
          extractCategoryName(product.categoryId) ||
          getCategoryNameById(extractCategoryId(product.categoryId));
        return {
          ...product,
          categoryName,
          currentStock: productStocks.get(product._id) || null,
        };
      });
  }, [productsResponse, productStocks, getCategoryNameById]);

  const categoryProducts = useMemo((): Product[] => {
    if (!navigation.selectedCategory) return [];
    return products.filter((product) => {
      const productCategoryId = extractCategoryId(product.categoryId);
      return productCategoryId === navigation.selectedCategory?._id;
    });
  }, [products, navigation.selectedCategory]);

  const getProductCount = useCallback(
    (categoryId: string): number => {
      return products.filter((product) => {
        const productCategoryId = extractCategoryId(product.categoryId);
        return productCategoryId === categoryId;
      }).length;
    },
    [products]
  );

  const getProductsInStockCount = useCallback(
    (categoryId: string): number => {
      return products.filter((product) => {
        const productCategoryId = extractCategoryId(product.categoryId);
        return productCategoryId === categoryId && productStocks.has(product._id);
      }).length;
    },
    [products, productStocks]
  );

  // =============================================
  // Live Search Results
  // =============================================
  const searchResults = useMemo(() => {
    if (!isSearchMode) return { categories: [], products: [] };
    
    const term = debouncedSearchTerm.toLowerCase().trim();
    
    // Search categories
    const matchedCategories = categories.filter((category) =>
      category.name.toLowerCase().includes(term)
    );

    // Search products
    const matchedProducts = products.filter((product) =>
      product.name.toLowerCase().includes(term) ||
      product.description?.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term) ||
      product.size?.toLowerCase().includes(term)
    );

    return {
      categories: matchedCategories,
      products: matchedProducts,
    };
  }, [debouncedSearchTerm, isSearchMode, categories, products]);

  // =============================================
  // Refresh All Stocks Handler
  // =============================================
  const handleRefreshAllStocks = useCallback(async () => {
    setIsRefreshingAllStocks(true);
    try {
      const response = await fetch("/api/stock/fifo/oldest-all");
      if (!response.ok) throw new Error("Failed to refresh stocks");
      
      const data: ApiResponse<StockFIFOResponse> = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to refresh stocks");
      }

      queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(["fifo-stocks"], data);
      toast.success(`Stock data refreshed! ${data.data.summary?.withStock || 0} products with stock.`);
    } catch (error) {
      console.error("Error refreshing all stocks:", error);
      toast.error("Failed to refresh stock data");
    } finally {
      setIsRefreshingAllStocks(false);
    }
  }, [queryClient]);

  // =============================================
  // Search Handlers
  // =============================================
  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      clearSearch();
    }
  }, [clearSearch]);

  // =============================================
  // Navigation Handlers
  // =============================================
  const navigateToCategories = useCallback(() => {
    setNavigation({ view: "categories", selectedCategory: null });
    setSelectedProductIds({});
    setQuantities({});
    setSearchTerm("");
  }, []);

  const navigateToProducts = useCallback((category: Category) => {
    setNavigation({ view: "products", selectedCategory: category });
    setSelectedProductIds({});
    setQuantities({});
    setSearchTerm("");
  }, []);

  const navigateToCategoryFromProduct = useCallback(
    (categoryId: string) => {
      const category = getCategoryById(categoryId);
      if (category) {
        navigateToProducts(category);
      }
    },
    [getCategoryById, navigateToProducts]
  );

  // =============================================
  // Stock Management
  // =============================================
  const refreshStockForProduct = useCallback(
    async (productId: string): Promise<void> => {
      setRefreshingStocks((prev) => new Set(prev).add(productId));
      try {
        const response = await fetch(`/api/stock/fifo/oldest-single?productId=${productId}`);
        if (response.ok) {
          const result: ApiResponse<StockInfo> = await response.json();
          queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(["fifo-stocks"], (oldData) => {
            if (!oldData?.data?.data) return oldData;
            const stocksArray = [...oldData.data.data];
            const index = stocksArray.findIndex((item) => item.productId === productId);
            if (result.success && result.data) {
              const newItem = { productId, currentStock: result.data };
              if (index >= 0) stocksArray[index] = newItem;
              else stocksArray.push(newItem);
              toast.success("Stock refreshed");
            } else {
              if (index >= 0) stocksArray.splice(index, 1);
              toast.info("No stock available");
            }
            return { ...oldData, data: { ...oldData.data, data: stocksArray } };
          });
        }
      } catch (error) {
        console.error("Error refreshing stock:", error);
        toast.error("Failed to refresh stock");
      } finally {
        setRefreshingStocks((prev) => {
          const updated = new Set(prev);
          updated.delete(productId);
          return updated;
        });
      }
    },
    [queryClient]
  );

  const updateStockInCache = useCallback(
    (productId: string, quantityReduced: number): void => {
      queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(["fifo-stocks"], (oldData) => {
        if (!oldData?.data?.data) return oldData;
        const stocksArray = [...oldData.data.data];
        const index = stocksArray.findIndex((item) => item.productId === productId);
        if (index >= 0 && stocksArray[index].currentStock) {
          const currentStock = stocksArray[index].currentStock!;
          const newQuantity = currentStock.quantityLeft - quantityReduced;
          if (newQuantity <= 0) stocksArray.splice(index, 1);
          else stocksArray[index] = { 
            ...stocksArray[index], 
            currentStock: { ...currentStock, quantityLeft: newQuantity } 
          };
        }
        return { ...oldData, data: { ...oldData.data, data: stocksArray } };
      });
    },
    [queryClient]
  );

  // =============================================
  // Cart Handlers
  // =============================================
  const handleInitialAddToCart = useCallback((productId: string): void => {
    setSelectedProductIds((prev) => ({ ...prev, [productId]: true }));
    setQuantities((prev) => ({ ...prev, [productId]: 1 }));
  }, []);

  const handleQuantityChange = useCallback((productId: string, newQuantity: number, maxStock: number): void => {
    if (newQuantity < 1) {
      setQuantities((prev) => ({ ...prev, [productId]: 1 }));
      return;
    }
    if (newQuantity > maxStock) {
      toast.error(`Only ${maxStock} units available`);
      setQuantities((prev) => ({ ...prev, [productId]: maxStock }));
      return;
    }
    setQuantities((prev) => ({ ...prev, [productId]: newQuantity }));
  }, []);

  const handleQuantityClick = useCallback((productId: string, currentQuantity: number): void => {
    setEditingProductId(productId);
    setEditingValue(currentQuantity.toString());
  }, []);

  const handleManualQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) setEditingValue(value);
  }, []);

  const handleQuantityBlur = useCallback(
    (productId: string, maxStock: number): void => {
      const newQuantity = parseInt(editingValue, 10) || 1;
      if (newQuantity < 1) {
        toast.error("Quantity must be at least 1");
        setQuantities((prev) => ({ ...prev, [productId]: 1 }));
      } else if (newQuantity > maxStock) {
        toast.error(`Only ${maxStock} units available`);
        setQuantities((prev) => ({ ...prev, [productId]: maxStock }));
      } else {
        setQuantities((prev) => ({ ...prev, [productId]: newQuantity }));
      }
      setEditingProductId(null);
      setEditingValue("");
    },
    [editingValue]
  );

  const handleQuantityKeyDown = useCallback(
    (e: React.KeyboardEvent, productId: string, maxStock: number): void => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleQuantityBlur(productId, maxStock);
      } else if (e.key === "Escape") {
        setEditingProductId(null);
        setEditingValue("");
      }
    },
    [handleQuantityBlur]
  );

  const handleFinalAddToCart = useCallback(
    (product: Product): void => {
      const stockInfo = productStocks.get(product._id);
      if (!stockInfo) {
        toast.error("No stock information available");
        return;
      }
      const quantity = quantities[product._id] || 1;
      updateStockInCache(product._id, quantity);
      
      const categoryId = extractCategoryId(product.categoryId);
      
      const cartItem: CartItem = {
        itemKey: `prod:${product._id}`,
        productId: product._id,
        categoryId: categoryId || undefined,
        name: product.name,
        size: product.size,
        price: stockInfo.sellingPrice,
        quantity,
        stock: stockInfo.quantityLeft,
        stockTransactionId: stockInfo.stockTransactionId,
        imageURL: product.imageURL,
      };
      
      onAddToCart(cartItem);
      toast.success(`${quantity} × ${product.name} added to cart`);
      setSelectedProductIds((prev) => ({ ...prev, [product._id]: false }));
      setQuantities((prev) => ({ ...prev, [product._id]: 1 }));
    },
    [quantities, productStocks, updateStockInCache, onAddToCart]
  );

  const handleFinalAddTopProductToCart = useCallback(
    (topProduct: TopSellingProduct): void => {
      const stockInfo = productStocks.get(topProduct.productId);
      if (!stockInfo) {
        toast.error("No stock available for this product");
        return;
      }
      
      const quantity = quantities[topProduct.productId] || 1;
      updateStockInCache(topProduct.productId, quantity);
      
      const cartItem: CartItem = {
        itemKey: `prod:${topProduct.productId}`,
        productId: topProduct.productId,
        categoryId: topProduct.categoryId || undefined,
        name: topProduct.name,
        size: topProduct.size,
        price: stockInfo.sellingPrice,
        quantity,
        stock: stockInfo.quantityLeft,
        stockTransactionId: stockInfo.stockTransactionId,
        imageURL: topProduct.imageURL,
      };
      
      onAddToCart(cartItem);
      toast.success(`${quantity} × ${topProduct.name} added to cart`);
      setSelectedProductIds((prev) => ({ ...prev, [topProduct.productId]: false }));
      setQuantities((prev) => ({ ...prev, [topProduct.productId]: 1 }));
    },
    [quantities, productStocks, updateStockInCache, onAddToCart]
  );

  // =============================================
  // Helper Functions
  // =============================================
  const hasLowStock = useCallback(
    (product: Product): boolean => {
      const stockInfo = productStocks.get(product._id);
      if (!stockInfo) return true;
      return stockInfo.quantityLeft <= (product.lowStockThreshold || 5);
    },
    [productStocks]
  );

  const hasLowStockForTopProduct = useCallback(
    (topProduct: TopSellingProduct): boolean => {
      const stockInfo = productStocks.get(topProduct.productId);
      if (!stockInfo) return true;
      return stockInfo.quantityLeft <= (topProduct.lowStockThreshold || 5);
    },
    [productStocks]
  );

  const isOutOfStock = useCallback(
    (productId: string): boolean => {
      const stockInfo = productStocks.get(productId);
      return !stockInfo || stockInfo.quantityLeft <= 0;
    },
    [productStocks]
  );

  const isProductInCart = useCallback(
    (productId: string): boolean => {
      return cartItems.some((item) => item.productId === productId);
    },
    [cartItems]
  );

  const getCartQuantity = useCallback(
    (productId: string): number => {
      const cartItem = cartItems.find((item) => item.productId === productId);
      return cartItem?.quantity || 0;
    },
    [cartItems]
  );

  // =============================================
  // Loading State
  // =============================================
  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600 text-sm">Loading...</span>
      </div>
    );
  }

  // =============================================
  // Render In Cart Badge Component
  // =============================================
  const renderInCartBadge = (productId: string) => {
    const inCart = isProductInCart(productId);
    const cartQty = getCartQuantity(productId);
    
    if (!inCart) return null;
    
    return (
      <div className="absolute top-1.5 left-1.5 z-10">
        <Badge className="bg-blue-500 text-white text-xs px-1.5 py-0.5 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {cartQty} in cart
        </Badge>
      </div>
    );
  };

  // =============================================
  // Render Product Card (Reusable)
  // =============================================
  const renderProductCard = (product: Product, showCategory: boolean = false) => {
    const stockInfo = productStocks.get(product._id);
    const outOfStock = !stockInfo || stockInfo.quantityLeft <= 0;
    const lowStock = hasLowStock(product);
    const inCart = isProductInCart(product._id);
    const isRefreshing = refreshingStocks.has(product._id);
    const isActive = selectedProductIds[product._id] ?? false;
    const quantity = quantities[product._id] || 1;
    const isEditing = editingProductId === product._id;

    return (
      <div
        key={product._id}
        className={`relative bg-white border-2 rounded-lg overflow-hidden transition-all hover:shadow-md ${
          inCart 
            ? "border-blue-300 bg-blue-50" 
            : outOfStock 
              ? "border-gray-200 opacity-60" 
              : lowStock 
                ? "border-orange-200" 
                : "border-green-200"
        }`}
      >
        {renderInCartBadge(product._id)}

        <div className="relative h-24 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
          {product.imageURL ? (
            <img 
              src={product.imageURL} 
              alt={product.name}
              className={`w-full h-full object-cover ${outOfStock ? 'grayscale' : ''}`}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const nextSibling = e.currentTarget.nextElementSibling;
                if (nextSibling) nextSibling.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`flex items-center justify-center ${product.imageURL ? 'hidden' : ''}`}>
            <Package className="w-10 h-10 text-gray-300" />
          </div>

          {stockInfo && (
            <Badge 
              variant={lowStock ? "destructive" : "default"} 
              className={`absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 ${
                lowStock ? "bg-orange-500" : "bg-green-500"
              }`}
            >
              {stockInfo.quantityLeft}
            </Badge>
          )}

          {product.size && !inCart && (
            <Badge variant="outline" className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5 bg-white">
              {product.size}
            </Badge>
          )}

          {outOfStock && (
            <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
              <Badge variant="secondary" className="text-xs">Out of Stock</Badge>
            </div>
          )}

          {/* View in Category Button (for search results) */}
          {showCategory && (
            <Button
              onClick={(e) => { 
                e.stopPropagation(); 
                const categoryId = extractCategoryId(product.categoryId);
                if (categoryId) navigateToCategoryFromProduct(categoryId);
              }}
              variant="ghost"
              size="sm"
              className="absolute bottom-1.5 left-1.5 h-6 w-6 p-0 bg-white/80 hover:bg-white"
              title="View in Category"
            >
              <Eye className="w-3 h-3 text-blue-600" />
            </Button>
          )}

          <Button
            onClick={(e) => { e.stopPropagation(); refreshStockForProduct(product._id); }}
            disabled={isRefreshing}
            variant="ghost"
            size="sm"
            className="absolute bottom-1.5 right-1.5 h-6 w-6 p-0 bg-white/80 hover:bg-white"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="p-2">
          <h4 className="font-medium text-gray-900 text-sm line-clamp-1 mb-0.5">
            {isSearchMode ? highlightMatch(product.name, debouncedSearchTerm) : product.name}
          </h4>
          
          {showCategory && (
            <button
              onClick={() => {
                const categoryId = extractCategoryId(product.categoryId);
                if (categoryId) navigateToCategoryFromProduct(categoryId);
              }}
              className="text-xs text-blue-500 hover:text-blue-600 hover:underline line-clamp-1 mb-1"
            >
              {product.categoryName}
            </button>
          )}

          {product.size && (
            <Badge variant="outline" className="text-xs px-1 py-0 mb-1">{product.size}</Badge>
          )}

          <div className="flex items-center justify-between mb-1.5">
            {stockInfo ? (
              // <span className="text-sm font-bold text-green-600">₹{stockInfo.sellingPrice}</span>
              <span className="text-sm font-bold text-green-600">₹{Number(stockInfo.sellingPrice).toFixed(0)}</span>
            ) : (
              <span className="text-xs text-gray-400">No price</span>
            )}
            {lowStock && !outOfStock && <AlertTriangle className="w-4 h-4 text-orange-500" />}
          </div>

          {!outOfStock ? (
            !isActive ? (
              <Button 
                onClick={() => handleInitialAddToCart(product._id)} 
                size="sm" 
                className="w-full h-7 text-xs bg-green-500 hover:bg-green-600"
              >
                <ShoppingCart className="w-3 h-3 mr-1" />
                Add to Cart
              </Button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-1">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleQuantityChange(product._id, quantity - 1, stockInfo!.quantityLeft)} 
                    disabled={quantity <= 1} 
                    className="h-6 w-6 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={editingValue}
                      onChange={handleManualQuantityChange}
                      onBlur={() => handleQuantityBlur(product._id, stockInfo!.quantityLeft)}
                      onKeyDown={(e) => handleQuantityKeyDown(e, product._id, stockInfo!.quantityLeft)}
                      className="w-10 h-6 text-center text-xs p-0"
                      autoFocus
                    />
                  ) : (
                    <span 
                      onClick={() => handleQuantityClick(product._id, quantity)} 
                      className="w-8 text-center font-medium text-xs cursor-pointer hover:bg-gray-100 rounded py-1"
                    >
                      {quantity}
                    </span>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleQuantityChange(product._id, quantity + 1, stockInfo!.quantityLeft)} 
                    disabled={quantity >= stockInfo!.quantityLeft} 
                    className="h-6 w-6 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button 
                  onClick={() => handleFinalAddToCart(product)} 
                  size="sm" 
                  className="w-full h-7 text-xs bg-green-500 hover:bg-green-600"
                >
                  <ShoppingCart className="w-3 h-3 mr-1" />
                  Add {quantity}
                </Button>
              </div>
            )
          ) : (
            <Button 
              disabled 
              size="sm" 
              className="w-full h-7 text-xs"
            >
              Out of Stock
            </Button>
          )}
        </div>
      </div>
    );
  };

  // =============================================
  // Render Breadcrumb with Search
  // =============================================
  const renderBreadcrumb = () => (
    <Card className="mb-1 p-4">
      <CardContent className="py-0 px-4">
        <div className="flex items-center justify-between gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink 
                  onClick={navigateToCategories} 
                  className="flex items-center cursor-pointer hover:text-blue-600 text-sm font-medium"
                >
                  <Home className="w-4 h-4 mr-1" />
                  Categories
                </BreadcrumbLink>
              </BreadcrumbItem>
              {!isSearchMode && navigation.selectedCategory && (
                <>
                  <BreadcrumbSeparator><ChevronRight className="w-4 h-4" /></BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="flex items-center font-semibold text-sm">
                      <Layers className="w-4 h-4 mr-1" />
                      {navigation.selectedCategory.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
              {isSearchMode && (
                <>
                  <BreadcrumbSeparator><ChevronRight className="w-4 h-4" /></BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="flex items-center font-semibold text-sm">
                      <Search className="w-4 h-4 mr-1" />
                      Search: "{debouncedSearchTerm}" ({searchResults.categories.length + searchResults.products.length} results)
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-2">
            {/* Refresh All Stocks Button */}
            <Button
              onClick={handleRefreshAllStocks}
              disabled={isRefreshingAllStocks || stocksLoading}
              variant="outline"
              size="sm"
              className="h-9 px-3 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
            >
              {isRefreshingAllStocks ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-4 h-4 mr-1.5" />
                  Refresh Stocks
                </>
              )}
            </Button>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Type to search... (min 2 chars)"
                value={searchTerm}
                onChange={handleSearchInputChange}
                onKeyDown={handleSearchKeyDown}
                className="pl-9 pr-8 h-9 text-sm w-72"
                autoComplete="off"
              />
              {searchTerm && (
                <button 
                  onClick={clearSearch} 
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // =============================================
  // Render Live Search Results (Inline)
  // =============================================
  const renderSearchResults = () => {
    const { categories: matchedCategories, products: matchedProducts } = searchResults;
    const totalResults = matchedCategories.length + matchedProducts.length;

    if (totalResults === 0) {
      return (
        <div className="text-center py-16">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
          <p className="text-gray-500 mb-4">
            No products or categories match "{debouncedSearchTerm}"
          </p>
          <Button variant="outline" onClick={clearSearch}>
            <X className="w-4 h-4 mr-2" />
            Clear Search
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Matched Categories */}
        {matchedCategories.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Categories ({matchedCategories.length})
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {matchedCategories.map((category) => {
                const productCount = getProductCount(category._id);
                const inStockCount = getProductsInStockCount(category._id);
                
                return (
                  <div
                    key={category._id}
                    onClick={() => navigateToProducts(category)}
                    className="cursor-pointer bg-white border-2 border-blue-200 rounded-lg p-3 hover:shadow-md hover:border-blue-400 transition-all text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-1">
                      {highlightMatch(category.name, debouncedSearchTerm)}
                    </h3>
                    <p className="text-xs text-gray-500">{productCount} products</p>
                    <Badge 
                      variant={inStockCount > 0 ? "default" : "secondary"} 
                      className={`text-xs mt-1 ${inStockCount > 0 ? "bg-green-500" : ""}`}
                    >
                      {inStockCount} in stock
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Matched Products */}
        {matchedProducts.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              Products ({matchedProducts.length})
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {matchedProducts.map((product) => renderProductCard(product, true))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // =============================================
  // Render Top Selling Products Section
  // =============================================
  const renderTopSellingProducts = () => {
    if (topSellingLoading) {
      return (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-bold text-gray-900">Top Selling Products</h3>
          </div>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span className="ml-2 text-gray-500 text-sm">Loading top products...</span>
          </div>
        </div>
      );
    }

    if (topSellingProducts.length === 0) {
      return null;
    }

    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Top Selling Products</h3>
              <p className="text-xs text-gray-500">Most popular items of all time</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
            <TrendingUp className="w-3 h-3 mr-1" />
            Top {topSellingProducts.length}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-1">
          {topSellingProducts.map((topProduct, index) => {
            const stockInfo = productStocks.get(topProduct.productId);
            const outOfStock = !stockInfo || stockInfo.quantityLeft <= 0;
            const lowStock = hasLowStockForTopProduct(topProduct);
            const inCart = isProductInCart(topProduct.productId);
            const isRefreshing = refreshingStocks.has(topProduct.productId);
            const isActive = selectedProductIds[topProduct.productId] ?? false;
            const quantity = quantities[topProduct.productId] || 1;
            const isEditing = editingProductId === topProduct.productId;

            return (
              <div
                key={topProduct.productId}
                className={`relative bg-white border-2 rounded-lg overflow-hidden transition-all hover:shadow-md ${
                  inCart 
                    ? "border-blue-300 bg-blue-50" 
                    : outOfStock 
                      ? "border-gray-200 opacity-60" 
                      : lowStock 
                        ? "border-orange-200" 
                        : "border-gray-200 hover:border-orange-300"
                }`}
              >
                {renderInCartBadge(topProduct.productId)}

                {!inCart && (
                  <div className="absolute top-1.5 left-1.5 z-10">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index < 3 
                        ? "bg-gradient-to-br from-yellow-400 to-orange-500" 
                        : "bg-gray-400"
                    }`}>
                      {index + 1}
                    </div>
                  </div>
                )}

                <div className="relative h-24 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                  {topProduct.imageURL ? (
                    <img 
                      src={topProduct.imageURL} 
                      alt={topProduct.name}
                      className={`w-full h-full object-cover ${outOfStock ? 'grayscale' : ''}`}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const nextSibling = e.currentTarget.nextElementSibling;
                        if (nextSibling) nextSibling.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`flex items-center justify-center ${topProduct.imageURL ? 'hidden' : ''}`}>
                    <Package className="w-8 h-8 text-gray-300" />
                  </div>

                  {stockInfo && (
                    <Badge 
                      variant={lowStock ? "destructive" : "default"} 
                      className={`absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 ${
                        lowStock ? "bg-orange-500" : "bg-green-500"
                      }`}
                    >
                      {stockInfo.quantityLeft}
                    </Badge>
                  )}

                  {outOfStock && (
                    <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
                      <Badge variant="secondary" className="text-xs">Out of Stock</Badge>
                    </div>
                  )}

                  <Button
                    onClick={(e) => { e.stopPropagation(); refreshStockForProduct(topProduct.productId); }}
                    disabled={isRefreshing}
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-1.5 right-1.5 h-5 w-5 p-0 bg-white/80 hover:bg-white"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                  </Button>
                </div>

                <div className="p-2">
                  <h4 className="font-medium text-gray-900 text-xs line-clamp-1 mb-0.5">{topProduct.name}</h4>
                  
                  <button
                    onClick={() => navigateToCategoryFromProduct(topProduct.categoryId)}
                    className="text-xs text-blue-500 hover:text-blue-600 hover:underline text-left mb-1"
                  >
                    {topProduct.categoryName}
                  </button>

                  {topProduct.size && (
                    <Badge variant="outline" className="text-xs px-1 py-0 mb-1">{topProduct.size}</Badge>
                  )}

                  <div className="flex items-center justify-between mb-1.5">
                    {stockInfo ? (
                      // <span className="text-sm font-bold text-green-600">₹{stockInfo.sellingPrice}</span>
                      <span className="text-sm font-bold text-green-600">₹{Number(stockInfo.sellingPrice).toFixed(0)}</span>
                    ) : (
                      <span className="text-xs text-gray-400">No price</span>
                    )}
                    <span className="text-xs text-gray-400">{topProduct.totalQuantitySold} sold</span>
                  </div>

                  {!outOfStock ? (
                    !isActive ? (
                      <Button 
                        onClick={() => handleInitialAddToCart(topProduct.productId)} 
                        size="sm" 
                        className="w-full h-7 text-xs bg-orange-500 hover:bg-orange-600"
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Add to Cart
                      </Button>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleQuantityChange(topProduct.productId, quantity - 1, stockInfo!.quantityLeft)} 
                            disabled={quantity <= 1} 
                            className="h-6 w-6 p-0"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={editingValue}
                              onChange={handleManualQuantityChange}
                              onBlur={() => handleQuantityBlur(topProduct.productId, stockInfo!.quantityLeft)}
                              onKeyDown={(e) => handleQuantityKeyDown(e, topProduct.productId, stockInfo!.quantityLeft)}
                              className="w-10 h-6 text-center text-xs p-0"
                              autoFocus
                            />
                          ) : (
                            <span 
                              onClick={() => handleQuantityClick(topProduct.productId, quantity)} 
                              className="w-8 text-center font-medium text-xs cursor-pointer hover:bg-gray-100 rounded py-1"
                            >
                              {quantity}
                            </span>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleQuantityChange(topProduct.productId, quantity + 1, stockInfo!.quantityLeft)} 
                            disabled={quantity >= stockInfo!.quantityLeft} 
                            className="h-6 w-6 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button 
                          onClick={() => handleFinalAddTopProductToCart(topProduct)} 
                          size="sm" 
                          className="w-full h-7 text-xs bg-orange-500 hover:bg-orange-600"
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          Add {quantity}
                        </Button>
                      </div>
                    )
                  ) : (
                    <Button 
                      disabled 
                      size="sm" 
                      className="w-full h-7 text-xs"
                    >
                      Out of Stock
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // =============================================
  // Render Categories View
  // =============================================
  const renderCategories = () => (
    <div>
      <div className="mb-3">
        <h2 className="text-xl font-bold text-gray-900">Category</h2>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {categories.map((category) => {
          const productCount = getProductCount(category._id);
          const inStockCount = getProductsInStockCount(category._id);
          
          return (
            <div
              key={category._id}
              onClick={() => navigateToProducts(category)}
              className="cursor-pointer bg-white border rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all text-center"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-medium text-gray-900 text-sm">{category.name}</h3>
              <p className="text-xs text-gray-500">{productCount} products</p>
              <Badge 
                variant={inStockCount > 0 ? "default" : "secondary"} 
                className={`text-xs mt-1 ${inStockCount > 0 ? "bg-green-500" : ""}`}
              >
                {inStockCount} in stock
              </Badge>
            </div>
          );
        })}
      </div>
      {categories.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No categories found</p>
        </div>
      )}

      {renderTopSellingProducts()}
    </div>
  );

  // =============================================
  // Render Products View
  // =============================================
  const renderProducts = () => {
    const productsWithStock = categoryProducts.filter((p) => productStocks.has(p._id));
    const productsWithoutStock = categoryProducts.filter((p) => !productStocks.has(p._id));

    return (
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">{navigation.selectedCategory?.name}</h2>
          <p className="text-sm text-gray-500">
            {productsWithStock.length} in stock, {productsWithoutStock.length} out of stock
          </p>
        </div>

        {productsWithStock.length > 0 && (
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              Available ({productsWithStock.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
              {productsWithStock.map((product) => renderProductCard(product, false))}
            </div>
          </div>
        )}

        {productsWithoutStock.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Out of Stock ({productsWithoutStock.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
              {productsWithoutStock.map((product) => {
                const isRefreshing = refreshingStocks.has(product._id);
                return (
                  <div key={product._id} className="bg-white border rounded-lg overflow-hidden opacity-60">
                    <div className="relative h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
                      {product.imageURL ? (
                        <img 
                          src={product.imageURL} 
                          alt={product.name}
                          className="w-full h-full object-cover grayscale"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const nextSibling = e.currentTarget.nextElementSibling;
                            if (nextSibling) nextSibling.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`flex items-center justify-center ${product.imageURL ? 'hidden' : ''}`}>
                        <Package className="w-10 h-10 text-gray-400" />
                      </div>
                      <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5">Out</Badge>
                      {product.size && (
                        <Badge variant="outline" className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 bg-white/50">
                          {product.size}
                        </Badge>
                      )}
                      <Button 
                        onClick={() => refreshStockForProduct(product._id)} 
                        disabled={isRefreshing} 
                        variant="ghost" 
                        size="sm" 
                        className="absolute bottom-1.5 right-1.5 h-6 w-6 p-0 bg-white/80 hover:bg-white"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                    <div className="p-2.5">
                      <h4 className="font-medium text-gray-600 text-sm">{product.name}</h4>
                      <Button disabled size="sm" className="w-full h-8 text-sm mt-2">Out of Stock</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {categoryProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No products found in this category</p>
          </div>
        )}
      </div>
    );
  };

  // =============================================
  // Main Render - Determine what to show
  // =============================================
  const renderContent = () => {
    // If searching, always show search results
    if (isSearchMode) {
      return renderSearchResults();
    }

    // Otherwise, show based on navigation state
    if (navigation.view === "products" && navigation.selectedCategory) {
      return renderProducts();
    }

    return renderCategories();
  };

  return (
    // <div className="space-y-3">
    //   {renderBreadcrumb()}
    //   <Card className="p-0">
    //     <CardContent className="p-4 min-h-[600px]">
    //       {renderContent()}
    //     </CardContent>
    //   </Card>
    // </div>

    // Change from space-y-3 to flex column with full height
  <div className="flex flex-col h-full overflow-hidden">
    {/* Breadcrumb - sticky/frozen at top */}
    <div className="flex-shrink-0">
      {renderBreadcrumb()}
    </div>
    
    {/* Scrollable content area */}
    <Card className="flex-1 overflow-hidden p-0 mt-1">
      <CardContent className="p-4 h-full overflow-y-auto">
        {renderContent()}
      </CardContent>
    </Card>
  </div>
  );
}



// // //NOTE - Working without Top 20 Prduct
// // // components/admin/pos/product-navigation.tsx
// // "use client";

// // import { useState, useCallback, useMemo, JSX } from "react";
// // import { useQuery, useQueryClient } from "@tanstack/react-query";
// // import { Button } from "@/components/ui/button";
// // import { Input } from "@/components/ui/input";
// // import { Card, CardContent } from "@/components/ui/card";
// // import { Badge } from "@/components/ui/badge";
// // import {
// //   Breadcrumb,
// //   BreadcrumbItem,
// //   BreadcrumbLink,
// //   BreadcrumbList,
// //   BreadcrumbPage,
// //   BreadcrumbSeparator,
// // } from "@/components/ui/breadcrumb";
// // import {
// //   Package,
// //   AlertTriangle,
// //   ShoppingCart,
// //   Plus,
// //   Minus,
// //   RefreshCw,
// //   Loader2,
// //   Home,
// //   ChevronRight,
// //   Layers,
// //   Search,
// //   X,
// // } from "lucide-react";
// // import { toast } from "sonner";

// // import type {
// //   ApiResponse,
// //   CartItem,
// //   Product,
// //   StockInfo,
// //   ProductsInventoryResponse,
// //   StockFIFOResponse,
// //   CategoryRef,
// //   SearchResult,
// // } from "@/types/pos";
// // import type { Category, CategoriesResponse } from "@/types/category";

// // // =============================================
// // // Types
// // // =============================================
// // type NavigationView = "categories" | "products" | "search";

// // interface NavigationState {
// //   view: NavigationView;
// //   selectedCategory: Category | null;
// // }

// // interface ProductNavigationProps {
// //   onAddToCart: (item: CartItem) => void;
// //   cartItems: CartItem[];
// // }

// // // =============================================
// // // Helper Functions
// // // =============================================
// // function isCategoryRef(
// //   categoryId: CategoryRef | string | null | undefined
// // ): categoryId is CategoryRef {
// //   return (
// //     categoryId !== null &&
// //     categoryId !== undefined &&
// //     typeof categoryId === "object" &&
// //     "_id" in categoryId
// //   );
// // }

// // function extractCategoryId(
// //   categoryId: CategoryRef | string | null | undefined
// // ): string | null {
// //   if (!categoryId) return null;
// //   if (typeof categoryId === "string") return categoryId;
// //   if (isCategoryRef(categoryId)) return categoryId._id;
// //   return null;
// // }

// // function extractCategoryName(
// //   categoryId: CategoryRef | string | null | undefined
// // ): string | null {
// //   if (isCategoryRef(categoryId)) return categoryId.name;
// //   return null;
// // }

// // // =============================================
// // // Component
// // // =============================================
// // export default function ProductNavigation({
// //   onAddToCart,
// //   cartItems,
// // }: ProductNavigationProps): JSX.Element {
// //   const queryClient = useQueryClient();

// //   const [navigation, setNavigation] = useState<NavigationState>({
// //     view: "categories",
// //     selectedCategory: null,
// //   });

// //   const [searchTerm, setSearchTerm] = useState("");
// //   const [isSearching, setIsSearching] = useState(false);
// //   const [selectedProductIds, setSelectedProductIds] = useState<Record<string, boolean>>({});
// //   const [quantities, setQuantities] = useState<Record<string, number>>({});
// //   const [editingProductId, setEditingProductId] = useState<string | null>(null);
// //   const [editingValue, setEditingValue] = useState("");
// //   const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());

// //   // =============================================
// //   // Data Fetching
// //   // =============================================
// //   const { data: productsResponse, isLoading: productsLoading } = useQuery<
// //     ApiResponse<ProductsInventoryResponse>,
// //     Error
// //   >({
// //     queryKey: ["products-inventory"],
// //     queryFn: async () => {
// //       const response = await fetch("/api/products?includeInactive=false");
// //       if (!response.ok) throw new Error("Failed to fetch products");
// //       const data: ApiResponse<ProductsInventoryResponse> = await response.json();
// //       if (!data.success || !data.data) {
// //         throw new Error(data.error?.message || "Failed to fetch products");
// //       }
// //       return data;
// //     },
// //   });

// //   const { data: categoriesResponse, isLoading: categoriesLoading } = useQuery<
// //     ApiResponse<CategoriesResponse>,
// //     Error
// //   >({
// //     queryKey: ["categories-active"],
// //     queryFn: async () => {
// //       const response = await fetch("/api/categories");
// //       if (!response.ok) throw new Error("Failed to fetch categories");
// //       const data: ApiResponse<CategoriesResponse> = await response.json();
// //       if (!data.success || !data.data) {
// //         throw new Error(data.error?.message || "Failed to fetch categories");
// //       }
// //       return data;
// //     },
// //   });

// //   const { data: stocksResponse } = useQuery<ApiResponse<StockFIFOResponse>, Error>({
// //     queryKey: ["fifo-stocks"],
// //     queryFn: async () => {
// //       const response = await fetch("/api/stock/fifo/oldest-all");
// //       if (!response.ok) throw new Error("Failed to fetch stocks");
// //       const data: ApiResponse<StockFIFOResponse> = await response.json();
// //       if (!data.success || !data.data) {
// //         throw new Error(data.error?.message || "Failed to fetch stocks");
// //       }
// //       return data;
// //     },
// //     enabled: !!productsResponse,
// //     staleTime: 0,
// //   });

// //   // =============================================
// //   // Memoized Data
// //   // =============================================
// //   const productStocks = useMemo((): Map<string, StockInfo> => {
// //     const stocksMap = new Map<string, StockInfo>();
// //     if (stocksResponse?.data?.data) {
// //       stocksResponse.data.data.forEach((item) => {
// //         if (item.currentStock) {
// //           stocksMap.set(item.productId, item.currentStock);
// //         }
// //       });
// //     }
// //     return stocksMap;
// //   }, [stocksResponse]);

// //   const categories = useMemo((): Category[] => {
// //     return categoriesResponse?.data?.categories?.filter((cat) => cat.isActive) || [];
// //   }, [categoriesResponse]);

// //   const getCategoryNameById = useCallback(
// //     (categoryId: string | null): string => {
// //       if (!categoryId) return "Uncategorized";
// //       const category = categories.find((cat) => cat._id === categoryId);
// //       return category?.name || "Uncategorized";
// //     },
// //     [categories]
// //   );

// //   const getCategoryById = useCallback(
// //     (categoryId: string | null): Category | null => {
// //       if (!categoryId) return null;
// //       return categories.find((cat) => cat._id === categoryId) || null;
// //     },
// //     [categories]
// //   );

// //   const products = useMemo((): Product[] => {
// //     if (!productsResponse?.data?.products) return [];
// //     return productsResponse.data.products
// //       .filter((product) => product.isActive)
// //       .map((product): Product => {
// //         const categoryName =
// //           extractCategoryName(product.categoryId) ||
// //           getCategoryNameById(extractCategoryId(product.categoryId));
// //         return {
// //           ...product,
// //           categoryName,
// //           currentStock: productStocks.get(product._id) || null,
// //         };
// //       });
// //   }, [productsResponse, productStocks, getCategoryNameById]);

// //   const categoryProducts = useMemo((): Product[] => {
// //     if (!navigation.selectedCategory) return [];
// //     return products.filter((product) => {
// //       const productCategoryId = extractCategoryId(product.categoryId);
// //       return productCategoryId === navigation.selectedCategory?._id;
// //     });
// //   }, [products, navigation.selectedCategory]);

// //   const getProductCount = useCallback(
// //     (categoryId: string): number => {
// //       return products.filter((product) => {
// //         const productCategoryId = extractCategoryId(product.categoryId);
// //         return productCategoryId === categoryId;
// //       }).length;
// //     },
// //     [products]
// //   );

// //   const getProductsInStockCount = useCallback(
// //     (categoryId: string): number => {
// //       return products.filter((product) => {
// //         const productCategoryId = extractCategoryId(product.categoryId);
// //         return productCategoryId === categoryId && productStocks.has(product._id);
// //       }).length;
// //     },
// //     [products, productStocks]
// //   );

// //   // =============================================
// //   // Search Functionality
// //   // =============================================
// //   const searchResults = useMemo((): SearchResult[] => {
// //     if (!searchTerm.trim()) return [];
// //     const term = searchTerm.toLowerCase().trim();
// //     const results: SearchResult[] = [];

// //     // Search categories
// //     categories.forEach((category) => {
// //       if (category.name.toLowerCase().includes(term)) {
// //         results.push({
// //           type: "category",
// //           id: category._id,
// //           name: category.name,
// //           description: `${getProductCount(category._id)} products`,
// //           category: { _id: category._id, name: category.name },
// //         });
// //       }
// //     });

// //     // Search products
// //     products.forEach((product) => {
// //       if (
// //         product.name.toLowerCase().includes(term) ||
// //         product.description?.toLowerCase().includes(term) ||
// //         product.barcode?.toLowerCase().includes(term) ||
// //         product.size?.toLowerCase().includes(term)
// //       ) {
// //         const categoryId = extractCategoryId(product.categoryId);
// //         const category = categoryId ? getCategoryById(categoryId) : null;
// //         const stockInfo = productStocks.get(product._id);
        
// //         results.push({
// //           type: "product",
// //           id: product._id,
// //           name: product.name,
// //           description: product.categoryName,
// //           category: category ? { _id: category._id, name: category.name } : undefined,
// //           product,
// //           price: stockInfo?.sellingPrice,
// //           stock: stockInfo?.quantityLeft,
// //         });
// //       }
// //     });

// //     return results;
// //   }, [searchTerm, categories, products, getProductCount, getCategoryById, productStocks]);

// //   const handleSearch = useCallback(() => {
// //     if (!searchTerm.trim()) {
// //       toast.error("Please enter a search term");
// //       return;
// //     }
// //     setIsSearching(true);
// //     setNavigation({ view: "search", selectedCategory: null });
// //     setTimeout(() => setIsSearching(false), 300);
// //   }, [searchTerm]);

// //   const handleSearchKeyPress = useCallback(
// //     (e: React.KeyboardEvent) => {
// //       if (e.key === "Enter") handleSearch();
// //     },
// //     [handleSearch]
// //   );

// //   const clearSearch = useCallback(() => {
// //     setSearchTerm("");
// //     setNavigation({ view: "categories", selectedCategory: null });
// //   }, []);

// //   const handleSearchResultClick = useCallback(
// //     (result: SearchResult) => {
// //       setSearchTerm("");
// //       if (result.type === "category" && result.category) {
// //         const category = getCategoryById(result.category._id);
// //         if (category) {
// //           setNavigation({ view: "products", selectedCategory: category });
// //         }
// //       } else if (result.type === "product" && result.product) {
// //         const categoryId = extractCategoryId(result.product.categoryId);
// //         const category = categoryId ? getCategoryById(categoryId) : null;
// //         setNavigation({ view: "products", selectedCategory: category });
// //       }
// //     },
// //     [getCategoryById]
// //   );

// //   // =============================================
// //   // Navigation Handlers
// //   // =============================================
// //   const navigateToCategories = useCallback(() => {
// //     setNavigation({ view: "categories", selectedCategory: null });
// //     setSelectedProductIds({});
// //     setQuantities({});
// //     setSearchTerm("");
// //   }, []);

// //   const navigateToProducts = useCallback((category: Category) => {
// //     setNavigation({ view: "products", selectedCategory: category });
// //     setSelectedProductIds({});
// //     setQuantities({});
// //   }, []);

// //   // =============================================
// //   // Stock Management
// //   // =============================================
// //   const refreshStockForProduct = useCallback(
// //     async (productId: string): Promise<void> => {
// //       setRefreshingStocks((prev) => new Set(prev).add(productId));
// //       try {
// //         const response = await fetch(`/api/stock/fifo/oldest-single?productId=${productId}`);
// //         if (response.ok) {
// //           const result: ApiResponse<StockInfo> = await response.json();
// //           queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(["fifo-stocks"], (oldData) => {
// //             if (!oldData?.data?.data) return oldData;
// //             const stocksArray = [...oldData.data.data];
// //             const index = stocksArray.findIndex((item) => item.productId === productId);
// //             if (result.success && result.data) {
// //               const newItem = { productId, currentStock: result.data };
// //               if (index >= 0) stocksArray[index] = newItem;
// //               else stocksArray.push(newItem);
// //               toast.success("Stock refreshed");
// //             } else {
// //               if (index >= 0) stocksArray.splice(index, 1);
// //               toast.info("No stock available");
// //             }
// //             return { ...oldData, data: { ...oldData.data, data: stocksArray } };
// //           });
// //         }
// //       } catch (error) {
// //         console.error("Error refreshing stock:", error);
// //         toast.error("Failed to refresh stock");
// //       } finally {
// //         setRefreshingStocks((prev) => {
// //           const updated = new Set(prev);
// //           updated.delete(productId);
// //           return updated;
// //         });
// //       }
// //     },
// //     [queryClient]
// //   );

// //   const updateStockInCache = useCallback(
// //     (productId: string, quantityReduced: number): void => {
// //       queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(["fifo-stocks"], (oldData) => {
// //         if (!oldData?.data?.data) return oldData;
// //         const stocksArray = [...oldData.data.data];
// //         const index = stocksArray.findIndex((item) => item.productId === productId);
// //         if (index >= 0 && stocksArray[index].currentStock) {
// //           const currentStock = stocksArray[index].currentStock!;
// //           const newQuantity = currentStock.quantityLeft - quantityReduced;
// //           if (newQuantity <= 0) stocksArray.splice(index, 1);
// //           else stocksArray[index] = { 
// //             ...stocksArray[index], 
// //             currentStock: { ...currentStock, quantityLeft: newQuantity } 
// //           };
// //         }
// //         return { ...oldData, data: { ...oldData.data, data: stocksArray } };
// //       });
// //     },
// //     [queryClient]
// //   );

// //   // =============================================
// //   // Cart Handlers
// //   // =============================================
// //   const handleInitialAddToCart = useCallback((productId: string): void => {
// //     setSelectedProductIds((prev) => ({ ...prev, [productId]: true }));
// //     setQuantities((prev) => ({ ...prev, [productId]: 1 }));
// //   }, []);

// //   const handleQuantityChange = useCallback((productId: string, newQuantity: number, maxStock: number): void => {
// //     if (newQuantity < 1) {
// //       setQuantities((prev) => ({ ...prev, [productId]: 1 }));
// //       return;
// //     }
// //     if (newQuantity > maxStock) {
// //       toast.error(`Only ${maxStock} units available`);
// //       setQuantities((prev) => ({ ...prev, [productId]: maxStock }));
// //       return;
// //     }
// //     setQuantities((prev) => ({ ...prev, [productId]: newQuantity }));
// //   }, []);

// //   const handleQuantityClick = useCallback((productId: string, currentQuantity: number): void => {
// //     setEditingProductId(productId);
// //     setEditingValue(currentQuantity.toString());
// //   }, []);

// //   const handleManualQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
// //     const value = e.target.value;
// //     if (value === "" || /^\d+$/.test(value)) setEditingValue(value);
// //   }, []);

// //   const handleQuantityBlur = useCallback(
// //     (productId: string, maxStock: number): void => {
// //       const newQuantity = parseInt(editingValue, 10) || 1;
// //       if (newQuantity < 1) {
// //         toast.error("Quantity must be at least 1");
// //         setQuantities((prev) => ({ ...prev, [productId]: 1 }));
// //       } else if (newQuantity > maxStock) {
// //         toast.error(`Only ${maxStock} units available`);
// //         setQuantities((prev) => ({ ...prev, [productId]: maxStock }));
// //       } else {
// //         setQuantities((prev) => ({ ...prev, [productId]: newQuantity }));
// //       }
// //       setEditingProductId(null);
// //       setEditingValue("");
// //     },
// //     [editingValue]
// //   );

// //   const handleQuantityKeyPress = useCallback(
// //     (e: React.KeyboardEvent, productId: string, maxStock: number): void => {
// //       if (e.key === "Enter") handleQuantityBlur(productId, maxStock);
// //       else if (e.key === "Escape") {
// //         setEditingProductId(null);
// //         setEditingValue("");
// //       }
// //     },
// //     [handleQuantityBlur]
// //   );

// //   const handleFinalAddToCart = useCallback(
// //     (product: Product): void => {
// //       const stockInfo = productStocks.get(product._id);
// //       if (!stockInfo) {
// //         toast.error("No stock information available");
// //         return;
// //       }
// //       const quantity = quantities[product._id] || 1;
// //       updateStockInCache(product._id, quantity);
      
// //       const categoryId = extractCategoryId(product.categoryId);
      
// //       const cartItem: CartItem = {
// //         itemKey: `prod:${product._id}`,
// //         productId: product._id,
// //         categoryId: categoryId || undefined,
// //         name: product.name,
// //         size: product.size,
// //         price: stockInfo.sellingPrice,
// //         quantity,
// //         stock: stockInfo.quantityLeft,
// //         stockTransactionId: stockInfo.stockTransactionId,
// //         imageURL: product.imageURL,
// //       };
      
// //       onAddToCart(cartItem);
// //       toast.success(`${quantity} × ${product.name} added to cart`);
// //       setSelectedProductIds((prev) => ({ ...prev, [product._id]: false }));
// //       setQuantities((prev) => ({ ...prev, [product._id]: 1 }));
// //     },
// //     [quantities, productStocks, updateStockInCache, onAddToCart]
// //   );

// //   const handleDirectAddToCart = useCallback(
// //     (product: Product): void => {
// //       const stockInfo = productStocks.get(product._id);
// //       if (!stockInfo) {
// //         toast.error("No stock information available");
// //         return;
// //       }
// //       if (stockInfo.quantityLeft <= 0) {
// //         toast.error("Product is out of stock");
// //         return;
// //       }
// //       updateStockInCache(product._id, 1);
      
// //       const categoryId = extractCategoryId(product.categoryId);
      
// //       const cartItem: CartItem = {
// //         itemKey: `prod:${product._id}`,
// //         productId: product._id,
// //         categoryId: categoryId || undefined,
// //         name: product.name,
// //         size: product.size,
// //         price: stockInfo.sellingPrice,
// //         quantity: 1,
// //         stock: stockInfo.quantityLeft,
// //         stockTransactionId: stockInfo.stockTransactionId,
// //         imageURL: product.imageURL,
// //       };
      
// //       onAddToCart(cartItem);
// //       toast.success(`${product.name} added to cart`);
// //     },
// //     [productStocks, updateStockInCache, onAddToCart]
// //   );

// //   // =============================================
// //   // Helper Functions
// //   // =============================================
// //   const hasLowStock = useCallback(
// //     (product: Product): boolean => {
// //       const stockInfo = productStocks.get(product._id);
// //       if (!stockInfo) return true;
// //       return stockInfo.quantityLeft <= (product.lowStockThreshold || 5);
// //     },
// //     [productStocks]
// //   );

// //   const isOutOfStock = useCallback(
// //     (productId: string): boolean => {
// //       const stockInfo = productStocks.get(productId);
// //       return !stockInfo || stockInfo.quantityLeft <= 0;
// //     },
// //     [productStocks]
// //   );

// //   const isProductInCart = useCallback(
// //     (productId: string): boolean => {
// //       return cartItems.some((item) => item.productId === productId);
// //     },
// //     [cartItems]
// //   );

// //   // =============================================
// //   // Loading State
// //   // =============================================
// //   if (productsLoading || categoriesLoading) {
// //     return (
// //       <div className="flex items-center justify-center py-8">
// //         <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
// //         <span className="ml-2 text-gray-600 text-sm">Loading...</span>
// //       </div>
// //     );
// //   }

// //   // =============================================
// //   // Render Breadcrumb with Search
// //   // =============================================
// //   const renderBreadcrumb = () => (
// //     <Card className="mb-3">
// //       <CardContent className="py-3 px-4">
// //         <div className="flex items-center justify-between gap-4">
// //           <Breadcrumb>
// //             <BreadcrumbList>
// //               <BreadcrumbItem>
// //                 <BreadcrumbLink 
// //                   onClick={navigateToCategories} 
// //                   className="flex items-center cursor-pointer hover:text-blue-600 text-sm font-medium"
// //                 >
// //                   <Home className="w-4 h-4 mr-1" />
// //                   Categories
// //                 </BreadcrumbLink>
// //               </BreadcrumbItem>
// //               {navigation.selectedCategory && (
// //                 <>
// //                   <BreadcrumbSeparator><ChevronRight className="w-4 h-4" /></BreadcrumbSeparator>
// //                   <BreadcrumbItem>
// //                     <BreadcrumbPage className="flex items-center font-semibold text-sm">
// //                       <Layers className="w-4 h-4 mr-1" />
// //                       {navigation.selectedCategory.name}
// //                     </BreadcrumbPage>
// //                   </BreadcrumbItem>
// //                 </>
// //               )}
// //               {navigation.view === "search" && (
// //                 <>
// //                   <BreadcrumbSeparator><ChevronRight className="w-4 h-4" /></BreadcrumbSeparator>
// //                   <BreadcrumbItem>
// //                     <BreadcrumbPage className="flex items-center font-semibold text-sm">
// //                       <Search className="w-4 h-4 mr-1" />
// //                       Search Results
// //                     </BreadcrumbPage>
// //                   </BreadcrumbItem>
// //                 </>
// //               )}
// //             </BreadcrumbList>
// //           </Breadcrumb>

// //           <div className="flex items-center gap-2">
// //             <div className="relative">
// //               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
// //               <Input
// //                 type="text"
// //                 placeholder="Search products..."
// //                 value={searchTerm}
// //                 onChange={(e) => setSearchTerm(e.target.value)}
// //                 onKeyPress={handleSearchKeyPress}
// //                 className="pl-9 pr-8 h-9 text-sm w-56"
// //               />
// //               {searchTerm && (
// //                 <button 
// //                   onClick={clearSearch} 
// //                   className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
// //                 >
// //                   <X className="w-4 h-4" />
// //                 </button>
// //               )}
// //             </div>
// //             <Button 
// //               onClick={handleSearch} 
// //               disabled={isSearching || !searchTerm.trim()} 
// //               size="sm" 
// //               className="h-9 px-3 bg-blue-500 hover:bg-blue-600"
// //             >
// //               {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// //             </Button>
// //           </div>
// //         </div>
// //       </CardContent>
// //     </Card>
// //   );

// //   // =============================================
// //   // Render Categories View
// //   // =============================================
// //   const renderCategories = () => (
// //     <div>
// //       <div className="mb-4">
// //         <h2 className="text-xl font-bold text-gray-900">Select Category</h2>
// //       </div>
// //       <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
// //         {categories.map((category) => {
// //           const productCount = getProductCount(category._id);
// //           const inStockCount = getProductsInStockCount(category._id);
          
// //           return (
// //             <div
// //               key={category._id}
// //               onClick={() => navigateToProducts(category)}
// //               className="cursor-pointer bg-white border rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all text-center"
// //             >
// //               <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
// //                 <Package className="w-6 h-6 text-blue-600" />
// //               </div>
// //               <h3 className="font-medium text-gray-900 text-sm line-clamp-1">{category.name}</h3>
// //               <p className="text-xs text-gray-500">{productCount} products</p>
// //               <Badge 
// //                 variant={inStockCount > 0 ? "default" : "secondary"} 
// //                 className={`text-xs mt-1 ${inStockCount > 0 ? "bg-green-500" : ""}`}
// //               >
// //                 {inStockCount} in stock
// //               </Badge>
// //             </div>
// //           );
// //         })}
// //       </div>
// //       {categories.length === 0 && (
// //         <div className="text-center py-12">
// //           <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
// //           <p className="text-gray-600">No categories found</p>
// //         </div>
// //       )}
// //     </div>
// //   );

// //   // =============================================
// //   // Render Products View
// //   // =============================================
// //   const renderProducts = () => {
// //     const productsWithStock = categoryProducts.filter((p) => productStocks.has(p._id));
// //     const productsWithoutStock = categoryProducts.filter((p) => !productStocks.has(p._id));

// //     return (
// //       <div>
// //         <div className="mb-4">
// //           <h2 className="text-xl font-bold text-gray-900">{navigation.selectedCategory?.name}</h2>
// //           <p className="text-sm text-gray-500">
// //             {productsWithStock.length} in stock, {productsWithoutStock.length} out of stock
// //           </p>
// //         </div>

// //         {/* Products with Stock */}
// //         {productsWithStock.length > 0 && (
// //           <div className="mb-6">
// //             <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
// //               <Package className="w-5 h-5 text-green-600" />
// //               Available ({productsWithStock.length})
// //             </h3>
// //             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
// //               {productsWithStock.map((product) => {
// //                 const stockInfo = productStocks.get(product._id)!;
// //                 const isActive = selectedProductIds[product._id] ?? false;
// //                 const quantity = quantities[product._id] || 1;
// //                 const isEditing = editingProductId === product._id;
// //                 const isRefreshing = refreshingStocks.has(product._id);
// //                 const lowStock = hasLowStock(product);
// //                 const inCart = isProductInCart(product._id);

// //                 return (
// //                   <div
// //                     key={product._id}
// //                     className={`bg-white border-2 rounded-lg overflow-hidden transition-all ${
// //                       inCart ? "border-blue-300 bg-blue-50" : lowStock ? "border-orange-200" : "border-green-200"
// //                     }`}
// //                   >
// //                     <div className="relative h-28 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
// //                       {product.imageURL ? (
// //                         <img 
// //                           src={product.imageURL} 
// //                           alt={product.name}
// //                           className="w-full h-full object-cover"
// //                           onError={(e) => {
// //                             e.currentTarget.style.display = 'none';
// //                             e.currentTarget.nextElementSibling?.classList.remove('hidden');
// //                           }}
// //                         />
// //                       ) : null}
// //                       <div className={`flex items-center justify-center ${product.imageURL ? 'hidden' : ''}`}>
// //                         <Package className="w-10 h-10 text-gray-300" />
// //                       </div>
                      
// //                       <div className="absolute top-1.5 left-1.5">
// //                         <Badge 
// //                           variant={lowStock ? "destructive" : "default"} 
// //                           className={`text-xs px-1.5 py-0.5 ${lowStock ? "bg-orange-500" : "bg-green-500"}`}
// //                         >
// //                           {stockInfo.quantityLeft}
// //                         </Badge>
// //                       </div>
// //                       {product.size && (
// //                         <Badge variant="outline" className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 bg-white">
// //                           {product.size}
// //                         </Badge>
// //                       )}
// //                       <Button
// //                         onClick={(e) => { e.stopPropagation(); refreshStockForProduct(product._id); }}
// //                         disabled={isRefreshing}
// //                         variant="ghost"
// //                         size="sm"
// //                         className="absolute bottom-1.5 right-1.5 h-6 w-6 p-0 bg-white/80 hover:bg-white"
// //                       >
// //                         <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
// //                       </Button>
// //                     </div>

// //                     <div className="p-2.5">
// //                       <h4 className="font-medium text-gray-900 text-sm line-clamp-1 mb-1">{product.name}</h4>
// //                       <div className="flex items-center justify-between mb-2">
// //                         <span className="text-base font-bold text-green-600">₹{stockInfo.sellingPrice}</span>
// //                         {lowStock && <AlertTriangle className="w-4 h-4 text-orange-500" />}
// //                       </div>

// //                       {inCart && <Badge className="mb-2 bg-blue-500 text-xs">In cart</Badge>}

// //                       {!isActive ? (
// //                         <Button 
// //                           onClick={() => handleInitialAddToCart(product._id)} 
// //                           size="sm" 
// //                           className="w-full h-8 text-sm bg-green-500 hover:bg-green-600"
// //                         >
// //                           <ShoppingCart className="w-4 h-4 mr-1" />
// //                           Add
// //                         </Button>
// //                       ) : (
// //                         <div className="space-y-2">
// //                           <div className="flex items-center justify-center gap-1">
// //                             <Button 
// //                               variant="outline" 
// //                               size="sm" 
// //                               onClick={() => handleQuantityChange(product._id, quantity - 1, stockInfo.quantityLeft)} 
// //                               disabled={quantity <= 1} 
// //                               className="h-7 w-7 p-0"
// //                             >
// //                               <Minus className="h-3 w-3" />
// //                             </Button>
// //                             {isEditing ? (
// //                               <Input
// //                                 type="text"
// //                                 value={editingValue}
// //                                 onChange={handleManualQuantityChange}
// //                                 onBlur={() => handleQuantityBlur(product._id, stockInfo.quantityLeft)}
// //                                 onKeyDown={(e) => handleQuantityKeyPress(e, product._id, stockInfo.quantityLeft)}
// //                                 className="w-12 h-7 text-center text-sm p-0"
// //                                 autoFocus
// //                               />
// //                             ) : (
// //                               <span 
// //                                 onClick={() => handleQuantityClick(product._id, quantity)} 
// //                                 className="w-10 text-center font-medium text-sm cursor-pointer hover:bg-gray-100 rounded py-1"
// //                               >
// //                                 {quantity}
// //                               </span>
// //                             )}
// //                             <Button 
// //                               variant="outline" 
// //                               size="sm" 
// //                               onClick={() => handleQuantityChange(product._id, quantity + 1, stockInfo.quantityLeft)} 
// //                               disabled={quantity >= stockInfo.quantityLeft} 
// //                               className="h-7 w-7 p-0"
// //                             >
// //                               <Plus className="h-3 w-3" />
// //                             </Button>
// //                           </div>
// //                           <Button 
// //                             onClick={() => handleFinalAddToCart(product)} 
// //                             size="sm" 
// //                             className="w-full h-8 text-sm bg-green-500 hover:bg-green-600"
// //                           >
// //                             <ShoppingCart className="w-4 h-4 mr-1" />
// //                             Add {quantity}
// //                           </Button>
// //                         </div>
// //                       )}
// //                     </div>
// //                   </div>
// //                 );
// //               })}
// //             </div>
// //           </div>
// //         )}

// //         {/* Products without Stock */}
// //         {productsWithoutStock.length > 0 && (
// //           <div>
// //             <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
// //               <AlertTriangle className="w-5 h-5 text-amber-600" />
// //               Out of Stock ({productsWithoutStock.length})
// //             </h3>
// //             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
// //               {productsWithoutStock.map((product) => {
// //                 const isRefreshing = refreshingStocks.has(product._id);
// //                 return (
// //                   <div key={product._id} className="bg-white border rounded-lg overflow-hidden opacity-60">
// //                     <div className="relative h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
// //                       {product.imageURL ? (
// //                         <img 
// //                           src={product.imageURL} 
// //                           alt={product.name}
// //                           className="w-full h-full object-cover grayscale"
// //                           onError={(e) => {
// //                             e.currentTarget.style.display = 'none';
// //                             e.currentTarget.nextElementSibling?.classList.remove('hidden');
// //                           }}
// //                         />
// //                       ) : null}
// //                       <div className={`flex items-center justify-center ${product.imageURL ? 'hidden' : ''}`}>
// //                         <Package className="w-10 h-10 text-gray-400" />
// //                       </div>
// //                       <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5">Out</Badge>
// //                       {product.size && (
// //                         <Badge variant="outline" className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 bg-white/50">
// //                           {product.size}
// //                         </Badge>
// //                       )}
// //                       <Button 
// //                         onClick={() => refreshStockForProduct(product._id)} 
// //                         disabled={isRefreshing} 
// //                         variant="ghost" 
// //                         size="sm" 
// //                         className="absolute bottom-1.5 right-1.5 h-6 w-6 p-0 bg-white/80 hover:bg-white"
// //                       >
// //                         <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
// //                       </Button>
// //                     </div>
// //                     <div className="p-2.5">
// //                       <h4 className="font-medium text-gray-600 text-sm line-clamp-1">{product.name}</h4>
// //                       <Button disabled size="sm" className="w-full h-8 text-sm mt-2">Out of Stock</Button>
// //                     </div>
// //                   </div>
// //                 );
// //               })}
// //             </div>
// //           </div>
// //         )}

// //         {categoryProducts.length === 0 && (
// //           <div className="text-center py-12">
// //             <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
// //             <p className="text-gray-600">No products found in this category</p>
// //           </div>
// //         )}
// //       </div>
// //     );
// //   };

// //   // =============================================
// //   // Render Search Results
// //   // =============================================
// //   const renderSearchResults = () => (
// //     <div>
// //       <div className="mb-4">
// //         <h2 className="text-xl font-bold text-gray-900">Search Results</h2>
// //         <p className="text-sm text-gray-500">{searchResults.length} results for "{searchTerm}"</p>
// //       </div>

// //       {searchResults.length === 0 ? (
// //         <div className="text-center py-12">
// //           <Search className="w-16 h-16 text-gray-400 mx-auto mb-3" />
// //           <p className="text-gray-600">No results found</p>
// //         </div>
// //       ) : (
// //         <div className="space-y-6">
// //           {/* Categories */}
// //           {searchResults.filter((r) => r.type === "category").length > 0 && (
// //             <div>
// //               <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
// //                 <Layers className="w-5 h-5 text-blue-600" />
// //                 Categories
// //               </h3>
// //               <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
// //                 {searchResults.filter((r) => r.type === "category").map((result) => (
// //                   <div 
// //                     key={result.id} 
// //                     onClick={() => handleSearchResultClick(result)} 
// //                     className="cursor-pointer bg-white border rounded-lg p-3 hover:shadow-md hover:border-blue-300 text-center"
// //                   >
// //                     <Layers className="w-6 h-6 text-blue-600 mx-auto mb-1" />
// //                     <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{result.name}</h4>
// //                     <p className="text-xs text-gray-500">{result.description}</p>
// //                   </div>
// //                 ))}
// //               </div>
// //             </div>
// //           )}

// //           {/* Products */}
// //           {searchResults.filter((r) => r.type === "product").length > 0 && (
// //             <div>
// //               <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
// //                 <Package className="w-5 h-5 text-green-600" />
// //                 Products
// //               </h3>
// //               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
// //                 {searchResults.filter((r) => r.type === "product").map((result) => {
// //                   const product = result.product!;
// //                   const stockInfo = productStocks.get(product._id);
// //                   const outOfStock = isOutOfStock(product._id);
// //                   const inCart = isProductInCart(product._id);

// //                   return (
// //                     <div 
// //                       key={result.id} 
// //                       className={`bg-white border-2 rounded-lg overflow-hidden ${
// //                         inCart ? "border-blue-300 bg-blue-50" : outOfStock ? "border-gray-200 opacity-60" : "border-green-200"
// //                       }`}
// //                     >
// //                       <div className="relative h-20 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
// //                         {product.imageURL ? (
// //                           <img 
// //                             src={product.imageURL} 
// //                             alt={product.name}
// //                             className={`w-full h-full object-cover ${outOfStock ? 'grayscale' : ''}`}
// //                             onError={(e) => {
// //                               e.currentTarget.style.display = 'none';
// //                               e.currentTarget.nextElementSibling?.classList.remove('hidden');
// //                             }}
// //                           />
// //                         ) : null}
// //                         <div className={`flex items-center justify-center ${product.imageURL ? 'hidden' : ''}`}>
// //                           <Package className="w-8 h-8 text-gray-300" />
// //                         </div>
// //                         {stockInfo && (
// //                           <Badge 
// //                             variant={stockInfo.quantityLeft <= 5 ? "destructive" : "default"} 
// //                             className={`absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5 ${
// //                               stockInfo.quantityLeft <= 5 ? "bg-orange-500" : "bg-green-500"
// //                             }`}
// //                           >
// //                             {stockInfo.quantityLeft}
// //                           </Badge>
// //                         )}
// //                         {product.size && (
// //                           <Badge variant="outline" className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 bg-white">
// //                             {product.size}
// //                           </Badge>
// //                         )}
// //                       </div>
// //                       <div className="p-2">
// //                         <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{result.name}</h4>
// //                         <p className="text-xs text-gray-500 line-clamp-1">{result.description}</p>
// //                         {stockInfo && (
// //                           <span className="text-base font-bold text-green-600">₹{stockInfo.sellingPrice}</span>
// //                         )}
// //                         <div className="flex gap-1.5 mt-2">
// //                           <Button 
// //                             variant="outline" 
// //                             size="sm" 
// //                             onClick={(e) => { e.stopPropagation(); handleSearchResultClick(result); }} 
// //                             className="flex-1 h-7 text-xs"
// //                           >
// //                             View
// //                           </Button>
// //                           {!outOfStock && (
// //                             <Button 
// //                               size="sm" 
// //                               onClick={(e) => { e.stopPropagation(); handleDirectAddToCart(product); }} 
// //                               className="flex-1 h-7 text-xs bg-green-500 hover:bg-green-600"
// //                             >
// //                               Add
// //                             </Button>
// //                           )}
// //                         </div>
// //                       </div>
// //                     </div>
// //                   );
// //                 })}
// //               </div>
// //             </div>
// //           )}
// //         </div>
// //       )}
// //     </div>
// //   );

// //   // =============================================
// //   // Main Render
// //   // =============================================
// //   return (
// //     <div className="space-y-3">
// //       {renderBreadcrumb()}
// //       <Card>
// //         <CardContent className="p-4 min-h-[600px]">
// //           {navigation.view === "categories" && renderCategories()}
// //           {navigation.view === "products" && renderProducts()}
// //           {navigation.view === "search" && renderSearchResults()}
// //         </CardContent>
// //       </Card>
// //     </div>
// //   );
// // }