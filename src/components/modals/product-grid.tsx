// components/pos/product-grid.tsx
"use client";

import { useState, useCallback, useMemo, JSX } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Package,
  AlertTriangle,
  Eye,
  ShoppingCart,
  Plus,
  Minus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import ProductVariantsModal from "@/components/modals/product-variants-modal";

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
// Props Interface
// =============================================
interface ProductGridProps {
  onAddToCart: (item: CartItem) => void;
}

// =============================================
// Helper Functions (defined outside component)
// =============================================

/** Type guard to check if categoryId is a CategoryRef object */
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

/** Extract category ID string from CategoryRef or string */
function extractCategoryId(categoryId: CategoryRef | string | null | undefined): string | null {
  if (!categoryId) return null;
  if (typeof categoryId === "string") return categoryId;
  if (isCategoryRef(categoryId)) return categoryId._id;
  return null;
}

/** Extract category name from CategoryRef */
function extractCategoryName(categoryId: CategoryRef | string | null | undefined): string | null {
  if (isCategoryRef(categoryId)) return categoryId.name;
  return null;
}

// =============================================
// Component
// =============================================
export default function ProductGrid({ onAddToCart }: ProductGridProps): JSX.Element {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithVariants | null>(null);
  const [activeProducts, setActiveProducts] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());

  // =============================================
  // Data Fetching
  // =============================================

  // Fetch products
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

  // Fetch categories
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

  // Fetch FIFO stocks
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

  // Create stocks map
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

  // Categories list
  const categories = useMemo((): Category[] => {
    return categoriesResponse?.data?.categories?.filter((cat) => cat.isActive) || [];
  }, [categoriesResponse]);

  // Get category name by ID (for fallback)
  const getCategoryNameById = useCallback(
    (categoryId: string | null): string => {
      if (!categoryId) return "Uncategorized";
      const category = categories.find((cat) => cat._id === categoryId);
      return category?.name || "Uncategorized";
    },
    [categories]
  );

  // Products with enriched data
  const products = useMemo((): ProductWithVariants[] => {
    if (!productsResponse?.data?.products) return [];

    return productsResponse.data.products
      .filter((product) => product.isActive)
      .map((product): ProductWithVariants => {
        // Extract category name from CategoryRef or lookup from categories
        const categoryName =
          extractCategoryName(product.categoryId) ||
          getCategoryNameById(extractCategoryId(product.categoryId));

        return {
          ...product,
          variantCount: product.variants?.length || 0,
          categoryName,
          // Enrich variants with currentStock from the stocks map
          variants: product.variants?.map((variant) => ({
            ...variant,
            currentStock: subProductStocks.get(variant._id) || null,
          })),
        };
      });
  }, [productsResponse, subProductStocks, getCategoryNameById]);

  // =============================================
  // Helper Callbacks
  // =============================================

  const getFirstActiveVariant = useCallback(
    (product: ProductWithVariants): SubProductWithStock | null => {
      if (!product.variants || product.variants.length === 0) return null;
      const variant = product.variants.find((v) => v.isActive);
      if (!variant) return null;

      return {
        ...variant,
        currentStock: subProductStocks.get(variant._id) || null,
      };
    },
    [subProductStocks]
  );

  const getPriceRange = useCallback(
    (product: ProductWithVariants): { min: number; max: number } | null => {
      if (!product.variants || product.variants.length === 0) return null;

      const activePrices = product.variants
        .filter((variant) => variant.isActive && subProductStocks.get(variant._id))
        .map((variant) => subProductStocks.get(variant._id)?.sellingPrice || 0)
        .filter((price) => price > 0);

      if (activePrices.length === 0) return null;

      return {
        min: Math.min(...activePrices),
        max: Math.max(...activePrices),
      };
    },
    [subProductStocks]
  );

  const hasLowStock = useCallback((variant: SubProductWithStock): boolean => {
    if (!variant.currentStock) return true;
    return variant.currentStock.quantityLeft <= variant.lowStockThreshold;
  }, []);

  const isOutOfStock = useCallback((variant: SubProductWithStock): boolean => {
    return !variant.currentStock || variant.currentStock.quantityLeft <= 0;
  }, []);

  // =============================================
  // Stock Management
  // =============================================

  // Refresh single stock
  const refreshStockForSubProduct = useCallback(
    async (subProductId: string): Promise<void> => {
      setRefreshingStocks((prev) => new Set(prev).add(subProductId));

      try {
        const response = await fetch(
          `/api/stock/fifo/oldest-single?subProductId=${subProductId}`
        );

        if (response.ok) {
          const result: ApiResponse<StockInfo> = await response.json();

          queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(
            ["fifo-stocks"],
            (oldData) => {
              if (!oldData?.data?.data) return oldData;

              const stocksArray = [...oldData.data.data];
              const index = stocksArray.findIndex(
                (item) => item.subProductId === subProductId
              );

              if (result.success && result.data) {
                const newItem = {
                  subProductId,
                  currentStock: result.data,
                };

                if (index >= 0) {
                  stocksArray[index] = newItem;
                } else {
                  stocksArray.push(newItem);
                }

                toast.success("Stock refreshed - new batch loaded");
              } else {
                if (index >= 0) {
                  stocksArray.splice(index, 1);
                }
                toast.info("No stock available for this product");
              }

              return {
                ...oldData,
                data: {
                  ...oldData.data,
                  data: stocksArray,
                },
              };
            }
          );
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

  // Refresh depleted stocks
  const refreshDepletedStocks = useCallback(async (): Promise<void> => {
    const depletedSubProductIds: string[] = [];

    subProductStocks.forEach((stock, subProductId) => {
      if (stock.quantityLeft === 0) {
        depletedSubProductIds.push(subProductId);
      }
    });

    if (depletedSubProductIds.length === 0) {
      toast.info("No depleted stocks to refresh");
      return;
    }

    toast.info(`Refreshing ${depletedSubProductIds.length} depleted stocks...`);

    try {
      const response = await fetch("/api/stock/fifo/oldest-multiple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subProductIds: depletedSubProductIds }),
      });

      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ["fifo-stocks"] });
        toast.success("Depleted stocks refreshed");
      } else {
        toast.error("Failed to refresh depleted stocks");
      }
    } catch (error) {
      console.error("Error refreshing depleted stocks:", error);
      toast.error("Failed to refresh depleted stocks");
    }
  }, [subProductStocks, queryClient]);

  // Update stock in cache after adding to cart
  const updateStockInCache = useCallback(
    (subProductId: string, quantityReduced: number): void => {
      queryClient.setQueryData<ApiResponse<StockFIFOResponse>>(
        ["fifo-stocks"],
        (oldData) => {
          if (!oldData?.data?.data) return oldData;

          const stocksArray = [...oldData.data.data];
          const index = stocksArray.findIndex(
            (item) => item.subProductId === subProductId
          );

          if (index >= 0 && stocksArray[index].currentStock) {
            const currentStock = stocksArray[index].currentStock!;
            const newQuantity = currentStock.quantityLeft - quantityReduced;

            if (newQuantity <= 0) {
              stocksArray.splice(index, 1);
            } else {
              stocksArray[index] = {
                ...stocksArray[index],
                currentStock: {
                  ...currentStock,
                  quantityLeft: newQuantity,
                },
              };
            }
          }

          return {
            ...oldData,
            data: {
              ...oldData.data,
              data: stocksArray,
            },
          };
        }
      );
    },
    [queryClient]
  );

  // =============================================
  // Cart Handlers
  // =============================================

  const handleInitialAddToCart = useCallback((product: ProductWithVariants): void => {
    setActiveProducts((prev) => ({ ...prev, [product._id]: true }));
    setQuantities((prev) => ({ ...prev, [product._id]: 1 }));
  }, []);

  const handleQuantityChange = useCallback(
    (productId: string, newQuantity: number, maxStock: number): void => {
      if (newQuantity < 1) {
        setQuantities((prev) => ({ ...prev, [productId]: 1 }));
        return;
      }
      if (newQuantity > maxStock) {
        toast.error(`Only ${maxStock} units available in stock`);
        setQuantities((prev) => ({ ...prev, [productId]: maxStock }));
        return;
      }
      setQuantities((prev) => ({ ...prev, [productId]: newQuantity }));
    },
    []
  );

  const handleQuantityClick = useCallback(
    (productId: string, currentQuantity: number): void => {
      setEditingProductId(productId);
      setEditingValue(currentQuantity.toString());
    },
    []
  );

  const handleManualQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.value;
      if (value === "" || /^\d+$/.test(value)) {
        setEditingValue(value);
      }
    },
    []
  );

  const handleQuantityBlur = useCallback(
    (productId: string, maxStock: number): void => {
      const newQuantity = parseInt(editingValue, 10) || 1;

      if (newQuantity < 1) {
        toast.error("Quantity must be at least 1");
        setQuantities((prev) => ({ ...prev, [productId]: 1 }));
      } else if (newQuantity > maxStock) {
        toast.error(`Only ${maxStock} units available in stock`);
        setQuantities((prev) => ({ ...prev, [productId]: maxStock }));
      } else {
        setQuantities((prev) => ({ ...prev, [productId]: newQuantity }));
      }

      setEditingProductId(null);
      setEditingValue("");
    },
    [editingValue]
  );

  const handleQuantityKeyPress = useCallback(
    (e: React.KeyboardEvent, productId: string, maxStock: number): void => {
      if (e.key === "Enter") {
        handleQuantityBlur(productId, maxStock);
      } else if (e.key === "Escape") {
        setEditingProductId(null);
        setEditingValue("");
      }
    },
    [handleQuantityBlur]
  );

  const handleFinalAddToCart = useCallback(
    (product: ProductWithVariants): void => {
      const firstActiveVariant = getFirstActiveVariant(product);
      if (firstActiveVariant?.currentStock) {
        const quantity = quantities[product._id] || 1;

        updateStockInCache(firstActiveVariant._id, quantity);

        const cartItem: CartItem = {
          itemKey: `sub:${firstActiveVariant._id}`,
          subProductId: firstActiveVariant._id,
          productId: product._id,
          name: firstActiveVariant.name,
          price: firstActiveVariant.currentStock.sellingPrice,
          quantity: quantity,
          stock: firstActiveVariant.currentStock.quantityLeft,
          itemType: "subProduct",
          stockTransactionId: firstActiveVariant.currentStock.stockTransactionId,
        };

        onAddToCart(cartItem);
        toast.success(`${quantity} × ${firstActiveVariant.name} added to cart`);

        setActiveProducts((prev) => ({ ...prev, [product._id]: false }));
        setQuantities((prev) => ({ ...prev, [product._id]: 1 }));
        return;
      }

      toast.error("This product has no available stock");
    },
    [getFirstActiveVariant, quantities, updateStockInCache, onAddToCart]
  );

  const handleAddToCart = useCallback(
    (product: ProductWithVariants): void => {
      const variantCount = product.variants?.length || 0;

      if (variantCount > 1) {
        setSelectedProduct(product);
        setShowVariantsModal(true);
        return;
      }

      const firstActiveVariant = getFirstActiveVariant(product);
      if (firstActiveVariant) {
        if (isOutOfStock(firstActiveVariant)) {
          toast.error("Product is out of stock");
          return;
        }
        handleInitialAddToCart(product);
        return;
      }

      toast.error("This product has no available variants");
    },
    [getFirstActiveVariant, isOutOfStock, handleInitialAddToCart]
  );

  const handleVariantAddToCart = useCallback(
    (variant: SubProductWithStock, quantity: number): void => {
      const stockInfo = subProductStocks.get(variant._id);
      if (!stockInfo) {
        toast.error("No stock information available");
        return;
      }

      updateStockInCache(variant._id, quantity);

      const cartItem: CartItem = {
        itemKey: `sub:${variant._id}`,
        subProductId: variant._id,
        productId: selectedProduct?._id,
        name: variant.name,
        price: stockInfo.sellingPrice,
        quantity,
        stock: stockInfo.quantityLeft,
        itemType: "subProduct",
        stockTransactionId: stockInfo.stockTransactionId,
      };

      onAddToCart(cartItem);
      setShowVariantsModal(false);
      toast.success(`${quantity} × ${variant.name} added to cart`);
    },
    [subProductStocks, selectedProduct, updateStockInCache, onAddToCart]
  );

  // =============================================
  // Filter Functions
  // =============================================

  const getProductsCountByCategory = useCallback(
    (categoryId: string): number => {
      if (categoryId === "all") {
        return products.filter((product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase())
        ).length;
      }
      return products.filter((product) => {
        const productCategoryId = extractCategoryId(product.categoryId);
        return (
          productCategoryId === categoryId &&
          product.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }).length;
    },
    [products, searchTerm]
  );

  const filteredProducts = useMemo((): ProductWithVariants[] => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      const productCategoryId = extractCategoryId(product.categoryId);
      const matchesCategory =
        selectedCategory === "all" || productCategoryId === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // =============================================
  // Loading State
  // =============================================

  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading products...</span>
      </div>
    );
  }

  // =============================================
  // Render
  // =============================================

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Products</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={refreshDepletedStocks}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Depleted Stocks
          </Button>
          <Badge variant="outline" className="text-sm">
            {filteredProducts.length} products available
          </Badge>
        </div>
      </div>

      {/* Search and Filter Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Search Products
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Product name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs and Products Grid */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="flex flex-wrap w-full gap-1 h-auto p-1 bg-gray-100">
          <TabsTrigger
            value="all"
            className="flex items-center space-x-2 py-2 px-4 bg-white data-[state=active]:border-indigo-500 data-[state=active]:bg-blue-100 data-[state=active]:shadow-sm"
          >
            <span>All Categories</span>
            <Badge variant="secondary" className="ml-1 text-xs">
              {getProductsCountByCategory("all")}
            </Badge>
          </TabsTrigger>
          {categories.map((category) => (
            <TabsTrigger
              key={category._id}
              value={category._id}
              className="flex items-center space-x-2 py-2 px-4 bg-white data-[state=active]:border-indigo-500 data-[state=active]:bg-blue-100 data-[state=active]:shadow-sm"
            >
              <span>{category.name}</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {getProductsCountByCategory(category._id)}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-4">
          {filteredProducts.map((product) => {
            const firstActiveVariant = getFirstActiveVariant(product);
            const priceRange = getPriceRange(product);
            const isActive = activeProducts[product._id] ?? false;
            const quantity = quantities[product._id] || 1;
            const isEditing = editingProductId === product._id;
            // const isRefreshing =
            //   firstActiveVariant && refreshingStocks.has(firstActiveVariant._id);
            const isRefreshing = firstActiveVariant 
            ? refreshingStocks.has(firstActiveVariant._id) 
            : false;
            const variantCount = product.variants?.length || 0;

            return (
              <Card
                key={product._id}
                className="hover:shadow-lg transition-shadow relative"
              >
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div className="w-32 h-32 rounded-lg bg-gray-100 flex items-center justify-center text-2xl overflow-hidden">
                      {firstActiveVariant?.imageURL ? (
                        <img
                          src={firstActiveVariant.imageURL}
                          alt={product.name}
                          className="object-contain w-full h-full"
                        />
                      ) : (
                        <Package className="w-12 h-12 text-gray-400" />
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {variantCount === 1 && firstActiveVariant?.currentStock ? (
                        <span className="text-lg font-bold text-green-600">
                          ₹{firstActiveVariant.currentStock.sellingPrice?.toFixed(2)}
                        </span>
                      ) : variantCount > 1 && priceRange ? (
                        <div className="text-right">
                          <span className="text-lg font-bold text-green-600">
                            ₹{priceRange.min.toFixed(2)}
                            {priceRange.min !== priceRange.max &&
                              ` - ₹${priceRange.max.toFixed(2)}`}
                          </span>
                          <Badge variant="secondary" className="mt-1 block">
                            {variantCount} Variants
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No stock</span>
                      )}
                      {variantCount === 1 && firstActiveVariant && (
                        <Button
                          onClick={() => refreshStockForSubProduct(firstActiveVariant._id)}
                          disabled={isRefreshing}
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {variantCount === 1 && firstActiveVariant && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span
                          className={`text-sm font-medium ${
                            firstActiveVariant.currentStock &&
                            hasLowStock(firstActiveVariant)
                              ? "text-red-600"
                              : "text-gray-700"
                          }`}
                        >
                          Stock: {firstActiveVariant.currentStock?.quantityLeft || 0}
                        </span>
                        {firstActiveVariant.currentStock &&
                          hasLowStock(firstActiveVariant) && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {product.categoryName}
                      </Badge>
                    </div>
                  )}

                  {variantCount > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {product.variants?.filter(
                            (v) => v.isActive && subProductStocks.get(v._id)
                          ).length || 0}{" "}
                          in stock
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {product.categoryName}
                      </Badge>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {variantCount > 1 ? (
                      <Button
                        onClick={() => handleAddToCart(product)}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Variants
                      </Button>
                    ) : firstActiveVariant && !isActive ? (
                      <Button
                        onClick={() => handleAddToCart(product)}
                        disabled={isOutOfStock(firstActiveVariant)}
                        className="w-full bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-400"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {isOutOfStock(firstActiveVariant) ? "Out of Stock" : "Add to Cart"}
                      </Button>
                    ) : isActive && firstActiveVariant?.currentStock ? (
                      <>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleQuantityChange(
                                product._id,
                                quantity - 1,
                                firstActiveVariant.currentStock!.quantityLeft
                              )
                            }
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
                              onBlur={() =>
                                handleQuantityBlur(
                                  product._id,
                                  firstActiveVariant.currentStock!.quantityLeft
                                )
                              }
                              onKeyDown={(e) =>
                                handleQuantityKeyPress(
                                  e,
                                  product._id,
                                  firstActiveVariant.currentStock!.quantityLeft
                                )
                              }
                              className="w-14 h-7 text-center text-sm p-1"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="w-14 text-center font-medium cursor-pointer hover:bg-gray-100 rounded px-2 py-1 text-sm"
                              onClick={() => handleQuantityClick(product._id, quantity)}
                              title="Click to edit quantity"
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  handleQuantityClick(product._id, quantity);
                                }
                              }}
                            >
                              {quantity}
                            </span>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleQuantityChange(
                                product._id,
                                quantity + 1,
                                firstActiveVariant.currentStock!.quantityLeft
                              )
                            }
                            disabled={quantity >= firstActiveVariant.currentStock.quantityLeft}
                            className="h-7 w-7 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          onClick={() => handleFinalAddToCart(product)}
                          className="w-full bg-green-500 hover:bg-green-600 text-white"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Confirm Add {quantity} to Cart
                        </Button>
                      </>
                    ) : (
                      <Button disabled className="w-full bg-gray-400 text-white">
                        No Stock Available
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Tabs>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
        </div>
      )}

      {/* Variants Modal */}
      {selectedProduct && (
        <ProductVariantsModal
          isOpen={showVariantsModal}
          onClose={() => setShowVariantsModal(false)}
          product={selectedProduct}
          variants={selectedProduct.variants || []}
          subProductStocks={subProductStocks}
          onAddToCart={handleVariantAddToCart}
          onRefreshStock={refreshStockForSubProduct}
        />
      )}
    </div>
  );
}