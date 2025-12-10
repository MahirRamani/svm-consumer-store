"use client";

import { useState, useEffect, useCallback, useMemo, JSX } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  Package,
  RefreshCw,
  Plus,
  Minus,
  AlertTriangle,
  X,
  ImageOff,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import type {
  ProductWithVariants,
  SubProductWithStock,
  StockInfo,
} from "@/types/pos";

// =============================================
// Component Props Interface
// =============================================
interface ProductVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductWithVariants;
  variants: SubProductWithStock[];
  subProductStocks: Map<string, StockInfo>;
  onAddToCart: (variant: SubProductWithStock, quantity: number) => void;
  onRefreshStock: (subProductId: string) => Promise<void>;
}

// =============================================
// Component
// =============================================
export default function ProductVariantsModal({
  isOpen,
  onClose,
  product,
  variants,
  subProductStocks,
  onAddToCart,
  onRefreshStock,
}: ProductVariantsModalProps): JSX.Element {
  const [activeVariants, setActiveVariants] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveVariants({});
      setQuantities({});
      setEditingVariantId(null);
      setEditingValue("");
      setRefreshingStocks(new Set());
    }
  }, [isOpen]);

  // Categorize variants - using _id
  const { variantsWithStock, variantsWithoutStock } = useMemo(() => {
    const activeVars = variants.filter((v) => v.isActive === true);
    return {
      variantsWithStock: activeVars.filter((v) => subProductStocks.has(v._id)),
      variantsWithoutStock: activeVars.filter((v) => !subProductStocks.has(v._id)),
    };
  }, [variants, subProductStocks]);

  const totalActiveVariants = useMemo((): number => {
    return variants.filter((v) => v.isActive === true).length;
  }, [variants]);

  const handleRefreshStock = useCallback(
    async (variantId: string): Promise<void> => {
      setRefreshingStocks((prev) => new Set(prev).add(variantId));
      try {
        await onRefreshStock(variantId);
      } finally {
        setRefreshingStocks((prev) => {
          const updated = new Set(prev);
          updated.delete(variantId);
          return updated;
        });
      }
    },
    [onRefreshStock]
  );

  const handleInitialAddToCart = useCallback((variantId: string): void => {
    setActiveVariants((prev) => ({ ...prev, [variantId]: true }));
    setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
  }, []);

  const handleQuantityChange = useCallback(
    (variantId: string, newQuantity: number, maxStock: number): void => {
      if (newQuantity < 1) {
        setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
        return;
      }
      if (newQuantity > maxStock) {
        toast.error(`Only ${maxStock} units available in stock`);
        setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
        return;
      }
      setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
    },
    []
  );

  const handleQuantityClick = useCallback(
    (variantId: string, currentQuantity: number): void => {
      setEditingVariantId(variantId);
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
    (variantId: string, maxStock: number): void => {
      const newQuantity = parseInt(editingValue, 10) || 1;

      if (newQuantity < 1) {
        toast.error("Quantity must be at least 1");
        setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
      } else if (newQuantity > maxStock) {
        toast.error(`Only ${maxStock} units available in stock`);
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
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      variantId: string,
      maxStock: number
    ): void => {
      if (e.key === "Enter") {
        handleQuantityBlur(variantId, maxStock);
      } else if (e.key === "Escape") {
        setEditingVariantId(null);
        setEditingValue("");
      }
    },
    [handleQuantityBlur]
  );

  const handleFinalAddToCart = useCallback(
    (variant: SubProductWithStock): void => {
      const quantity = quantities[variant._id] || 1;
      onAddToCart(variant, quantity);
      setActiveVariants((prev) => ({ ...prev, [variant._id]: false }));
      setQuantities((prev) => ({ ...prev, [variant._id]: 1 }));
    },
    [quantities, onAddToCart]
  );

  const hasLowStockCheck = useCallback(
    (stockInfo: StockInfo, threshold: number): boolean => {
      return stockInfo.quantityLeft <= threshold;
    },
    []
  );

  const formatDate = useCallback((dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Package className="h-5 w-5 text-blue-600" />
              {product.name} - Variants
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {variantsWithStock.length} of {totalActiveVariants} in stock
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {product.description && (
            <p className="text-sm text-muted-foreground mt-2">
              {product.description}
            </p>
          )}
        </DialogHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto px-1">
          {/* Variants with stock */}
          {variantsWithStock.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-green-600" />
                Available Variants ({variantsWithStock.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {variantsWithStock.map((variant) => {
                  const isActive = activeVariants[variant._id] ?? false;
                  const quantity = quantities[variant._id] || 1;
                  const isEditing = editingVariantId === variant._id;
                  const stockInfo = subProductStocks.get(variant._id)!;
                  const isRefreshing = refreshingStocks.has(variant._id);
                  const isLowStock = hasLowStockCheck(
                    stockInfo,
                    variant.lowStockThreshold || 5
                  );

                  return (
                    <Card
                      key={variant._id}
                      className="relative overflow-hidden hover:shadow-lg transition-all border-2 border-green-100 hover:border-green-300"
                    >
                      {/* Image */}
                      <div className="relative w-full h-40 bg-gradient-to-br from-gray-50 to-gray-100">
                        {variant.imageURL ? (
                          <img
                            src={variant.imageURL}
                            alt={variant.name}
                            className="w-full h-full object-cover"
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                              e.currentTarget.src =
                                "https://via.placeholder.com/300x200?text=No+Image";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <Badge
                            variant={isLowStock ? "destructive" : "default"}
                            className={`shadow-sm ${
                              isLowStock ? "bg-red-500" : "bg-green-500"
                            }`}
                          >
                            Stock: {stockInfo.quantityLeft}
                          </Badge>
                        </div>
                        <div className="absolute top-2 right-2">
                          <Button
                            onClick={() => handleRefreshStock(variant._id)}
                            disabled={isRefreshing}
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 shadow-sm"
                            title="Refresh stock"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                isRefreshing ? "animate-spin" : ""
                              }`}
                            />
                          </Button>
                        </div>
                      </div>

                      <CardHeader className="pb-2">
                        <CardTitle className="text-base line-clamp-2 min-h-[2.5rem]">
                          {variant.name}
                        </CardTitle>
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-bold text-green-600">
                            ₹{stockInfo.sellingPrice.toFixed(2)}
                          </span>
                          {isLowStock && (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                              <span className="text-xs text-red-600 font-medium">
                                Low Stock
                              </span>
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="py-2 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {variant.size && (
                            <Badge variant="outline" className="text-xs">
                              {variant.size}
                            </Badge>
                          )}
                          {variant.weight && (
                            <Badge variant="outline" className="text-xs">
                              {variant.weight}
                            </Badge>
                          )}
                          {variant.volume && (
                            <Badge variant="outline" className="text-xs">
                              {variant.volume}
                            </Badge>
                          )}
                        </div>

                        {variant.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {variant.description}
                          </p>
                        )}

                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Info className="w-3 h-3" />
                          <span>Batch: {formatDate(stockInfo.stockDate)}</span>
                        </div>
                      </CardContent>

                      <CardFooter className="flex flex-col gap-2 pt-2">
                        {!isActive ? (
                          <Button
                            onClick={() => handleInitialAddToCart(variant._id)}
                            className="w-full bg-green-500 hover:bg-green-600 text-white"
                            size="sm"
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>
                        ) : (
                          <>
                            <div className="flex items-center justify-center gap-2 w-full">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleQuantityChange(
                                    variant._id,
                                    quantity - 1,
                                    stockInfo.quantityLeft
                                  )
                                }
                                disabled={quantity <= 1}
                                className="h-8 w-8 p-0"
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
                                      variant._id,
                                      stockInfo.quantityLeft
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    handleQuantityKeyPress(
                                      e,
                                      variant._id,
                                      stockInfo.quantityLeft
                                    )
                                  }
                                  className="w-16 h-8 text-center text-sm p-1"
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="w-16 text-center font-semibold cursor-pointer hover:bg-gray-100 rounded px-2 py-1 text-sm"
                                  onClick={() =>
                                    handleQuantityClick(variant._id, quantity)
                                  }
                                  title="Click to edit quantity"
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      handleQuantityClick(variant._id, quantity);
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
                                    variant._id,
                                    quantity + 1,
                                    stockInfo.quantityLeft
                                  )
                                }
                                disabled={quantity >= stockInfo.quantityLeft}
                                className="h-8 w-8 p-0"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              onClick={() => handleFinalAddToCart(variant)}
                              className="w-full bg-green-500 hover:bg-green-600 text-white"
                              size="sm"
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              Add {quantity} to Cart
                            </Button>
                          </>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variants without stock */}
          {variantsWithoutStock.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Out of Stock ({variantsWithoutStock.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {variantsWithoutStock.map((variant) => {
                  const isRefreshing = refreshingStocks.has(variant._id);

                  return (
                    <Card
                      key={variant._id}
                      className="relative opacity-60 border-2 border-gray-200"
                    >
                      <div className="relative w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200">
                        {variant.imageURL ? (
                          <img
                            src={variant.imageURL}
                            alt={variant.name}
                            className="w-full h-full object-cover grayscale"
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                              e.currentTarget.src =
                                "https://via.placeholder.com/300x200?text=No+Image";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="shadow-sm bg-gray-400">
                            Out of Stock
                          </Badge>
                        </div>
                        <div className="absolute top-2 right-2">
                          <Button
                            onClick={() => handleRefreshStock(variant._id)}
                            disabled={isRefreshing}
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 shadow-sm"
                            title="Check for stock"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${
                                isRefreshing ? "animate-spin" : ""
                              }`}
                            />
                          </Button>
                        </div>
                      </div>

                      <CardHeader className="pb-2">
                        <CardTitle className="text-base line-clamp-2 min-h-[2.5rem] text-gray-600">
                          {variant.name}
                        </CardTitle>
                        <span className="text-lg text-muted-foreground">
                          Price unavailable
                        </span>
                      </CardHeader>

                      <CardContent className="py-2 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {variant.size && (
                            <Badge variant="outline" className="text-xs">
                              {variant.size}
                            </Badge>
                          )}
                          {variant.weight && (
                            <Badge variant="outline" className="text-xs">
                              {variant.weight}
                            </Badge>
                          )}
                          {variant.volume && (
                            <Badge variant="outline" className="text-xs">
                              {variant.volume}
                            </Badge>
                          )}
                        </div>

                        {variant.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {variant.description}
                          </p>
                        )}
                      </CardContent>

                      <CardFooter className="pt-2">
                        <Button disabled className="w-full" size="sm">
                          Out of Stock
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* No variants message */}
          {totalActiveVariants === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Active Variants
              </h3>
              <p className="text-gray-600">
                This product has no active variants available.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}





// "use client";

// import { useState, useEffect, useCallback, useMemo } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Badge } from "@/components/ui/badge";
// import {
//   Card,
//   CardContent,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";
// import {
//   ShoppingCart,
//   Package,
//   RefreshCw,
//   Plus,
//   Minus,
//   AlertTriangle,
//   X,
//   ImageOff,
//   Info,
// } from "lucide-react";
// import { toast } from "sonner";

// // =============================================
// // Import types from your centralized types
// // =============================================
// import type {
//   ProductWithVariants,
//   SubProductWithStock,
//   StockInfo,
// } from "@/types/pos";

// // =============================================
// // Component Props Interface
// // =============================================
// interface ProductVariantsModalProps {
//   /** Whether the modal is open */
//   isOpen: boolean;
//   /** Callback to close the modal */
//   onClose: () => void;
//   /** The parent product containing variants */
//   product: ProductWithVariants;
//   /** Array of sub-products (variants) */
//   variants: SubProductWithStock[];
//   /** Map of subProductId to stock information (FIFO) */
//   subProductStocks: Map<string, StockInfo>;
//   /** Callback when adding a variant to cart */
//   onAddToCart: (variant: SubProductWithStock, quantity: number) => void;
//   /** Callback to refresh stock for a specific sub-product */
//   onRefreshStock: (subProductId: string) => Promise<void>;
// }

// // =============================================
// // Helper Types for Internal State
// // =============================================
// type ActiveVariantsState = Record<string, boolean>;
// type QuantitiesState = Record<string, number>;

// // =============================================
// // Component
// // =============================================
// export default function ProductVariantsModal({
//   isOpen,
//   onClose,
//   product,
//   variants,
//   subProductStocks,
//   onAddToCart,
//   onRefreshStock,
// }: ProductVariantsModalProps): JSX.Element {
//   // =============================================
//   // State
//   // =============================================
//   const [activeVariants, setActiveVariants] = useState<ActiveVariantsState>({});
//   const [quantities, setQuantities] = useState<QuantitiesState>({});
//   const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
//   const [editingValue, setEditingValue] = useState<string>("");
//   const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());

//   // =============================================
//   // Reset state when modal opens/closes
//   // =============================================
//   useEffect(() => {
//     if (!isOpen) {
//       setActiveVariants({});
//       setQuantities({});
//       setEditingVariantId(null);
//       setEditingValue("");
//       setRefreshingStocks(new Set());
//     }
//   }, [isOpen]);

//   // =============================================
//   // Memoized Categorization of Variants
//   // =============================================
//   const { variantsWithStock, variantsWithoutStock } = useMemo(() => {
//     const activeVars = variants.filter(
//       (v): v is SubProductWithStock => v.isActive === true
//     );

//     return {
//       variantsWithStock: activeVars.filter((v) =>
//         subProductStocks.has(v._id)
//       ),
//       variantsWithoutStock: activeVars.filter(
//         (v) => !subProductStocks.has(v._id)
//       ),
//     };
//   }, [variants, subProductStocks]);

//   const totalActiveVariants = useMemo((): number => {
//     return variants.filter((v) => v.isActive === true).length;
//   }, [variants]);

//   // =============================================
//   // Stock Refresh Handler
//   // =============================================
//   const handleRefreshStock = useCallback(
//     async (variantId: string): Promise<void> => {
//       setRefreshingStocks((prev) => new Set(prev).add(variantId));
//       try {
//         await onRefreshStock(variantId);
//       } finally {
//         setRefreshingStocks((prev) => {
//           const updated = new Set(prev);
//           updated.delete(variantId);
//           return updated;
//         });
//       }
//     },
//     [onRefreshStock]
//   );

//   // =============================================
//   // Cart Handlers
//   // =============================================
//   const handleInitialAddToCart = useCallback((variantId: string): void => {
//     setActiveVariants((prev) => ({ ...prev, [variantId]: true }));
//     setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
//   }, []);

//   const handleQuantityChange = useCallback(
//     (variantId: string, newQuantity: number, maxStock: number): void => {
//       if (newQuantity < 1) {
//         setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
//         return;
//       }
//       if (newQuantity > maxStock) {
//         toast.error(`Only ${maxStock} units available in stock`);
//         setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
//         return;
//       }
//       setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
//     },
//     []
//   );

//   const handleQuantityClick = useCallback(
//     (variantId: string, currentQuantity: number): void => {
//       setEditingVariantId(variantId);
//       setEditingValue(currentQuantity.toString());
//     },
//     []
//   );

//   const handleManualQuantityChange = useCallback(
//     (e: React.ChangeEvent<HTMLInputElement>): void => {
//       const value = e.target.value;
//       if (value === "" || /^\d+$/.test(value)) {
//         setEditingValue(value);
//       }
//     },
//     []
//   );

//   const handleQuantityBlur = useCallback(
//     (variantId: string, maxStock: number): void => {
//       const newQuantity = parseInt(editingValue, 10) || 1;

//       if (newQuantity < 1) {
//         toast.error("Quantity must be at least 1");
//         setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
//       } else if (newQuantity > maxStock) {
//         toast.error(`Only ${maxStock} units available in stock`);
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
//     (
//       e: React.KeyboardEvent<HTMLInputElement>,
//       variantId: string,
//       maxStock: number
//     ): void => {
//       if (e.key === "Enter") {
//         handleQuantityBlur(variantId, maxStock);
//       } else if (e.key === "Escape") {
//         setEditingVariantId(null);
//         setEditingValue("");
//       }
//     },
//     [handleQuantityBlur]
//   );

//   const handleFinalAddToCart = useCallback(
//     (variant: SubProductWithStock): void => {
//       const quantity = quantities[variant._id] || 1;
//       onAddToCart(variant, quantity);
//       setActiveVariants((prev) => ({ ...prev, [variant._id]: false }));
//       setQuantities((prev) => ({ ...prev, [variant._id]: 1 }));
//     },
//     [quantities, onAddToCart]
//   );

//   // =============================================
//   // Utility Functions
//   // =============================================
//   const hasLowStock = useCallback(
//     (stockInfo: StockInfo, threshold: number): boolean => {
//       return stockInfo.quantityLeft <= threshold;
//     },
//     []
//   );

//   const formatDate = useCallback((dateString: string): string => {
//     return new Date(dateString).toLocaleDateString("en-GB", {
//       day: "2-digit",
//       month: "short",
//       year: "numeric",
//     });
//   }, []);

//   // =============================================
//   // Render Helper: Variant Card with Stock
//   // =============================================
//   const renderVariantWithStock = useCallback(
//     (variant: SubProductWithStock): JSX.Element => {
//       const isActive = activeVariants[variant._id] ?? false;
//       const quantity = quantities[variant._id] || 1;
//       const isEditing = editingVariantId === variant._id;
//       const stockInfo = subProductStocks.get(variant._id);
//       const isRefreshing = refreshingStocks.has(variant._id);

//       // Type guard - stockInfo should exist for variants with stock
//       if (!stockInfo) {
//         return <React.Fragment key={variant._id} />;
//       }

//       const isLowStock = hasLowStock(stockInfo, variant.lowStockThreshold || 5);

//       return (
//         <Card
//           key={variant._id}
//           className="relative overflow-hidden hover:shadow-lg transition-all border-2 border-green-100 hover:border-green-300"
//         >
//           {/* Image Section */}
//           <div className="relative w-full h-40 bg-gradient-to-br from-gray-50 to-gray-100">
//             {variant.imageURL ? (
//               <img
//                 src={variant.imageURL}
//                 alt={variant.name}
//                 className="w-full h-full object-cover"
//                 onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
//                   e.currentTarget.src =
//                     "https://via.placeholder.com/300x200?text=No+Image";
//                 }}
//               />
//             ) : (
//               <div className="w-full h-full flex items-center justify-center">
//                 <ImageOff className="w-12 h-12 text-gray-400" />
//               </div>
//             )}

//             {/* Stock Badge */}
//             <div className="absolute top-2 left-2">
//               <Badge
//                 variant={isLowStock ? "destructive" : "default"}
//                 className={`shadow-sm ${isLowStock ? "bg-red-500" : "bg-green-500"}`}
//               >
//                 Stock: {stockInfo.quantityLeft}
//               </Badge>
//             </div>

//             {/* Refresh Button */}
//             <div className="absolute top-2 right-2">
//               <Button
//                 onClick={() => handleRefreshStock(variant._id)}
//                 disabled={isRefreshing}
//                 variant="secondary"
//                 size="sm"
//                 className="h-7 px-2 shadow-sm"
//                 title="Refresh stock"
//               >
//                 <RefreshCw
//                   className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
//                 />
//               </Button>
//             </div>
//           </div>

//           {/* Card Header */}
//           <CardHeader className="pb-2">
//             <CardTitle className="text-base line-clamp-2 min-h-[2.5rem]">
//               {variant.name}
//             </CardTitle>
//             <div className="flex items-baseline justify-between">
//               <span className="text-2xl font-bold text-green-600">
//                 ₹{stockInfo.sellingPrice.toFixed(2)}
//               </span>
//               {isLowStock && (
//                 <div className="flex items-center gap-1">
//                   <AlertTriangle className="h-3 w-3 text-red-500" />
//                   <span className="text-xs text-red-600 font-medium">
//                     Low Stock
//                   </span>
//                 </div>
//               )}
//             </div>
//           </CardHeader>

//           {/* Card Content */}
//           <CardContent className="py-2 space-y-2">
//             {/* Variant Attributes */}
//             <div className="flex flex-wrap gap-1">
//               {variant.size && (
//                 <Badge variant="outline" className="text-xs">
//                   {variant.size}
//                 </Badge>
//               )}
//               {variant.weight && (
//                 <Badge variant="outline" className="text-xs">
//                   {variant.weight}
//                 </Badge>
//               )}
//               {variant.volume && (
//                 <Badge variant="outline" className="text-xs">
//                   {variant.volume}
//                 </Badge>
//               )}
//             </div>

//             {variant.description && (
//               <p className="text-xs text-muted-foreground line-clamp-2">
//                 {variant.description}
//               </p>
//             )}

//             {/* Stock Date */}
//             <div className="flex items-center gap-1 text-xs text-gray-500">
//               <Info className="w-3 h-3" />
//               <span>Batch: {formatDate(stockInfo.stockDate)}</span>
//             </div>
//           </CardContent>

//           {/* Card Footer */}
//           <CardFooter className="flex flex-col gap-2 pt-2">
//             {!isActive ? (
//               <Button
//                 onClick={() => handleInitialAddToCart(variant._id)}
//                 className="w-full bg-green-500 hover:bg-green-600 text-white"
//                 size="sm"
//               >
//                 <ShoppingCart className="h-4 w-4 mr-2" />
//                 Add to Cart
//               </Button>
//             ) : (
//               <>
//                 {/* Quantity Controls */}
//                 <div className="flex items-center justify-center gap-2 w-full">
//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() =>
//                       handleQuantityChange(
//                         variant._id,
//                         quantity - 1,
//                         stockInfo.quantityLeft
//                       )
//                     }
//                     disabled={quantity <= 1}
//                     className="h-8 w-8 p-0"
//                   >
//                     <Minus className="h-3 w-3" />
//                   </Button>

//                   {isEditing ? (
//                     <Input
//                       type="text"
//                       value={editingValue}
//                       onChange={handleManualQuantityChange}
//                       onBlur={() =>
//                         handleQuantityBlur(variant._id, stockInfo.quantityLeft)
//                       }
//                       onKeyDown={(e) =>
//                         handleQuantityKeyPress(
//                           e,
//                           variant._id,
//                           stockInfo.quantityLeft
//                         )
//                       }
//                       className="w-16 h-8 text-center text-sm p-1"
//                       autoFocus
//                     />
//                   ) : (
//                     <span
//                       className="w-16 text-center font-semibold cursor-pointer hover:bg-gray-100 rounded px-2 py-1 text-sm"
//                       onClick={() => handleQuantityClick(variant._id, quantity)}
//                       title="Click to edit quantity"
//                       role="button"
//                       tabIndex={0}
//                       onKeyDown={(e) => {
//                         if (e.key === "Enter" || e.key === " ") {
//                           handleQuantityClick(variant._id, quantity);
//                         }
//                       }}
//                     >
//                       {quantity}
//                     </span>
//                   )}

//                   <Button
//                     variant="outline"
//                     size="sm"
//                     onClick={() =>
//                       handleQuantityChange(
//                         variant._id,
//                         quantity + 1,
//                         stockInfo.quantityLeft
//                       )
//                     }
//                     disabled={quantity >= stockInfo.quantityLeft}
//                     className="h-8 w-8 p-0"
//                   >
//                     <Plus className="h-3 w-3" />
//                   </Button>
//                 </div>

//                 {/* Confirm Add Button */}
//                 <Button
//                   onClick={() => handleFinalAddToCart(variant)}
//                   className="w-full bg-green-500 hover:bg-green-600 text-white"
//                   size="sm"
//                 >
//                   <ShoppingCart className="h-4 w-4 mr-2" />
//                   Add {quantity} to Cart
//                 </Button>
//               </>
//             )}
//           </CardFooter>
//         </Card>
//       );
//     },
//     [
//       activeVariants,
//       quantities,
//       editingVariantId,
//       editingValue,
//       subProductStocks,
//       refreshingStocks,
//       hasLowStock,
//       formatDate,
//       handleRefreshStock,
//       handleInitialAddToCart,
//       handleQuantityChange,
//       handleQuantityClick,
//       handleManualQuantityChange,
//       handleQuantityBlur,
//       handleQuantityKeyPress,
//       handleFinalAddToCart,
//     ]
//   );

//   // =============================================
//   // Render Helper: Variant Card without Stock
//   // =============================================
//   const renderVariantWithoutStock = useCallback(
//     (variant: SubProductWithStock): JSX.Element => {
//       const isRefreshing = refreshingStocks.has(variant._id);

//       return (
//         <Card
//           key={variant._id}
//           className="relative opacity-60 border-2 border-gray-200"
//         >
//           {/* Image Section */}
//           <div className="relative w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200">
//             {variant.imageURL ? (
//               <img
//                 src={variant.imageURL}
//                 alt={variant.name}
//                 className="w-full h-full object-cover grayscale"
//                 onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
//                   e.currentTarget.src =
//                     "https://via.placeholder.com/300x200?text=No+Image";
//                 }}
//               />
//             ) : (
//               <div className="w-full h-full flex items-center justify-center">
//                 <ImageOff className="w-12 h-12 text-gray-400" />
//               </div>
//             )}

//             {/* Out of Stock Badge */}
//             <div className="absolute top-2 left-2">
//               <Badge variant="secondary" className="shadow-sm bg-gray-400">
//                 Out of Stock
//               </Badge>
//             </div>

//             {/* Refresh Button */}
//             <div className="absolute top-2 right-2">
//               <Button
//                 onClick={() => handleRefreshStock(variant._id)}
//                 disabled={isRefreshing}
//                 variant="secondary"
//                 size="sm"
//                 className="h-7 px-2 shadow-sm"
//                 title="Check for stock"
//               >
//                 <RefreshCw
//                   className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
//                 />
//               </Button>
//             </div>
//           </div>

//           {/* Card Header */}
//           <CardHeader className="pb-2">
//             <CardTitle className="text-base line-clamp-2 min-h-[2.5rem] text-gray-600">
//               {variant.name}
//             </CardTitle>
//             <span className="text-lg text-muted-foreground">
//               Price unavailable
//             </span>
//           </CardHeader>

//           {/* Card Content */}
//           <CardContent className="py-2 space-y-2">
//             <div className="flex flex-wrap gap-1">
//               {variant.size && (
//                 <Badge variant="outline" className="text-xs">
//                   {variant.size}
//                 </Badge>
//               )}
//               {variant.weight && (
//                 <Badge variant="outline" className="text-xs">
//                   {variant.weight}
//                 </Badge>
//               )}
//               {variant.volume && (
//                 <Badge variant="outline" className="text-xs">
//                   {variant.volume}
//                 </Badge>
//               )}
//             </div>

//             {variant.description && (
//               <p className="text-xs text-muted-foreground line-clamp-2">
//                 {variant.description}
//               </p>
//             )}
//           </CardContent>

//           {/* Card Footer */}
//           <CardFooter className="pt-2">
//             <Button disabled className="w-full" size="sm">
//               Out of Stock
//             </Button>
//           </CardFooter>
//         </Card>
//       );
//     },
//     [refreshingStocks, handleRefreshStock]
//   );

//   // =============================================
//   // Main Render
//   // =============================================
//   return (
//     <Dialog open={isOpen} onOpenChange={onClose}>
//       <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
//         {/* Dialog Header */}
//         <DialogHeader>
//           <div className="flex items-center justify-between">
//             <DialogTitle className="flex items-center gap-2 text-xl">
//               <Package className="h-5 w-5 text-blue-600" />
//               {product.name} - Variants
//             </DialogTitle>
//             <div className="flex items-center gap-2">
//               <Badge variant="outline" className="text-sm">
//                 {variantsWithStock.length} of {totalActiveVariants} in stock
//               </Badge>
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 onClick={onClose}
//                 className="h-8 w-8 p-0"
//                 aria-label="Close modal"
//               >
//                 <X className="h-4 w-4" />
//               </Button>
//             </div>
//           </div>
//           {product.description && (
//             <p className="text-sm text-muted-foreground mt-2">
//               {product.description}
//             </p>
//           )}
//         </DialogHeader>

//         <Separator />

//         {/* Scrollable Content */}
//         <div className="flex-1 overflow-y-auto px-1">
//           {/* Available Variants Section */}
//           {variantsWithStock.length > 0 && (
//             <div className="mb-6">
//               <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
//                 <Package className="h-4 w-4 text-green-600" />
//                 Available Variants ({variantsWithStock.length})
//               </h3>
//               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//                 {variantsWithStock.map(renderVariantWithStock)}
//               </div>
//             </div>
//           )}

//           {/* Out of Stock Variants Section */}
//           {variantsWithoutStock.length > 0 && (
//             <div>
//               <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
//                 <AlertTriangle className="h-4 w-4 text-amber-600" />
//                 Out of Stock ({variantsWithoutStock.length})
//               </h3>
//               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//                 {variantsWithoutStock.map(renderVariantWithoutStock)}
//               </div>
//             </div>
//           )}

//           {/* No Variants Message */}
//           {totalActiveVariants === 0 && (
//             <div className="text-center py-12">
//               <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
//               <h3 className="text-lg font-medium text-gray-900 mb-2">
//                 No Active Variants
//               </h3>
//               <p className="text-gray-600">
//                 This product has no active variants available.
//               </p>
//             </div>
//           )}
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }

// // // components/pos/product-variants-modal.tsx
// // "use client";

// // import { useState, useEffect, useCallback, useMemo } from "react";
// // import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// // import { Button } from "@/components/ui/button";
// // import { Input } from "@/components/ui/input";
// // import { Badge } from "@/components/ui/badge";
// // import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// // import { Separator } from "@/components/ui/separator";
// // import { ShoppingCart, Package, RefreshCw, Plus, Minus, AlertTriangle, X, ImageOff, Info } from "lucide-react";
// // import { toast } from "sonner";
// // import type { SubProduct, Product } from "@/types";

// // interface StockInfo {
// //   stockTransactionId: string;
// //   sellingPrice: number;
// //   quantityLeft: number;
// //   stockDate: string;
// // }

// // interface ProductVariantsModalProps {
// //   isOpen: boolean;
// //   onClose: () => void;
// //   product: Product;
// //   variants: SubProduct[];
// //   subProductStocks: Map<string, StockInfo>;
// //   onAddToCart: (variant: SubProduct, quantity: number) => void;
// //   onRefreshStock: (subProductId: string) => Promise<void>;
// // }

// // export default function ProductVariantsModal({
// //   isOpen,
// //   onClose,
// //   product,
// //   variants,
// //   subProductStocks,
// //   onAddToCart,
// //   onRefreshStock,
// // }: ProductVariantsModalProps) {
// //   const [activeVariants, setActiveVariants] = useState<Record<string, boolean>>({});
// //   const [quantities, setQuantities] = useState<Record<string, number>>({});
// //   const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
// //   const [editingValue, setEditingValue] = useState("");
// //   const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set());

// //   // Reset state when modal opens/closes
// //   useEffect(() => {
// //     if (!isOpen) {
// //       setActiveVariants({});
// //       setQuantities({});
// //       setEditingVariantId(null);
// //       setEditingValue("");
// //       setRefreshingStocks(new Set());
// //     }
// //   }, [isOpen]);

// //   // Categorize variants
// //   const { variantsWithStock, variantsWithoutStock } = useMemo(() => {
// //     const activeVars = variants.filter((v) => v.isActive === true);
// //     return {
// //       variantsWithStock: activeVars.filter((v) => subProductStocks.has(v.id)),
// //       variantsWithoutStock: activeVars.filter((v) => !subProductStocks.has(v.id)),
// //     };
// //   }, [variants, subProductStocks]);

// //   const totalActiveVariants = useMemo(() => {
// //     return variants.filter((v) => v.isActive === true).length;
// //   }, [variants]);

// //   const handleRefreshStock = useCallback(
// //     async (variantId: string) => {
// //       setRefreshingStocks((prev) => new Set(prev).add(variantId));
// //       try {
// //         await onRefreshStock(variantId);
// //       } finally {
// //         setRefreshingStocks((prev) => {
// //           const updated = new Set(prev);
// //           updated.delete(variantId);
// //           return updated;
// //         });
// //       }
// //     },
// //     [onRefreshStock]
// //   );

// //   const handleInitialAddToCart = useCallback((variantId: string) => {
// //     setActiveVariants((prev) => ({ ...prev, [variantId]: true }));
// //     setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// //   }, []);

// //   const handleQuantityChange = useCallback(
// //     (variantId: string, newQuantity: number, maxStock: number) => {
// //       if (newQuantity < 1) {
// //         setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// //         return;
// //       }
// //       if (newQuantity > maxStock) {
// //         toast.error(`Only ${maxStock} units available in stock`);
// //         setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
// //         return;
// //       }
// //       setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
// //     },
// //     []
// //   );

// //   const handleQuantityClick = useCallback((variantId: string, currentQuantity: number) => {
// //     setEditingVariantId(variantId);
// //     setEditingValue(currentQuantity.toString());
// //   }, []);

// //   const handleManualQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
// //     const value = e.target.value;
// //     if (value === "" || /^\d+$/.test(value)) {
// //       setEditingValue(value);
// //     }
// //   }, []);

// //   const handleQuantityBlur = useCallback(
// //     (variantId: string, maxStock: number) => {
// //       const newQuantity = parseInt(editingValue) || 1;

// //       if (newQuantity < 1) {
// //         toast.error("Quantity must be at least 1");
// //         setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// //       } else if (newQuantity > maxStock) {
// //         toast.error(`Only ${maxStock} units available in stock`);
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
// //     (e: React.KeyboardEvent, variantId: string, maxStock: number) => {
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
// //     (variant: SubProduct) => {
// //       const quantity = quantities[variant.id] || 1;
// //       onAddToCart(variant, quantity);
// //       setActiveVariants((prev) => ({ ...prev, [variant.id]: false }));
// //       setQuantities((prev) => ({ ...prev, [variant.id]: 1 }));
// //     },
// //     [quantities, onAddToCart]
// //   );

// //   const hasLowStock = useCallback(
// //     (stockInfo: StockInfo, threshold: number): boolean => {
// //       return stockInfo.quantityLeft <= threshold;
// //     },
// //     []
// //   );

// //   const formatDate = useCallback((dateString: string): string => {
// //     return new Date(dateString).toLocaleDateString("en-GB", {
// //       day: "2-digit",
// //       month: "short",
// //       year: "numeric",
// //     });
// //   }, []);

// //   return (
// //     <Dialog open={isOpen} onOpenChange={onClose}>
// //       <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
// //         <DialogHeader>
// //           <div className="flex items-center justify-between">
// //             <DialogTitle className="flex items-center gap-2 text-xl">
// //               <Package className="h-5 w-5 text-blue-600" />
// //               {product.name} - Variants
// //             </DialogTitle>
// //             <div className="flex items-center gap-2">
// //               <Badge variant="outline" className="text-sm">
// //                 {variantsWithStock.length} of {totalActiveVariants} in stock
// //               </Badge>
// //               <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
// //                 <X className="h-4 w-4" />
// //               </Button>
// //             </div>
// //           </div>
// //           {product.description && (
// //             <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
// //           )}
// //         </DialogHeader>

// //         <Separator />

// //         <div className="flex-1 overflow-y-auto px-1">
// //           {/* Variants with stock */}
// //           {variantsWithStock.length > 0 && (
// //             <div className="mb-6">
// //               <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
// //                 <Package className="h-4 w-4 text-green-600" />
// //                 Available Variants ({variantsWithStock.length})
// //               </h3>
// //               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
// //                 {variantsWithStock.map((variant) => {
// //                   const isActive = activeVariants[variant.id];
// //                   const quantity = quantities[variant.id] || 1;
// //                   const isEditing = editingVariantId === variant.id;
// //                   const stockInfo = subProductStocks.get(variant.id)!;
// //                   const isRefreshing = refreshingStocks.has(variant.id);
// //                   const isLowStock = hasLowStock(stockInfo, variant.lowStockThreshold || 5);

// //                   return (
// //                     <Card
// //                       key={variant.id}
// //                       className="relative overflow-hidden hover:shadow-lg transition-all border-2 border-green-100 hover:border-green-300"
// //                     >
// //                       {/* Image */}
// //                       <div className="relative w-full h-40 bg-gradient-to-br from-gray-50 to-gray-100">
// //                         {variant.imageURL ? (
// //                           <img
// //                             src={variant.imageURL}
// //                             alt={variant.name}
// //                             className="w-full h-full object-cover"
// //                             onError={(e) => {
// //                               e.currentTarget.src = "https://via.placeholder.com/300x200?text=No+Image";
// //                             }}
// //                           />
// //                         ) : (
// //                           <div className="w-full h-full flex items-center justify-center">
// //                             <ImageOff className="w-12 h-12 text-gray-400" />
// //                           </div>
// //                         )}
// //                         {/* Stock badge overlay */}
// //                         <div className="absolute top-2 left-2">
// //                           <Badge
// //                             variant={isLowStock ? "destructive" : "default"}
// //                             className={`shadow-sm ${isLowStock ? "bg-red-500" : "bg-green-500"}`}
// //                           >
// //                             Stock: {stockInfo.quantityLeft}
// //                           </Badge>
// //                         </div>
// //                         {/* Refresh button overlay */}
// //                         <div className="absolute top-2 right-2">
// //                           <Button
// //                             onClick={() => handleRefreshStock(variant.id)}
// //                             disabled={isRefreshing}
// //                             variant="secondary"
// //                             size="sm"
// //                             className="h-7 px-2 shadow-sm"
// //                             title="Refresh stock"
// //                           >
// //                             <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
// //                           </Button>
// //                         </div>
// //                       </div>

// //                       <CardHeader className="pb-2">
// //                         <CardTitle className="text-base line-clamp-2 min-h-[2.5rem]">{variant.name}</CardTitle>
// //                         <div className="flex items-baseline justify-between">
// //                           <span className="text-2xl font-bold text-green-600">₹{stockInfo.sellingPrice.toFixed(2)}</span>
// //                           {isLowStock && (
// //                             <div className="flex items-center gap-1">
// //                               <AlertTriangle className="h-3 w-3 text-red-500" />
// //                               <span className="text-xs text-red-600 font-medium">Low Stock</span>
// //                             </div>
// //                           )}
// //                         </div>
// //                       </CardHeader>

// //                       <CardContent className="py-2 space-y-2">
// //                         {/* Variant details */}
// //                         <div className="flex flex-wrap gap-1">
// //                           {variant.size && (
// //                             <Badge variant="outline" className="text-xs">
// //                               {variant.size}
// //                             </Badge>
// //                           )}
// //                           {variant.weight && (
// //                             <Badge variant="outline" className="text-xs">
// //                               {variant.weight}
// //                             </Badge>
// //                           )}
// //                           {variant.volume && (
// //                             <Badge variant="outline" className="text-xs">
// //                               {variant.volume}
// //                             </Badge>
// //                           )}
// //                         </div>

// //                         {variant.description && (
// //                           <p className="text-xs text-muted-foreground line-clamp-2">{variant.description}</p>
// //                         )}

// //                         {/* Stock date info */}
// //                         <div className="flex items-center gap-1 text-xs text-gray-500">
// //                           <Info className="w-3 h-3" />
// //                           <span>Batch: {formatDate(stockInfo.stockDate)}</span>
// //                         </div>
// //                       </CardContent>

// //                       <CardFooter className="flex flex-col gap-2 pt-2">
// //                         {!isActive ? (
// //                           <Button
// //                             onClick={() => handleInitialAddToCart(variant.id)}
// //                             className="w-full bg-green-500 hover:bg-green-600 text-white"
// //                             size="sm"
// //                           >
// //                             <ShoppingCart className="h-4 w-4 mr-2" />
// //                             Add to Cart
// //                           </Button>
// //                         ) : (
// //                           <>
// //                             <div className="flex items-center justify-center gap-2 w-full">
// //                               <Button
// //                                 variant="outline"
// //                                 size="sm"
// //                                 onClick={() => handleQuantityChange(variant.id, quantity - 1, stockInfo.quantityLeft)}
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
// //                                   onBlur={() => handleQuantityBlur(variant.id, stockInfo.quantityLeft)}
// //                                   onKeyDown={(e) => handleQuantityKeyPress(e, variant.id, stockInfo.quantityLeft)}
// //                                   className="w-16 h-8 text-center text-sm p-1"
// //                                   autoFocus
// //                                 />
// //                               ) : (
// //                                 <span
// //                                   className="w-16 text-center font-semibold cursor-pointer hover:bg-gray-100 rounded px-2 py-1 text-sm"
// //                                   onClick={() => handleQuantityClick(variant.id, quantity)}
// //                                   title="Click to edit quantity"
// //                                 >
// //                                   {quantity}
// //                                 </span>
// //                               )}

// //                               <Button
// //                                 variant="outline"
// //                                 size="sm"
// //                                 onClick={() => handleQuantityChange(variant.id, quantity + 1, stockInfo.quantityLeft)}
// //                                 disabled={quantity >= stockInfo.quantityLeft}
// //                                 className="h-8 w-8 p-0"
// //                               >
// //                                 <Plus className="h-3 w-3" />
// //                               </Button>
// //                             </div>
// //                             <Button
// //                               onClick={() => handleFinalAddToCart(variant)}
// //                               className="w-full bg-green-500 hover:bg-green-600 text-white"
// //                               size="sm"
// //                             >
// //                               <ShoppingCart className="h-4 w-4 mr-2" />
// //                               Add {quantity} to Cart
// //                             </Button>
// //                           </>
// //                         )}
// //                       </CardFooter>
// //                     </Card>
// //                   );
// //                 })}
// //               </div>
// //             </div>
// //           )}

// //           {/* Variants without stock */}
// //           {variantsWithoutStock.length > 0 && (
// //             <div>
// //               <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
// //                 <AlertTriangle className="h-4 w-4 text-amber-600" />
// //                 Out of Stock ({variantsWithoutStock.length})
// //               </h3>
// //               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
// //                 {variantsWithoutStock.map((variant) => {
// //                   const isRefreshing = refreshingStocks.has(variant.id);

// //                   return (
// //                     <Card key={variant.id} className="relative opacity-60 border-2 border-gray-200">
// //                       {/* Image */}
// //                       <div className="relative w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200">
// //                         {variant.imageURL ? (
// //                           <img
// //                             src={variant.imageURL}
// //                             alt={variant.name}
// //                             className="w-full h-full object-cover grayscale"
// //                             onError={(e) => {
// //                               e.currentTarget.src = "https://via.placeholder.com/300x200?text=No+Image";
// //                             }}
// //                           />
// //                         ) : (
// //                           <div className="w-full h-full flex items-center justify-center">
// //                             <ImageOff className="w-12 h-12 text-gray-400" />
// //                           </div>
// //                         )}
// //                         <div className="absolute top-2 left-2">
// //                           <Badge variant="secondary" className="shadow-sm bg-gray-400">
// //                             Out of Stock
// //                           </Badge>
// //                         </div>
// //                         <div className="absolute top-2 right-2">
// //                           <Button
// //                             onClick={() => handleRefreshStock(variant.id)}
// //                             disabled={isRefreshing}
// //                             variant="secondary"
// //                             size="sm"
// //                             className="h-7 px-2 shadow-sm"
// //                             title="Check for stock"
// //                           >
// //                             <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
// //                           </Button>
// //                         </div>
// //                       </div>

// //                       <CardHeader className="pb-2">
// //                         <CardTitle className="text-base line-clamp-2 min-h-[2.5rem] text-gray-600">{variant.name}</CardTitle>
// //                         <span className="text-lg text-muted-foreground">Price unavailable</span>
// //                       </CardHeader>

// //                       <CardContent className="py-2 space-y-2">
// //                         <div className="flex flex-wrap gap-1">
// //                           {variant.size && (
// //                             <Badge variant="outline" className="text-xs">
// //                               {variant.size}
// //                             </Badge>
// //                           )}
// //                           {variant.weight && (
// //                             <Badge variant="outline" className="text-xs">
// //                               {variant.weight}
// //                             </Badge>
// //                           )}
// //                           {variant.volume && (
// //                             <Badge variant="outline" className="text-xs">
// //                               {variant.volume}
// //                             </Badge>
// //                           )}
// //                         </div>

// //                         {variant.description && (
// //                           <p className="text-xs text-muted-foreground line-clamp-2">{variant.description}</p>
// //                         )}
// //                       </CardContent>

// //                       <CardFooter className="pt-2">
// //                         <Button disabled className="w-full" size="sm">
// //                           Out of Stock
// //                         </Button>
// //                       </CardFooter>
// //                     </Card>
// //                   );
// //                 })}
// //               </div>
// //             </div>
// //           )}

// //           {/* No variants message */}
// //           {totalActiveVariants === 0 && (
// //             <div className="text-center py-12">
// //               <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
// //               <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Variants</h3>
// //               <p className="text-gray-600">This product has no active variants available.</p>
// //             </div>
// //           )}
// //         </div>
// //       </DialogContent>
// //     </Dialog>
// //   );
// // }
// // // "use client"

// // // import { useState, useEffect } from "react"
// // // import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// // // import { Button } from "@/components/ui/button"
// // // import { Input } from "@/components/ui/input"
// // // import { Badge } from "@/components/ui/badge"
// // // import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// // // import { ShoppingCart, Package, RefreshCw, Plus, Minus, AlertTriangle } from "lucide-react"
// // // import { toast } from "sonner"
// // // import type { SubProduct, Product } from "@/lib/types"

// // // interface StockInfo {
// // //   stockTransactionId: string;
// // //   sellingPrice: number;
// // //   quantityLeft: number;
// // //   stockDate: string;
// // // }

// // // interface ProductVariantsModalProps {
// // //   isOpen: boolean
// // //   onClose: () => void
// // //   product: Product | null // Changed to accept full product
// // //   variants: SubProduct[] // Variants passed directly from parent
// // //   subProductStocks: Map<string, StockInfo>
// // //   onAddToCart?: (variant: SubProduct, quantity: number) => void
// // //   onRefreshStock?: (subProductId: string) => void
// // // }

// // // export function ProductVariantsModal({
// // //   isOpen,
// // //   onClose,
// // //   product,
// // //   variants,
// // //   subProductStocks,
// // //   onAddToCart,
// // //   onRefreshStock,
// // // }: ProductVariantsModalProps) {
// // //   const [activeVariants, setActiveVariants] = useState<Record<string, boolean>>({})
// // //   const [quantities, setQuantities] = useState<Record<string, number>>({})
// // //   const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
// // //   const [editingValue, setEditingValue] = useState("")
// // //   const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set())

// // //   useEffect(() => {
// // //     if (isOpen) {
// // //       // Reset state when modal opens
// // //       setActiveVariants({})
// // //       setQuantities({})
// // //       setEditingVariantId(null)
// // //       setEditingValue("")
// // //     }
// // //   }, [isOpen])

// // //   const handleRefreshStock = async (variantId: string) => {
// // //     if (!onRefreshStock) return
    
// // //     setRefreshingStocks(prev => new Set(prev).add(variantId))
// // //     await onRefreshStock(variantId)
// // //     setRefreshingStocks(prev => {
// // //       const updated = new Set(prev)
// // //       updated.delete(variantId)
// // //       return updated
// // //     })
// // //   }

// // //   const handleInitialAddToCart = (variantId: string) => {
// // //     setActiveVariants(prev => ({ ...prev, [variantId]: true }))
// // //     setQuantities(prev => ({ ...prev, [variantId]: 1 }))
// // //   }

// // //   const handleQuantityChange = (variantId: string, newQuantity: number, maxStock: number) => {
// // //     if (newQuantity < 1) {
// // //       setQuantities(prev => ({ ...prev, [variantId]: 1 }))
// // //       return
// // //     }
// // //     if (newQuantity > maxStock) {
// // //       toast.error(`Only ${maxStock} units available in stock`)
// // //       setQuantities(prev => ({ ...prev, [variantId]: maxStock }))
// // //       return
// // //     }
// // //     setQuantities(prev => ({ ...prev, [variantId]: newQuantity }))
// // //   }

// // //   const handleQuantityClick = (variantId: string, currentQuantity: number) => {
// // //     setEditingVariantId(variantId)
// // //     setEditingValue(currentQuantity.toString())
// // //   }

// // //   const handleManualQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
// // //     const value = e.target.value
// // //     if (value === "" || /^\d+$/.test(value)) {
// // //       setEditingValue(value)
// // //     }
// // //   }

// // //   const handleQuantityBlur = (variantId: string, maxStock: number) => {
// // //     const newQuantity = parseInt(editingValue) || 1
    
// // //     if (newQuantity < 1) {
// // //       toast.error("Quantity must be at least 1")
// // //       setQuantities(prev => ({ ...prev, [variantId]: 1 }))
// // //     } else if (newQuantity > maxStock) {
// // //       toast.error(`Only ${maxStock} units available in stock`)
// // //       setQuantities(prev => ({ ...prev, [variantId]: maxStock }))
// // //     } else {
// // //       setQuantities(prev => ({ ...prev, [variantId]: newQuantity }))
// // //     }
    
// // //     setEditingVariantId(null)
// // //     setEditingValue("")
// // //   }

// // //   const handleQuantityKeyPress = (e: React.KeyboardEvent, variantId: string, maxStock: number) => {
// // //     if (e.key === "Enter") {
// // //       handleQuantityBlur(variantId, maxStock)
// // //     } else if (e.key === "Escape") {
// // //       setEditingVariantId(null)
// // //       setEditingValue("")
// // //     }
// // //   }

// // //   const handleFinalAddToCart = (variant: SubProduct) => {
// // //     const quantity = quantities[variant.id] || 1
// // //     if (onAddToCart) {
// // //       onAddToCart(variant, quantity)
// // //       setActiveVariants(prev => ({ ...prev, [variant.id]: false }))
// // //       setQuantities(prev => ({ ...prev, [variant.id]: 1 }))
// // //     }
// // //   }

// // //   // Filter only active variants that have stock information
// // //   const activeVariantsWithStock = variants.filter(v => 
// // //     v.isActive && subProductStocks.has(v.id)
// // //   )

// // //   const activeVariantsWithoutStock = variants.filter(v => 
// // //     v.isActive && !subProductStocks.has(v.id)
// // //   )

// // //   if (!product) return null

// // //   return (
// // //     <Dialog open={isOpen} onOpenChange={onClose}>
// // //       <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
// // //         <DialogHeader>
// // //           <DialogTitle className="flex items-center gap-2">
// // //             <Package className="h-5 w-5" />
// // //             {product.name} - Variants
// // //             <Badge variant="outline" className="ml-2">
// // //               {activeVariantsWithStock.length} of {variants.filter(v => v.isActive).length} in stock
// // //             </Badge>
// // //           </DialogTitle>
// // //         </DialogHeader>

// // //         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
// // //           {/* Show variants with stock first */}
// // //           {activeVariantsWithStock.map((variant) => {
// // //             const isActive = activeVariants[variant.id]
// // //             const quantity = quantities[variant.id] || 1
// // //             const isEditing = editingVariantId === variant.id
// // //             const stockInfo = subProductStocks.get(variant.id)!
// // //             const isRefreshing = refreshingStocks.has(variant.id)
// // //             const isLowStock = stockInfo.quantityLeft <= variant.lowStockThreshold
            
// // //             return (
// // //               <Card key={variant.id} className="relative border-green-200">
// // //                 {variant.imageURL && (
// // //                   <div className="w-full h-32 overflow-hidden rounded-t-lg bg-gray-100">
// // //                     <img
// // //                       src={variant.imageURL}
// // //                       alt={variant.name}
// // //                       className="w-full h-full object-cover"
// // //                     />
// // //                   </div>
// // //                 )}

// // //                 <CardHeader className="pb-3">
// // //                   <CardTitle className="text-lg flex items-center justify-between">
// // //                     <span className="truncate">{variant.name}</span>
// // //                     <Button
// // //                       onClick={() => handleRefreshStock(variant.id)}
// // //                       disabled={isRefreshing}
// // //                       variant="ghost"
// // //                       size="sm"
// // //                       className="h-6 px-2 ml-2"
// // //                       title="Refresh stock"
// // //                     >
// // //                       <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
// // //                     </Button>
// // //                   </CardTitle>
// // //                   <div className="flex items-center gap-2">
// // //                     <Badge 
// // //                       variant={isLowStock ? "destructive" : "default"}
// // //                       className="text-xs"
// // //                     >
// // //                       Stock: {stockInfo.quantityLeft}
// // //                     </Badge>
// // //                     {isLowStock && (
// // //                       <div className="flex items-center gap-1">
// // //                         <AlertTriangle className="h-3 w-3 text-red-500" />
// // //                         <span className="text-xs text-red-600">Low Stock</span>
// // //                       </div>
// // //                     )}
// // //                   </div>
// // //                 </CardHeader>

// // //                 <CardContent className="space-y-2 py-2">
// // //                   <div className="text-2xl font-bold text-green-600">
// // //                     ₹{stockInfo.sellingPrice.toFixed(2)}
// // //                   </div>
// // //                   {variant.description && (
// // //                     <p className="text-sm text-muted-foreground line-clamp-2">
// // //                       {variant.description}
// // //                     </p>
// // //                   )}
// // //                 </CardContent>

// // //                 <CardFooter className="flex flex-col gap-2 pt-2">
// // //                   {!isActive ? (
// // //                     <Button 
// // //                       onClick={() => handleInitialAddToCart(variant.id)} 
// // //                       className="w-full bg-green-500 hover:bg-green-600"
// // //                     >
// // //                       <ShoppingCart className="h-4 w-4 mr-2" />
// // //                       Add to Cart
// // //                     </Button>
// // //                   ) : (
// // //                     <>
// // //                       <div className="flex items-center justify-center gap-2 w-full">
// // //                         <Button
// // //                           variant="outline"
// // //                           size="sm"
// // //                           onClick={() => handleQuantityChange(variant.id, quantity - 1, stockInfo.quantityLeft)}
// // //                           disabled={quantity <= 1}
// // //                           className="h-8 w-8 p-0"
// // //                         >
// // //                           <Minus className="h-4 w-4" />
// // //                         </Button>
                        
// // //                         {isEditing ? (
// // //                           <Input
// // //                             type="text"
// // //                             value={editingValue}
// // //                             onChange={handleManualQuantityChange}
// // //                             onBlur={() => handleQuantityBlur(variant.id, stockInfo.quantityLeft)}
// // //                             onKeyDown={(e) => handleQuantityKeyPress(e, variant.id, stockInfo.quantityLeft)}
// // //                             className="w-16 h-8 text-center text-sm p-1"
// // //                             autoFocus
// // //                           />
// // //                         ) : (
// // //                           <span 
// // //                             className="w-16 text-center font-medium cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
// // //                             onClick={() => handleQuantityClick(variant.id, quantity)}
// // //                             title="Click to edit quantity"
// // //                           >
// // //                             {quantity}
// // //                           </span>
// // //                         )}
                        
// // //                         <Button
// // //                           variant="outline"
// // //                           size="sm"
// // //                           onClick={() => handleQuantityChange(variant.id, quantity + 1, stockInfo.quantityLeft)}
// // //                           disabled={quantity >= stockInfo.quantityLeft}
// // //                           className="h-8 w-8 p-0"
// // //                         >
// // //                           <Plus className="h-4 w-4" />
// // //                         </Button>
// // //                       </div>
// // //                       <Button 
// // //                         onClick={() => handleFinalAddToCart(variant)} 
// // //                         className="w-full bg-green-500 hover:bg-green-600"
// // //                       >
// // //                         <ShoppingCart className="h-4 w-4 mr-2" />
// // //                         Confirm Add {quantity} to Cart
// // //                       </Button>
// // //                     </>
// // //                   )}
// // //                 </CardFooter>
// // //               </Card>
// // //             )
// // //           })}

// // //           {/* Show variants without stock */}
// // //           {activeVariantsWithoutStock.map((variant) => {
// // //             const isRefreshing = refreshingStocks.has(variant.id)
            
// // //             return (
// // //               <Card key={variant.id} className="relative opacity-75 border-gray-300">
// // //                 {variant.imageURL && (
// // //                   <div className="w-full h-32 overflow-hidden rounded-t-lg bg-gray-100">
// // //                     <img
// // //                       src={variant.imageURL}
// // //                       alt={variant.name}
// // //                       className="w-full h-full object-cover grayscale"
// // //                     />
// // //                   </div>
// // //                 )}

// // //                 <CardHeader className="pb-3">
// // //                   <CardTitle className="text-lg flex items-center justify-between">
// // //                     <span className="truncate">{variant.name}</span>
// // //                     <Button
// // //                       onClick={() => handleRefreshStock(variant.id)}
// // //                       disabled={isRefreshing}
// // //                       variant="ghost"
// // //                       size="sm"
// // //                       className="h-6 px-2 ml-2"
// // //                       title="Check for stock"
// // //                     >
// // //                       <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
// // //                     </Button>
// // //                   </CardTitle>
// // //                   <Badge variant="secondary" className="text-xs">
// // //                     Out of Stock
// // //                   </Badge>
// // //                 </CardHeader>

// // //                 <CardContent className="space-y-2 py-2">
// // //                   <div className="text-lg text-muted-foreground">
// // //                     Price unavailable
// // //                   </div>
// // //                   {variant.description && (
// // //                     <p className="text-sm text-muted-foreground line-clamp-2">
// // //                       {variant.description}
// // //                     </p>
// // //                   )}
// // //                 </CardContent>

// // //                 <CardFooter>
// // //                   <Button 
// // //                     disabled 
// // //                     className="w-full"
// // //                   >
// // //                     Out of Stock
// // //                   </Button>
// // //                 </CardFooter>
// // //               </Card>
// // //             )
// // //           })}
// // //         </div>

// // //         {variants.filter(v => v.isActive).length === 0 && (

// // //           <div className="text-center py-8 text-muted-foreground">
// // //             No active variants found for this product.
// // //           </div>
// // //         )}
// // //       </DialogContent>
// // //     </Dialog>
// // //   )
// // // }
// // // // "use client"

// // // // import { useState, useEffect } from "react"
// // // // import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// // // // import { Button } from "@/components/ui/button"
// // // // import { Input } from "@/components/ui/input"
// // // // import { Badge } from "@/components/ui/badge"
// // // // import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// // // // import { ShoppingCart, Package, RefreshCw, Plus, Minus } from "lucide-react"
// // // // import { toast } from "sonner"
// // // // import type { SubProduct } from "@/lib/types"

// // // // interface StockInfo {
// // // //   stockTransactionId: string;
// // // //   sellingPrice: number;
// // // //   quantityLeft: number;
// // // //   stockDate: string;
// // // // }

// // // // interface ProductVariantsModalProps {
// // // //   isOpen: boolean
// // // //   onClose: () => void
// // // //   productId: string
// // // //   productName: string
// // // //   subProductStocks: Map<string, StockInfo>
// // // //   onAddToCart?: (variant: SubProduct, quantity: number) => void
// // // //   onRefreshStock?: (subProductId: string) => void
// // // // }

// // // // export function ProductVariantsModal({
// // // //   isOpen,
// // // //   onClose,
// // // //   productId,
// // // //   productName,
// // // //   subProductStocks,
// // // //   onAddToCart,
// // // //   onRefreshStock,
// // // // }: ProductVariantsModalProps) {
// // // //   const [variants, setVariants] = useState<SubProduct[]>([])
// // // //   const [loading, setLoading] = useState(false)
// // // //   const [activeVariants, setActiveVariants] = useState<Record<string, boolean>>({})
// // // //   const [quantities, setQuantities] = useState<Record<string, number>>({})
// // // //   const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
// // // //   const [editingValue, setEditingValue] = useState("")
// // // //   const [refreshingStocks, setRefreshingStocks] = useState<Set<string>>(new Set())

// // // //   useEffect(() => {
// // // //     if (isOpen && productId) {
// // // //       fetchVariants()
// // // //       setActiveVariants({})
// // // //       setQuantities({})
// // // //     }
// // // //   }, [isOpen, productId])

// // // //   const fetchVariants = async () => {
// // // //     setLoading(true)
// // // //     try {
// // // //       const response = await fetch(`/api/products/${productId}/variants`)
// // // //       if (response.ok) {
// // // //         const data = await response.json()
// // // //         setVariants(data.variants || [])
// // // //       }
// // // //     } catch (error) {
// // // //       console.error("Error fetching variants:", error)
// // // //       toast.error("Failed to load variants")
// // // //     } finally {
// // // //       setLoading(false)
// // // //     }
// // // //   }

// // // //   const handleRefreshStock = async (variantId: string) => {
// // // //     if (!onRefreshStock) return
    
// // // //     setRefreshingStocks(prev => new Set(prev).add(variantId))
// // // //     await onRefreshStock(variantId)
// // // //     setRefreshingStocks(prev => {
// // // //       const updated = new Set(prev)
// // // //       updated.delete(variantId)
// // // //       return updated
// // // //     })
// // // //   }

// // // //   const handleInitialAddToCart = (variantId: string) => {
// // // //     setActiveVariants(prev => ({ ...prev, [variantId]: true }))
// // // //     setQuantities(prev => ({ ...prev, [variantId]: 1 }))
// // // //   }

// // // //   const handleQuantityChange = (variantId: string, newQuantity: number, maxStock: number) => {
// // // //     if (newQuantity < 1) {
// // // //       setQuantities(prev => ({ ...prev, [variantId]: 1 }))
// // // //       return
// // // //     }
// // // //     if (newQuantity > maxStock) {
// // // //       toast.error(`Only ${maxStock} units available in stock`)
// // // //       setQuantities(prev => ({ ...prev, [variantId]: maxStock }))
// // // //       return
// // // //     }
// // // //     setQuantities(prev => ({ ...prev, [variantId]: newQuantity }))
// // // //   }

// // // //   const handleQuantityClick = (variantId: string, currentQuantity: number) => {
// // // //     setEditingVariantId(variantId)
// // // //     setEditingValue(currentQuantity.toString())
// // // //   }

// // // //   const handleManualQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
// // // //     const value = e.target.value
// // // //     if (value === "" || /^\d+$/.test(value)) {
// // // //       setEditingValue(value)
// // // //     }
// // // //   }

// // // //   const handleQuantityBlur = (variantId: string, maxStock: number) => {
// // // //     const newQuantity = parseInt(editingValue) || 1
    
// // // //     if (newQuantity < 1) {
// // // //       toast.error("Quantity must be at least 1")
// // // //       setQuantities(prev => ({ ...prev, [variantId]: 1 }))
// // // //     } else if (newQuantity > maxStock) {
// // // //       toast.error(`Only ${maxStock} units available in stock`)
// // // //       setQuantities(prev => ({ ...prev, [variantId]: maxStock }))
// // // //     } else {
// // // //       setQuantities(prev => ({ ...prev, [variantId]: newQuantity }))
// // // //     }
    
// // // //     setEditingVariantId(null)
// // // //     setEditingValue("")
// // // //   }

// // // //   const handleQuantityKeyPress = (e: React.KeyboardEvent, variantId: string, maxStock: number) => {
// // // //     if (e.key === "Enter") {
// // // //       handleQuantityBlur(variantId, maxStock)
// // // //     } else if (e.key === "Escape") {
// // // //       setEditingVariantId(null)
// // // //       setEditingValue("")
// // // //     }
// // // //   }

// // // //   const handleFinalAddToCart = (variant: SubProduct) => {
// // // //     const quantity = quantities[variant.id] || 1
// // // //     if (onAddToCart) {
// // // //       onAddToCart(variant, quantity)
// // // //       setActiveVariants(prev => ({ ...prev, [variant.id]: false }))
// // // //       setQuantities(prev => ({ ...prev, [variant.id]: 1 }))
// // // //     }
// // // //   }

// // // //   return (
// // // //     <Dialog open={isOpen} onOpenChange={onClose}>
// // // //       <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
// // // //         <DialogHeader>
// // // //           <DialogTitle className="flex items-center gap-2">
// // // //             <Package className="h-5 w-5" />
// // // //             {productName} - Variants
// // // //           </DialogTitle>
// // // //         </DialogHeader>

// // // //         {loading ? (
// // // //           <div className="flex items-center justify-center py-8">
// // // //             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
// // // //           </div>
// // // //         ) : (
// // // //           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
// // // //             {variants.map((variant) => {
// // // //               const isActive = activeVariants[variant.id]
// // // //               const quantity = quantities[variant.id] || 1
// // // //               const isEditing = editingVariantId === variant.id
// // // //               const stockInfo = subProductStocks.get(variant.id)
// // // //               const isRefreshing = refreshingStocks.has(variant.id)
// // // //               const hasStock = stockInfo && stockInfo.quantityLeft > 0
// // // //               const isLowStock = stockInfo && stockInfo.quantityLeft <= variant.lowStockThreshold
              
// // // //               return (
// // // //                 <Card key={variant.id} className="relative">
// // // //                   {variant.imageURL && (
// // // //                     <div className="w-full h-32 overflow-hidden rounded-t-lg">
// // // //                       <img
// // // //                         src={variant.imageURL}
// // // //                         alt={variant.name}
// // // //                         className="w-full h-full object-cover"
// // // //                       />
// // // //                     </div>
// // // //                   )}

// // // //                   <CardHeader className="pb-3">
// // // //                     <CardTitle className="text-lg flex items-center justify-between">
// // // //                       {variant.name}
// // // //                       <Button
// // // //                         onClick={() => handleRefreshStock(variant.id)}
// // // //                         disabled={isRefreshing}
// // // //                         variant="ghost"
// // // //                         size="sm"
// // // //                         className="h-6 px-2"
// // // //                       >
// // // //                         <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
// // // //                       </Button>
// // // //                     </CardTitle>
// // // //                     <div className="flex items-center gap-2">
// // // //                       <Badge variant={isLowStock ? "destructive" : hasStock ? "default" : "secondary"}>
// // // //                         Stock: {stockInfo?.quantityLeft || 0}
// // // //                       </Badge>
// // // //                       {isLowStock && <span className="text-xs text-red-600">Low Stock</span>}
// // // //                     </div>
// // // //                   </CardHeader>

// // // //                   <CardContent className="space-y-2">
// // // //                     {stockInfo && (
// // // //                       <div className="text-2xl font-bold text-primary">
// // // //                         ₹{stockInfo.sellingPrice.toFixed(2)}
// // // //                       </div>
// // // //                     )}

// // // //                     {variant.description && (
// // // //                       <p className="text-sm text-muted-foreground">{variant.description}</p>
// // // //                     )}
// // // //                   </CardContent>

// // // //                   <CardFooter className="flex flex-col gap-2">
// // // //                     {!isActive ? (
// // // //                       <Button 
// // // //                         onClick={() => handleInitialAddToCart(variant.id)} 
// // // //                         disabled={!hasStock} 
// // // //                         className="w-full"
// // // //                       >
// // // //                         <ShoppingCart className="h-4 w-4 mr-2" />
// // // //                         {hasStock ? "Add to Cart" : "Out of Stock"}
// // // //                       </Button>
// // // //                     ) : stockInfo ? (
// // // //                       <>
// // // //                         <div className="flex items-center justify-center gap-2 w-full">
// // // //                           <Button
// // // //                             variant="outline"
// // // //                             size="sm"
// // // //                             onClick={() => handleQuantityChange(variant.id, quantity - 1, stockInfo.quantityLeft)}
// // // //                             disabled={quantity <= 1}
// // // //                             className="h-8 w-8 p-0"
// // // //                           >
// // // //                             <Minus className="h-4 w-4" />
// // // //                           </Button>
                          
// // // //                           {isEditing ? (
// // // //                             <Input
// // // //                               type="text"
// // // //                               value={editingValue}
// // // //                               onChange={handleManualQuantityChange}
// // // //                               onBlur={() => handleQuantityBlur(variant.id, stockInfo.quantityLeft)}
// // // //                               onKeyDown={(e) => handleQuantityKeyPress(e, variant.id, stockInfo.quantityLeft)}
// // // //                               className="w-16 h-8 text-center text-sm p-1"
// // // //                               autoFocus
// // // //                             />
// // // //                           ) : (
// // // //                             <span 
// // // //                               className="w-16 text-center font-medium cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
// // // //                               onClick={() => handleQuantityClick(variant.id, quantity)}
// // // //                               title="Click to edit quantity"
// // // //                             >
// // // //                               {quantity}
// // // //                             </span>
// // // //                           )}
                          
// // // //                           <Button
// // // //                             variant="outline"
// // // //                             size="sm"
// // // //                             onClick={() => handleQuantityChange(variant.id, quantity + 1, stockInfo.quantityLeft)}
// // // //                             disabled={quantity >= stockInfo.quantityLeft}
// // // //                             className="h-8 w-8 p-0"
// // // //                           >
// // // //                             <Plus className="h-4 w-4" />
// // // //                           </Button>
// // // //                         </div>
// // // //                         <Button 
// // // //                           onClick={() => handleFinalAddToCart(variant)} 
// // // //                           className="w-full bg-green-500 hover:bg-green-600"
// // // //                         >
// // // //                           <ShoppingCart className="h-4 w-4 mr-2" />
// // // //                           Confirm Add {quantity} to Cart
// // // //                         </Button>
// // // //                       </>
// // // //                     ) : (
// // // //                       <Button disabled className="w-full">
// // // //                         No Stock Information
// // // //                       </Button>
// // // //                     )}
// // // //                   </CardFooter>
// // // //                 </Card>
// // // //               )
// // // //             })}
// // // //           </div>
// // // //         )}

// // // //         {!loading && variants.length === 0 && (
// // // //           <div className="text-center py-8 text-muted-foreground">
// // // //             No variants found for this product.
// // // //           </div>
// // // //         )}
// // // //       </DialogContent>
// // // //     </Dialog>
// // // //   )
// // // // }

// // // // // // //NOTE - Working
// // // // // "use client";

// // // // // import { useState, useEffect } from "react";
// // // // // import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// // // // // import { Button } from "@/components/ui/button";
// // // // // import { Input } from "@/components/ui/input";
// // // // // import { Badge } from "@/components/ui/badge";
// // // // // import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // import { ShoppingCart, Package, Weight, Ruler, Plus, Minus, Layers, Info } from "lucide-react";
// // // // // import { toast } from "sonner";
// // // // // import type { SubProduct, StockInfo } from "@/lib/types";

// // // // // interface ProductVariantsModalProps {
// // // // //   isOpen: boolean;
// // // // //   onClose: () => void;
// // // // //   productId: string;
// // // // //   productName: string;
// // // // //   onAddToCart?: (variant: SubProduct, quantity: number) => void;
// // // // //   stockInfo: Record<string, StockInfo>;
// // // // // }

// // // // // export function ProductVariantsModal({
// // // // //   isOpen,
// // // // //   onClose,
// // // // //   productId,
// // // // //   productName,
// // // // //   onAddToCart,
// // // // //   stockInfo,
// // // // // }: ProductVariantsModalProps) {
// // // // //   const [variants, setVariants] = useState<SubProduct[]>([]);
// // // // //   const [loading, setLoading] = useState(false);
// // // // //   const [activeVariants, setActiveVariants] = useState<Record<string, boolean>>({});
// // // // //   const [quantities, setQuantities] = useState<Record<string, number>>({});
// // // // //   const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
// // // // //   const [editingValue, setEditingValue] = useState("");

// // // // //   useEffect(() => {
// // // // //     if (isOpen && productId) {
// // // // //       fetchVariants();
// // // // //       setActiveVariants({});
// // // // //       setQuantities({});
// // // // //     }
// // // // //   }, [isOpen, productId]);

// // // // //   const fetchVariants = async () => {
// // // // //     setLoading(true);
// // // // //     try {
// // // // //       const response = await fetch(`/api/products/${productId}/variants`);
// // // // //       if (response.ok) {
// // // // //         const data = await response.json();
// // // // //         setVariants(data.variants);
// // // // //       }
// // // // //     } catch (error) {
// // // // //       console.error("Error fetching variants:", error);
// // // // //     } finally {
// // // // //       setLoading(false);
// // // // //     }
// // // // //   };

// // // // //   const getVariantStock = (variantId: string): StockInfo | null => {
// // // // //     return stockInfo[variantId] || null;
// // // // //   };

// // // // //   const handleInitialAddToCart = (variantId: string) => {
// // // // //     setActiveVariants((prev) => ({ ...prev, [variantId]: true }));
// // // // //     setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// // // // //   };

// // // // //   const handleQuantityChange = (
// // // // //     variantId: string,
// // // // //     newQuantity: number,
// // // // //     maxStock: number
// // // // //   ) => {
// // // // //     if (newQuantity < 1) {
// // // // //       setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// // // // //       return;
// // // // //     }
// // // // //     if (newQuantity > maxStock) {
// // // // //       toast.error(`Only ${maxStock} units available in stock`);
// // // // //       setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
// // // // //       return;
// // // // //     }
// // // // //     setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
// // // // //   };

// // // // //   const handleQuantityClick = (variantId: string, currentQuantity: number) => {
// // // // //     setEditingVariantId(variantId);
// // // // //     setEditingValue(currentQuantity.toString());
// // // // //   };

// // // // //   const handleManualQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
// // // // //     const value = e.target.value;
// // // // //     if (value === "" || /^\d+$/.test(value)) {
// // // // //       setEditingValue(value);
// // // // //     }
// // // // //   };

// // // // //   const handleQuantityBlur = (variantId: string, maxStock: number) => {
// // // // //     const newQuantity = parseInt(editingValue) || 1;

// // // // //     if (newQuantity < 1) {
// // // // //       toast.error("Quantity must be at least 1");
// // // // //       setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// // // // //     } else if (newQuantity > maxStock) {
// // // // //       toast.error(`Only ${maxStock} units available in stock`);
// // // // //       setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
// // // // //     } else {
// // // // //       setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
// // // // //     }

// // // // //     setEditingVariantId(null);
// // // // //     setEditingValue("");
// // // // //   };

// // // // //   const handleQuantityKeyPress = (
// // // // //     e: React.KeyboardEvent,
// // // // //     variantId: string,
// // // // //     maxStock: number
// // // // //   ) => {
// // // // //     if (e.key === "Enter") {
// // // // //       handleQuantityBlur(variantId, maxStock);
// // // // //     } else if (e.key === "Escape") {
// // // // //       setEditingVariantId(null);
// // // // //       setEditingValue("");
// // // // //     }
// // // // //   };

// // // // //   const handleFinalAddToCart = (variant: SubProduct) => {
// // // // //     const quantity = quantities[variant.id] || 1;
// // // // //     if (onAddToCart) {
// // // // //       onAddToCart(variant, quantity);
// // // // //       setActiveVariants((prev) => ({ ...prev, [variant.id]: false }));
// // // // //       setQuantities((prev) => ({ ...prev, [variant.id]: 1 }));
// // // // //     }
// // // // //   };

// // // // //   return (
// // // // //     <Dialog open={isOpen} onOpenChange={onClose}>
// // // // //       <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
// // // // //         <DialogHeader>
// // // // //           <DialogTitle className="flex items-center gap-2">
// // // // //             <Package className="h-5 w-5" />
// // // // //             {productName} - Variants
// // // // //           </DialogTitle>
// // // // //         </DialogHeader>

// // // // //         {loading ? (
// // // // //           <div className="flex items-center justify-center py-8">
// // // // //             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
// // // // //           </div>
// // // // //         ) : (
// // // // //           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
// // // // //             {variants.map((variant) => {
// // // // //               const isActive = activeVariants[variant.id];
// // // // //               const quantity = quantities[variant.id] || 1;
// // // // //               const isEditing = editingVariantId === variant.id;
// // // // //               const stock = getVariantStock(variant.id);

// // // // //               return (
// // // // //                 <Card key={variant.id} className="relative">
// // // // //                   {variant.imageURL && (
// // // // //                     <div className="w-full h-32 overflow-hidden rounded-t-lg">
// // // // //                       <img
// // // // //                         src={
// // // // //                           variant.imageURL ||
// // // // //                           "https://res.cloudinary.com/dap7sy5lk/image/upload/v1757599575/Wafer_rgwce3.jpg"
// // // // //                         }
// // // // //                         alt={variant.name}
// // // // //                         className="w-full h-full object-cover"
// // // // //                       />
// // // // //                     </div>
// // // // //                   )}

// // // // //                   <CardHeader className="pb-3">
// // // // //                     <CardTitle className="text-lg">{variant.name}</CardTitle>
// // // // //                     <div className="flex items-center gap-2 flex-wrap">
// // // // //                       <Badge variant="secondary" className="text-xs">
// // // // //                         {variant.size}
// // // // //                       </Badge>
// // // // //                       {stock && (
// // // // //                         <>
// // // // //                           <Badge
// // // // //                             variant={
// // // // //                               stock.totalStock > variant.lowStockThreshold
// // // // //                                 ? "default"
// // // // //                                 : "destructive"
// // // // //                             }
// // // // //                           >
// // // // //                             Stock: {stock.totalStock}
// // // // //                           </Badge>
// // // // //                           {stock.hasMultipleBatches && (
// // // // //                             <Badge variant="outline" className="text-xs">
// // // // //                               <Layers className="w-3 h-3 mr-1" />
// // // // //                               {stock.batchCount} Batches
// // // // //                             </Badge>
// // // // //                           )}
// // // // //                         </>
// // // // //                       )}
// // // // //                       {!stock && (
// // // // //                         <Badge variant="destructive">No Stock</Badge>
// // // // //                       )}
// // // // //                     </div>
// // // // //                   </CardHeader>

// // // // //                   <CardContent className="space-y-2">
// // // // //                     {stock ? (
// // // // //                       <>
// // // // //                         <div className="text-2xl font-bold text-primary">
// // // // //                           ₹{stock.currentPrice.toFixed(2)}
// // // // //                         </div>
// // // // //                         {stock.hasMultipleBatches && (
// // // // //                           <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
// // // // //                             <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
// // // // //                             <span>
// // // // //                               Multiple batches available. Current batch: {stock.currentBatchQuantity} units
// // // // //                             </span>
// // // // //                           </div>
// // // // //                         )}
// // // // //                       </>
// // // // //                     ) : (
// // // // //                       <div className="text-lg font-bold text-gray-400">
// // // // //                         Out of Stock
// // // // //                       </div>
// // // // //                     )}

// // // // //                     {variant.description && (
// // // // //                       <p className="text-sm text-muted-foreground">
// // // // //                         {variant.description}
// // // // //                       </p>
// // // // //                     )}

// // // // //                     <div className="space-y-1 text-sm">
// // // // //                       {variant.weight && (
// // // // //                         <div className="flex items-center gap-2">
// // // // //                           <Weight className="h-4 w-4 text-muted-foreground" />
// // // // //                           <span>Weight: {variant.weight}</span>
// // // // //                         </div>
// // // // //                       )}
// // // // //                       {variant.volume && (
// // // // //                         <div className="flex items-center gap-2">
// // // // //                           <Ruler className="h-4 w-4 text-muted-foreground" />
// // // // //                           <span>Volume: {variant.volume}</span>
// // // // //                         </div>
// // // // //                       )}
// // // // //                     </div>
// // // // //                   </CardContent>

// // // // //                   <CardFooter className="flex flex-col gap-2">
// // // // //                     {!stock || stock.totalStock === 0 ? (
// // // // //                       <Button disabled className="w-full">
// // // // //                         <ShoppingCart className="h-4 w-4 mr-2" />
// // // // //                         Out of Stock
// // // // //                       </Button>
// // // // //                     ) : !isActive ? (
// // // // //                       <Button
// // // // //                         onClick={() => handleInitialAddToCart(variant.id)}
// // // // //                         className="w-full"
// // // // //                       >
// // // // //                         <ShoppingCart className="h-4 w-4 mr-2" />
// // // // //                         Add to Cart
// // // // //                       </Button>
// // // // //                     ) : (
// // // // //                       <>
// // // // //                         <div className="flex items-center justify-center gap-2 w-full">
// // // // //                           <Button
// // // // //                             variant="outline"
// // // // //                             size="sm"
// // // // //                             onClick={() =>
// // // // //                               handleQuantityChange(
// // // // //                                 variant.id,
// // // // //                                 quantity - 1,
// // // // //                                 stock.totalStock
// // // // //                               )
// // // // //                             }
// // // // //                             disabled={quantity <= 1}
// // // // //                             className="h-8 w-8 p-0"
// // // // //                           >
// // // // //                             <Minus className="h-4 w-4" />
// // // // //                           </Button>

// // // // //                           {isEditing ? (
// // // // //                             <Input
// // // // //                               type="text"
// // // // //                               value={editingValue}
// // // // //                               onChange={handleManualQuantityChange}
// // // // //                               onBlur={() =>
// // // // //                                 handleQuantityBlur(variant.id, stock.totalStock)
// // // // //                               }
// // // // //                               onKeyDown={(e) =>
// // // // //                                 handleQuantityKeyPress(e, variant.id, stock.totalStock)
// // // // //                               }
// // // // //                               className="w-16 h-8 text-center text-sm p-1"
// // // // //                               autoFocus
// // // // //                             />
// // // // //                           ) : (
// // // // //                             <span
// // // // //                               className="w-16 text-center font-medium cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
// // // // //                               onClick={() => handleQuantityClick(variant.id, quantity)}
// // // // //                               title="Click to edit quantity"
// // // // //                             >
// // // // //                               {quantity}
// // // // //                             </span>
// // // // //                           )}

// // // // //                           <Button
// // // // //                             variant="outline"
// // // // //                             size="sm"
// // // // //                             onClick={() =>
// // // // //                               handleQuantityChange(
// // // // //                                 variant.id,
// // // // //                                 quantity + 1,
// // // // //                                 stock.totalStock
// // // // //                               )
// // // // //                             }
// // // // //                             disabled={quantity >= stock.totalStock}
// // // // //                             className="h-8 w-8 p-0"
// // // // //                           >
// // // // //                             <Plus className="h-4 w-4" />
// // // // //                           </Button>
// // // // //                         </div>
// // // // //                         <Button
// // // // //                           onClick={() => handleFinalAddToCart(variant)}
// // // // //                           className="w-full bg-green-500 hover:bg-green-600"
// // // // //                         >
// // // // //                           <ShoppingCart className="h-4 w-4 mr-2" />
// // // // //                           Confirm Add {quantity} to Cart
// // // // //                         </Button>
// // // // //                       </>
// // // // //                     )}
// // // // //                   </CardFooter>
// // // // //                 </Card>
// // // // //               );
// // // // //             })}
// // // // //           </div>
// // // // //         )}

// // // // //         {!loading && variants.length === 0 && (
// // // // //           <div className="text-center py-8 text-muted-foreground">
// // // // //             No variants found for this product.
// // // // //           </div>
// // // // //         )}
// // // // //       </DialogContent>
// // // // //     </Dialog>
// // // // //   );
// // // // // }





// // // // // // "use client";

// // // // // // import { useState, useEffect } from "react";
// // // // // // import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// // // // // // import { Button } from "@/components/ui/button";
// // // // // // import { Input } from "@/components/ui/input";
// // // // // // import { Badge } from "@/components/ui/badge";
// // // // // // import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // // import { ShoppingCart, Package, Weight, Ruler, Plus, Minus, Layers, Info } from "lucide-react";
// // // // // // import { toast } from "sonner";
// // // // // // // import type { SubProduct, StockInfo } from "@/lib/types";

// // // // // // type SubProduct = {
// // // // // //     id: string;
// // // // // //     name: string;
// // // // // //     size: string;
// // // // // //     description?: string;
// // // // // //     weight?: string;
// // // // // //     volume?: string;
// // // // // //     imageURL?: string;
// // // // // //     lowStockThreshold: number;
// // // // // // };

// // // // // // type StockInfo = {
// // // // // //     totalStock: number;
// // // // // //     currentPrice: number;
// // // // // //     hasMultipleBatches: boolean;
// // // // // //     batchCount: number;
// // // // // //     currentBatchQuantity: number;
// // // // // // };

// // // // // // interface ProductVariantsModalProps {
// // // // // //   isOpen: boolean;
// // // // // //   onClose: () => void;
// // // // // //   productId: string;
// // // // // //   productName: string;
// // // // // //   onAddToCart?: (variant: SubProduct, quantity: number) => void;
// // // // // //   stockInfo: Record<string, StockInfo>;
// // // // // // }

// // // // // // export function ProductVariantsModal({
// // // // // //   isOpen,
// // // // // //   onClose,
// // // // // //   productId,
// // // // // //   productName,
// // // // // //   onAddToCart,
// // // // // //   stockInfo,
// // // // // // }: ProductVariantsModalProps) {
// // // // // //   const [variants, setVariants] = useState<SubProduct[]>([]);
// // // // // //   const [loading, setLoading] = useState(false);
// // // // // //   const [activeVariants, setActiveVariants] = useState<Record<string, boolean>>({});
// // // // // //   const [quantities, setQuantities] = useState<Record<string, number>>({});
// // // // // //   const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
// // // // // //   const [editingValue, setEditingValue] = useState("");

// // // // // //   useEffect(() => {
// // // // // //     if (isOpen && productId) {
// // // // // //       fetchVariants();
// // // // // //       setActiveVariants({});
// // // // // //       setQuantities({});
// // // // // //     }
// // // // // //   }, [isOpen, productId]);

// // // // // //   const fetchVariants = async () => {
// // // // // //     setLoading(true);
// // // // // //     try {
// // // // // //       const response = await fetch(`/api/products/${productId}/variants`);
// // // // // //       if (response.ok) {
// // // // // //         const data = await response.json();
// // // // // //         setVariants(data.variants);
// // // // // //       }
// // // // // //     } catch (error) {
// // // // // //       console.error("Error fetching variants:", error);
// // // // // //     } finally {
// // // // // //       setLoading(false);
// // // // // //     }
// // // // // //   };

// // // // // //   const getVariantStock = (variantId: string): StockInfo | null => {
// // // // // //     return stockInfo[variantId] || null;
// // // // // //   };

// // // // // //   const handleInitialAddToCart = (variantId: string) => {
// // // // // //     setActiveVariants((prev) => ({ ...prev, [variantId]: true }));
// // // // // //     setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// // // // // //   };

// // // // // //   const handleQuantityChange = (
// // // // // //     variantId: string,
// // // // // //     newQuantity: number,
// // // // // //     maxStock: number
// // // // // //   ) => {
// // // // // //     if (newQuantity < 1) {
// // // // // //       setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// // // // // //       return;
// // // // // //     }
// // // // // //     if (newQuantity > maxStock) {
// // // // // //       toast.error(`Only ${maxStock} units available in stock`);
// // // // // //       setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
// // // // // //       return;
// // // // // //     }
// // // // // //     setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
// // // // // //   };

// // // // // //   const handleQuantityClick = (variantId: string, currentQuantity: number) => {
// // // // // //     setEditingVariantId(variantId);
// // // // // //     setEditingValue(currentQuantity.toString());
// // // // // //   };

// // // // // //   const handleManualQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
// // // // // //     const value = e.target.value;
// // // // // //     if (value === "" || /^\d+$/.test(value)) {
// // // // // //       setEditingValue(value);
// // // // // //     }
// // // // // //   };

// // // // // //   const handleQuantityBlur = (variantId: string, maxStock: number) => {
// // // // // //     const newQuantity = parseInt(editingValue) || 1;

// // // // // //     if (newQuantity < 1) {
// // // // // //       toast.error("Quantity must be at least 1");
// // // // // //       setQuantities((prev) => ({ ...prev, [variantId]: 1 }));
// // // // // //     } else if (newQuantity > maxStock) {
// // // // // //       toast.error(`Only ${maxStock} units available in stock`);
// // // // // //       setQuantities((prev) => ({ ...prev, [variantId]: maxStock }));
// // // // // //     } else {
// // // // // //       setQuantities((prev) => ({ ...prev, [variantId]: newQuantity }));
// // // // // //     }

// // // // // //     setEditingVariantId(null);
// // // // // //     setEditingValue("");
// // // // // //   };

// // // // // //   const handleQuantityKeyPress = (
// // // // // //     e: React.KeyboardEvent,
// // // // // //     variantId: string,
// // // // // //     maxStock: number
// // // // // //   ) => {
// // // // // //     if (e.key === "Enter") {
// // // // // //       handleQuantityBlur(variantId, maxStock);
// // // // // //     } else if (e.key === "Escape") {
// // // // // //       setEditingVariantId(null);
// // // // // //       setEditingValue("");
// // // // // //     }
// // // // // //   };

// // // // // //   const handleFinalAddToCart = (variant: SubProduct) => {
// // // // // //     const quantity = quantities[variant.id] || 1;
// // // // // //     if (onAddToCart) {
// // // // // //       onAddToCart(variant, quantity);
// // // // // //       setActiveVariants((prev) => ({ ...prev, [variant.id]: false }));
// // // // // //       setQuantities((prev) => ({ ...prev, [variant.id]: 1 }));
// // // // // //     }
// // // // // //   };

// // // // // //   return (
// // // // // //     <Dialog open={isOpen} onOpenChange={onClose}>
// // // // // //       <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
// // // // // //         <DialogHeader>
// // // // // //           <DialogTitle className="flex items-center gap-2">
// // // // // //             <Package className="h-5 w-5" />
// // // // // //             {productName} - Variants
// // // // // //           </DialogTitle>
// // // // // //         </DialogHeader>

// // // // // //         {loading ? (
// // // // // //           <div className="flex items-center justify-center py-8">
// // // // // //             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
// // // // // //           </div>
// // // // // //         ) : (
// // // // // //           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
// // // // // //             {variants.map((variant) => {
// // // // // //               const isActive = activeVariants[variant.id];
// // // // // //               const quantity = quantities[variant.id] || 1;
// // // // // //               const isEditing = editingVariantId === variant.id;
// // // // // //               const stock = getVariantStock(variant.id);

// // // // // //               return (
// // // // // //                 <Card key={variant.id} className="relative">
// // // // // //                   {variant.imageURL && (
// // // // // //                     <div className="w-full h-32 overflow-hidden rounded-t-lg">
// // // // // //                       <img
// // // // // //                         src={
// // // // // //                           variant.imageURL ||
// // // // // //                           "https://res.cloudinary.com/dap7sy5lk/image/upload/v1757599575/Wafer_rgwce3.jpg"
// // // // // //                         }
// // // // // //                         alt={variant.name}
// // // // // //                         className="w-full h-full object-cover"
// // // // // //                       />
// // // // // //                     </div>
// // // // // //                   )}

// // // // // //                   <CardHeader className="pb-3">
// // // // // //                     <CardTitle className="text-lg">{variant.name}</CardTitle>
// // // // // //                     <div className="flex items-center gap-2 flex-wrap">
// // // // // //                       <Badge variant="secondary" className="text-xs">
// // // // // //                         {variant.size}
// // // // // //                       </Badge>
// // // // // //                       {stock && (
// // // // // //                         <>
// // // // // //                           <Badge
// // // // // //                             variant={
// // // // // //                               stock.totalStock > variant.lowStockThreshold
// // // // // //                                 ? "default"
// // // // // //                                 : "destructive"
// // // // // //                             }
// // // // // //                           >
// // // // // //                             Stock: {stock.totalStock}
// // // // // //                           </Badge>
// // // // // //                           {stock.hasMultipleBatches && (
// // // // // //                             <Badge variant="outline" className="text-xs">
// // // // // //                               <Layers className="w-3 h-3 mr-1" />
// // // // // //                               {stock.batchCount} Batches
// // // // // //                             </Badge>
// // // // // //                           )}
// // // // // //                         </>
// // // // // //                       )}
// // // // // //                       {!stock && (
// // // // // //                         <Badge variant="destructive">No Stock</Badge>
// // // // // //                       )}
// // // // // //                     </div>
// // // // // //                   </CardHeader>

// // // // // //                   <CardContent className="space-y-2">
// // // // // //                     {stock ? (
// // // // // //                       <>
// // // // // //                         <div className="text-2xl font-bold text-primary">
// // // // // //                           ₹{stock.currentPrice.toFixed(2)}
// // // // // //                         </div>
// // // // // //                         {stock.hasMultipleBatches && (
// // // // // //                           <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
// // // // // //                             <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
// // // // // //                             <span>
// // // // // //                               Multiple batches available. Current batch: {stock.currentBatchQuantity} units
// // // // // //                             </span>
// // // // // //                           </div>
// // // // // //                         )}
// // // // // //                       </>
// // // // // //                     ) : (
// // // // // //                       <div className="text-lg font-bold text-gray-400">
// // // // // //                         Out of Stock
// // // // // //                       </div>
// // // // // //                     )}

// // // // // //                     {variant.description && (
// // // // // //                       <p className="text-sm text-muted-foreground">
// // // // // //                         {variant.description}
// // // // // //                       </p>
// // // // // //                     )}

// // // // // //                     <div className="space-y-1 text-sm">
// // // // // //                       {variant.weight && (
// // // // // //                         <div className="flex items-center gap-2">
// // // // // //                           <Weight className="h-4 w-4 text-muted-foreground" />
// // // // // //                           <span>Weight: {variant.weight}</span>
// // // // // //                         </div>
// // // // // //                       )}
// // // // // //                       {variant.volume && (
// // // // // //                         <div className="flex items-center gap-2">
// // // // // //                           <Ruler className="h-4 w-4 text-muted-foreground" />
// // // // // //                           <span>Volume: {variant.volume}</span>
// // // // // //                         </div>
// // // // // //                       )}
// // // // // //                     </div>
// // // // // //                   </CardContent>

// // // // // //                   <CardFooter className="flex flex-col gap-2">
// // // // // //                     {!stock || stock.totalStock === 0 ? (
// // // // // //                       <Button disabled className="w-full">
// // // // // //                         <ShoppingCart className="h-4 w-4 mr-2" />
// // // // // //                         Out of Stock
// // // // // //                       </Button>
// // // // // //                     ) : !isActive ? (
// // // // // //                       <Button
// // // // // //                         onClick={() => handleInitialAddToCart(variant.id)}
// // // // // //                         className="w-full"
// // // // // //                       >
// // // // // //                         <ShoppingCart className="h-4 w-4 mr-2" />
// // // // // //                         Add to Cart
// // // // // //                       </Button>
// // // // // //                     ) : (
// // // // // //                       <>
// // // // // //                         <div className="flex items-center justify-center gap-2 w-full">
// // // // // //                           <Button
// // // // // //                             variant="outline"
// // // // // //                             size="sm"
// // // // // //                             onClick={() =>
// // // // // //                               handleQuantityChange(
// // // // // //                                 variant.id,
// // // // // //                                 quantity - 1,
// // // // // //                                 stock.totalStock
// // // // // //                               )
// // // // // //                             }
// // // // // //                             disabled={quantity <= 1}
// // // // // //                             className="h-8 w-8 p-0"
// // // // // //                           >
// // // // // //                             <Minus className="h-4 w-4" />
// // // // // //                           </Button>

// // // // // //                           {isEditing ? (
// // // // // //                             <Input
// // // // // //                               type="text"
// // // // // //                               value={editingValue}
// // // // // //                               onChange={handleManualQuantityChange}
// // // // // //                               onBlur={() =>
// // // // // //                                 handleQuantityBlur(variant.id, stock.totalStock)
// // // // // //                               }
// // // // // //                               onKeyDown={(e) =>
// // // // // //                                 handleQuantityKeyPress(e, variant.id, stock.totalStock)
// // // // // //                               }
// // // // // //                               className="w-16 h-8 text-center text-sm p-1"
// // // // // //                               autoFocus
// // // // // //                             />
// // // // // //                           ) : (
// // // // // //                             <span
// // // // // //                               className="w-16 text-center font-medium cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
// // // // // //                               onClick={() => handleQuantityClick(variant.id, quantity)}
// // // // // //                               title="Click to edit quantity"
// // // // // //                             >
// // // // // //                               {quantity}
// // // // // //                             </span>
// // // // // //                           )}

// // // // // //                           <Button
// // // // // //                             variant="outline"
// // // // // //                             size="sm"
// // // // // //                             onClick={() =>
// // // // // //                               handleQuantityChange(
// // // // // //                                 variant.id,
// // // // // //                                 quantity + 1,
// // // // // //                                 stock.totalStock
// // // // // //                               )
// // // // // //                             }
// // // // // //                             disabled={quantity >= stock.totalStock}
// // // // // //                             className="h-8 w-8 p-0"
// // // // // //                           >
// // // // // //                             <Plus className="h-4 w-4" />
// // // // // //                           </Button>
// // // // // //                         </div>
// // // // // //                         <Button
// // // // // //                           onClick={() => handleFinalAddToCart(variant)}
// // // // // //                           className="w-full bg-green-500 hover:bg-green-600"
// // // // // //                         >
// // // // // //                           <ShoppingCart className="h-4 w-4 mr-2" />
// // // // // //                           Confirm Add {quantity} to Cart
// // // // // //                         </Button>
// // // // // //                       </>
// // // // // //                     )}
// // // // // //                   </CardFooter>
// // // // // //                 </Card>
// // // // // //               );
// // // // // //             })}
// // // // // //           </div>
// // // // // //         )}

// // // // // //         {!loading && variants.length === 0 && (
// // // // // //           <div className="text-center py-8 text-muted-foreground">
// // // // // //             No variants found for this product.
// // // // // //           </div>
// // // // // //         )}
// // // // // //       </DialogContent>
// // // // // //     </Dialog>
// // // // // //   );
// // // // // // }