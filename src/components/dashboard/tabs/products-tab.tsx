// app/dashboard/products-tab.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Search, Trash2, Eye, EyeOff, Download, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import AddProductModal from "@/components/modals/add-product-modal";
import EditProductModal from "@/components/modals/edit-product-modal";

import type { 
  ApiResponse, 
  Product, 
  ProductsResponse, 
  ProductFilterState 
} from "@/types/product";
import type { Category, CategoriesResponse } from "@/types/category";

export default function ProductsTab() {
  const [filterState, setFilterState] = useState<ProductFilterState>({
    searchTerm: "",
    selectedCategory: "all",
    showInactive: false,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const queryClient = useQueryClient();

  // Fetch products with type-safe response
  const {
    data: productsResponse,
    isLoading: productsLoading,
    error: productsError,
    isError: isProductsError,
  } = useQuery<ApiResponse<ProductsResponse>, Error>({
    queryKey: ["products", filterState.showInactive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterState.showInactive) {
        params.append("includeInactive", "true");
      }

      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
      }

      const data: ApiResponse<ProductsResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch products");
      }

      return data;
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch categories
  const { data: categoriesResponse } = useQuery<ApiResponse<CategoriesResponse>, Error>({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }

      const data: ApiResponse<CategoriesResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch categories");
      }

      return data;
    },
  });

  const products = productsResponse?.data?.products || [];
  const categories = categoriesResponse?.data?.categories || [];

  // Delete product mutation
  const deleteProductMutation = useMutation<ApiResponse<null>, Error, string>({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      const result: ApiResponse<null> = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || `Failed to delete product: ${response.status}`);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted successfully.");
    },
    onError: (error: Error) => {
      console.error("Delete product error:", error);
      toast.error(`Failed to delete product: ${error.message}`);
    },
  });

  // Toggle product status mutation
  const toggleProductMutation = useMutation<
    ApiResponse<Product>,
    Error,
    { productId: string; isActive: boolean }
  >({
    mutationFn: async ({ productId, isActive }) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      const result: ApiResponse<Product> = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || `Failed to update product: ${response.status}`);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product status updated successfully.");
    },
    onError: (error: Error) => {
      console.error("Toggle product error:", error);
      toast.error(`Failed to update product: ${error.message}`);
    },
  });

  const handleFilterChange = useCallback((key: keyof ProductFilterState, value: string | boolean) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleEditProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  }, []);

  const handleToggleActive = useCallback(
    (productId: string, currentStatus: boolean) => {
      toggleProductMutation.mutate({ productId, isActive: !currentStatus });
    },
    [toggleProductMutation]
  );

  const handleDeleteProduct = useCallback(
    (productId: string, productName: string) => {
      if (
        window.confirm(
          `Are you sure you want to delete "${productName}"? This action cannot be undone.`
        )
      ) {
        deleteProductMutation.mutate(productId);
      }
    },
    [deleteProductMutation]
  );

  const getCategoryIcon = useCallback((categoryName: string): string => {
    if (!categoryName) return "📦";

    switch (categoryName.toLowerCase()) {
      case "food":
        return "🍜";
      case "stationery":
        return "📚";
      case "daily use":
        return "🧴";
      case "pooja":
        return "🔥";
      default:
        return "📦";
    }
  }, []);

  const getCategoryName = useCallback(
    (product: Product): string => {
      // Check if category is populated
      if (product.category && typeof product.category === "object" && "name" in product.category) {
        return product.category.name;
      }

      // Fallback to looking up by categoryId
      const category = categories.find((cat) => cat._id === product.categoryId);
      return category?.name || "Uncategorized";
    },
    [categories]
  );

  // Memoized filtered products
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) {
      console.warn("products is not an array:", products);
      return [];
    }

    return products.filter((product: Product) => {
      if (!product) return false;

      const searchTerm = filterState.searchTerm.toLowerCase().trim();
      const matchesSearch =
        !searchTerm ||
        product.name?.toLowerCase().includes(searchTerm) ||
        product.description?.toLowerCase().includes(searchTerm);

      let matchesCategory = true;
      if (filterState.selectedCategory !== "all") {
        matchesCategory = product.categoryId === filterState.selectedCategory;
      }

      return matchesSearch && matchesCategory;
    });
  }, [products, filterState.searchTerm, filterState.selectedCategory]);

  // CLIENT-SIDE EXPORT FUNCTIONALITY
  const handleExport = useCallback(() => {
    try {
      const headers = [
        "Product Name",
        "Category",
        "Description",
        "Has Variants",
        "Variant Count",
        "Status",
        "Created At",
      ];

      const rows = filteredProducts.map((product: Product) => {
        const categoryName = getCategoryName(product);
        const createdDate = new Date(product.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        return [
          `"${product.name}"`,
          `"${categoryName}"`,
          `"${product.description || "N/A"}"`,
          product.hasVariants ? "Yes" : "No",
          product.variantCount || 0,
          product.isActive ? "Active" : "Disabled",
          createdDate,
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `products-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Products exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export products");
    }
  }, [filteredProducts, getCategoryName]);

  // Error state
  if (isProductsError) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Products</h3>
          <p className="text-gray-600 mb-4">
            {productsError instanceof Error ? productsError.message : "An unknown error occurred"}
          </p>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (productsLoading) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading products...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
        <div className="flex space-x-2">
          <Button onClick={handleExport} variant="outline" disabled={filteredProducts.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Search Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Product name..."
                  value={filterState.searchTerm}
                  onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Category</Label>
              <Select
                value={filterState.selectedCategory}
                onValueChange={(value) => handleFilterChange("selectedCategory", value)}
              >
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
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Show Inactive Products
              </Label>
              <div className="flex items-center space-x-2 mt-3">
                <Switch
                  checked={filterState.showInactive}
                  onCheckedChange={(checked) => handleFilterChange("showInactive", checked)}
                />
                <span className="text-sm text-gray-600">Include disabled products</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold text-gray-900">Products Inventory</CardTitle>
            <p className="text-sm text-gray-600 m-0 pt-1">
              [{filteredProducts.length} of {products.length} products]
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500 mb-4">
                {products.length === 0
                  ? "Get started by adding your first product."
                  : "Try adjusting your search or filters."}
              </p>
              {products.length === 0 && (
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variants
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product: Product) => (
                    <tr
                      key={product._id}
                      className={!product.isActive ? "bg-gray-50 opacity-75" : ""}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                              product.isActive ? "bg-gray-100" : "bg-gray-200"
                            }`}
                          >
                            {getCategoryIcon(getCategoryName(product))}
                          </div>
                          <div className="ml-3">
                            <p
                              className={`text-sm font-medium ${
                                product.isActive ? "text-gray-900" : "text-gray-500"
                              }`}
                            >
                              {product.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {product.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {getCategoryName(product)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {product.hasVariants
                            ? `${product.variantCount || 0} variants`
                            : "No variants"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {new Date(product.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={product.isActive ? "default" : "secondary"}
                          className={
                            product.isActive ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"
                          }
                        >
                          {product.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(product._id, product.isActive)}
                            disabled={toggleProductMutation.isPending}
                            className={
                              product.isActive
                                ? "text-orange-500 hover:text-orange-600"
                                : "text-green-500 hover:text-green-600"
                            }
                            title={product.isActive ? "Disable Product" : "Enable Product"}
                          >
                            {toggleProductMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : product.isActive ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                            className="text-purple-500 hover:text-purple-600"
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product._id, product.name)}
                            disabled={deleteProductMutation.isPending}
                            className="text-red-500 hover:text-red-600"
                            title="Delete Product"
                          >
                            {deleteProductMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
      <EditProductModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        product={selectedProduct}
      />
    </div>
  );
}





// "use client"

// import { useState, useMemo, useCallback } from "react"
// import { useQuery, useQueryClient } from "@tanstack/react-query"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"
// import { Badge } from "@/components/ui/badge"
// import { Switch } from "@/components/ui/switch"
// import {
//   Plus,
//   Edit,
//   Search,
//   Trash2,
//   Eye,
//   EyeOff,
//   Download,
//   Loader2,
//   AlertTriangle,
// } from "lucide-react"
// import { toast } from "sonner"
// import AddProductModal from "@/components/modals/add-product-modal"
// import EditProductModal from "@/components/modals/edit-product-modal"
// import { useDeleteProduct, useToggleProductStatus } from "@/hooks/use-product-mutations"
// import type {
//   Product,
//   Category,
//   ProductsListResponse,
//   CategoriesListResponse,
// } from "@/types"

// // =============================================
// // Filter State Interface
// // =============================================
// interface FilterState {
//   searchTerm: string
//   selectedCategory: string
//   showInactive: boolean
// }

// // =============================================
// // Helper Functions
// // =============================================
// const getCategoryIcon = (categoryName: string): string => {
//   if (!categoryName) return "📦"

//   const lowerName = categoryName.toLowerCase()

//   if (lowerName.includes("food")) return "🍜"
//   if (lowerName.includes("stationery")) return "📚"
//   if (lowerName.includes("daily")) return "🧴"
//   if (lowerName.includes("pooja")) return "🔥"

//   return "📦"
// }

// const getCategoryName = (product: Product, categories: Category[]): string => {
//   // If category info is embedded
//   if (product.category && typeof product.category === "object") {
//     return product.category.name
//   }

//   // Lookup by categoryId
//   const category = categories.find((cat) => cat.id === product.categoryId)
//   return category?.name || "Uncategorized"
// }

// // =============================================
// // Main Component
// // =============================================
// export default function ProductsTab() {
//   const [filterState, setFilterState] = useState<FilterState>({
//     searchTerm: "",
//     selectedCategory: "all",
//     showInactive: false,
//   })
//   const [showAddModal, setShowAddModal] = useState(false)
//   const [showEditModal, setShowEditModal] = useState(false)
//   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

//   const queryClient = useQueryClient()

//   // =============================================
//   // Use New Mutation Hooks
//   // =============================================
//   const deleteProductMutation = useDeleteProduct()
//   const toggleProductMutation = useToggleProductStatus()

//   // =============================================
//   // Fetch Products Query
//   // =============================================
//   const {
//     data: productsData,
//     isLoading: isLoadingProducts,
//     isError: isProductsError,
//     error: productsError,
//   } = useQuery<Product[]>({
//     queryKey: ["products", filterState.showInactive],
//     queryFn: async (): Promise<Product[]> => {
//       const params = new URLSearchParams()
//       if (filterState.showInactive) {
//         params.append("includeInactive", "true")
//       }

//       const response = await fetch(`/api/products?${params}`)

//       if (!response.ok) {
//         throw new Error(`Failed to fetch products: ${response.status}`)
//       }

//       const data: ProductsListResponse = await response.json()

//       if (!data.success || !data.data.products) {
//         throw new Error("Invalid response format")
//       }

//       return data.data.products
//     },
//     retry: 2,
//     staleTime: 5 * 60 * 1000,
//   })

//   // =============================================
//   // Fetch Categories Query
//   // =============================================
//   const { data: categoriesData } = useQuery<Category[]>({
//     queryKey: ["categories"],
//     queryFn: async (): Promise<Category[]> => {
//       const response = await fetch("/api/categories?includeInactive=false")

//       if (!response.ok) {
//         throw new Error("Failed to fetch categories")
//       }

//       const data: CategoriesListResponse = await response.json()

//       if (!data.success || !data.data.categories) {
//         throw new Error("Invalid response format")
//       }

//       return data.data.categories
//     },
//   })

//   const products = productsData || []
//   const categories = categoriesData || []

//   // =============================================
//   // Event Handlers
//   // =============================================
//   const handleFilterChange = useCallback((key: keyof FilterState, value: string | boolean) => {
//     setFilterState((prev) => ({ ...prev, [key]: value }))
//   }, [])

//   const handleEditProduct = useCallback((product: Product) => {
//     setSelectedProduct(product)
//     setShowEditModal(true)
//   }, [])

//   const handleToggleActive = useCallback(
//     (productId: string, currentStatus: boolean) => {
//       toggleProductMutation.mutate({ id: productId, isActive: !currentStatus })
//     },
//     [toggleProductMutation]
//   )

//   const handleDeleteProduct = useCallback(
//     (productId: string, productName: string) => {
//       if (
//         window.confirm(
//           `Are you sure you want to delete "${productName}"? This action cannot be undone.`
//         )
//       ) {
//         deleteProductMutation.mutate(productId)
//       }
//     },
//     [deleteProductMutation]
//   )

//   // =============================================
//   // Filtered Products (Memoized)
//   // =============================================
//   const filteredProducts = useMemo(() => {
//     return products.filter((product) => {
//       const matchesSearch =
//         !filterState.searchTerm ||
//         product.name.toLowerCase().includes(filterState.searchTerm.toLowerCase())

//       const matchesCategory =
//         filterState.selectedCategory === "all" ||
//         product.categoryId === filterState.selectedCategory ||
//         getCategoryName(product, categories).toLowerCase() ===
//           categories.find((c) => c.id === filterState.selectedCategory)?.name.toLowerCase()

//       return matchesSearch && matchesCategory
//     })
//   }, [products, filterState, categories])

//   // =============================================
//   // Export Functionality
//   // =============================================
//   const handleExport = useCallback(() => {
//     try {
//       const headers = [
//         "Product Name",
//         "Category",
//         "Description",
//         "Has Variants",
//         "Variant Count",
//         "Status",
//         "Created At",
//       ]

//       const rows = filteredProducts.map((product) => {
//         const categoryName = getCategoryName(product, categories)
//         const createdDate = new Date(product.createdAt).toLocaleDateString("en-GB", {
//           day: "2-digit",
//           month: "2-digit",
//           year: "numeric",
//         })

//         return [
//           `"${product.name}"`,
//           `"${categoryName}"`,
//           `"${product.description || "N/A"}"`,
//           product.hasVariants ? "Yes" : "No",
//           product.variantCount || 0,
//           product.isActive ? "Active" : "Disabled",
//           createdDate,
//         ].join(",")
//       })

//       const csvContent = [headers.join(","), ...rows].join("\n")

//       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
//       const url = window.URL.createObjectURL(blob)
//       const link = document.createElement("a")
//       link.href = url
//       link.download = `products-${new Date().toISOString().split("T")[0]}.csv`
//       document.body.appendChild(link)
//       link.click()
//       document.body.removeChild(link)
//       window.URL.revokeObjectURL(url)

//       toast.success("Products exported successfully!")
//     } catch (error) {
//       console.error("Export error:", error)
//       toast.error("Failed to export products")
//     }
//   }, [filteredProducts, categories])

//   // =============================================
//   // Error State
//   // =============================================
//   if (isProductsError) {
//     return (
//       <Card className="p-8">
//         <div className="text-center">
//           <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
//           <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Products</h3>
//           <p className="text-gray-600 mb-4">
//             {productsError instanceof Error ? productsError.message : "An unknown error occurred"}
//           </p>
//           <Button
//             onClick={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
//             variant="outline"
//           >
//             Try Again
//           </Button>
//         </div>
//       </Card>
//     )
//   }

//   // =============================================
//   // Loading State
//   // =============================================
//   if (isLoadingProducts) {
//     return (
//       <Card className="p-8">
//         <div className="text-center">
//           <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
//           <p className="text-gray-600">Loading products...</p>
//         </div>
//       </Card>
//     )
//   }

//   // =============================================
//   // Main Render
//   // =============================================
//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex justify-between items-center">
//         <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
//         <div className="flex space-x-2">
//           <Button onClick={handleExport} variant="outline" disabled={filteredProducts.length === 0}>
//             <Download className="w-4 h-4 mr-2" />
//             Export
//           </Button>
//           <Button
//             onClick={() => setShowAddModal(true)}
//             className="bg-blue-500 hover:bg-blue-600 text-white"
//           >
//             <Plus className="w-4 h-4 mr-2" />
//             Add Product
//           </Button>
//         </div>
//       </div>

//       {/* Search and Filter */}
//       <Card>
//         <CardContent className="p-6">
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//             {/* Search */}
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">
//                 Search Products
//               </Label>
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//                 <Input
//                   placeholder="Product name..."
//                   value={filterState.searchTerm}
//                   onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
//                   className="pl-10"
//                 />
//               </div>
//             </div>

//             {/* Category Filter */}
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">Category</Label>
//               <Select
//                 value={filterState.selectedCategory}
//                 onValueChange={(value) => handleFilterChange("selectedCategory", value)}
//               >
//                 <SelectTrigger>
//                   <SelectValue placeholder="All Categories" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All Categories</SelectItem>
//                   {categories.map((category) => (
//                     <SelectItem key={category.id} value={category.id}>
//                       {category.name}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* Show Inactive Toggle */}
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">
//                 Show Inactive Products
//               </Label>
//               <div className="flex items-center space-x-2 mt-3">
//                 <Switch
//                   checked={filterState.showInactive}
//                   onCheckedChange={(checked) => handleFilterChange("showInactive", checked)}
//                 />
//                 <span className="text-sm text-gray-600">Include disabled products</span>
//               </div>
//             </div>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Products List */}
//       <Card>
//         <CardHeader>
//           <div className="flex items-center gap-3">
//             <CardTitle className="text-lg font-semibold text-gray-900">
//               Products Inventory
//             </CardTitle>
//             <p className="text-sm text-gray-600">
//               [{filteredProducts.length} of {products.length} products]
//             </p>
//           </div>
//         </CardHeader>
//         <CardContent className="p-0">
//           {filteredProducts.length === 0 ? (
//             <div className="text-center py-12">
//               <div className="text-gray-400 mb-4">📦</div>
//               <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
//               <p className="text-gray-500 mb-4">
//                 {products.length === 0
//                   ? "Get started by adding your first product."
//                   : "Try adjusting your search or filters."}
//               </p>
//               {products.length === 0 && (
//                 <Button
//                   onClick={() => setShowAddModal(true)}
//                   className="bg-blue-500 hover:bg-blue-600 text-white"
//                 >
//                   <Plus className="w-4 h-4 mr-2" />
//                   Add Product
//                 </Button>
//               )}
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full">
//                 <thead className="bg-gray-50">
//                   <tr>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Product
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Category
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Variants
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Created At
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Status
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Actions
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="bg-white divide-y divide-gray-200">
//                   {filteredProducts.map((product) => {
//                     const categoryName = getCategoryName(product, categories)

//                     return (
//                       <tr
//                         key={product.id}
//                         className={!product.isActive ? "bg-gray-50 opacity-75" : ""}
//                       >
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <div className="flex items-center">
//                             <div
//                               className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
//                                 product.isActive ? "bg-gray-100" : "bg-gray-200"
//                               }`}
//                             >
//                               {getCategoryIcon(categoryName)}
//                             </div>
//                             <div className="ml-3">
//                               <p
//                                 className={`text-sm font-medium ${
//                                   product.isActive ? "text-gray-900" : "text-gray-500"
//                                 }`}
//                               >
//                                 {product.name}
//                               </p>
//                               <p className="text-sm text-gray-500">
//                                 {product.description || "No description"}
//                               </p>
//                             </div>
//                           </div>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
//                           {categoryName}
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                           <Badge variant="outline" className="bg-blue-50 text-blue-700">
//                             {product.hasVariants
//                               ? `${product.variantCount || 0} variants`
//                               : "No variants"}
//                           </Badge>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
//                           {new Date(product.createdAt).toLocaleDateString("en-GB", {
//                             day: "2-digit",
//                             month: "2-digit",
//                             year: "numeric",
//                           })}
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <Badge
//                             variant={product.isActive ? "default" : "secondary"}
//                             className={
//                               product.isActive ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"
//                             }
//                           >
//                             {product.isActive ? "Active" : "Disabled"}
//                           </Badge>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                           <div className="flex space-x-2">
//                             <Button
//                               variant="ghost"
//                               size="sm"
//                               onClick={() => handleToggleActive(product.id, product.isActive)}
//                               disabled={toggleProductMutation.isPending}
//                               className={
//                                 product.isActive
//                                   ? "text-orange-500 hover:text-orange-600"
//                                   : "text-green-500 hover:text-green-600"
//                               }
//                               title={product.isActive ? "Disable Product" : "Enable Product"}
//                             >
//                               {toggleProductMutation.isPending ? (
//                                 <Loader2 className="w-4 h-4 animate-spin" />
//                               ) : product.isActive ? (
//                                 <EyeOff className="w-4 h-4" />
//                               ) : (
//                                 <Eye className="w-4 h-4" />
//                               )}
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="sm"
//                               onClick={() => handleEditProduct(product)}
//                               className="text-purple-500 hover:text-purple-600"
//                               title="Edit Product"
//                             >
//                               <Edit className="w-4 h-4" />
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="sm"
//                               onClick={() => handleDeleteProduct(product.id, product.name)}
//                               disabled={deleteProductMutation.isPending}
//                               className="text-red-500 hover:text-red-600"
//                               title="Delete Product"
//                             >
//                               {deleteProductMutation.isPending ? (
//                                 <Loader2 className="w-4 h-4 animate-spin" />
//                               ) : (
//                                 <Trash2 className="w-4 h-4" />
//                               )}
//                             </Button>
//                           </div>
//                         </td>
//                       </tr>
//                     )
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </CardContent>
//       </Card>

//       {/* Modals */}
//       <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
//       <EditProductModal
//         open={showEditModal}
//         onOpenChange={setShowEditModal}
//         product={selectedProduct}
//       />
//     </div>
//   )
// }