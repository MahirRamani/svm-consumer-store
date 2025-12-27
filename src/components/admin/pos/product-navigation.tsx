"use client";

import { useState, useCallback, useMemo, JSX } from "react";
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
  Box,
  Layers,
  Search,
  X,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";

import type {
  ApiResponse,
  CartItem,
  ProductWithVariants,
  SubProductWithStock,
  StockInfo,
  ProductsInventoryResponse,
  StockFIFOResponse,
  CategoryRef,
} from "@/types/pos";
import type { Category, CategoriesResponse } from "@/types/category";

// =============================================
// Types
// =============================================
type NavigationView = "categories" | "products" | "subProducts" | "search";

interface NavigationState {
  view: NavigationView;
  selectedCategory: Category | null;
  selectedProduct: ProductWithVariants | null;
}

interface ProductNavigationProps {
  onAddToCart: (item: CartItem) => void;
  cartItems: CartItem[];
}

interface SearchResult {
  type: "category" | "product" | "subProduct";
  id: string;
  name: string;
  description?: string;
  category?: Category;
  product?: ProductWithVariants;
  variant?: SubProductWithStock;
  price?: number;
  stock?: number;
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

// =============================================
// Component
// =============================================
export default function ProductNavigation({
  onAddToCart,
  cartItems,
}: ProductNavigationProps): JSX.Element {
  const queryClient = useQueryClient();

  const [navigation, setNavigation] = useState<NavigationState>({
    view: "categories",
    selectedCategory: null,
    selectedProduct: null,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());

  // =============================================
  // Data Fetching
  // =============================================
  const { data: productsResponse, isLoading: productsLoading } = useQuery<
    ApiResponse<ProductsInventoryResponse>,
    Error
  >({
    queryKey: ["products-inventory"],
    queryFn: async () => {
      const response = await fetch("/api/inventories");
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

  const { data: stocksResponse } = useQuery<ApiResponse<StockFIFOResponse>, Error>({
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

  // =============================================
  // Memoized Data
  // =============================================
  const subProductStocks = useMemo((): Map<string, StockInfo> => {
    const stocksMap = new Map<string, StockInfo>();
    if (stocksResponse?.data?.data) {
      stocksResponse.data.data.forEach((item) => {
        if (item.currentStock) {
          stocksMap.set(item.subProductId, item.currentStock);
        }
      });
    }
    return stocksMap;
  }, [stocksResponse]);

  const categories = useMemo((): Category[] => {
    return categoriesResponse?.data?.categories?.filter((cat) => cat.isActive) || [];
  }, [categoriesResponse]);

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

  const products = useMemo((): ProductWithVariants[] => {
    if (!productsResponse?.data?.products) return [];
    return productsResponse.data.products
      .filter((product) => product.isActive)
      .map((product): ProductWithVariants => {
        const categoryName =
          extractCategoryName(product.categoryId) ||
          getCategoryNameById(extractCategoryId(product.categoryId));
        return {
          ...product,
          variantCount: product.variants?.length || 0,
          categoryName,
          variants: product.variants?.map((variant) => ({
            ...variant,
            currentStock: subProductStocks.get(variant._id) || null,
          })),
        };
      });
  }, [productsResponse, subProductStocks, getCategoryNameById]);

  const categoryProducts = useMemo((): ProductWithVariants[] => {
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

  // Get first variant image for product display
  const getProductImage = useCallback((product: ProductWithVariants): string | null => {
    if (!product.variants || product.variants.length === 0) return null;
    const variantWithImage = product.variants.find((v) => v.isActive && v.imageURL);
    return variantWithImage?.imageURL || null;
  }, []);

  // =============================================
  // Search Functionality
  // =============================================
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    const results: SearchResult[] = [];

    categories.forEach((category) => {
      if (category.name.toLowerCase().includes(term)) {
        results.push({
          type: "category",
          id: category._id,
          name: category.name,
          description: `${getProductCount(category._id)} products`,
          category,
        });
      }
    });

    products.forEach((product) => {
      if (
        product.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term)
      ) {
        const categoryId = extractCategoryId(product.categoryId);
        const category = categoryId ? getCategoryById(categoryId) : null;
        results.push({
          type: "product",
          id: product._id,
          name: product.name,
          description: product.categoryName,
          category: category || undefined,
          product,
        });
      }

      product.variants?.forEach((variant) => {
        if (
          variant.isActive &&
          (variant.name.toLowerCase().includes(term) ||
            variant.description?.toLowerCase().includes(term))
        ) {
          const categoryId = extractCategoryId(product.categoryId);
          const category = categoryId ? getCategoryById(categoryId) : null;
          const stockInfo = subProductStocks.get(variant._id);
          results.push({
            type: "subProduct",
            id: variant._id,
            name: variant.name,
            description: `${product.name} • ${product.categoryName}`,
            category: category || undefined,
            product,
            variant,
            price: stockInfo?.sellingPrice,
            stock: stockInfo?.quantityLeft,
          });
        }
      });
    });

    return results;
  }, [searchTerm, categories, products, getProductCount, getCategoryById, subProductStocks]);

  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      toast.error("Please enter a search term");
      return;
    }
    setIsSearching(true);
    setNavigation({ view: "search", selectedCategory: null, selectedProduct: null });
    setTimeout(() => setIsSearching(false), 300);
  }, [searchTerm]);

  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch]
  );

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setNavigation({ view: "categories", selectedCategory: null, selectedProduct: null });
  }, []);

  const handleSearchResultClick = useCallback(
    (result: SearchResult) => {
      setSearchTerm("");
      if (result.type === "category" && result.category) {
        setNavigation({ view: "products", selectedCategory: result.category, selectedProduct: null });
      } else if (result.type === "product" && result.product) {
        const categoryId = extractCategoryId(result.product.categoryId);
        const category = categoryId ? getCategoryById(categoryId) : null;
        setNavigation({ view: "subProducts", selectedCategory: category, selectedProduct: result.product });
      } else if (result.type === "subProduct" && result.product) {
        const categoryId = extractCategoryId(result.product.categoryId);
        const category = categoryId ? getCategoryById(categoryId) : null;
        setNavigation({ view: "subProducts", selectedCategory: category, selectedProduct: result.product });
      }
    },
    [getCategoryById]
  );

  // =============================================
  // Navigation Handlers
  // =============================================
  const navigateToCategories = useCallback(() => {
    setNavigation({ view: "categories", selectedCategory: null, selectedProduct: null });
    setSelectedVariantIds({});
    setQuantities({});
    setSearchTerm("");
  }, []);

  const navigateToProducts = useCallback((category: Category) => {
    setNavigation({ view: "products", selectedCategory: category, selectedProduct: null });
    setSelectedVariantIds({});
    setQuantities({});
  }, []);

  const navigateToSubProducts = useCallback(
    (product: ProductWithVariants) => {
      setNavigation({ view: "subProducts", selectedCategory: navigation.selectedCategory, selectedProduct: product });
      setSelectedVariantIds({});
      setQuantities({});
    },
    [navigation.selectedCategory]
  );

  // =============================================
  // Stock Management
  // =============================================
  const refreshStockForSubProduct = useCallback(
    async (subProductId: string): Promise<void> => {
      setRefreshingStocks((prev) => new Set(prev).add(subProductId));
      try {
        const response = await fetch(`/api/stock/fifo/oldest-single?subProductId=${subProductId}`);
        if (response.ok) {
          const result: ApiResponse<StockInfo> = await response.json();
          queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(["fifo-stocks"], (oldData) => {
            if (!oldData?.data?.data) return oldData;
            const stocksArray = [...oldData.data.data];
            const index = stocksArray.findIndex((item) => item.subProductId === subProductId);
            if (result.success && result.data) {
              const newItem = { subProductId, currentStock: result.data };
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
          updated.delete(subProductId);
          return updated;
        });
      }
    },
    [queryClient]
  );

  const updateStockInCache = useCallback(
    (subProductId: string, quantityReduced: number): void => {
      queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(["fifo-stocks"], (oldData) => {
        if (!oldData?.data?.data) return oldData;
        const stocksArray = [...oldData.data.data];
        const index = stocksArray.findIndex((item) => item.subProductId === subProductId);
        if (index >= 0 && stocksArray[index].currentStock) {
          const currentStock = stocksArray[index].currentStock!;
          const newQuantity = currentStock.quantityLeft - quantityReduced;
          if (newQuantity <= 0) stocksArray.splice(index, 1);
          else stocksArray[index] = { ...stocksArray[index], currentStock: { ...currentStock, quantityLeft: newQuantity } };
        }
        return { ...oldData, data: { ...oldData.data, data: stocksArray } };
      });
    },
    [queryClient]
  );

  // =============================================
  // Cart Handlers
  // =============================================
  const handleInitialAddToCart = useCallback((variantId: string): void => {
    setSelectedVariantIds((prev) => ({ ...prev, [variantId]: true }));
    setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
  }, []);

  const handleQuantityChange = useCallback((variantId: string, newQuantity: number, maxStock: number): void => {
    if (newQuantity < 1) {
      setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
      return;
    }
    if (newQuantity > maxStock) {
      toast.error(`Only ${maxStock} units available`);
      setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
      return;
    }
    setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
  }, []);

  const handleQuantityClick = useCallback((variantId: string, currentQuantity: number): void => {
    setEditingVariantId(variantId);
    setEditingValue(currentQuantity.toString());
  }, []);

  const handleManualQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) setEditingValue(value);
  }, []);

  const handleQuantityBlur = useCallback(
    (variantId: string, maxStock: number): void => {
      const newQuantity = parseInt(editingValue, 10) || 1;
      if (newQuantity < 1) {
        toast.error("Quantity must be at least 1");
        setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
      } else if (newQuantity > maxStock) {
        toast.error(`Only ${maxStock} units available`);
        setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
      } else {
        setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
      }
      setEditingVariantId(null);
      setEditingValue("");
    },
    [editingValue]
  );

  const handleQuantityKeyPress = useCallback(
    (e: React.KeyboardEvent, variantId: string, maxStock: number): void => {
      if (e.key === "Enter") handleQuantityBlur(variantId, maxStock);
      else if (e.key === "Escape") {
        setEditingVariantId(null);
        setEditingValue("");
      }
    },
    [handleQuantityBlur]
  );

  const handleFinalAddToCart = useCallback(
    (variant: SubProductWithStock, product: ProductWithVariants): void => {
      const stockInfo = subProductStocks.get(variant._id);
      if (!stockInfo) {
        toast.error("No stock information available");
        return;
      }
      const quantity = quantities[variant._id] || 1;
      updateStockInCache(variant._id, quantity);
      const cartItem: CartItem = {
        itemKey: `sub:${variant._id}`,
        subProductId: variant._id,
        productId: product._id,
        name: variant.name,
        price: stockInfo.sellingPrice,
        quantity,
        stock: stockInfo.quantityLeft,
        itemType: "subProduct",
        stockTransactionId: stockInfo.stockTransactionId,
      };
      onAddToCart(cartItem);
      toast.success(`${quantity} × ${variant.name} added to cart`);
      setSelectedVariantIds((prev) => ({ ...prev, [variant._id]: false }));
      setQuantities((prev) => ({ ...prev, [variant._id]: 1 }));
    },
    [quantities, subProductStocks, updateStockInCache, onAddToCart]
  );

  const handleDirectAddToCart = useCallback(
    (variant: SubProductWithStock, product: ProductWithVariants): void => {
      const stockInfo = subProductStocks.get(variant._id);
      if (!stockInfo) {
        toast.error("No stock information available");
        return;
      }
      if (stockInfo.quantityLeft <= 0) {
        toast.error("Product is out of stock");
        return;
      }
      updateStockInCache(variant._id, 1);
      const cartItem: CartItem = {
        itemKey: `sub:${variant._id}`,
        subProductId: variant._id,
        productId: product._id,
        name: variant.name,
        price: stockInfo.sellingPrice,
        quantity: 1,
        stock: stockInfo.quantityLeft,
        itemType: "subProduct",
        stockTransactionId: stockInfo.stockTransactionId,
      };
      onAddToCart(cartItem);
      toast.success(`${variant.name} added to cart`);
    },
    [subProductStocks, updateStockInCache, onAddToCart]
  );

  // =============================================
  // Helper Functions
  // =============================================
  const hasLowStock = useCallback(
    (variant: SubProductWithStock): boolean => {
      const stockInfo = subProductStocks.get(variant._id);
      if (!stockInfo) return true;
      return stockInfo.quantityLeft <= (variant.lowStockThreshold || 5);
    },
    [subProductStocks]
  );

  const isOutOfStock = useCallback(
    (variantId: string): boolean => {
      const stockInfo = subProductStocks.get(variantId);
      return !stockInfo || stockInfo.quantityLeft <= 0;
    },
    [subProductStocks]
  );

  const getPriceRange = useCallback(
    (product: ProductWithVariants): { min: number; max: number } | null => {
      if (!product.variants || product.variants.length === 0) return null;
      const activePrices = product.variants
        .filter((v) => v.isActive && subProductStocks.get(v._id))
        .map((v) => subProductStocks.get(v._id)?.sellingPrice || 0)
        .filter((price) => price > 0);
      if (activePrices.length === 0) return null;
      return { min: Math.min(...activePrices), max: Math.max(...activePrices) };
    },
    [subProductStocks]
  );

  const getVariantsInStock = useCallback(
    (product: ProductWithVariants): number => {
      if (!product.variants) return 0;
      return product.variants.filter((v) => v.isActive && subProductStocks.has(v._id)).length;
    },
    [subProductStocks]
  );

  const isVariantInCart = useCallback(
    (variantId: string): boolean => {
      return cartItems.some((item) => item.subProductId === variantId);
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
  // Render Breadcrumb with Search
  // =============================================
  const renderBreadcrumb = () => (
    <Card className="mb-3">
      <CardContent className="py-3 px-4">
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
              {navigation.selectedCategory && (
                <>
                  <BreadcrumbSeparator><ChevronRight className="w-4 h-4" /></BreadcrumbSeparator>
                  <BreadcrumbItem>
                    {navigation.view === "products" ? (
                      <BreadcrumbPage className="flex items-center font-semibold text-sm">
                        <Layers className="w-4 h-4 mr-1" />
                        {navigation.selectedCategory.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink 
                        onClick={() => navigateToProducts(navigation.selectedCategory!)} 
                        className="flex items-center cursor-pointer hover:text-blue-600 text-sm font-medium"
                      >
                        <Layers className="w-4 h-4 mr-1" />
                        {navigation.selectedCategory.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </>
              )}
              {navigation.selectedProduct && (
                <>
                  <BreadcrumbSeparator><ChevronRight className="w-4 h-4" /></BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="flex items-center font-semibold text-sm">
                      <Box className="w-4 h-4 mr-1" />
                      {navigation.selectedProduct.name}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
              {navigation.view === "search" && (
                <>
                  <BreadcrumbSeparator><ChevronRight className="w-4 h-4" /></BreadcrumbSeparator>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="flex items-center font-semibold text-sm">
                      <Search className="w-4 h-4 mr-1" />
                      Search Results
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="pl-9 pr-8 h-9 text-sm w-56"
              />
              {searchTerm && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !searchTerm.trim()} size="sm" className="h-9 px-3 bg-blue-500 hover:bg-blue-600">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // =============================================
  // Render Categories View
  // =============================================
  const renderCategories = () => (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Select Category</h2>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {categories.map((category) => (
          <div
            key={category._id}
            onClick={() => navigateToProducts(category)}
            className="cursor-pointer bg-white border rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all text-center"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900 text-sm line-clamp-1">{category.name}</h3>
            <p className="text-xs text-gray-500">{getProductCount(category._id)} products</p>
          </div>
        ))}
      </div>
      {categories.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No categories found</p>
        </div>
      )}
    </div>
  );

  // =============================================
  // Render Products View
  // =============================================
  const renderProducts = () => (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">{navigation.selectedCategory?.name}</h2>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {categoryProducts.map((product) => {
          const priceRange = getPriceRange(product);
          const variantsInStock = getVariantsInStock(product);
          const productImage = getProductImage(product);
          
          return (
            <div
              key={product._id}
              onClick={() => navigateToSubProducts(product)}
              className="cursor-pointer bg-white border rounded-lg overflow-hidden hover:shadow-md hover:border-green-300 transition-all"
            >
              <div className="h-24 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                {productImage ? (
                  <img 
                    src={productImage} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`flex items-center justify-center ${productImage ? 'hidden' : ''}`}>
                  <Package className="w-10 h-10 text-gray-400" />
                </div>
              </div>
              <div className="p-2">
                <h3 className="font-medium text-gray-900 text-sm line-clamp-1">{product.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  {priceRange ? (
                    <span className="text-green-600 font-bold text-sm">
                      ₹{priceRange.min}{priceRange.min !== priceRange.max && `+`}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                  <Badge variant={variantsInStock > 0 ? "default" : "destructive"} className="text-xs px-1.5 py-0.5">
                    {variantsInStock} in stock
                  </Badge>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {categoryProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No products found</p>
        </div>
      )}
    </div>
  );

  // =============================================
  // Render Sub-Products View
  // =============================================
  const renderSubProducts = () => {
    const product = navigation.selectedProduct;
    if (!product) return null;

    const activeProductVariants = product.variants?.filter((v) => v.isActive) || [];
    const variantsWithStock = activeProductVariants.filter((v) => subProductStocks.has(v._id));
    const variantsWithoutStock = activeProductVariants.filter((v) => !subProductStocks.has(v._id));

    return (
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
          {product.description && <p className="text-sm text-gray-500 mt-1">{product.description}</p>}
        </div>

        {variantsWithStock.length > 0 && (
          <div className="mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              Available ({variantsWithStock.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {variantsWithStock.map((variant) => {
                const stockInfo = subProductStocks.get(variant._id)!;
                const isActive = selectedVariantIds[variant._id] ?? false;
                const quantity = quantities[variant._id] || 1;
                const isEditing = editingVariantId === variant._id;
                const isRefreshing = refreshingStocks.has(variant._id);
                const lowStock = hasLowStock(variant);
                const inCart = isVariantInCart(variant._id);

                return (
                  <div
                    key={variant._id}
                    className={`bg-white border-2 rounded-lg overflow-hidden transition-all ${
                      inCart ? "border-blue-300 bg-blue-50" : lowStock ? "border-orange-200" : "border-green-200"
                    }`}
                  >
                    <div className="relative h-28 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                      {variant.imageURL ? (
                        <img 
                          src={variant.imageURL} 
                          alt={variant.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`flex items-center justify-center ${variant.imageURL ? 'hidden' : ''}`}>
                        <Package className="w-10 h-10 text-gray-300" />
                      </div>
                      
                      <div className="absolute top-1.5 left-1.5">
                        <Badge 
                          variant={lowStock ? "destructive" : "default"} 
                          className={`text-xs px-1.5 py-0.5 ${lowStock ? "bg-orange-500" : "bg-green-500"}`}
                        >
                          {stockInfo.quantityLeft}
                        </Badge>
                      </div>
                      {variant.size && (
                        <Badge variant="outline" className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 bg-white">
                          {variant.size}
                        </Badge>
                      )}
                      <Button
                        onClick={(e) => { e.stopPropagation(); refreshStockForSubProduct(variant._id); }}
                        disabled={isRefreshing}
                        variant="ghost"
                        size="sm"
                        className="absolute bottom-1.5 right-1.5 h-6 w-6 p-0 bg-white/80 hover:bg-white"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                      </Button>
                    </div>

                    <div className="p-2.5">
                      <h4 className="font-medium text-gray-900 text-sm line-clamp-1 mb-1">{variant.name}</h4>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-bold text-green-600">₹{stockInfo.sellingPrice}</span>
                        {lowStock && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                      </div>

                      {inCart && <Badge className="mb-2 bg-blue-500 text-xs">In cart</Badge>}

                      {!isActive ? (
                        <Button 
                          onClick={() => handleInitialAddToCart(variant._id)} 
                          size="sm" 
                          className="w-full h-8 text-sm bg-green-500 hover:bg-green-600"
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleQuantityChange(variant._id, quantity - 1, stockInfo.quantityLeft)} 
                              disabled={quantity <= 1} 
                              className="h-7 w-7 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            {isEditing ? (
                              <Input
                                type="text"
                                value={editingValue}
                                onChange={handleManualQuantityChange}
                                onBlur={() => handleQuantityBlur(variant._id, stockInfo.quantityLeft)}
                                onKeyDown={(e) => handleQuantityKeyPress(e, variant._id, stockInfo.quantityLeft)}
                                className="w-12 h-7 text-center text-sm p-0"
                                autoFocus
                              />
                            ) : (
                              <span 
                                onClick={() => handleQuantityClick(variant._id, quantity)} 
                                className="w-10 text-center font-medium text-sm cursor-pointer hover:bg-gray-100 rounded py-1"
                              >
                                {quantity}
                              </span>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleQuantityChange(variant._id, quantity + 1, stockInfo.quantityLeft)} 
                              disabled={quantity >= stockInfo.quantityLeft} 
                              className="h-7 w-7 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button 
                            onClick={() => handleFinalAddToCart(variant, product)} 
                            size="sm" 
                            className="w-full h-8 text-sm bg-green-500 hover:bg-green-600"
                          >
                            <ShoppingCart className="w-4 h-4 mr-1" />
                            Add {quantity}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {variantsWithoutStock.length > 0 && (
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Out of Stock ({variantsWithoutStock.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {variantsWithoutStock.map((variant) => {
                const isRefreshing = refreshingStocks.has(variant._id);
                return (
                  <div key={variant._id} className="bg-white border rounded-lg overflow-hidden opacity-60">
                    <div className="relative h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
                      {variant.imageURL ? (
                        <img 
                          src={variant.imageURL} 
                          alt={variant.name}
                          className="w-full h-full object-cover grayscale"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`flex items-center justify-center ${variant.imageURL ? 'hidden' : ''}`}>
                        <Package className="w-10 h-10 text-gray-400" />
                      </div>
                      <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5">Out</Badge>
                      <Button 
                        onClick={() => refreshStockForSubProduct(variant._id)} 
                        disabled={isRefreshing} 
                        variant="ghost" 
                        size="sm" 
                        className="absolute bottom-1.5 right-1.5 h-6 w-6 p-0 bg-white/80 hover:bg-white"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                    <div className="p-2.5">
                      <h4 className="font-medium text-gray-600 text-sm line-clamp-1">{variant.name}</h4>
                      <Button disabled size="sm" className="w-full h-8 text-sm mt-2">Out of Stock</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeProductVariants.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No variants found</p>
          </div>
        )}
      </div>
    );
  };

  // =============================================
  // Render Search Results
  // =============================================
  const renderSearchResults = () => (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Search Results</h2>
        <p className="text-sm text-gray-500">{searchResults.length} results for "{searchTerm}"</p>
      </div>

      {searchResults.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No results found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {searchResults.filter((r) => r.type === "category").length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Categories
              </h3>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {searchResults.filter((r) => r.type === "category").map((result) => (
                  <div 
                    key={result.id} 
                    onClick={() => handleSearchResultClick(result)} 
                    className="cursor-pointer bg-white border rounded-lg p-3 hover:shadow-md hover:border-blue-300 text-center"
                  >
                    <Layers className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{result.name}</h4>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchResults.filter((r) => r.type === "product").length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                Products
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {searchResults.filter((r) => r.type === "product").map((result) => {
                  const product = result.product!;
                  const priceRange = getPriceRange(product);
                  const productImage = getProductImage(product);
                  
                  return (
                    <div 
                      key={result.id} 
                      onClick={() => handleSearchResultClick(result)} 
                      className="cursor-pointer bg-white border rounded-lg overflow-hidden hover:shadow-md hover:border-green-300"
                    >
                      <div className="h-20 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                        {productImage ? (
                          <img 
                            src={productImage} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`flex items-center justify-center ${productImage ? 'hidden' : ''}`}>
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      </div>
                      <div className="p-2">
                        <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{result.name}</h4>
                        {priceRange && <span className="text-green-600 font-bold text-sm">₹{priceRange.min}+</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {searchResults.filter((r) => r.type === "subProduct").length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Box className="w-5 h-5 text-purple-600" />
                Variants
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {searchResults.filter((r) => r.type === "subProduct").map((result) => {
                  const variant = result.variant!;
                  const product = result.product!;
                  const stockInfo = subProductStocks.get(variant._id);
                  const outOfStock = isOutOfStock(variant._id);
                  const inCart = isVariantInCart(variant._id);

                  return (
                    <div 
                      key={result.id} 
                      className={`bg-white border-2 rounded-lg overflow-hidden ${
                        inCart ? "border-blue-300 bg-blue-50" : outOfStock ? "border-gray-200 opacity-60" : "border-green-200"
                      }`}
                    >
                      <div className="relative h-20 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                        {variant.imageURL ? (
                          <img 
                            src={variant.imageURL} 
                            alt={variant.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`flex items-center justify-center ${variant.imageURL ? 'hidden' : ''}`}>
                          <Box className="w-8 h-8 text-gray-300" />
                        </div>
                        {stockInfo && (
                          <Badge 
                            variant={stockInfo.quantityLeft <= 5 ? "destructive" : "default"} 
                            className={`absolute top-1.5 left-1.5 text-xs px-1.5 py-0.5 ${
                              stockInfo.quantityLeft <= 5 ? "bg-orange-500" : "bg-green-500"
                            }`}
                          >
                            {stockInfo.quantityLeft}
                          </Badge>
                        )}
                      </div>
                      <div className="p-2">
                        <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{result.name}</h4>
                        <p className="text-xs text-gray-500 line-clamp-1">{result.description}</p>
                        {stockInfo && <span className="text-base font-bold text-green-600">₹{stockInfo.sellingPrice}</span>}
                        <div className="flex gap-1.5 mt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); handleSearchResultClick(result); }} 
                            className="flex-1 h-7 text-xs"
                          >
                            View
                          </Button>
                          {!outOfStock && (
                            <Button 
                              size="sm" 
                              onClick={(e) => { e.stopPropagation(); handleDirectAddToCart(variant, product); }} 
                              className="flex-1 h-7 text-xs bg-green-500 hover:bg-green-600"
                            >
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // =============================================
  // Main Render
  // =============================================
  return (
    <div className="space-y-3">
      {renderBreadcrumb()}
      <Card>
        <CardContent className="p-4 min-h-[600px]">
          {navigation.view === "categories" && renderCategories()}
          {navigation.view === "products" && renderProducts()}
          {navigation.view === "subProducts" && renderSubProducts()}
          {navigation.view === "search" && renderSearchResults()}
        </CardContent>
      </Card>
    </div>
  );
}
// "use client";

// import { useState, useCallback, useMemo, JSX } from "react";
// import { useQuery, useQueryClient } from "@tanstack/react-query";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Card, CardContent } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import {
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbLink,
//   BreadcrumbList,
//   BreadcrumbPage,
//   BreadcrumbSeparator,
// } from "@/components/ui/breadcrumb";
// import {
//   Package,
//   AlertTriangle,
//   ShoppingCart,
//   Plus,
//   Minus,
//   RefreshCw,
//   Loader2,
//   Home,
//   ChevronRight,
//   Box,
//   Layers,
//   Search,
//   X,
// } from "lucide-react";
// import { toast } from "sonner";

// import type {
//   ApiResponse,
//   CartItem,
//   ProductWithVariants,
//   SubProductWithStock,
//   StockInfo,
//   ProductsInventoryResponse,
//   StockFIFOResponse,
//   CategoryRef,
// } from "@/types/pos";
// import type { Category, CategoriesResponse } from "@/types/category";

// // =============================================
// // Types
// // =============================================
// type NavigationView = "categories" | "products" | "subProducts" | "search";

// interface NavigationState {
//   view: NavigationView;
//   selectedCategory: Category | null;
//   selectedProduct: ProductWithVariants | null;
// }

// interface ProductNavigationProps {
//   onAddToCart: (item: CartItem) => void;
//   cartItems: CartItem[];
// }

// interface SearchResult {
//   type: "category" | "product" | "subProduct";
//   id: string;
//   name: string;
//   description?: string;
//   category?: Category;
//   product?: ProductWithVariants;
//   variant?: SubProductWithStock;
//   price?: number;
//   stock?: number;
// }

// // =============================================
// // Helper Functions
// // =============================================
// function isCategoryRef(
//   categoryId: CategoryRef | string | null | undefined
// ): categoryId is CategoryRef {
//   return (
//     categoryId !== null &&
//     categoryId !== undefined &&
//     typeof categoryId === "object" &&
//     "_id" in categoryId
//   );
// }

// function extractCategoryId(
//   categoryId: CategoryRef | string | null | undefined
// ): string | null {
//   if (!categoryId) return null;
//   if (typeof categoryId === "string") return categoryId;
//   if (isCategoryRef(categoryId)) return categoryId._id;
//   return null;
// }

// function extractCategoryName(
//   categoryId: CategoryRef | string | null | undefined
// ): string | null {
//   if (isCategoryRef(categoryId)) return categoryId.name;
//   return null;
// }

// // =============================================
// // Component
// // =============================================
// export default function ProductNavigation({
//   onAddToCart,
//   cartItems,
// }: ProductNavigationProps): JSX.Element {
//   const queryClient = useQueryClient();

//   const [navigation, setNavigation] = useState<NavigationState>({
//     view: "categories",
//     selectedCategory: null,
//     selectedProduct: null,
//   });

//   const [searchTerm, setSearchTerm] = useState("");
//   const [isSearching, setIsSearching] = useState(false);
//   const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, boolean>>({});
//   const [quantities, setQuantities] = useState<Record<string, number>>({});
//   const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
//   const [editingValue, setEditingValue] = useState("");
//   const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());

//   // =============================================
//   // Data Fetching
//   // =============================================
//   const { data: productsResponse, isLoading: productsLoading } = useQuery<
//     ApiResponse<ProductsInventoryResponse>,
//     Error
//   >({
//     queryKey: ["products-inventory"],
//     queryFn: async () => {
//       const response = await fetch("/api/inventories");
//       if (!response.ok) throw new Error("Failed to fetch products");
//       const data: ApiResponse<ProductsInventoryResponse> = await response.json();
//       if (!data.success || !data.data) {
//         throw new Error(data.error?.message || "Failed to fetch products");
//       }
//       return data;
//     },
//   });

//   const { data: categoriesResponse, isLoading: categoriesLoading } = useQuery<
//     ApiResponse<CategoriesResponse>,
//     Error
//   >({
//     queryKey: ["categories-active"],
//     queryFn: async () => {
//       const response = await fetch("/api/categories");
//       if (!response.ok) throw new Error("Failed to fetch categories");
//       const data: ApiResponse<CategoriesResponse> = await response.json();
//       if (!data.success || !data.data) {
//         throw new Error(data.error?.message || "Failed to fetch categories");
//       }
//       return data;
//     },
//   });

//   const { data: stocksResponse } = useQuery<ApiResponse<StockFIFOResponse>, Error>({
//     queryKey: ["fifo-stocks"],
//     queryFn: async () => {
//       const response = await fetch("/api/stock/fifo/oldest-all");
//       if (!response.ok) throw new Error("Failed to fetch stocks");
//       const data: ApiResponse<StockFIFOResponse> = await response.json();
//       if (!data.success || !data.data) {
//         throw new Error(data.error?.message || "Failed to fetch stocks");
//       }
//       return data;
//     },
//     enabled: !!productsResponse,
//     staleTime: 0,
//   });

//   // =============================================
//   // Memoized Data
//   // =============================================
//   const subProductStocks = useMemo((): Map<string, StockInfo> => {
//     const stocksMap = new Map<string, StockInfo>();
//     if (stocksResponse?.data?.data) {
//       stocksResponse.data.data.forEach((item) => {
//         if (item.currentStock) {
//           stocksMap.set(item.subProductId, item.currentStock);
//         }
//       });
//     }
//     return stocksMap;
//   }, [stocksResponse]);

//   const categories = useMemo((): Category[] => {
//     return categoriesResponse?.data?.categories?.filter((cat) => cat.isActive) || [];
//   }, [categoriesResponse]);

//   const getCategoryNameById = useCallback(
//     (categoryId: string | null): string => {
//       if (!categoryId) return "Uncategorized";
//       const category = categories.find((cat) => cat._id === categoryId);
//       return category?.name || "Uncategorized";
//     },
//     [categories]
//   );

//   const getCategoryById = useCallback(
//     (categoryId: string | null): Category | null => {
//       if (!categoryId) return null;
//       return categories.find((cat) => cat._id === categoryId) || null;
//     },
//     [categories]
//   );

//   const products = useMemo((): ProductWithVariants[] => {
//     if (!productsResponse?.data?.products) return [];
//     return productsResponse.data.products
//       .filter((product) => product.isActive)
//       .map((product): ProductWithVariants => {
//         const categoryName =
//           extractCategoryName(product.categoryId) ||
//           getCategoryNameById(extractCategoryId(product.categoryId));
//         return {
//           ...product,
//           variantCount: product.variants?.length || 0,
//           categoryName,
//           variants: product.variants?.map((variant) => ({
//             ...variant,
//             currentStock: subProductStocks.get(variant._id) || null,
//           })),
//         };
//       });
//   }, [productsResponse, subProductStocks, getCategoryNameById]);

//   const categoryProducts = useMemo((): ProductWithVariants[] => {
//     if (!navigation.selectedCategory) return [];
//     return products.filter((product) => {
//       const productCategoryId = extractCategoryId(product.categoryId);
//       return productCategoryId === navigation.selectedCategory?._id;
//     });
//   }, [products, navigation.selectedCategory]);

//   const getProductCount = useCallback(
//     (categoryId: string): number => {
//       return products.filter((product) => {
//         const productCategoryId = extractCategoryId(product.categoryId);
//         return productCategoryId === categoryId;
//       }).length;
//     },
//     [products]
//   );

//   // =============================================
//   // Search Functionality
//   // =============================================
//   const searchResults = useMemo((): SearchResult[] => {
//     if (!searchTerm.trim()) return [];
//     const term = searchTerm.toLowerCase().trim();
//     const results: SearchResult[] = [];

//     categories.forEach((category) => {
//       if (category.name.toLowerCase().includes(term)) {
//         results.push({
//           type: "category",
//           id: category._id,
//           name: category.name,
//           description: `${getProductCount(category._id)} products`,
//           category,
//         });
//       }
//     });

//     products.forEach((product) => {
//       if (
//         product.name.toLowerCase().includes(term) ||
//         product.description?.toLowerCase().includes(term)
//       ) {
//         const categoryId = extractCategoryId(product.categoryId);
//         const category = categoryId ? getCategoryById(categoryId) : null;
//         results.push({
//           type: "product",
//           id: product._id,
//           name: product.name,
//           description: product.categoryName,
//           category: category || undefined,
//           product,
//         });
//       }

//       product.variants?.forEach((variant) => {
//         if (
//           variant.isActive &&
//           (variant.name.toLowerCase().includes(term) ||
//             variant.description?.toLowerCase().includes(term))
//         ) {
//           const categoryId = extractCategoryId(product.categoryId);
//           const category = categoryId ? getCategoryById(categoryId) : null;
//           const stockInfo = subProductStocks.get(variant._id);
//           results.push({
//             type: "subProduct",
//             id: variant._id,
//             name: variant.name,
//             description: `${product.name} • ${product.categoryName}`,
//             category: category || undefined,
//             product,
//             variant,
//             price: stockInfo?.sellingPrice,
//             stock: stockInfo?.quantityLeft,
//           });
//         }
//       });
//     });

//     return results;
//   }, [searchTerm, categories, products, getProductCount, getCategoryById, subProductStocks]);

//   const handleSearch = useCallback(() => {
//     if (!searchTerm.trim()) {
//       toast.error("Please enter a search term");
//       return;
//     }
//     setIsSearching(true);
//     setNavigation({ view: "search", selectedCategory: null, selectedProduct: null });
//     setTimeout(() => setIsSearching(false), 300);
//   }, [searchTerm]);

//   const handleSearchKeyPress = useCallback(
//     (e: React.KeyboardEvent) => {
//       if (e.key === "Enter") handleSearch();
//     },
//     [handleSearch]
//   );

//   const clearSearch = useCallback(() => {
//     setSearchTerm("");
//     setNavigation({ view: "categories", selectedCategory: null, selectedProduct: null });
//   }, []);

//   const handleSearchResultClick = useCallback(
//     (result: SearchResult) => {
//       setSearchTerm("");
//       if (result.type === "category" && result.category) {
//         setNavigation({ view: "products", selectedCategory: result.category, selectedProduct: null });
//       } else if (result.type === "product" && result.product) {
//         const categoryId = extractCategoryId(result.product.categoryId);
//         const category = categoryId ? getCategoryById(categoryId) : null;
//         setNavigation({ view: "subProducts", selectedCategory: category, selectedProduct: result.product });
//       } else if (result.type === "subProduct" && result.product) {
//         const categoryId = extractCategoryId(result.product.categoryId);
//         const category = categoryId ? getCategoryById(categoryId) : null;
//         setNavigation({ view: "subProducts", selectedCategory: category, selectedProduct: result.product });
//       }
//     },
//     [getCategoryById]
//   );

//   // =============================================
//   // Navigation Handlers
//   // =============================================
//   const navigateToCategories = useCallback(() => {
//     setNavigation({ view: "categories", selectedCategory: null, selectedProduct: null });
//     setSelectedVariantIds({});
//     setQuantities({});
//     setSearchTerm("");
//   }, []);

//   const navigateToProducts = useCallback((category: Category) => {
//     setNavigation({ view: "products", selectedCategory: category, selectedProduct: null });
//     setSelectedVariantIds({});
//     setQuantities({});
//   }, []);

//   const navigateToSubProducts = useCallback(
//     (product: ProductWithVariants) => {
//       setNavigation({ view: "subProducts", selectedCategory: navigation.selectedCategory, selectedProduct: product });
//       setSelectedVariantIds({});
//       setQuantities({});
//     },
//     [navigation.selectedCategory]
//   );

//   // =============================================
//   // Stock Management
//   // =============================================
//   const refreshStockForSubProduct = useCallback(
//     async (subProductId: string): Promise<void> => {
//       setRefreshingStocks((prev) => new Set(prev).add(subProductId));
//       try {
//         const response = await fetch(`/api/stock/fifo/oldest-single?subProductId=${subProductId}`);
//         if (response.ok) {
//           const result: ApiResponse<StockInfo> = await response.json();
//           queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(["fifo-stocks"], (oldData) => {
//             if (!oldData?.data?.data) return oldData;
//             const stocksArray = [...oldData.data.data];
//             const index = stocksArray.findIndex((item) => item.subProductId === subProductId);
//             if (result.success && result.data) {
//               const newItem = { subProductId, currentStock: result.data };
//               if (index >= 0) stocksArray[index] = newItem;
//               else stocksArray.push(newItem);
//               toast.success("Stock refreshed");
//             } else {
//               if (index >= 0) stocksArray.splice(index, 1);
//               toast.info("No stock available");
//             }
//             return { ...oldData, data: { ...oldData.data, data: stocksArray } };
//           });
//         }
//       } catch (error) {
//         console.error("Error refreshing stock:", error);
//         toast.error("Failed to refresh stock");
//       } finally {
//         setRefreshingStocks((prev) => {
//           const updated = new Set(prev);
//           updated.delete(subProductId);
//           return updated;
//         });
//       }
//     },
//     [queryClient]
//   );

//   const updateStockInCache = useCallback(
//     (subProductId: string, quantityReduced: number): void => {
//       queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(["fifo-stocks"], (oldData) => {
//         if (!oldData?.data?.data) return oldData;
//         const stocksArray = [...oldData.data.data];
//         const index = stocksArray.findIndex((item) => item.subProductId === subProductId);
//         if (index >= 0 && stocksArray[index].currentStock) {
//           const currentStock = stocksArray[index].currentStock!;
//           const newQuantity = currentStock.quantityLeft - quantityReduced;
//           if (newQuantity <= 0) stocksArray.splice(index, 1);
//           else stocksArray[index] = { ...stocksArray[index], currentStock: { ...currentStock, quantityLeft: newQuantity } };
//         }
//         return { ...oldData, data: { ...oldData.data, data: stocksArray } };
//       });
//     },
//     [queryClient]
//   );

//   // =============================================
//   // Cart Handlers
//   // =============================================
//   const handleInitialAddToCart = useCallback((variantId: string): void => {
//     setSelectedVariantIds((prev) => ({ ...prev, [variantId]: true }));
//     setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
//   }, []);

//   const handleQuantityChange = useCallback((variantId: string, newQuantity: number, maxStock: number): void => {
//     if (newQuantity < 1) {
//       setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
//       return;
//     }
//     if (newQuantity > maxStock) {
//       toast.error(`Only ${maxStock} units available`);
//       setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
//       return;
//     }
//     setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
//   }, []);

//   const handleQuantityClick = useCallback((variantId: string, currentQuantity: number): void => {
//     setEditingVariantId(variantId);
//     setEditingValue(currentQuantity.toString());
//   }, []);

//   const handleManualQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
//     const value = e.target.value;
//     if (value === "" || /^\d+$/.test(value)) setEditingValue(value);
//   }, []);

//   const handleQuantityBlur = useCallback(
//     (variantId: string, maxStock: number): void => {
//       const newQuantity = parseInt(editingValue, 10) || 1;
//       if (newQuantity < 1) {
//         toast.error("Quantity must be at least 1");
//         setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
//       } else if (newQuantity > maxStock) {
//         toast.error(`Only ${maxStock} units available`);
//         setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
//       } else {
//         setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
//       }
//       setEditingVariantId(null);
//       setEditingValue("");
//     },
//     [editingValue]
//   );

//   const handleQuantityKeyPress = useCallback(
//     (e: React.KeyboardEvent, variantId: string, maxStock: number): void => {
//       if (e.key === "Enter") handleQuantityBlur(variantId, maxStock);
//       else if (e.key === "Escape") {
//         setEditingVariantId(null);
//         setEditingValue("");
//       }
//     },
//     [handleQuantityBlur]
//   );

//   const handleFinalAddToCart = useCallback(
//     (variant: SubProductWithStock, product: ProductWithVariants): void => {
//       const stockInfo = subProductStocks.get(variant._id);
//       if (!stockInfo) {
//         toast.error("No stock information available");
//         return;
//       }
//       const quantity = quantities[variant._id] || 1;
//       updateStockInCache(variant._id, quantity);
//       const cartItem: CartItem = {
//         itemKey: `sub:${variant._id}`,
//         subProductId: variant._id,
//         productId: product._id,
//         name: variant.name,
//         price: stockInfo.sellingPrice,
//         quantity,
//         stock: stockInfo.quantityLeft,
//         itemType: "subProduct",
//         stockTransactionId: stockInfo.stockTransactionId,
//       };
//       onAddToCart(cartItem);
//       toast.success(`${quantity} × ${variant.name} added to cart`);
//       setSelectedVariantIds((prev) => ({ ...prev, [variant._id]: false }));
//       setQuantities((prev) => ({ ...prev, [variant._id]: 1 }));
//     },
//     [quantities, subProductStocks, updateStockInCache, onAddToCart]
//   );

//   const handleDirectAddToCart = useCallback(
//     (variant: SubProductWithStock, product: ProductWithVariants): void => {
//       const stockInfo = subProductStocks.get(variant._id);
//       if (!stockInfo) {
//         toast.error("No stock information available");
//         return;
//       }
//       if (stockInfo.quantityLeft <= 0) {
//         toast.error("Product is out of stock");
//         return;
//       }
//       updateStockInCache(variant._id, 1);
//       const cartItem: CartItem = {
//         itemKey: `sub:${variant._id}`,
//         subProductId: variant._id,
//         productId: product._id,
//         name: variant.name,
//         price: stockInfo.sellingPrice,
//         quantity: 1,
//         stock: stockInfo.quantityLeft,
//         itemType: "subProduct",
//         stockTransactionId: stockInfo.stockTransactionId,
//       };
//       onAddToCart(cartItem);
//       toast.success(`${variant.name} added to cart`);
//     },
//     [subProductStocks, updateStockInCache, onAddToCart]
//   );

//   // =============================================
//   // Helper Functions
//   // =============================================
//   const hasLowStock = useCallback(
//     (variant: SubProductWithStock): boolean => {
//       const stockInfo = subProductStocks.get(variant._id);
//       if (!stockInfo) return true;
//       return stockInfo.quantityLeft <= (variant.lowStockThreshold || 5);
//     },
//     [subProductStocks]
//   );

//   const isOutOfStock = useCallback(
//     (variantId: string): boolean => {
//       const stockInfo = subProductStocks.get(variantId);
//       return !stockInfo || stockInfo.quantityLeft <= 0;
//     },
//     [subProductStocks]
//   );

//   const getPriceRange = useCallback(
//     (product: ProductWithVariants): { min: number; max: number } | null => {
//       if (!product.variants || product.variants.length === 0) return null;
//       const activePrices = product.variants
//         .filter((v) => v.isActive && subProductStocks.get(v._id))
//         .map((v) => subProductStocks.get(v._id)?.sellingPrice || 0)
//         .filter((price) => price > 0);
//       if (activePrices.length === 0) return null;
//       return { min: Math.min(...activePrices), max: Math.max(...activePrices) };
//     },
//     [subProductStocks]
//   );

//   const getVariantsInStock = useCallback(
//     (product: ProductWithVariants): number => {
//       if (!product.variants) return 0;
//       return product.variants.filter((v) => v.isActive && subProductStocks.has(v._id)).length;
//     },
//     [subProductStocks]
//   );

//   const isVariantInCart = useCallback(
//     (variantId: string): boolean => {
//       return cartItems.some((item) => item.subProductId === variantId);
//     },
//     [cartItems]
//   );

//   // =============================================
//   // Loading State
//   // =============================================
//   if (productsLoading || categoriesLoading) {
//     return (
//       <div className="flex items-center justify-center py-8">
//         <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
//         <span className="ml-2 text-gray-600 text-sm">Loading...</span>
//       </div>
//     );
//   }

//   // =============================================
//   // Render Breadcrumb with Search (Compact)
//   // =============================================
//   const renderBreadcrumb = () => (
//     <div className="bg-white rounded-lg shadow-sm border px-3 py-2 mb-2">
//       <div className="flex items-center justify-between gap-2">
//         <Breadcrumb>
//           <BreadcrumbList className="text-sm">
//             <BreadcrumbItem>
//               <BreadcrumbLink onClick={navigateToCategories} className="flex items-center cursor-pointer hover:text-blue-600 text-xs">
//                 <Home className="w-3 h-3 mr-1" />
//                 Categories
//               </BreadcrumbLink>
//             </BreadcrumbItem>
//             {navigation.selectedCategory && (
//               <>
//                 <BreadcrumbSeparator><ChevronRight className="w-3 h-3" /></BreadcrumbSeparator>
//                 <BreadcrumbItem>
//                   {navigation.view === "products" ? (
//                     <BreadcrumbPage className="flex items-center font-medium text-xs">
//                       <Layers className="w-3 h-3 mr-1" />
//                       {navigation.selectedCategory.name}
//                     </BreadcrumbPage>
//                   ) : (
//                     <BreadcrumbLink onClick={() => navigateToProducts(navigation.selectedCategory!)} className="flex items-center cursor-pointer hover:text-blue-600 text-xs">
//                       <Layers className="w-3 h-3 mr-1" />
//                       {navigation.selectedCategory.name}
//                     </BreadcrumbLink>
//                   )}
//                 </BreadcrumbItem>
//               </>
//             )}
//             {navigation.selectedProduct && (
//               <>
//                 <BreadcrumbSeparator><ChevronRight className="w-3 h-3" /></BreadcrumbSeparator>
//                 <BreadcrumbItem>
//                   <BreadcrumbPage className="flex items-center font-medium text-xs">
//                     <Box className="w-3 h-3 mr-1" />
//                     {navigation.selectedProduct.name}
//                   </BreadcrumbPage>
//                 </BreadcrumbItem>
//               </>
//             )}
//             {navigation.view === "search" && (
//               <>
//                 <BreadcrumbSeparator><ChevronRight className="w-3 h-3" /></BreadcrumbSeparator>
//                 <BreadcrumbItem>
//                   <BreadcrumbPage className="flex items-center font-medium text-xs">
//                     <Search className="w-3 h-3 mr-1" />
//                     Search
//                   </BreadcrumbPage>
//                 </BreadcrumbItem>
//               </>
//             )}
//           </BreadcrumbList>
//         </Breadcrumb>

//         <div className="flex items-center gap-1">
//           <div className="relative">
//             <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
//             <Input
//               type="text"
//               placeholder="Search..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               onKeyPress={handleSearchKeyPress}
//               className="pl-7 pr-7 h-7 text-xs w-48"
//             />
//             {searchTerm && (
//               <button onClick={clearSearch} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
//                 <X className="w-3 h-3" />
//               </button>
//             )}
//           </div>
//           <Button onClick={handleSearch} disabled={isSearching || !searchTerm.trim()} size="sm" className="h-7 px-2 bg-blue-500 hover:bg-blue-600">
//             {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
//           </Button>
//         </div>
//       </div>
//     </div>
//   );

//   // =============================================
//   // Render Categories View (Compact)
//   // =============================================
//   const renderCategories = () => (
//     <div>
//       <div className="mb-3">
//         <h2 className="text-lg font-bold text-gray-900">Select Category</h2>
//       </div>
//       <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
//         {categories.map((category) => (
//           <div
//             key={category._id}
//             onClick={() => navigateToProducts(category)}
//             className="cursor-pointer bg-white border rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all text-center"
//           >
//             <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
//               <Package className="w-5 h-5 text-blue-600" />
//             </div>
//             <h3 className="font-medium text-gray-900 text-xs line-clamp-1">{category.name}</h3>
//             <p className="text-xs text-gray-500">{getProductCount(category._id)}</p>
//           </div>
//         ))}
//       </div>
//       {categories.length === 0 && (
//         <div className="text-center py-8">
//           <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
//           <p className="text-gray-600 text-sm">No categories found</p>
//         </div>
//       )}
//     </div>
//   );

//   // =============================================
//   // Render Products View (Compact)
//   // =============================================
//   const renderProducts = () => (
//     <div>
//       <div className="mb-3">
//         <h2 className="text-lg font-bold text-gray-900">{navigation.selectedCategory?.name}</h2>
//       </div>
//       <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
//         {categoryProducts.map((product) => {
//           const priceRange = getPriceRange(product);
//           const variantsInStock = getVariantsInStock(product);
//           return (
//             <div
//               key={product._id}
//               onClick={() => navigateToSubProducts(product)}
//               className="cursor-pointer bg-white border rounded-lg overflow-hidden hover:shadow-md hover:border-green-300 transition-all"
//             >
//               <div className="h-16 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
//                 <Package className="w-8 h-8 text-gray-400" />
//               </div>
//               <div className="p-2">
//                 <h3 className="font-medium text-gray-900 text-xs line-clamp-1">{product.name}</h3>
//                 <div className="flex items-center justify-between mt-1">
//                   {priceRange ? (
//                     <span className="text-green-600 font-bold text-xs">
//                       ₹{priceRange.min}{priceRange.min !== priceRange.max && `+`}
//                     </span>
//                   ) : (
//                     <span className="text-gray-400 text-xs">-</span>
//                   )}
//                   <Badge variant={variantsInStock > 0 ? "default" : "destructive"} className="text-[10px] px-1 py-0 h-4">
//                     {variantsInStock}
//                   </Badge>
//                 </div>
//               </div>
//             </div>
//           );
//         })}
//       </div>
//       {categoryProducts.length === 0 && (
//         <div className="text-center py-8">
//           <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
//           <p className="text-gray-600 text-sm">No products found</p>
//         </div>
//       )}
//     </div>
//   );

//   // =============================================
//   // Render Sub-Products View (Compact)
//   // =============================================
//   const renderSubProducts = () => {
//     const product = navigation.selectedProduct;
//     if (!product) return null;

//     const activeProductVariants = product.variants?.filter((v) => v.isActive) || [];
//     const variantsWithStock = activeProductVariants.filter((v) => subProductStocks.has(v._id));
//     const variantsWithoutStock = activeProductVariants.filter((v) => !subProductStocks.has(v._id));

//     return (
//       <div>
//         <div className="mb-3">
//           <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>
//           {product.description && <p className="text-xs text-gray-500">{product.description}</p>}
//         </div>

//         {variantsWithStock.length > 0 && (
//           <div className="mb-4">
//             <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
//               <Package className="w-4 h-4 text-green-600" />
//               Available ({variantsWithStock.length})
//             </h3>
//             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
//               {variantsWithStock.map((variant) => {
//                 const stockInfo = subProductStocks.get(variant._id)!;
//                 const isActive = selectedVariantIds[variant._id] ?? false;
//                 const quantity = quantities[variant._id] || 1;
//                 const isEditing = editingVariantId === variant._id;
//                 const isRefreshing = refreshingStocks.has(variant._id);
//                 const lowStock = hasLowStock(variant);
//                 const inCart = isVariantInCart(variant._id);

//                 return (
//                   <div
//                     key={variant._id}
//                     className={`bg-white border-2 rounded-lg overflow-hidden transition-all ${
//                       inCart ? "border-blue-300 bg-blue-50" : lowStock ? "border-orange-200" : "border-green-200"
//                     }`}
//                   >
//                     <div className="relative h-20 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
//                       <Package className="w-8 h-8 text-gray-300" />
//                       <div className="absolute top-1 left-1">
//                         <Badge variant={lowStock ? "destructive" : "default"} className={`text-[10px] px-1 py-0 h-4 ${lowStock ? "bg-orange-500" : "bg-green-500"}`}>
//                           {stockInfo.quantityLeft}
//                         </Badge>
//                       </div>
//                       {variant.size && (
//                         <Badge variant="outline" className="absolute top-1 right-1 text-[10px] px-1 py-0 h-4 bg-white">
//                           {variant.size}
//                         </Badge>
//                       )}
//                       <Button
//                         onClick={(e) => { e.stopPropagation(); refreshStockForSubProduct(variant._id); }}
//                         disabled={isRefreshing}
//                         variant="ghost"
//                         size="sm"
//                         className="absolute bottom-1 right-1 h-5 w-5 p-0"
//                       >
//                         <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
//                       </Button>
//                     </div>

//                     <div className="p-2">
//                       <h4 className="font-medium text-gray-900 text-xs line-clamp-1 mb-1">{variant.name}</h4>
//                       <div className="flex items-center justify-between mb-2">
//                         <span className="text-sm font-bold text-green-600">₹{stockInfo.sellingPrice}</span>
//                         {lowStock && <AlertTriangle className="w-3 h-3 text-orange-500" />}
//                       </div>

//                       {inCart && <Badge className="mb-1 bg-blue-500 text-[10px] px-1 py-0 h-4">In cart</Badge>}

//                       {!isActive ? (
//                         <Button onClick={() => handleInitialAddToCart(variant._id)} size="sm" className="w-full h-6 text-xs bg-green-500 hover:bg-green-600">
//                           <ShoppingCart className="w-3 h-3 mr-1" />
//                           Add
//                         </Button>
//                       ) : (
//                         <div className="space-y-1">
//                           <div className="flex items-center justify-center gap-1">
//                             <Button variant="outline" size="sm" onClick={() => handleQuantityChange(variant._id, quantity - 1, stockInfo.quantityLeft)} disabled={quantity <= 1} className="h-6 w-6 p-0">
//                               <Minus className="h-3 w-3" />
//                             </Button>
//                             {isEditing ? (
//                               <Input
//                                 type="text"
//                                 value={editingValue}
//                                 onChange={handleManualQuantityChange}
//                                 onBlur={() => handleQuantityBlur(variant._id, stockInfo.quantityLeft)}
//                                 onKeyDown={(e) => handleQuantityKeyPress(e, variant._id, stockInfo.quantityLeft)}
//                                 className="w-10 h-6 text-center text-xs p-0"
//                                 autoFocus
//                               />
//                             ) : (
//                               <span onClick={() => handleQuantityClick(variant._id, quantity)} className="w-8 text-center font-medium text-xs cursor-pointer hover:bg-gray-100 rounded">
//                                 {quantity}
//                               </span>
//                             )}
//                             <Button variant="outline" size="sm" onClick={() => handleQuantityChange(variant._id, quantity + 1, stockInfo.quantityLeft)} disabled={quantity >= stockInfo.quantityLeft} className="h-6 w-6 p-0">
//                               <Plus className="h-3 w-3" />
//                             </Button>
//                           </div>
//                           <Button onClick={() => handleFinalAddToCart(variant, product)} size="sm" className="w-full h-6 text-xs bg-green-500 hover:bg-green-600">
//                             <ShoppingCart className="w-3 h-3 mr-1" />
//                             Add {quantity}
//                           </Button>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         )}

//         {variantsWithoutStock.length > 0 && (
//           <div>
//             <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
//               <AlertTriangle className="w-4 h-4 text-amber-600" />
//               Out of Stock ({variantsWithoutStock.length})
//             </h3>
//             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
//               {variantsWithoutStock.map((variant) => {
//                 const isRefreshing = refreshingStocks.has(variant._id);
//                 return (
//                   <div key={variant._id} className="bg-white border rounded-lg overflow-hidden opacity-60">
//                     <div className="relative h-20 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
//                       <Package className="w-8 h-8 text-gray-400" />
//                       <Badge variant="secondary" className="absolute top-1 left-1 text-[10px] px-1 py-0 h-4">Out</Badge>
//                       <Button onClick={() => refreshStockForSubProduct(variant._id)} disabled={isRefreshing} variant="ghost" size="sm" className="absolute bottom-1 right-1 h-5 w-5 p-0">
//                         <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
//                       </Button>
//                     </div>
//                     <div className="p-2">
//                       <h4 className="font-medium text-gray-600 text-xs line-clamp-1">{variant.name}</h4>
//                       <Button disabled size="sm" className="w-full h-6 text-xs mt-1">Out of Stock</Button>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         )}

//         {activeProductVariants.length === 0 && (
//           <div className="text-center py-8">
//             <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
//             <p className="text-gray-600 text-sm">No variants found</p>
//           </div>
//         )}
//       </div>
//     );
//   };

//   // =============================================
//   // Render Search Results (Compact)
//   // =============================================
//   const renderSearchResults = () => (
//     <div>
//       <div className="mb-3">
//         <h2 className="text-lg font-bold text-gray-900">Search Results</h2>
//         <p className="text-xs text-gray-500">{searchResults.length} results for "{searchTerm}"</p>
//       </div>

//       {searchResults.length === 0 ? (
//         <div className="text-center py-8">
//           <Search className="w-12 h-12 text-gray-400 mx-auto mb-2" />
//           <p className="text-gray-600 text-sm">No results found</p>
//         </div>
//       ) : (
//         <div className="space-y-4">
//           {searchResults.filter((r) => r.type === "category").length > 0 && (
//             <div>
//               <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
//                 <Layers className="w-4 h-4 text-blue-600" />
//                 Categories
//               </h3>
//               <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
//                 {searchResults.filter((r) => r.type === "category").map((result) => (
//                   <div key={result.id} onClick={() => handleSearchResultClick(result)} className="cursor-pointer bg-white border rounded-lg p-2 hover:shadow-md hover:border-blue-300 text-center">
//                     <Layers className="w-5 h-5 text-blue-600 mx-auto mb-1" />
//                     <h4 className="font-medium text-gray-900 text-xs line-clamp-1">{result.name}</h4>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}

//           {searchResults.filter((r) => r.type === "product").length > 0 && (
//             <div>
//               <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
//                 <Package className="w-4 h-4 text-green-600" />
//                 Products
//               </h3>
//               <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
//                 {searchResults.filter((r) => r.type === "product").map((result) => {
//                   const product = result.product!;
//                   const priceRange = getPriceRange(product);
//                   return (
//                     <div key={result.id} onClick={() => handleSearchResultClick(result)} className="cursor-pointer bg-white border rounded-lg overflow-hidden hover:shadow-md hover:border-green-300">
//                       <div className="h-14 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
//                         <Package className="w-6 h-6 text-gray-400" />
//                       </div>
//                       <div className="p-2">
//                         <h4 className="font-medium text-gray-900 text-xs line-clamp-1">{result.name}</h4>
//                         {priceRange && <span className="text-green-600 font-bold text-xs">₹{priceRange.min}+</span>}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           )}

//           {searchResults.filter((r) => r.type === "subProduct").length > 0 && (
//             <div>
//               <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
//                 <Box className="w-4 h-4 text-purple-600" />
//                 Variants
//               </h3>
//               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
//                 {searchResults.filter((r) => r.type === "subProduct").map((result) => {
//                   const variant = result.variant!;
//                   const product = result.product!;
//                   const stockInfo = subProductStocks.get(variant._id);
//                   const outOfStock = isOutOfStock(variant._id);
//                   const inCart = isVariantInCart(variant._id);

//                   return (
//                     <div key={result.id} className={`bg-white border-2 rounded-lg overflow-hidden ${inCart ? "border-blue-300 bg-blue-50" : outOfStock ? "border-gray-200 opacity-60" : "border-green-200"}`}>
//                       <div className="relative h-16 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
//                         <Box className="w-6 h-6 text-gray-300" />
//                         {stockInfo && (
//                           <Badge variant={stockInfo.quantityLeft <= 5 ? "destructive" : "default"} className={`absolute top-1 left-1 text-[10px] px-1 py-0 h-4 ${stockInfo.quantityLeft <= 5 ? "bg-orange-500" : "bg-green-500"}`}>
//                             {stockInfo.quantityLeft}
//                           </Badge>
//                         )}
//                       </div>
//                       <div className="p-2">
//                         <h4 className="font-medium text-gray-900 text-xs line-clamp-1">{result.name}</h4>
//                         <p className="text-[10px] text-gray-500 line-clamp-1">{result.description}</p>
//                         {stockInfo && <span className="text-sm font-bold text-green-600">₹{stockInfo.sellingPrice}</span>}
//                         <div className="flex gap-1 mt-1">
//                           <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleSearchResultClick(result); }} className="flex-1 h-5 text-[10px] px-1">
//                             View
//                           </Button>
//                           {!outOfStock && (
//                             <Button size="sm" onClick={(e) => { e.stopPropagation(); handleDirectAddToCart(variant, product); }} className="flex-1 h-5 text-[10px] px-1 bg-green-500 hover:bg-green-600">
//                               Add
//                             </Button>
//                           )}
//                         </div>
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );

//   // =============================================
//   // Main Render
//   // =============================================
//   return (
//     <div>
//       {renderBreadcrumb()}
//       <div className="bg-white rounded-lg shadow-sm border p-3 min-h-[500px]">
//         {navigation.view === "categories" && renderCategories()}
//         {navigation.view === "products" && renderProducts()}
//         {navigation.view === "subProducts" && renderSubProducts()}
//         {navigation.view === "search" && renderSearchResults()}
//       </div>
//     </div>
//   );
// }


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
// //   Box,
// //   Layers,
// //   Search,
// //   X,
// // } from "lucide-react";
// // import { toast } from "sonner";

// // import type {
// //   ApiResponse,
// //   CartItem,
// //   ProductWithVariants,
// //   SubProductWithStock,
// //   StockInfo,
// //   ProductsInventoryResponse,
// //   StockFIFOResponse,
// //   CategoryRef,
// // } from "@/types/pos";
// // import type { Category, CategoriesResponse } from "@/types/category";

// // // =============================================
// // // Types
// // // =============================================
// // type NavigationView = "categories" | "products" | "subProducts" | "search";

// // interface NavigationState {
// //   view: NavigationView;
// //   selectedCategory: Category | null;
// //   selectedProduct: ProductWithVariants | null;
// // }

// // interface ProductNavigationProps {
// //   onAddToCart: (item: CartItem) => void;
// //   cartItems: CartItem[];
// // }

// // interface SearchResult {
// //   type: "category" | "product" | "subProduct";
// //   id: string;
// //   name: string;
// //   description?: string;
// //   category?: Category;
// //   product?: ProductWithVariants;
// //   variant?: SubProductWithStock;
// //   price?: number;
// //   stock?: number;
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

// //   // Navigation state
// //   const [navigation, setNavigation] = useState<NavigationState>({
// //     view: "categories",
// //     selectedCategory: null,
// //     selectedProduct: null,
// //   });

// //   // Search state
// //   const [searchTerm, setSearchTerm] = useState("");
// //   const [isSearching, setIsSearching] = useState(false);

// //   // UI states - RENAMED to avoid conflict
// //   const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, boolean>>({});
// //   const [quantities, setQuantities] = useState<Record<string, number>>({});
// //   const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
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
// //       const response = await fetch("/api/inventories");
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
// //   const subProductStocks = useMemo((): Map<string, StockInfo> => {
// //     const stocksMap = new Map<string, StockInfo>();
// //     if (stocksResponse?.data?.data) {
// //       stocksResponse.data.data.forEach((item) => {
// //         if (item.currentStock) {
// //           stocksMap.set(item.subProductId, item.currentStock);
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

// //   const products = useMemo((): ProductWithVariants[] => {
// //     if (!productsResponse?.data?.products) return [];

// //     return productsResponse.data.products
// //       .filter((product) => product.isActive)
// //       .map((product): ProductWithVariants => {
// //         const categoryName =
// //           extractCategoryName(product.categoryId) ||
// //           getCategoryNameById(extractCategoryId(product.categoryId));

// //         return {
// //           ...product,
// //           variantCount: product.variants?.length || 0,
// //           categoryName,
// //           variants: product.variants?.map((variant) => ({
// //             ...variant,
// //             currentStock: subProductStocks.get(variant._id) || null,
// //           })),
// //         };
// //       });
// //   }, [productsResponse, subProductStocks, getCategoryNameById]);

// //   // Get products for selected category
// //   const categoryProducts = useMemo((): ProductWithVariants[] => {
// //     if (!navigation.selectedCategory) return [];
// //     return products.filter((product) => {
// //       const productCategoryId = extractCategoryId(product.categoryId);
// //       return productCategoryId === navigation.selectedCategory?._id;
// //     });
// //   }, [products, navigation.selectedCategory]);

// //   // Get product count per category
// //   const getProductCount = useCallback(
// //     (categoryId: string): number => {
// //       return products.filter((product) => {
// //         const productCategoryId = extractCategoryId(product.categoryId);
// //         return productCategoryId === categoryId;
// //       }).length;
// //     },
// //     [products]
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
// //           category,
// //         });
// //       }
// //     });

// //     // Search products
// //     products.forEach((product) => {
// //       if (
// //         product.name.toLowerCase().includes(term) ||
// //         product.description?.toLowerCase().includes(term)
// //       ) {
// //         const categoryId = extractCategoryId(product.categoryId);
// //         const category = categoryId ? getCategoryById(categoryId) : null;

// //         results.push({
// //           type: "product",
// //           id: product._id,
// //           name: product.name,
// //           description: product.categoryName,
// //           category: category || undefined,
// //           product,
// //         });
// //       }

// //       // Search sub-products (variants)
// //       product.variants?.forEach((variant) => {
// //         if (
// //           variant.isActive &&
// //           (variant.name.toLowerCase().includes(term) ||
// //             variant.description?.toLowerCase().includes(term))
// //         ) {
// //           const categoryId = extractCategoryId(product.categoryId);
// //           const category = categoryId ? getCategoryById(categoryId) : null;
// //           const stockInfo = subProductStocks.get(variant._id);

// //           results.push({
// //             type: "subProduct",
// //             id: variant._id,
// //             name: variant.name,
// //             description: `${product.name} • ${product.categoryName}`,
// //             category: category || undefined,
// //             product,
// //             variant,
// //             price: stockInfo?.sellingPrice,
// //             stock: stockInfo?.quantityLeft,
// //           });
// //         }
// //       });
// //     });

// //     return results;
// //   }, [searchTerm, categories, products, getProductCount, getCategoryById, subProductStocks]);

// //   const handleSearch = useCallback(() => {
// //     if (!searchTerm.trim()) {
// //       toast.error("Please enter a search term");
// //       return;
// //     }
// //     setIsSearching(true);
// //     setNavigation({
// //       view: "search",
// //       selectedCategory: null,
// //       selectedProduct: null,
// //     });
// //     // Small delay to show loading state
// //     setTimeout(() => setIsSearching(false), 300);
// //   }, [searchTerm]);

// //   const handleSearchKeyPress = useCallback(
// //     (e: React.KeyboardEvent) => {
// //       if (e.key === "Enter") {
// //         handleSearch();
// //       }
// //     },
// //     [handleSearch]
// //   );

// //   const clearSearch = useCallback(() => {
// //     setSearchTerm("");
// //     setNavigation({
// //       view: "categories",
// //       selectedCategory: null,
// //       selectedProduct: null,
// //     });
// //   }, []);

// //   const handleSearchResultClick = useCallback(
// //     (result: SearchResult) => {
// //       setSearchTerm("");

// //       if (result.type === "category" && result.category) {
// //         setNavigation({
// //           view: "products",
// //           selectedCategory: result.category,
// //           selectedProduct: null,
// //         });
// //       } else if (result.type === "product" && result.product) {
// //         const categoryId = extractCategoryId(result.product.categoryId);
// //         const category = categoryId ? getCategoryById(categoryId) : null;

// //         setNavigation({
// //           view: "subProducts",
// //           selectedCategory: category,
// //           selectedProduct: result.product,
// //         });
// //       } else if (result.type === "subProduct" && result.product) {
// //         const categoryId = extractCategoryId(result.product.categoryId);
// //         const category = categoryId ? getCategoryById(categoryId) : null;

// //         setNavigation({
// //           view: "subProducts",
// //           selectedCategory: category,
// //           selectedProduct: result.product,
// //         });
// //       }
// //     },
// //     [getCategoryById]
// //   );

// //   // =============================================
// //   // Navigation Handlers
// //   // =============================================
// //   const navigateToCategories = useCallback(() => {
// //     setNavigation({
// //       view: "categories",
// //       selectedCategory: null,
// //       selectedProduct: null,
// //     });
// //     setSelectedVariantIds({});
// //     setQuantities({});
// //     setSearchTerm("");
// //   }, []);

// //   const navigateToProducts = useCallback((category: Category) => {
// //     setNavigation({
// //       view: "products",
// //       selectedCategory: category,
// //       selectedProduct: null,
// //     });
// //     setSelectedVariantIds({});
// //     setQuantities({});
// //   }, []);

// //   const navigateToSubProducts = useCallback(
// //     (product: ProductWithVariants) => {
// //       setNavigation({
// //         view: "subProducts",
// //         selectedCategory: navigation.selectedCategory,
// //         selectedProduct: product,
// //       });
// //       setSelectedVariantIds({});
// //       setQuantities({});
// //     },
// //     [navigation.selectedCategory]
// //   );

// //   // =============================================
// //   // Stock Management
// //   // =============================================
// //   const refreshStockForSubProduct = useCallback(
// //     async (subProductId: string): Promise<void> => {
// //       setRefreshingStocks((prev) => new Set(prev).add(subProductId));
// //       try {
// //         const response = await fetch(
// //           `/api/stock/fifo/oldest-single?subProductId=${subProductId}`
// //         );
// //         if (response.ok) {
// //           const result: ApiResponse<StockInfo> = await response.json();
// //           queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(
// //             ["fifo-stocks"],
// //             (oldData) => {
// //               if (!oldData?.data?.data) return oldData;
// //               const stocksArray = [...oldData.data.data];
// //               const index = stocksArray.findIndex(
// //                 (item) => item.subProductId === subProductId
// //               );

// //               if (result.success && result.data) {
// //                 const newItem = { subProductId, currentStock: result.data };
// //                 if (index >= 0) {
// //                   stocksArray[index] = newItem;
// //                 } else {
// //                   stocksArray.push(newItem);
// //                 }
// //                 toast.success("Stock refreshed");
// //               } else {
// //                 if (index >= 0) stocksArray.splice(index, 1);
// //                 toast.info("No stock available");
// //               }

// //               return { ...oldData, data: { ...oldData.data, data: stocksArray } };
// //             }
// //           );
// //         }
// //       } catch (error) {
// //         console.error("Error refreshing stock:", error);
// //         toast.error("Failed to refresh stock");
// //       } finally {
// //         setRefreshingStocks((prev) => {
// //           const updated = new Set(prev);
// //           updated.delete(subProductId);
// //           return updated;
// //         });
// //       }
// //     },
// //     [queryClient]
// //   );

// //   const updateStockInCache = useCallback(
// //     (subProductId: string, quantityReduced: number): void => {
// //       queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(
// //         ["fifo-stocks"],
// //         (oldData) => {
// //           if (!oldData?.data?.data) return oldData;
// //           const stocksArray = [...oldData.data.data];
// //           const index = stocksArray.findIndex(
// //             (item) => item.subProductId === subProductId
// //           );

// //           if (index >= 0 && stocksArray[index].currentStock) {
// //             const currentStock = stocksArray[index].currentStock!;
// //             const newQuantity = currentStock.quantityLeft - quantityReduced;
// //             if (newQuantity <= 0) {
// //               stocksArray.splice(index, 1);
// //             } else {
// //               stocksArray[index] = {
// //                 ...stocksArray[index],
// //                 currentStock: { ...currentStock, quantityLeft: newQuantity },
// //               };
// //             }
// //           }

// //           return { ...oldData, data: { ...oldData.data, data: stocksArray } };
// //         }
// //       );
// //     },
// //     [queryClient]
// //   );

// //   // =============================================
// //   // Cart Handlers
// //   // =============================================
// //   const handleInitialAddToCart = useCallback((variantId: string): void => {
// //     setSelectedVariantIds((prev) => ({ ...prev, [variantId]: true }));
// //     setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// //   }, []);

// //   const handleQuantityChange = useCallback(
// //     (variantId: string, newQuantity: number, maxStock: number): void => {
// //       if (newQuantity < 1) {
// //         setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// //         return;
// //       }
// //       if (newQuantity > maxStock) {
// //         toast.error(`Only ${maxStock} units available`);
// //         setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
// //         return;
// //       }
// //       setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
// //     },
// //     []
// //   );

// //   const handleQuantityClick = useCallback(
// //     (variantId: string, currentQuantity: number): void => {
// //       setEditingVariantId(variantId);
// //       setEditingValue(currentQuantity.toString());
// //     },
// //     []
// //   );

// //   const handleManualQuantityChange = useCallback(
// //     (e: React.ChangeEvent<HTMLInputElement>): void => {
// //       const value = e.target.value;
// //       if (value === "" || /^\d+$/.test(value)) {
// //         setEditingValue(value);
// //       }
// //     },
// //     []
// //   );

// //   const handleQuantityBlur = useCallback(
// //     (variantId: string, maxStock: number): void => {
// //       const newQuantity = parseInt(editingValue, 10) || 1;
// //       if (newQuantity < 1) {
// //         toast.error("Quantity must be at least 1");
// //         setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// //       } else if (newQuantity > maxStock) {
// //         toast.error(`Only ${maxStock} units available`);
// //         setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
// //       } else {
// //         setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
// //       }
// //       setEditingVariantId(null);
// //       setEditingValue("");
// //     },
// //     [editingValue]
// //   );

// //   const handleQuantityKeyPress = useCallback(
// //     (e: React.KeyboardEvent, variantId: string, maxStock: number): void => {
// //       if (e.key === "Enter") {
// //         handleQuantityBlur(variantId, maxStock);
// //       } else if (e.key === "Escape") {
// //         setEditingVariantId(null);
// //         setEditingValue("");
// //       }
// //     },
// //     [handleQuantityBlur]
// //   );

// //   const handleFinalAddToCart = useCallback(
// //     (variant: SubProductWithStock, product: ProductWithVariants): void => {
// //       const stockInfo = subProductStocks.get(variant._id);
// //       if (!stockInfo) {
// //         toast.error("No stock information available");
// //         return;
// //       }

// //       const quantity = quantities[variant._id] || 1;
// //       updateStockInCache(variant._id, quantity);

// //       const cartItem: CartItem = {
// //         itemKey: `sub:${variant._id}`,
// //         subProductId: variant._id,
// //         productId: product._id,
// //         name: variant.name,
// //         price: stockInfo.sellingPrice,
// //         quantity,
// //         stock: stockInfo.quantityLeft,
// //         itemType: "subProduct",
// //         stockTransactionId: stockInfo.stockTransactionId,
// //       };

// //       onAddToCart(cartItem);
// //       toast.success(`${quantity} × ${variant.name} added to cart`);
// //       setSelectedVariantIds((prev) => ({ ...prev, [variant._id]: false }));
// //       setQuantities((prev) => ({ ...prev, [variant._id]: 1 }));
// //     },
// //     [quantities, subProductStocks, updateStockInCache, onAddToCart]
// //   );

// //   // Direct add to cart from search results
// //   const handleDirectAddToCart = useCallback(
// //     (variant: SubProductWithStock, product: ProductWithVariants): void => {
// //       const stockInfo = subProductStocks.get(variant._id);
// //       if (!stockInfo) {
// //         toast.error("No stock information available");
// //         return;
// //       }

// //       if (stockInfo.quantityLeft <= 0) {
// //         toast.error("Product is out of stock");
// //         return;
// //       }

// //       updateStockInCache(variant._id, 1);

// //       const cartItem: CartItem = {
// //         itemKey: `sub:${variant._id}`,
// //         subProductId: variant._id,
// //         productId: product._id,
// //         name: variant.name,
// //         price: stockInfo.sellingPrice,
// //         quantity: 1,
// //         stock: stockInfo.quantityLeft,
// //         itemType: "subProduct",
// //         stockTransactionId: stockInfo.stockTransactionId,
// //       };

// //       onAddToCart(cartItem);
// //       toast.success(`${variant.name} added to cart`);
// //     },
// //     [subProductStocks, updateStockInCache, onAddToCart]
// //   );

// //   // =============================================
// //   // Helper Functions
// //   // =============================================
// //   const hasLowStock = useCallback(
// //     (variant: SubProductWithStock): boolean => {
// //       const stockInfo = subProductStocks.get(variant._id);
// //       if (!stockInfo) return true;
// //       return stockInfo.quantityLeft <= (variant.lowStockThreshold || 5);
// //     },
// //     [subProductStocks]
// //   );

// //   const isOutOfStock = useCallback(
// //     (variantId: string): boolean => {
// //       const stockInfo = subProductStocks.get(variantId);
// //       return !stockInfo || stockInfo.quantityLeft <= 0;
// //     },
// //     [subProductStocks]
// //   );

// //   const getPriceRange = useCallback(
// //     (product: ProductWithVariants): { min: number; max: number } | null => {
// //       if (!product.variants || product.variants.length === 0) return null;
// //       const activePrices = product.variants
// //         .filter((v) => v.isActive && subProductStocks.get(v._id))
// //         .map((v) => subProductStocks.get(v._id)?.sellingPrice || 0)
// //         .filter((price) => price > 0);
// //       if (activePrices.length === 0) return null;
// //       return { min: Math.min(...activePrices), max: Math.max(...activePrices) };
// //     },
// //     [subProductStocks]
// //   );

// //   const getVariantsInStock = useCallback(
// //     (product: ProductWithVariants): number => {
// //       if (!product.variants) return 0;
// //       return product.variants.filter(
// //         (v) => v.isActive && subProductStocks.has(v._id)
// //       ).length;
// //     },
// //     [subProductStocks]
// //   );

// //   const isVariantInCart = useCallback(
// //     (variantId: string): boolean => {
// //       return cartItems.some((item) => item.subProductId === variantId);
// //     },
// //     [cartItems]
// //   );

// //   // =============================================
// //   // Loading State
// //   // =============================================
// //   if (productsLoading || categoriesLoading) {
// //     return (
// //       <div className="flex items-center justify-center py-12">
// //         <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
// //         <span className="ml-2 text-gray-600">Loading...</span>
// //       </div>
// //     );
// //   }

// //   // =============================================
// //   // Render Breadcrumb with Search
// //   // =============================================
// //   const renderBreadcrumb = () => (
// //     <Card className="mb-4">
// //       <CardContent className="py-3">
// //         <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
// //           {/* Breadcrumb Navigation */}
// //           <Breadcrumb>
// //             <BreadcrumbList>
// //               <BreadcrumbItem>
// //                 <BreadcrumbLink
// //                   onClick={navigateToCategories}
// //                   className="flex items-center cursor-pointer hover:text-blue-600"
// //                 >
// //                   <Home className="w-4 h-4 mr-1" />
// //                   Categories
// //                 </BreadcrumbLink>
// //               </BreadcrumbItem>

// //               {navigation.selectedCategory && (
// //                 <>
// //                   <BreadcrumbSeparator>
// //                     <ChevronRight className="w-4 h-4" />
// //                   </BreadcrumbSeparator>
// //                   <BreadcrumbItem>
// //                     {navigation.view === "products" ? (
// //                       <BreadcrumbPage className="flex items-center font-semibold">
// //                         <Layers className="w-4 h-4 mr-1" />
// //                         {navigation.selectedCategory.name}
// //                       </BreadcrumbPage>
// //                     ) : (
// //                       <BreadcrumbLink
// //                         onClick={() => navigateToProducts(navigation.selectedCategory!)}
// //                         className="flex items-center cursor-pointer hover:text-blue-600"
// //                       >
// //                         <Layers className="w-4 h-4 mr-1" />
// //                         {navigation.selectedCategory.name}
// //                       </BreadcrumbLink>
// //                     )}
// //                   </BreadcrumbItem>
// //                 </>
// //               )}

// //               {navigation.selectedProduct && (
// //                 <>
// //                   <BreadcrumbSeparator>
// //                     <ChevronRight className="w-4 h-4" />
// //                   </BreadcrumbSeparator>
// //                   <BreadcrumbItem>
// //                     <BreadcrumbPage className="flex items-center font-semibold">
// //                       <Box className="w-4 h-4 mr-1" />
// //                       {navigation.selectedProduct.name}
// //                     </BreadcrumbPage>
// //                   </BreadcrumbItem>
// //                 </>
// //               )}

// //               {navigation.view === "search" && (
// //                 <>
// //                   <BreadcrumbSeparator>
// //                     <ChevronRight className="w-4 h-4" />
// //                   </BreadcrumbSeparator>
// //                   <BreadcrumbItem>
// //                     <BreadcrumbPage className="flex items-center font-semibold">
// //                       <Search className="w-4 h-4 mr-1" />
// //                       Search Results
// //                     </BreadcrumbPage>
// //                   </BreadcrumbItem>
// //                 </>
// //               )}
// //             </BreadcrumbList>
// //           </Breadcrumb>

// //           {/* Search Input */}
// //           <div className="flex items-center gap-2">
// //             <div className="relative">
// //               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
// //               <Input
// //                 type="text"
// //                 placeholder="Search categories, products, variants..."
// //                 value={searchTerm}
// //                 onChange={(e) => setSearchTerm(e.target.value)}
// //                 onKeyPress={handleSearchKeyPress}
// //                 className="pl-10 pr-10 w-64 md:w-80"
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
// //               className="bg-blue-500 hover:bg-blue-600 text-white"
// //             >
// //               {isSearching ? (
// //                 <Loader2 className="w-4 h-4 animate-spin" />
// //               ) : (
// //                 <Search className="w-4 h-4" />
// //               )}
// //             </Button>
// //           </div>
// //         </div>
// //       </CardContent>
// //     </Card>
// //   );

// //   // =============================================
// //   // Render Search Results View
// //   // =============================================
// //   const renderSearchResults = () => (
// //     <div>
// //       <div className="mb-6">
// //         <h2 className="text-2xl font-bold text-gray-900 mb-2">Search Results</h2>
// //         <p className="text-gray-600">
// //           Found {searchResults.length} results for "{searchTerm}"
// //         </p>
// //       </div>

// //       {searchResults.length === 0 ? (
// //         <div className="text-center py-12">
// //           <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
// //           <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
// //           <p className="text-gray-600">Try a different search term</p>
// //         </div>
// //       ) : (
// //         <div className="space-y-6">
// //           {/* Category Results */}
// //           {searchResults.filter((r) => r.type === "category").length > 0 && (
// //             <div>
// //               <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
// //                 <Layers className="w-5 h-5 text-blue-600" />
// //                 Categories
// //               </h3>
// //               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
// //                 {searchResults
// //                   .filter((r) => r.type === "category")
// //                   .map((result) => (
// //                     <Card
// //                       key={result.id}
// //                       onClick={() => handleSearchResultClick(result)}
// //                       className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
// //                     >
// //                       <CardContent className="p-4 text-center">
// //                         <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
// //                           <Layers className="w-6 h-6 text-blue-600" />
// //                         </div>
// //                         <h4 className="font-semibold text-gray-900">{result.name}</h4>
// //                         <p className="text-sm text-gray-500">{result.description}</p>
// //                       </CardContent>
// //                     </Card>
// //                   ))}
// //               </div>
// //             </div>
// //           )}

// //           {/* Product Results */}
// //           {searchResults.filter((r) => r.type === "product").length > 0 && (
// //             <div>
// //               <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
// //                 <Package className="w-5 h-5 text-green-600" />
// //                 Products
// //               </h3>
// //               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
// //                 {searchResults
// //                   .filter((r) => r.type === "product")
// //                   .map((result) => {
// //                     const product = result.product!;
// //                     const priceRange = getPriceRange(product);
// //                     const variantsInStock = getVariantsInStock(product);

// //                     return (
// //                       <Card
// //                         key={result.id}
// //                         onClick={() => handleSearchResultClick(result)}
// //                         className="cursor-pointer hover:shadow-lg hover:border-green-300 transition-all"
// //                       >
// //                         <div className="h-24 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center rounded-t-lg">
// //                           <Package className="w-10 h-10 text-gray-400" />
// //                         </div>
// //                         <CardContent className="p-3">
// //                           <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">
// //                             {result.name}
// //                           </h4>
// //                           <p className="text-xs text-gray-500 mb-2">{result.description}</p>
// //                           <div className="flex items-center justify-between">
// //                             {priceRange ? (
// //                               <span className="text-green-600 font-bold text-sm">
// //                                 ₹{priceRange.min}
// //                                 {priceRange.min !== priceRange.max && ` - ₹${priceRange.max}`}
// //                               </span>
// //                             ) : (
// //                               <span className="text-gray-500 text-xs">No price</span>
// //                             )}
// //                             <Badge variant="outline" className="text-xs">
// //                               {variantsInStock} in stock
// //                             </Badge>
// //                           </div>
// //                         </CardContent>
// //                       </Card>
// //                     );
// //                   })}
// //               </div>
// //             </div>
// //           )}

// //           {/* Sub-Product (Variant) Results */}
// //           {searchResults.filter((r) => r.type === "subProduct").length > 0 && (
// //             <div>
// //               <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
// //                 <Box className="w-5 h-5 text-purple-600" />
// //                 Variants
// //               </h3>
// //               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
// //                 {searchResults
// //                   .filter((r) => r.type === "subProduct")
// //                   .map((result) => {
// //                     const variant = result.variant!;
// //                     const product = result.product!;
// //                     const stockInfo = subProductStocks.get(variant._id);
// //                     const outOfStock = isOutOfStock(variant._id);
// //                     const inCart = isVariantInCart(variant._id);

// //                     return (
// //                       <Card
// //                         key={result.id}
// //                         className={`relative hover:shadow-lg transition-all border-2 ${
// //                           inCart
// //                             ? "border-blue-300 bg-blue-50"
// //                             : outOfStock
// //                             ? "border-gray-200 opacity-60"
// //                             : "border-green-200"
// //                         }`}
// //                       >
// //                         <div className="relative h-32 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center rounded-t-lg">
// //                           <Box className="w-12 h-12 text-gray-300" />
// //                           <div className="absolute top-2 left-2">
// //                             {stockInfo ? (
// //                               <Badge
// //                                 variant={stockInfo.quantityLeft <= 5 ? "destructive" : "default"}
// //                                 className={
// //                                   stockInfo.quantityLeft <= 5 ? "bg-orange-500" : "bg-green-500"
// //                                 }
// //                               >
// //                                 Stock: {stockInfo.quantityLeft}
// //                               </Badge>
// //                             ) : (
// //                               <Badge variant="secondary">Out of Stock</Badge>
// //                             )}
// //                           </div>
// //                         </div>
// //                         <CardContent className="p-4">
// //                           <h4 className="font-semibold text-gray-900 mb-1">{result.name}</h4>
// //                           <p className="text-xs text-gray-500 mb-2">{result.description}</p>

// //                           {stockInfo && (
// //                             <div className="flex items-center justify-between mb-3">
// //                               <span className="text-xl font-bold text-green-600">
// //                                 ₹{stockInfo.sellingPrice.toFixed(2)}
// //                               </span>
// //                             </div>
// //                           )}

// //                           {inCart && (
// //                             <Badge className="mb-3 bg-blue-500">Already in cart</Badge>
// //                           )}

// //                           <div className="flex gap-2">
// //                             <Button
// //                               variant="outline"
// //                               size="sm"
// //                               onClick={(e) => {
// //                                 e.stopPropagation();
// //                                 handleSearchResultClick(result);
// //                               }}
// //                               className="flex-1"
// //                             >
// //                               View Details
// //                             </Button>
// //                             {!outOfStock && (
// //                               <Button
// //                                 size="sm"
// //                                 onClick={(e) => {
// //                                   e.stopPropagation();
// //                                   handleDirectAddToCart(variant, product);
// //                                 }}
// //                                 className="flex-1 bg-green-500 hover:bg-green-600 text-white"
// //                               >
// //                                 <ShoppingCart className="w-3 h-3 mr-1" />
// //                                 Add
// //                               </Button>
// //                             )}
// //                           </div>
// //                         </CardContent>
// //                       </Card>
// //                     );
// //                   })}
// //               </div>
// //             </div>
// //           )}
// //         </div>
// //       )}
// //     </div>
// //   );

// //   // =============================================
// //   // Render Categories View
// //   // =============================================
// //   const renderCategories = () => (
// //     <div>
// //       <div className="mb-6">
// //         <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Category</h2>
// //         <p className="text-gray-600">Choose a category to browse products</p>
// //       </div>

// //       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
// //         {categories.map((category) => {
// //           const productCount = getProductCount(category._id);
// //           return (
// //             <Card
// //               key={category._id}
// //               onClick={() => navigateToProducts(category)}
// //               className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
// //             >
// //               <CardContent className="p-6 text-center">
// //                 <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
// //                   <Package className="w-8 h-8 text-blue-600" />
// //                 </div>
// //                 <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
// //                 <p className="text-sm text-gray-500">{productCount} products</p>
// //               </CardContent>
// //             </Card>
// //           );
// //         })}
// //       </div>

// //       {categories.length === 0 && (
// //         <div className="text-center py-12">
// //           <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
// //           <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
// //           <p className="text-gray-600">Categories will appear here once added.</p>
// //         </div>
// //       )}
// //     </div>
// //   );

// //   // =============================================
// //   // Render Products View
// //   // =============================================
// //   const renderProducts = () => (
// //     <div>
// //       <div className="mb-6">
// //         <h2 className="text-2xl font-bold text-gray-900 mb-2">
// //           {navigation.selectedCategory?.name}
// //         </h2>
// //         <p className="text-gray-600">Select a product to view variants</p>
// //       </div>

// //       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
// //         {categoryProducts.map((product) => {
// //           const priceRange = getPriceRange(product);
// //           const variantsInStock = getVariantsInStock(product);
// //           const totalVariants = product.variants?.filter((v) => v.isActive).length || 0;

// //           return (
// //             <Card
// //               key={product._id}
// //               onClick={() => navigateToSubProducts(product)}
// //               className="cursor-pointer hover:shadow-lg hover:border-green-300 transition-all"
// //             >
// //               <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center rounded-t-lg">
// //                 <Package className="w-12 h-12 text-gray-400" />
// //               </div>
// //               <CardContent className="p-4">
// //                 <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
// //                   {product.name}
// //                 </h3>
// //                 {product.description && (
// //                   <p className="text-sm text-gray-500 mb-2 line-clamp-1">
// //                     {product.description}
// //                   </p>
// //                 )}
// //                 <div className="flex items-center justify-between mb-2">
// //                   {priceRange ? (
// //                     <span className="text-green-600 font-bold">
// //                       {priceRange.min === priceRange.max
// //                         ? `₹${priceRange.min}`
// //                         : `₹${priceRange.min} - ₹${priceRange.max}`}
// //                     </span>
// //                   ) : (
// //                     <span className="text-gray-500 text-sm">No price</span>
// //                   )}
// //                 </div>
// //                 <div className="flex items-center justify-between">
// //                   <Badge variant="outline" className="text-xs">
// //                     {totalVariants} variants
// //                   </Badge>
// //                   <Badge
// //                     variant={variantsInStock > 0 ? "default" : "destructive"}
// //                     className="text-xs"
// //                   >
// //                     {variantsInStock} in stock
// //                   </Badge>
// //                 </div>
// //               </CardContent>
// //             </Card>
// //           );
// //         })}
// //       </div>

// //       {categoryProducts.length === 0 && (
// //         <div className="text-center py-12">
// //           <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
// //           <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
// //           <p className="text-gray-600">This category doesn't have any products yet.</p>
// //         </div>
// //       )}
// //     </div>
// //   );

// //   // =============================================
// //   // Render Sub-Products (Variants) View
// //   // =============================================
// //   const renderSubProducts = () => {
// //     const product = navigation.selectedProduct;
// //     if (!product) return null;

// //     // Use different variable name to avoid conflict
// //     const activeProductVariants = product.variants?.filter((v) => v.isActive) || [];
// //     const variantsWithStock = activeProductVariants.filter((v) =>
// //       subProductStocks.has(v._id)
// //     );
// //     const variantsWithoutStock = activeProductVariants.filter(
// //       (v) => !subProductStocks.has(v._id)
// //     );

// //     return (
// //       <div>
// //         <div className="mb-6">
// //           <h2 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h2>
// //           <p className="text-gray-600">
// //             {product.description || "Select a variant to add to cart"}
// //           </p>
// //         </div>

// //         {/* Variants with stock */}
// //         {variantsWithStock.length > 0 && (
// //           <div className="mb-6">
// //             <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
// //               <Package className="w-5 h-5 text-green-600" />
// //               Available Variants ({variantsWithStock.length})
// //             </h3>
// //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
// //               {variantsWithStock.map((variant) => {
// //                 const stockInfo = subProductStocks.get(variant._id)!;
// //                 // Use selectedVariantIds instead of activeVariants
// //                 const isActive = selectedVariantIds[variant._id] ?? false;
// //                 const quantity = quantities[variant._id] || 1;
// //                 const isEditing = editingVariantId === variant._id;
// //                 const isRefreshing = refreshingStocks.has(variant._id);
// //                 const lowStock = hasLowStock(variant);
// //                 const inCart = isVariantInCart(variant._id);

// //                 return (
// //                   <Card
// //                     key={variant._id}
// //                     className={`relative hover:shadow-lg transition-all border-2 ${
// //                       inCart
// //                         ? "border-blue-300 bg-blue-50"
// //                         : lowStock
// //                         ? "border-orange-200"
// //                         : "border-green-200"
// //                     }`}
// //                   >
// //                     <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center rounded-t-lg">
// //                       <Package className="w-16 h-16 text-gray-300" />
// //                       <div className="absolute top-2 left-2">
// //                         <Badge
// //                           variant={lowStock ? "destructive" : "default"}
// //                           className={lowStock ? "bg-orange-500" : "bg-green-500"}
// //                         >
// //                           Stock: {stockInfo.quantityLeft}
// //                         </Badge>
// //                       </div>
// //                       {variant.size && (
// //                         <div className="absolute top-2 right-2">
// //                           <Badge variant="outline" className="bg-white">
// //                             {variant.size}
// //                           </Badge>
// //                         </div>
// //                       )}
// //                       <Button
// //                         onClick={(e) => {
// //                           e.stopPropagation();
// //                           refreshStockForSubProduct(variant._id);
// //                         }}
// //                         disabled={isRefreshing}
// //                         variant="secondary"
// //                         size="sm"
// //                         className="absolute bottom-2 right-2 h-7 px-2"
// //                       >
// //                         <RefreshCw
// //                           className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
// //                         />
// //                       </Button>
// //                     </div>

// //                     <CardContent className="p-4">
// //                       <h4 className="font-semibold text-gray-900 mb-2">{variant.name}</h4>
// //                       <div className="flex items-center justify-between mb-4">
// //                         <span className="text-2xl font-bold text-green-600">
// //                           ₹{stockInfo.sellingPrice.toFixed(2)}
// //                         </span>
// //                         {lowStock && (
// //                           <div className="flex items-center gap-1">
// //                             <AlertTriangle className="w-4 h-4 text-orange-500" />
// //                             <span className="text-xs text-orange-600">Low Stock</span>
// //                           </div>
// //                         )}
// //                       </div>

// //                       {inCart && (
// //                         <Badge className="mb-3 bg-blue-500">Already in cart</Badge>
// //                       )}

// //                       {/* Action Buttons */}
// //                       <div className="space-y-2">
// //                         {!isActive ? (
// //                           <Button
// //                             onClick={() => handleInitialAddToCart(variant._id)}
// //                             className="w-full bg-green-500 hover:bg-green-600 text-white"
// //                           >
// //                             <ShoppingCart className="w-4 h-4 mr-2" />
// //                             Add to Cart
// //                           </Button>
// //                         ) : (
// //                           <>
// //                             <div className="flex items-center justify-center gap-2">
// //                               <Button
// //                                 variant="outline"
// //                                 size="sm"
// //                                 onClick={() =>
// //                                   handleQuantityChange(
// //                                     variant._id,
// //                                     quantity - 1,
// //                                     stockInfo.quantityLeft
// //                                   )
// //                                 }
// //                                 disabled={quantity <= 1}
// //                                 className="h-8 w-8 p-0"
// //                               >
// //                                 <Minus className="h-3 w-3" />
// //                               </Button>

// //                               {isEditing ? (
// //                                 <Input
// //                                   type="text"
// //                                   value={editingValue}
// //                                   onChange={handleManualQuantityChange}
// //                                   onBlur={() =>
// //                                     handleQuantityBlur(variant._id, stockInfo.quantityLeft)
// //                                   }
// //                                   onKeyDown={(e) =>
// //                                     handleQuantityKeyPress(
// //                                       e,
// //                                       variant._id,
// //                                       stockInfo.quantityLeft
// //                                     )
// //                                   }
// //                                   className="w-14 h-8 text-center text-sm p-1"
// //                                   autoFocus
// //                                 />
// //                               ) : (
// //                                 <span
// //                                   className="w-14 text-center font-semibold cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
// //                                   onClick={() => handleQuantityClick(variant._id, quantity)}
// //                                   title="Click to edit"
// //                                 >
// //                                   {quantity}
// //                                 </span>
// //                               )}

// //                               <Button
// //                                 variant="outline"
// //                                 size="sm"
// //                                 onClick={() =>
// //                                   handleQuantityChange(
// //                                     variant._id,
// //                                     quantity + 1,
// //                                     stockInfo.quantityLeft
// //                                   )
// //                                 }
// //                                 disabled={quantity >= stockInfo.quantityLeft}
// //                                 className="h-8 w-8 p-0"
// //                               >
// //                                 <Plus className="h-3 w-3" />
// //                               </Button>
// //                             </div>
// //                             <Button
// //                               onClick={() => handleFinalAddToCart(variant, product)}
// //                               className="w-full bg-green-500 hover:bg-green-600 text-white"
// //                             >
// //                               <ShoppingCart className="w-4 h-4 mr-2" />
// //                               Add {quantity} to Cart
// //                             </Button>
// //                           </>
// //                         )}
// //                       </div>
// //                     </CardContent>
// //                   </Card>
// //                 );
// //               })}
// //             </div>
// //           </div>
// //         )}

// //         {/* Variants without stock */}
// //         {variantsWithoutStock.length > 0 && (
// //           <div>
// //             <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
// //               <AlertTriangle className="w-5 h-5 text-amber-600" />
// //               Out of Stock ({variantsWithoutStock.length})
// //             </h3>
// //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
// //               {variantsWithoutStock.map((variant) => {
// //                 const isRefreshing = refreshingStocks.has(variant._id);

// //                 return (
// //                   <Card key={variant._id} className="opacity-60 border-gray-200">
// //                     <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center rounded-t-lg">
// //                       <Package className="w-16 h-16 text-gray-400" />
// //                       <div className="absolute top-2 left-2">
// //                         <Badge variant="secondary">Out of Stock</Badge>
// //                       </div>
// //                       <Button
// //                         onClick={() => refreshStockForSubProduct(variant._id)}
// //                         disabled={isRefreshing}
// //                         variant="secondary"
// //                         size="sm"
// //                         className="absolute bottom-2 right-2 h-7 px-2"
// //                       >
// //                         <RefreshCw
// //                           className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
// //                         />
// //                       </Button>
// //                     </div>
// //                     <CardContent className="p-4">
// //                       <h4 className="font-semibold text-gray-600 mb-2">{variant.name}</h4>
// //                       <p className="text-gray-500 mb-4">Price unavailable</p>
// //                       <Button disabled className="w-full">
// //                         Out of Stock
// //                       </Button>
// //                     </CardContent>
// //                   </Card>
// //                 );
// //               })}
// //             </div>
// //           </div>
// //         )}

// //         {activeProductVariants.length === 0 && (
// //           <div className="text-center py-12">
// //             <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
// //             <h3 className="text-lg font-medium text-gray-900 mb-2">No variants found</h3>
// //             <p className="text-gray-600">This product doesn't have any active variants.</p>
// //           </div>
// //         )}
// //       </div>
// //     );
// //   };

// //   // =============================================
// //   // Main Render
// //   // =============================================
// //   return (
// //     <div className="space-y-4">
// //       {/* Breadcrumb Navigation with Search */}
// //       {renderBreadcrumb()}

// //       {/* Main Content Area */}
// //       <Card>
// //         <CardContent className="p-6 min-h-[600px]">
// //           {navigation.view === "categories" && renderCategories()}
// //           {navigation.view === "products" && renderProducts()}
// //           {navigation.view === "subProducts" && renderSubProducts()}
// //           {navigation.view === "search" && renderSearchResults()}
// //         </CardContent>
// //       </Card>
// //     </div>
// //   );
// // }

// // // "use client";

// // // import { useState, useCallback, useMemo, JSX } from "react";
// // // import { useQuery, useQueryClient } from "@tanstack/react-query";
// // // import { Button } from "@/components/ui/button";
// // // import { Input } from "@/components/ui/input";
// // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // import { Badge } from "@/components/ui/badge";
// // // import {
// // //   Breadcrumb,
// // //   BreadcrumbItem,
// // //   BreadcrumbLink,
// // //   BreadcrumbList,
// // //   BreadcrumbPage,
// // //   BreadcrumbSeparator,
// // // } from "@/components/ui/breadcrumb";
// // // import {
// // //   Package,
// // //   AlertTriangle,
// // //   ShoppingCart,
// // //   Plus,
// // //   Minus,
// // //   RefreshCw,
// // //   Loader2,
// // //   Home,
// // //   ChevronRight,
// // //   Box,
// // //   Layers,
// // // } from "lucide-react";
// // // import { toast } from "sonner";

// // // import type {
// // //   ApiResponse,
// // //   CartItem,
// // //   ProductWithVariants,
// // //   SubProductWithStock,
// // //   StockInfo,
// // //   ProductsInventoryResponse,
// // //   StockFIFOResponse,
// // //   CategoryRef,
// // // } from "@/types/pos";
// // // import type { Category, CategoriesResponse } from "@/types/category";

// // // // =============================================
// // // // Types
// // // // =============================================
// // // type NavigationView = "categories" | "products" | "subProducts";

// // // interface NavigationState {
// // //   view: NavigationView;
// // //   selectedCategory: Category | null;
// // //   selectedProduct: ProductWithVariants | null;
// // // }

// // // interface ProductNavigationProps {
// // //   onAddToCart: (item: CartItem) => void;
// // //   cartItems: CartItem[];
// // // }

// // // // =============================================
// // // // Helper Functions
// // // // =============================================
// // // function isCategoryRef(
// // //   categoryId: CategoryRef | string | null | undefined
// // // ): categoryId is CategoryRef {
// // //   return (
// // //     categoryId !== null &&
// // //     categoryId !== undefined &&
// // //     typeof categoryId === "object" &&
// // //     "_id" in categoryId
// // //   );
// // // }

// // // function extractCategoryId(
// // //   categoryId: CategoryRef | string | null | undefined
// // // ): string | null {
// // //   if (!categoryId) return null;
// // //   if (typeof categoryId === "string") return categoryId;
// // //   if (isCategoryRef(categoryId)) return categoryId._id;
// // //   return null;
// // // }

// // // function extractCategoryName(
// // //   categoryId: CategoryRef | string | null | undefined
// // // ): string | null {
// // //   if (isCategoryRef(categoryId)) return categoryId.name;
// // //   return null;
// // // }

// // // // =============================================
// // // // Component
// // // // =============================================
// // // export default function ProductNavigation({
// // //   onAddToCart,
// // //   cartItems,
// // // }: ProductNavigationProps): JSX.Element {
// // //   const queryClient = useQueryClient();

// // //   // Navigation state
// // //   const [navigation, setNavigation] = useState<NavigationState>({
// // //     view: "categories",
// // //     selectedCategory: null,
// // //     selectedProduct: null,
// // //   });

// // //   // UI states
// // //   const [activeVariants, setActiveVariants] = useState<Record<string, boolean>>({});
// // //   const [quantities, setQuantities] = useState<Record<string, number>>({});
// // //   const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
// // //   const [editingValue, setEditingValue] = useState("");
// // //   const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());

// // //   // =============================================
// // //   // Data Fetching
// // //   // =============================================
// // //   const { data: productsResponse, isLoading: productsLoading } = useQuery<
// // //     ApiResponse<ProductsInventoryResponse>,
// // //     Error
// // //   >({
// // //     queryKey: ["products-inventory"],
// // //     queryFn: async () => {
// // //       const response = await fetch("/api/inventories");
// // //       if (!response.ok) throw new Error("Failed to fetch products");
// // //       const data: ApiResponse<ProductsInventoryResponse> = await response.json();
// // //       if (!data.success || !data.data) {
// // //         throw new Error(data.error?.message || "Failed to fetch products");
// // //       }
// // //       return data;
// // //     },
// // //   });

// // //   const { data: categoriesResponse, isLoading: categoriesLoading } = useQuery<
// // //     ApiResponse<CategoriesResponse>,
// // //     Error
// // //   >({
// // //     queryKey: ["categories-active"],
// // //     queryFn: async () => {
// // //       const response = await fetch("/api/categories");
// // //       if (!response.ok) throw new Error("Failed to fetch categories");
// // //       const data: ApiResponse<CategoriesResponse> = await response.json();
// // //       if (!data.success || !data.data) {
// // //         throw new Error(data.error?.message || "Failed to fetch categories");
// // //       }
// // //       return data;
// // //     },
// // //   });

// // //   const { data: stocksResponse } = useQuery<ApiResponse<StockFIFOResponse>, Error>({
// // //     queryKey: ["fifo-stocks"],
// // //     queryFn: async () => {
// // //       const response = await fetch("/api/stock/fifo/oldest-all");
// // //       if (!response.ok) throw new Error("Failed to fetch stocks");
// // //       const data: ApiResponse<StockFIFOResponse> = await response.json();
// // //       if (!data.success || !data.data) {
// // //         throw new Error(data.error?.message || "Failed to fetch stocks");
// // //       }
// // //       return data;
// // //     },
// // //     enabled: !!productsResponse,
// // //     staleTime: 0,
// // //   });

// // //   // =============================================
// // //   // Memoized Data
// // //   // =============================================
// // //   const subProductStocks = useMemo((): Map<string, StockInfo> => {
// // //     const stocksMap = new Map<string, StockInfo>();
// // //     if (stocksResponse?.data?.data) {
// // //       stocksResponse.data.data.forEach((item) => {
// // //         if (item.currentStock) {
// // //           stocksMap.set(item.subProductId, item.currentStock);
// // //         }
// // //       });
// // //     }
// // //     return stocksMap;
// // //   }, [stocksResponse]);

// // //   const categories = useMemo((): Category[] => {
// // //     return categoriesResponse?.data?.categories?.filter((cat) => cat.isActive) || [];
// // //   }, [categoriesResponse]);

// // //   const getCategoryNameById = useCallback(
// // //     (categoryId: string | null): string => {
// // //       if (!categoryId) return "Uncategorized";
// // //       const category = categories.find((cat) => cat._id === categoryId);
// // //       return category?.name || "Uncategorized";
// // //     },
// // //     [categories]
// // //   );

// // //   const products = useMemo((): ProductWithVariants[] => {
// // //     if (!productsResponse?.data?.products) return [];

// // //     return productsResponse.data.products
// // //       .filter((product) => product.isActive)
// // //       .map((product): ProductWithVariants => {
// // //         const categoryName =
// // //           extractCategoryName(product.categoryId) ||
// // //           getCategoryNameById(extractCategoryId(product.categoryId));

// // //         return {
// // //           ...product,
// // //           variantCount: product.variants?.length || 0,
// // //           categoryName,
// // //           variants: product.variants?.map((variant) => ({
// // //             ...variant,
// // //             currentStock: subProductStocks.get(variant._id) || null,
// // //           })),
// // //         };
// // //       });
// // //   }, [productsResponse, subProductStocks, getCategoryNameById]);

// // //   // Get products for selected category
// // //   const categoryProducts = useMemo((): ProductWithVariants[] => {
// // //     if (!navigation.selectedCategory) return [];
// // //     return products.filter((product) => {
// // //       const productCategoryId = extractCategoryId(product.categoryId);
// // //       return productCategoryId === navigation.selectedCategory?._id;
// // //     });
// // //   }, [products, navigation.selectedCategory]);

// // //   // Get product count per category
// // //   const getProductCount = useCallback(
// // //     (categoryId: string): number => {
// // //       return products.filter((product) => {
// // //         const productCategoryId = extractCategoryId(product.categoryId);
// // //         return productCategoryId === categoryId;
// // //       }).length;
// // //     },
// // //     [products]
// // //   );

// // //   // =============================================
// // //   // Navigation Handlers
// // //   // =============================================
// // //   const navigateToCategories = useCallback(() => {
// // //     setNavigation({
// // //       view: "categories",
// // //       selectedCategory: null,
// // //       selectedProduct: null,
// // //     });
// // //     setActiveVariants({});
// // //     setQuantities({});
// // //   }, []);

// // //   const navigateToProducts = useCallback((category: Category) => {
// // //     setNavigation({
// // //       view: "products",
// // //       selectedCategory: category,
// // //       selectedProduct: null,
// // //     });
// // //     setActiveVariants({});
// // //     setQuantities({});
// // //   }, []);

// // //   const navigateToSubProducts = useCallback(
// // //     (product: ProductWithVariants) => {
// // //       setNavigation({
// // //         view: "subProducts",
// // //         selectedCategory: navigation.selectedCategory,
// // //         selectedProduct: product,
// // //       });
// // //       setActiveVariants({});
// // //       setQuantities({});
// // //     },
// // //     [navigation.selectedCategory]
// // //   );

// // //   // =============================================
// // //   // Stock Management
// // //   // =============================================
// // //   const refreshStockForSubProduct = useCallback(
// // //     async (subProductId: string): Promise<void> => {
// // //       setRefreshingStocks((prev) => new Set(prev).add(subProductId));
// // //       try {
// // //         const response = await fetch(
// // //           `/api/stock/fifo/oldest-single?subProductId=${subProductId}`
// // //         );
// // //         if (response.ok) {
// // //           const result: ApiResponse<StockInfo> = await response.json();
// // //           queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(
// // //             ["fifo-stocks"],
// // //             (oldData) => {
// // //               if (!oldData?.data?.data) return oldData;
// // //               const stocksArray = [...oldData.data.data];
// // //               const index = stocksArray.findIndex(
// // //                 (item) => item.subProductId === subProductId
// // //               );

// // //               if (result.success && result.data) {
// // //                 const newItem = { subProductId, currentStock: result.data };
// // //                 if (index >= 0) {
// // //                   stocksArray[index] = newItem;
// // //                 } else {
// // //                   stocksArray.push(newItem);
// // //                 }
// // //                 toast.success("Stock refreshed");
// // //               } else {
// // //                 if (index >= 0) stocksArray.splice(index, 1);
// // //                 toast.info("No stock available");
// // //               }

// // //               return { ...oldData, data: { ...oldData.data, data: stocksArray } };
// // //             }
// // //           );
// // //         }
// // //       } catch (error) {
// // //         console.error("Error refreshing stock:", error);
// // //         toast.error("Failed to refresh stock");
// // //       } finally {
// // //         setRefreshingStocks((prev) => {
// // //           const updated = new Set(prev);
// // //           updated.delete(subProductId);
// // //           return updated;
// // //         });
// // //       }
// // //     },
// // //     [queryClient]
// // //   );

// // //   const updateStockInCache = useCallback(
// // //     (subProductId: string, quantityReduced: number): void => {
// // //       queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(
// // //         ["fifo-stocks"],
// // //         (oldData) => {
// // //           if (!oldData?.data?.data) return oldData;
// // //           const stocksArray = [...oldData.data.data];
// // //           const index = stocksArray.findIndex(
// // //             (item) => item.subProductId === subProductId
// // //           );

// // //           if (index >= 0 && stocksArray[index].currentStock) {
// // //             const currentStock = stocksArray[index].currentStock!;
// // //             const newQuantity = currentStock.quantityLeft - quantityReduced;
// // //             if (newQuantity <= 0) {
// // //               stocksArray.splice(index, 1);
// // //             } else {
// // //               stocksArray[index] = {
// // //                 ...stocksArray[index],
// // //                 currentStock: { ...currentStock, quantityLeft: newQuantity },
// // //               };
// // //             }
// // //           }

// // //           return { ...oldData, data: { ...oldData.data, data: stocksArray } };
// // //         }
// // //       );
// // //     },
// // //     [queryClient]
// // //   );

// // //   // =============================================
// // //   // Cart Handlers
// // //   // =============================================
// // //   const handleInitialAddToCart = useCallback((variantId: string): void => {
// // //     setActiveVariants((prev) => ({ ...prev, [variantId]: true }));
// // //     setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// // //   }, []);

// // //   const handleQuantityChange = useCallback(
// // //     (variantId: string, newQuantity: number, maxStock: number): void => {
// // //       if (newQuantity < 1) {
// // //         setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// // //         return;
// // //       }
// // //       if (newQuantity > maxStock) {
// // //         toast.error(`Only ${maxStock} units available`);
// // //         setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
// // //         return;
// // //       }
// // //       setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
// // //     },
// // //     []
// // //   );

// // //   const handleQuantityClick = useCallback(
// // //     (variantId: string, currentQuantity: number): void => {
// // //       setEditingVariantId(variantId);
// // //       setEditingValue(currentQuantity.toString());
// // //     },
// // //     []
// // //   );

// // //   const handleManualQuantityChange = useCallback(
// // //     (e: React.ChangeEvent<HTMLInputElement>): void => {
// // //       const value = e.target.value;
// // //       if (value === "" || /^\d+$/.test(value)) {
// // //         setEditingValue(value);
// // //       }
// // //     },
// // //     []
// // //   );

// // //   const handleQuantityBlur = useCallback(
// // //     (variantId: string, maxStock: number): void => {
// // //       const newQuantity = parseInt(editingValue, 10) || 1;
// // //       if (newQuantity < 1) {
// // //         toast.error("Quantity must be at least 1");
// // //         setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// // //       } else if (newQuantity > maxStock) {
// // //         toast.error(`Only ${maxStock} units available`);
// // //         setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
// // //       } else {
// // //         setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
// // //       }
// // //       setEditingVariantId(null);
// // //       setEditingValue("");
// // //     },
// // //     [editingValue]
// // //   );

// // //   const handleQuantityKeyPress = useCallback(
// // //     (e: React.KeyboardEvent, variantId: string, maxStock: number): void => {
// // //       if (e.key === "Enter") {
// // //         handleQuantityBlur(variantId, maxStock);
// // //       } else if (e.key === "Escape") {
// // //         setEditingVariantId(null);
// // //         setEditingValue("");
// // //       }
// // //     },
// // //     [handleQuantityBlur]
// // //   );

// // //   const handleFinalAddToCart = useCallback(
// // //     (variant: SubProductWithStock, product: ProductWithVariants): void => {
// // //       const stockInfo = subProductStocks.get(variant._id);
// // //       if (!stockInfo) {
// // //         toast.error("No stock information available");
// // //         return;
// // //       }

// // //       const quantity = quantities[variant._id] || 1;
// // //       updateStockInCache(variant._id, quantity);

// // //       const cartItem: CartItem = {
// // //         itemKey: `sub:${variant._id}`,
// // //         subProductId: variant._id,
// // //         productId: product._id,
// // //         name: variant.name,
// // //         price: stockInfo.sellingPrice,
// // //         quantity,
// // //         stock: stockInfo.quantityLeft,
// // //         itemType: "subProduct",
// // //         stockTransactionId: stockInfo.stockTransactionId,
// // //       };

// // //       onAddToCart(cartItem);
// // //       toast.success(`${quantity} × ${variant.name} added to cart`);
// // //       setActiveVariants((prev) => ({ ...prev, [variant._id]: false }));
// // //       setQuantities((prev) => ({ ...prev, [variant._id]: 1 }));
// // //     },
// // //     [quantities, subProductStocks, updateStockInCache, onAddToCart]
// // //   );

// // //   // =============================================
// // //   // Helper Functions
// // //   // =============================================
// // //   const hasLowStock = useCallback(
// // //     (variant: SubProductWithStock): boolean => {
// // //       const stockInfo = subProductStocks.get(variant._id);
// // //       if (!stockInfo) return true;
// // //       return stockInfo.quantityLeft <= (variant.lowStockThreshold || 5);
// // //     },
// // //     [subProductStocks]
// // //   );

// // //   const isOutOfStock = useCallback(
// // //     (variant: SubProductWithStock): boolean => {
// // //       const stockInfo = subProductStocks.get(variant._id);
// // //       return !stockInfo || stockInfo.quantityLeft <= 0;
// // //     },
// // //     [subProductStocks]
// // //   );

// // //   const getPriceRange = useCallback(
// // //     (product: ProductWithVariants): { min: number; max: number } | null => {
// // //       if (!product.variants || product.variants.length === 0) return null;
// // //       const activePrices = product.variants
// // //         .filter((v) => v.isActive && subProductStocks.get(v._id))
// // //         .map((v) => subProductStocks.get(v._id)?.sellingPrice || 0)
// // //         .filter((price) => price > 0);
// // //       if (activePrices.length === 0) return null;
// // //       return { min: Math.min(...activePrices), max: Math.max(...activePrices) };
// // //     },
// // //     [subProductStocks]
// // //   );

// // //   const getVariantsInStock = useCallback(
// // //     (product: ProductWithVariants): number => {
// // //       if (!product.variants) return 0;
// // //       return product.variants.filter(
// // //         (v) => v.isActive && subProductStocks.has(v._id)
// // //       ).length;
// // //     },
// // //     [subProductStocks]
// // //   );

// // //   const isVariantInCart = useCallback(
// // //     (variantId: string): boolean => {
// // //       return cartItems.some((item) => item.subProductId === variantId);
// // //     },
// // //     [cartItems]
// // //   );

// // //   // =============================================
// // //   // Loading State
// // //   // =============================================
// // //   if (productsLoading || categoriesLoading) {
// // //     return (
// // //       <div className="flex items-center justify-center py-12">
// // //         <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
// // //         <span className="ml-2 text-gray-600">Loading...</span>
// // //       </div>
// // //     );
// // //   }

// // //   // =============================================
// // //   // Render Breadcrumb
// // //   // =============================================
// // //   const renderBreadcrumb = () => (
// // //     <Card className="mb-4">
// // //       <CardContent className="py-3">
// // //         <Breadcrumb>
// // //           <BreadcrumbList>
// // //             <BreadcrumbItem>
// // //               <BreadcrumbLink
// // //                 onClick={navigateToCategories}
// // //                 className="flex items-center cursor-pointer hover:text-blue-600"
// // //               >
// // //                 <Home className="w-4 h-4 mr-1" />
// // //                 Categories
// // //               </BreadcrumbLink>
// // //             </BreadcrumbItem>

// // //             {navigation.selectedCategory && (
// // //               <>
// // //                 <BreadcrumbSeparator>
// // //                   <ChevronRight className="w-4 h-4" />
// // //                 </BreadcrumbSeparator>
// // //                 <BreadcrumbItem>
// // //                   {navigation.view === "products" ? (
// // //                     <BreadcrumbPage className="flex items-center font-semibold">
// // //                       <Layers className="w-4 h-4 mr-1" />
// // //                       {navigation.selectedCategory.name}
// // //                     </BreadcrumbPage>
// // //                   ) : (
// // //                     <BreadcrumbLink
// // //                       onClick={() => navigateToProducts(navigation.selectedCategory!)}
// // //                       className="flex items-center cursor-pointer hover:text-blue-600"
// // //                     >
// // //                       <Layers className="w-4 h-4 mr-1" />
// // //                       {navigation.selectedCategory.name}
// // //                     </BreadcrumbLink>
// // //                   )}
// // //                 </BreadcrumbItem>
// // //               </>
// // //             )}

// // //             {navigation.selectedProduct && (
// // //               <>
// // //                 <BreadcrumbSeparator>
// // //                   <ChevronRight className="w-4 h-4" />
// // //                 </BreadcrumbSeparator>
// // //                 <BreadcrumbItem>
// // //                   <BreadcrumbPage className="flex items-center font-semibold">
// // //                     <Box className="w-4 h-4 mr-1" />
// // //                     {navigation.selectedProduct.name}
// // //                   </BreadcrumbPage>
// // //                 </BreadcrumbItem>
// // //               </>
// // //             )}
// // //           </BreadcrumbList>
// // //         </Breadcrumb>
// // //       </CardContent>
// // //     </Card>
// // //   );

// // //   // =============================================
// // //   // Render Categories View
// // //   // =============================================
// // //   const renderCategories = () => (
// // //     <div>
// // //       <div className="mb-6">
// // //         <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Category</h2>
// // //         <p className="text-gray-600">Choose a category to browse products</p>
// // //       </div>

// // //       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
// // //         {categories.map((category) => {
// // //           const productCount = getProductCount(category._id);
// // //           return (
// // //             <Card
// // //               key={category._id}
// // //               onClick={() => navigateToProducts(category)}
// // //               className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all"
// // //             >
// // //               <CardContent className="p-6 text-center">
// // //                 <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
// // //                   <Package className="w-8 h-8 text-blue-600" />
// // //                 </div>
// // //                 <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
// // //                 <p className="text-sm text-gray-500">{productCount} products</p>
// // //               </CardContent>
// // //             </Card>
// // //           );
// // //         })}
// // //       </div>

// // //       {categories.length === 0 && (
// // //         <div className="text-center py-12">
// // //           <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
// // //           <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
// // //           <p className="text-gray-600">Categories will appear here once added.</p>
// // //         </div>
// // //       )}
// // //     </div>
// // //   );

// // //   // =============================================
// // //   // Render Products View
// // //   // =============================================
// // //   const renderProducts = () => (
// // //     <div>
// // //       <div className="mb-6">
// // //         <h2 className="text-2xl font-bold text-gray-900 mb-2">
// // //           {navigation.selectedCategory?.name}
// // //         </h2>
// // //         <p className="text-gray-600">Select a product to view variants</p>
// // //       </div>

// // //       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
// // //         {categoryProducts.map((product) => {
// // //           const priceRange = getPriceRange(product);
// // //           const variantsInStock = getVariantsInStock(product);
// // //           const totalVariants = product.variants?.filter((v) => v.isActive).length || 0;

// // //           return (
// // //             <Card
// // //               key={product._id}
// // //               onClick={() => navigateToSubProducts(product)}
// // //               className="cursor-pointer hover:shadow-lg hover:border-green-300 transition-all"
// // //             >
// // //               <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center rounded-t-lg">
// // //                 <Package className="w-12 h-12 text-gray-400" />
// // //               </div>
// // //               <CardContent className="p-4">
// // //                 <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
// // //                   {product.name}
// // //                 </h3>
// // //                 {product.description && (
// // //                   <p className="text-sm text-gray-500 mb-2 line-clamp-1">
// // //                     {product.description}
// // //                   </p>
// // //                 )}
// // //                 <div className="flex items-center justify-between mb-2">
// // //                   {priceRange ? (
// // //                     <span className="text-green-600 font-bold">
// // //                       {priceRange.min === priceRange.max
// // //                         ? `₹${priceRange.min}`
// // //                         : `₹${priceRange.min} - ₹${priceRange.max}`}
// // //                     </span>
// // //                   ) : (
// // //                     <span className="text-gray-500 text-sm">No price</span>
// // //                   )}
// // //                 </div>
// // //                 <div className="flex items-center justify-between">
// // //                   <Badge variant="outline" className="text-xs">
// // //                     {totalVariants} variants
// // //                   </Badge>
// // //                   <Badge
// // //                     variant={variantsInStock > 0 ? "default" : "destructive"}
// // //                     className="text-xs"
// // //                   >
// // //                     {variantsInStock} in stock
// // //                   </Badge>
// // //                 </div>
// // //               </CardContent>
// // //             </Card>
// // //           );
// // //         })}
// // //       </div>

// // //       {categoryProducts.length === 0 && (
// // //         <div className="text-center py-12">
// // //           <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
// // //           <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
// // //           <p className="text-gray-600">This category doesn't have any products yet.</p>
// // //         </div>
// // //       )}
// // //     </div>
// // //   );

// // //   // =============================================
// // //   // Render Sub-Products (Variants) View
// // //   // =============================================
// // //   const renderSubProducts = () => {
// // //     const product = navigation.selectedProduct;
// // //     if (!product) return null;

// // //     const activeVariants = product.variants?.filter((v) => v.isActive) || [];
// // //     const variantsWithStock = activeVariants.filter((v) => subProductStocks.has(v._id));
// // //     const variantsWithoutStock = activeVariants.filter((v) => !subProductStocks.has(v._id));

// // //     return (
// // //       <div>
// // //         <div className="mb-6">
// // //           <h2 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h2>
// // //           <p className="text-gray-600">
// // //             {product.description || "Select a variant to add to cart"}
// // //           </p>
// // //         </div>

// // //         {/* Variants with stock */}
// // //         {variantsWithStock.length > 0 && (
// // //           <div className="mb-6">
// // //             <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
// // //               <Package className="w-5 h-5 text-green-600" />
// // //               Available Variants ({variantsWithStock.length})
// // //             </h3>
// // //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
// // //               {variantsWithStock.map((variant) => {
// // //                 const stockInfo = subProductStocks.get(variant._id)!;
// // //                 const isActive = activeVariants[variant._id] ?? false;
// // //                 const quantity = quantities[variant._id] || 1;
// // //                 const isEditing = editingVariantId === variant._id;
// // //                 const isRefreshing = refreshingStocks.has(variant._id);
// // //                 const lowStock = hasLowStock(variant);
// // //                 const inCart = isVariantInCart(variant._id);

// // //                 return (
// // //                   <Card
// // //                     key={variant._id}
// // //                     className={`relative hover:shadow-lg transition-all border-2 ${
// // //                       inCart
// // //                         ? "border-blue-300 bg-blue-50"
// // //                         : lowStock
// // //                         ? "border-orange-200"
// // //                         : "border-green-200"
// // //                     }`}
// // //                   >
// // //                     <div className="relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center rounded-t-lg">
// // //                       <Package className="w-16 h-16 text-gray-300" />
// // //                       <div className="absolute top-2 left-2">
// // //                         <Badge
// // //                           variant={lowStock ? "destructive" : "default"}
// // //                           className={lowStock ? "bg-orange-500" : "bg-green-500"}
// // //                         >
// // //                           Stock: {stockInfo.quantityLeft}
// // //                         </Badge>
// // //                       </div>
// // //                       {variant.size && (
// // //                         <div className="absolute top-2 right-2">
// // //                           <Badge variant="outline" className="bg-white">
// // //                             {variant.size}
// // //                           </Badge>
// // //                         </div>
// // //                       )}
// // //                       <Button
// // //                         onClick={(e) => {
// // //                           e.stopPropagation();
// // //                           refreshStockForSubProduct(variant._id);
// // //                         }}
// // //                         disabled={isRefreshing}
// // //                         variant="secondary"
// // //                         size="sm"
// // //                         className="absolute bottom-2 right-2 h-7 px-2"
// // //                       >
// // //                         <RefreshCw
// // //                           className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
// // //                         />
// // //                       </Button>
// // //                     </div>

// // //                     <CardContent className="p-4">
// // //                       <h4 className="font-semibold text-gray-900 mb-2">{variant.name}</h4>
// // //                       <div className="flex items-center justify-between mb-4">
// // //                         <span className="text-2xl font-bold text-green-600">
// // //                           ₹{stockInfo.sellingPrice.toFixed(2)}
// // //                         </span>
// // //                         {lowStock && (
// // //                           <div className="flex items-center gap-1">
// // //                             <AlertTriangle className="w-4 h-4 text-orange-500" />
// // //                             <span className="text-xs text-orange-600">Low Stock</span>
// // //                           </div>
// // //                         )}
// // //                       </div>

// // //                       {inCart && (
// // //                         <Badge className="mb-3 bg-blue-500">Already in cart</Badge>
// // //                       )}

// // //                       {/* Action Buttons */}
// // //                       <div className="space-y-2">
// // //                         {!isActive ? (
// // //                           <Button
// // //                             onClick={() => handleInitialAddToCart(variant._id)}
// // //                             className="w-full bg-green-500 hover:bg-green-600 text-white"
// // //                           >
// // //                             <ShoppingCart className="w-4 h-4 mr-2" />
// // //                             Add to Cart
// // //                           </Button>
// // //                         ) : (
// // //                           <>
// // //                             <div className="flex items-center justify-center gap-2">
// // //                               <Button
// // //                                 variant="outline"
// // //                                 size="sm"
// // //                                 onClick={() =>
// // //                                   handleQuantityChange(
// // //                                     variant._id,
// // //                                     quantity - 1,
// // //                                     stockInfo.quantityLeft
// // //                                   )
// // //                                 }
// // //                                 disabled={quantity <= 1}
// // //                                 className="h-8 w-8 p-0"
// // //                               >
// // //                                 <Minus className="h-3 w-3" />
// // //                               </Button>

// // //                               {isEditing ? (
// // //                                 <Input
// // //                                   type="text"
// // //                                   value={editingValue}
// // //                                   onChange={handleManualQuantityChange}
// // //                                   onBlur={() =>
// // //                                     handleQuantityBlur(variant._id, stockInfo.quantityLeft)
// // //                                   }
// // //                                   onKeyDown={(e) =>
// // //                                     handleQuantityKeyPress(
// // //                                       e,
// // //                                       variant._id,
// // //                                       stockInfo.quantityLeft
// // //                                     )
// // //                                   }
// // //                                   className="w-14 h-8 text-center text-sm p-1"
// // //                                   autoFocus
// // //                                 />
// // //                               ) : (
// // //                                 <span
// // //                                   className="w-14 text-center font-semibold cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
// // //                                   onClick={() => handleQuantityClick(variant._id, quantity)}
// // //                                   title="Click to edit"
// // //                                 >
// // //                                   {quantity}
// // //                                 </span>
// // //                               )}

// // //                               <Button
// // //                                 variant="outline"
// // //                                 size="sm"
// // //                                 onClick={() =>
// // //                                   handleQuantityChange(
// // //                                     variant._id,
// // //                                     quantity + 1,
// // //                                     stockInfo.quantityLeft
// // //                                   )
// // //                                 }
// // //                                 disabled={quantity >= stockInfo.quantityLeft}
// // //                                 className="h-8 w-8 p-0"
// // //                               >
// // //                                 <Plus className="h-3 w-3" />
// // //                               </Button>
// // //                             </div>
// // //                             <Button
// // //                               onClick={() => handleFinalAddToCart(variant, product)}
// // //                               className="w-full bg-green-500 hover:bg-green-600 text-white"
// // //                             >
// // //                               <ShoppingCart className="w-4 h-4 mr-2" />
// // //                               Add {quantity} to Cart
// // //                             </Button>
// // //                           </>
// // //                         )}
// // //                       </div>
// // //                     </CardContent>
// // //                   </Card>
// // //                 );
// // //               })}
// // //             </div>
// // //           </div>
// // //         )}

// // //         {/* Variants without stock */}
// // //         {variantsWithoutStock.length > 0 && (
// // //           <div>
// // //             <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
// // //               <AlertTriangle className="w-5 h-5 text-amber-600" />
// // //               Out of Stock ({variantsWithoutStock.length})
// // //             </h3>
// // //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
// // //               {variantsWithoutStock.map((variant) => {
// // //                 const isRefreshing = refreshingStocks.has(variant._id);

// // //                 return (
// // //                   <Card key={variant._id} className="opacity-60 border-gray-200">
// // //                     <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center rounded-t-lg">
// // //                       <Package className="w-16 h-16 text-gray-400" />
// // //                       <div className="absolute top-2 left-2">
// // //                         <Badge variant="secondary">Out of Stock</Badge>
// // //                       </div>
// // //                       <Button
// // //                         onClick={() => refreshStockForSubProduct(variant._id)}
// // //                         disabled={isRefreshing}
// // //                         variant="secondary"
// // //                         size="sm"
// // //                         className="absolute bottom-2 right-2 h-7 px-2"
// // //                       >
// // //                         <RefreshCw
// // //                           className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
// // //                         />
// // //                       </Button>
// // //                     </div>
// // //                     <CardContent className="p-4">
// // //                       <h4 className="font-semibold text-gray-600 mb-2">{variant.name}</h4>
// // //                       <p className="text-gray-500 mb-4">Price unavailable</p>
// // //                       <Button disabled className="w-full">
// // //                         Out of Stock
// // //                       </Button>
// // //                     </CardContent>
// // //                   </Card>
// // //                 );
// // //               })}
// // //             </div>
// // //           </div>
// // //         )}

// // //         {activeVariants.length === 0 && (
// // //           <div className="text-center py-12">
// // //             <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
// // //             <h3 className="text-lg font-medium text-gray-900 mb-2">No variants found</h3>
// // //             <p className="text-gray-600">This product doesn't have any active variants.</p>
// // //           </div>
// // //         )}
// // //       </div>
// // //     );
// // //   };

// // //   // =============================================
// // //   // Main Render
// // //   // =============================================
// // //   return (
// // //     <div className="space-y-4">
// // //       {/* Breadcrumb Navigation */}
// // //       {renderBreadcrumb()}

// // //       {/* Main Content Area */}
// // //       <Card>
// // //         <CardContent className="p-6 min-h-[600px]">
// // //           {navigation.view === "categories" && renderCategories()}
// // //           {navigation.view === "products" && renderProducts()}
// // //           {navigation.view === "subProducts" && renderSubProducts()}
// // //         </CardContent>
// // //       </Card>
// // //     </div>
// // //   );
// // // }