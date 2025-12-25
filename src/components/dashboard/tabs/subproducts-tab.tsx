// app/dashboard/sub-products-tab.tsx
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
import { Plus, Search, AlertTriangle, Trash2, Eye, EyeOff, Download, Loader2, PackagePlus, Edit } from "lucide-react";
import { toast } from "sonner";
import AddSubProductModal from "@/components/modals/add-sub-product-modal";
import EditSubProductModal from "@/components/modals/edit-sub-product-modal";
import AddStockEntryModal from "@/components/modals/add-stock-entry-modal";

import type { 
  ApiResponse, 
  SubProduct, 
  SubProductsResponse, 
  SubProductFilterState,
} from "@/types/subproduct";
import type { Product, ProductsResponse } from "@/types/product";

export default function SubProductsTab() {
  const [filterState, setFilterState] = useState<SubProductFilterState>({
    searchTerm: "",
    selectedProduct: "all",
    showInactive: false,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSubProduct, setEditSubProduct] = useState<SubProduct | null>(null);
  const [stockSubProduct, setStockSubProduct] = useState<SubProduct | null>(null);

  const queryClient = useQueryClient();

  // Fetch sub-products
  const {
    data: subProductsResponse,
    isLoading: isSubProductsLoading,
    error: subProductsError,
    isError: isSubProductsError,
  } = useQuery<ApiResponse<SubProductsResponse>, Error>({
    queryKey: ["sub-products", filterState.showInactive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterState.showInactive) {
        params.append("includeInactive", "true");
      }

      const response = await fetch(`/api/sub-products?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sub-products: ${response.status} ${response.statusText}`);
      }

      const data: ApiResponse<SubProductsResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch sub-products");
      }

      return data;
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch products
  const {
    data: productsResponse,
    isLoading: isProductsLoading,
    error: productsError,
  } = useQuery<ApiResponse<ProductsResponse>, Error>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await fetch("/api/products");
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
    staleTime: 10 * 60 * 1000,
  });

  const subProducts = subProductsResponse?.data?.subProducts || [];
  const products = productsResponse?.data?.products || [];

  // Delete sub-product mutation
  const deleteSubProductMutation = useMutation<ApiResponse<null>, Error, string>({
    mutationFn: async (subProductId: string) => {
      const response = await fetch(`/api/sub-products/${subProductId}`, {
        method: "DELETE",
      });

      const result: ApiResponse<null> = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || `Failed to delete sub-product: ${response.status}`);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-products"] });
      toast.success("Sub-product deleted successfully.");
    },
    onError: (error: Error) => {
      console.error("Delete sub-product error:", error);
      toast.error(`Failed to delete sub-product: ${error.message}`);
    },
  });

  // Toggle sub-product status mutation
  const toggleSubProductMutation = useMutation<
    ApiResponse<SubProduct>,
    Error,
    { subProductId: string; isActive: boolean }
  >({
    mutationFn: async ({ subProductId, isActive }) => {
      const response = await fetch(`/api/sub-products/${subProductId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      const result: ApiResponse<SubProduct> = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || `Failed to update sub-product: ${response.status}`);
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub-products"] });
      toast.success("Sub-product status updated successfully.");
    },
    onError: (error: Error) => {
      console.error("Toggle sub-product error:", error);
      toast.error(`Failed to update sub-product: ${error.message}`);
    },
  });

  const productNameMap = useMemo(() => {
    return products.reduce((acc, product) => {
      acc[product._id] = product.name;
      return acc;
    }, {} as Record<string, string>);
  }, [products]);

  const getProductName = useCallback(
    (productId: string): string => {
      return productNameMap[productId] || "Unknown Product";
    },
    [productNameMap]
  );

  const filteredSubProducts = useMemo(() => {
    if (!Array.isArray(subProducts)) {
      console.warn("subProducts is not an array:", subProducts);
      return [];
    }

    return subProducts.filter((subProduct: SubProduct) => {
      if (!subProduct) return false;

      const searchTerm = filterState.searchTerm.toLowerCase().trim();
      const matchesSearch =
        !searchTerm ||
        subProduct.name?.toLowerCase().includes(searchTerm) ||
        subProduct.size?.toLowerCase().includes(searchTerm) ||
        subProduct.description?.toLowerCase().includes(searchTerm);

      const matchesProduct =
        filterState.selectedProduct === "all" || subProduct.parentProduct?._id === filterState.selectedProduct;

      return matchesSearch && matchesProduct;
    });
  }, [subProducts, filterState]);

  const handleFilterChange = useCallback((key: keyof SubProductFilterState, value: string | boolean) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleToggleActive = useCallback(
    (subProductId: string, currentStatus: boolean) => {
      toggleSubProductMutation.mutate({ subProductId, isActive: !currentStatus });
    },
    [toggleSubProductMutation]
  );

  const handleDeleteSubProduct = useCallback(
    (subProductId: string, subProductName: string) => {
      if (
        window.confirm(
          `Are you sure you want to delete "${subProductName}"? This action cannot be undone.`
        )
      ) {
        deleteSubProductMutation.mutate(subProductId);
      }
    },
    [deleteSubProductMutation]
  );

  // CLIENT-SIDE EXPORT
  const handleExport = useCallback(() => {
    try {
      const headers = [
        "Sub-Product Name",
        "Parent Product",
        "Category",
        "Size",
        "Weight",
        "Volume",
        "Barcode",
        "Description",
        "Status",
        "Created At",
      ];

      const rows = filteredSubProducts.map((subProduct: SubProduct) => {
        const productName = subProduct.parentProduct?.name || getProductName(subProduct.parentProduct._id);
        const categoryName = subProduct.parentProduct?.category?.name || "N/A";
        const createdDate = new Date(subProduct.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

        return [
          `"${subProduct.name}"`,
          `"${productName}"`,
          `"${categoryName}"`,
          `"${subProduct.size || "N/A"}"`,
          `"${subProduct.weight || "N/A"}"`,
          `"${subProduct.volume || "N/A"}"`,
          `"${subProduct.barcode || "N/A"}"`,
          `"${subProduct.description || "N/A"}"`,
          subProduct.isActive ? "Active" : "Disabled",
          createdDate,
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sub-products-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Sub-products exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export sub-products");
    }
  }, [filteredSubProducts, getProductName]);

  const isLoading = isSubProductsLoading || isProductsLoading;

  if (isSubProductsError) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Sub-Products</h3>
          <p className="text-gray-600 mb-4">
            {subProductsError instanceof Error ? subProductsError.message : "An unknown error occurred"}
          </p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["sub-products"] })} variant="outline">
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading sub-products...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sub-Products Management</h2>
          <p className="text-gray-600 mt-1">
            {filteredSubProducts.length} of {subProducts.length} sub-products
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleExport} variant="outline" disabled={filteredSubProducts.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Sub-Product
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Search Sub-Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Name, size, or description..."
                  value={filterState.searchTerm}
                  onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Parent Product</Label>
              <Select
                value={filterState.selectedProduct}
                onValueChange={(value) => handleFilterChange("selectedProduct", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {productsError && <p className="text-xs text-red-500 mt-1">Failed to load products</p>}
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Show Inactive</Label>
              <div className="flex items-center space-x-2 mt-3">
                <Switch
                  checked={filterState.showInactive}
                  onCheckedChange={(checked) => handleFilterChange("showInactive", checked)}
                />
                <span className="text-sm text-gray-600">Include disabled variants</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Sub-Products Inventory</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredSubProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sub-products found</h3>
              <p className="text-gray-500 mb-4">
                {subProducts.length === 0
                  ? "Get started by adding your first sub-product."
                  : "Try adjusting your search or filters."}
              </p>
              {subProducts.length === 0 && (
                <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Sub-Product
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sub Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size/Weight
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSubProducts.map((subProduct: SubProduct) => (
                    <tr key={subProduct._id} className={!subProduct.isActive ? "bg-gray-50 opacity-75" : ""}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {subProduct.imageURL ? (
                            <img
                              src={subProduct.imageURL}
                              alt={subProduct.name}
                              className="w-10 h-10 rounded-lg object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "";
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                                subProduct.isActive ? "bg-gray-100" : "bg-gray-200"
                              }`}
                            >
                              📦
                            </div>
                          )}
                          <div className="ml-3">
                            <p
                              className={`text-sm font-medium ${
                                subProduct.isActive ? "text-gray-900" : "text-gray-500"
                              }`}
                            >
                              {subProduct.name}
                            </p>
                            <p className="text-sm text-gray-500">{subProduct.description || "No description"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {subProduct.parentProduct?.name || getProductName(subProduct.parentProduct._id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {subProduct.parentProduct?.category?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {subProduct.size && <span className="font-medium">{subProduct.size}</span>}
                          {subProduct.weight && <div className="text-gray-500">{subProduct.weight}</div>}
                          {subProduct.volume && <div className="text-gray-500">{subProduct.volume}</div>}
                          {!subProduct.size && !subProduct.weight && !subProduct.volume && (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={subProduct.isActive ? "default" : "secondary"}
                          className={subProduct.isActive ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"}
                        >
                          {subProduct.isActive ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
                        {new Date(subProduct.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditSubProduct(subProduct)}
                            className="text-purple-500 hover:text-purple-600 hover:bg-purple-50"
                            title="Edit Sub-Product"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStockSubProduct(subProduct)}
                            className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                            title="Add Stock Entry"
                          >
                            <PackagePlus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(subProduct._id, subProduct.isActive)}
                            disabled={toggleSubProductMutation.isPending}
                            className={
                              subProduct.isActive
                                ? "text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                : "text-green-500 hover:text-green-600 hover:bg-green-50"
                            }
                            title={subProduct.isActive ? "Disable Sub-Product" : "Enable Sub-Product"}
                          >
                            {toggleSubProductMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : subProduct.isActive ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSubProduct(subProduct._id, subProduct.name)}
                            disabled={deleteSubProductMutation.isPending}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete Sub-Product"
                          >
                            {deleteSubProductMutation.isPending ? (
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

      <AddSubProductModal open={showAddModal} onOpenChange={setShowAddModal} />
      
      {editSubProduct && (
        <EditSubProductModal 
          open={!!editSubProduct} 
          onOpenChange={(open) => !open && setEditSubProduct(null)} 
          subProduct={editSubProduct} 
        />
      )}
      
      {stockSubProduct && (
        <AddStockEntryModal
          open={!!stockSubProduct}
          onOpenChange={(open) => !open && setStockSubProduct(null)}
          subProductId={stockSubProduct._id}
          subProductName={stockSubProduct.name}
          productId={stockSubProduct.parentProduct._id}
          categoryId={stockSubProduct.parentProduct.category._id}
        />
      )}
    </div>
  );
}



// //NOTE - Working - duplication
// // app/dashboard/sub-products-tab.tsx
// "use client";

// import { useState, useMemo, useCallback } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Badge } from "@/components/ui/badge";
// import { Switch } from "@/components/ui/switch";
// import { Plus, Search, AlertTriangle, Trash2, Eye, EyeOff, Download, Loader2, PackagePlus, Edit } from "lucide-react";
// import { toast } from "sonner";
// import AddSubProductModal from "@/components/modals/add-sub-product-modal";
// import EditSubProductModal from "@/components/modals/edit-sub-product-modal";
// import AddStockEntryModal from "@/components/modals/add-stock-entry-modal";

// import type { 
//   ApiResponse, 
//   SubProduct, 
//   SubProductsResponse, 
//   SubProductFilterState,
//   StockModalState
// } from "@/types/subproduct";
// import type { Product, ProductsResponse } from "@/types/product";

// export default function SubProductsTab() {
//   const [filterState, setFilterState] = useState<SubProductFilterState>({
//     searchTerm: "",
//     selectedProduct: "all",
//     showInactive: false,
//   });
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [showEditModal, setShowEditModal] = useState(false);
//   const [selectedSubProduct, setSelectedSubProduct] = useState<SubProduct | null>(null);
//   const [stockModalState, setStockModalState] = useState<StockModalState>({
//     open: false,
//     subProductId: "",
//     subProductName: "",
//     currentSellingPrice: 0,
//   });

//   const queryClient = useQueryClient();

//   // Fetch sub-products
//   const {
//     data: subProductsResponse,
//     isLoading: isSubProductsLoading,
//     error: subProductsError,
//     isError: isSubProductsError,
//   } = useQuery<ApiResponse<SubProductsResponse>, Error>({
//     queryKey: ["sub-products", filterState.showInactive],
//     queryFn: async () => {
//       const params = new URLSearchParams();
//       if (filterState.showInactive) {
//         params.append("includeInactive", "true");
//       }

//       const response = await fetch(`/api/sub-products?${params}`);
//       if (!response.ok) {
//         throw new Error(`Failed to fetch sub-products: ${response.status} ${response.statusText}`);
//       }

//       const data: ApiResponse<SubProductsResponse> = await response.json();

//       if (!data.success || !data.data) {
//         throw new Error(data.error?.message || "Failed to fetch sub-products");
//       }

//       return data;
//     },
//     retry: 2,
//     staleTime: 5 * 60 * 1000,
//     gcTime: 10 * 60 * 1000,
//   });

//   // Fetch products
//   const {
//     data: productsResponse,
//     isLoading: isProductsLoading,
//     error: productsError,
//   } = useQuery<ApiResponse<ProductsResponse>, Error>({
//     queryKey: ["products"],
//     queryFn: async () => {
//       const response = await fetch("/api/products");
//       if (!response.ok) {
//         throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
//       }

//       const data: ApiResponse<ProductsResponse> = await response.json();

//       if (!data.success || !data.data) {
//         throw new Error(data.error?.message || "Failed to fetch products");
//       }

//       return data;
//     },
//     retry: 2,
//     staleTime: 10 * 60 * 1000,
//   });

//   const subProducts = subProductsResponse?.data?.subProducts || [];
//   const products = productsResponse?.data?.products || [];

//   // Delete sub-product mutation
//   const deleteSubProductMutation = useMutation<ApiResponse<null>, Error, string>({
//     mutationFn: async (subProductId: string) => {
//       const response = await fetch(`/api/sub-products/${subProductId}`, {
//         method: "DELETE",
//       });

//       const result: ApiResponse<null> = await response.json();

//       if (!response.ok) {
//         throw new Error(result.error?.message || `Failed to delete sub-product: ${response.status}`);
//       }

//       return result;
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["sub-products"] });
//       toast.success("Sub-product deleted successfully.");
//     },
//     onError: (error: Error) => {
//       console.error("Delete sub-product error:", error);
//       toast.error(`Failed to delete sub-product: ${error.message}`);
//     },
//   });

//   // Toggle sub-product status mutation
//   const toggleSubProductMutation = useMutation<
//     ApiResponse<SubProduct>,
//     Error,
//     { subProductId: string; isActive: boolean }
//   >({
//     mutationFn: async ({ subProductId, isActive }) => {
//       const response = await fetch(`/api/sub-products/${subProductId}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ isActive }),
//       });

//       const result: ApiResponse<SubProduct> = await response.json();

//       if (!response.ok) {
//         throw new Error(result.error?.message || `Failed to update sub-product: ${response.status}`);
//       }

//       return result;
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["sub-products"] });
//       toast.success("Sub-product status updated successfully.");
//     },
//     onError: (error: Error) => {
//       console.error("Toggle sub-product error:", error);
//       toast.error(`Failed to update sub-product: ${error.message}`);
//     },
//   });

//   const productNameMap = useMemo(() => {
//     return products.reduce((acc, product) => {
//       acc[product._id] = product.name;
//       return acc;
//     }, {} as Record<string, string>);
//   }, [products]);

//   const getProductName = useCallback(
//     (productId: string): string => {
//       return productNameMap[productId] || "Unknown Product";
//     },
//     [productNameMap]
//   );

//   const filteredSubProducts = useMemo(() => {
//     if (!Array.isArray(subProducts)) {
//       console.warn("subProducts is not an array:", subProducts);
//       return [];
//     }

//     return subProducts.filter((subProduct: SubProduct) => {
//       if (!subProduct) return false;

//       const searchTerm = filterState.searchTerm.toLowerCase().trim();
//       const matchesSearch =
//         !searchTerm ||
//         subProduct.name?.toLowerCase().includes(searchTerm) ||
//         subProduct.size?.toLowerCase().includes(searchTerm) ||
//         subProduct.description?.toLowerCase().includes(searchTerm);

//       const matchesProduct =
//         filterState.selectedProduct === "all" || subProduct.parentProduct?._id === filterState.selectedProduct;

//       return matchesSearch && matchesProduct;
//     });
//   }, [subProducts, filterState]);

//   const handleFilterChange = useCallback((key: keyof SubProductFilterState, value: string | boolean) => {
//     setFilterState((prev) => ({ ...prev, [key]: value }));
//   }, []);

//   const handleToggleActive = useCallback(
//     (subProductId: string, currentStatus: boolean) => {
//       toggleSubProductMutation.mutate({ subProductId, isActive: !currentStatus });
//     },
//     [toggleSubProductMutation]
//   );

//   const handleDeleteSubProduct = useCallback(
//     (subProductId: string, subProductName: string) => {
//       if (
//         window.confirm(
//           `Are you sure you want to delete "${subProductName}"? This action cannot be undone.`
//         )
//       ) {
//         deleteSubProductMutation.mutate(subProductId);
//       }
//     },
//     [deleteSubProductMutation]
//   );

//   const handleAddStock = useCallback((subProduct: SubProduct) => {
//     setStockModalState({
//       open: true,
//       subProductId: subProduct._id,
//       subProductName: subProduct.name,
//       currentSellingPrice: 0, // Price removed from SubProduct
//     });
//   }, []);

//   const handleEditSubProduct = useCallback((subProduct: SubProduct) => {
//     setSelectedSubProduct(subProduct);
//     setShowEditModal(true);
//   }, []);

//   // CLIENT-SIDE EXPORT
//   const handleExport = useCallback(() => {
//     try {
//       const headers = [
//         "Sub-Product Name",
//         "Parent Product",
//         "Category",
//         "Size",
//         "Weight",
//         "Volume",
//         "Barcode",
//         "Description",
//         "Status",
//         "Created At",
//       ];

//       const rows = filteredSubProducts.map((subProduct: SubProduct) => {
//         const productName = subProduct.parentProduct?.name || getProductName(subProduct.parentProduct._id);
//         const categoryName = subProduct.parentProduct?.category?.name || "N/A";
//         const createdDate = new Date(subProduct.createdAt).toLocaleDateString("en-GB", {
//           day: "2-digit",
//           month: "2-digit",
//           year: "numeric",
//         });

//         return [
//           `"${subProduct.name}"`,
//           `"${productName}"`,
//           `"${categoryName}"`,
//           `"${subProduct.size || "N/A"}"`,
//           `"${subProduct.weight || "N/A"}"`,
//           `"${subProduct.volume || "N/A"}"`,
//           `"${subProduct.barcode || "N/A"}"`,
//           `"${subProduct.description || "N/A"}"`,
//           subProduct.isActive ? "Active" : "Disabled",
//           createdDate,
//         ].join(",");
//       });

//       const csvContent = [headers.join(","), ...rows].join("\n");

//       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
//       const url = window.URL.createObjectURL(blob);
//       const link = document.createElement("a");
//       link.href = url;
//       link.download = `sub-products-${new Date().toISOString().split("T")[0]}.csv`;
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);

//       toast.success("Sub-products exported successfully!");
//     } catch (error) {
//       console.error("Export error:", error);
//       toast.error("Failed to export sub-products");
//     }
//   }, [filteredSubProducts, getProductName]);

//   const isLoading = isSubProductsLoading || isProductsLoading;

//   if (isSubProductsError) {
//     return (
//       <Card className="p-8">
//         <div className="text-center">
//           <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
//           <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Sub-Products</h3>
//           <p className="text-gray-600 mb-4">
//             {subProductsError instanceof Error ? subProductsError.message : "An unknown error occurred"}
//           </p>
//           <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["sub-products"] })} variant="outline">
//             Try Again
//           </Button>
//         </div>
//       </Card>
//     );
//   }

//   if (isLoading) {
//     return (
//       <Card className="p-8">
//         <div className="text-center">
//           <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
//           <p className="text-gray-600">Loading sub-products...</p>
//         </div>
//       </Card>
//     );
//   }

//   return (
//     <div className="space-y-6">
//       <div className="flex justify-between items-center">
//         <div>
//           <h2 className="text-2xl font-bold text-gray-900">Sub-Products Management</h2>
//           <p className="text-gray-600 mt-1">
//             {filteredSubProducts.length} of {subProducts.length} sub-products
//           </p>
//         </div>
//         <div className="flex space-x-2">
//           <Button onClick={handleExport} variant="outline" disabled={filteredSubProducts.length === 0}>
//             <Download className="w-4 h-4 mr-2" />
//             Export
//           </Button>
//           <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
//             <Plus className="w-4 h-4 mr-2" />
//             Add Sub-Product
//           </Button>
//         </div>
//       </div>

//       <Card>
//         <CardContent className="p-6">
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">Search Sub-Products</Label>
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//                 <Input
//                   placeholder="Name, size, or description..."
//                   value={filterState.searchTerm}
//                   onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
//                   className="pl-10"
//                 />
//               </div>
//             </div>
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">Parent Product</Label>
//               <Select
//                 value={filterState.selectedProduct}
//                 onValueChange={(value) => handleFilterChange("selectedProduct", value)}
//               >
//                 <SelectTrigger>
//                   <SelectValue placeholder="All Products" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All Products</SelectItem>
//                   {products.map((product) => (
//                     <SelectItem key={product._id} value={product._id}>
//                       {product.name}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//               {productsError && <p className="text-xs text-red-500 mt-1">Failed to load products</p>}
//             </div>
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">Show Inactive</Label>
//               <div className="flex items-center space-x-2 mt-3">
//                 <Switch
//                   checked={filterState.showInactive}
//                   onCheckedChange={(checked) => handleFilterChange("showInactive", checked)}
//                 />
//                 <span className="text-sm text-gray-600">Include disabled variants</span>
//               </div>
//             </div>
//           </div>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardHeader>
//           <CardTitle className="text-lg font-semibold text-gray-900">Sub-Products Inventory</CardTitle>
//         </CardHeader>
//         <CardContent className="p-0">
//           {filteredSubProducts.length === 0 ? (
//             <div className="text-center py-12">
//               <div className="text-gray-400 mb-4">📦</div>
//               <h3 className="text-lg font-medium text-gray-900 mb-2">No sub-products found</h3>
//               <p className="text-gray-500 mb-4">
//                 {subProducts.length === 0
//                   ? "Get started by adding your first sub-product."
//                   : "Try adjusting your search or filters."}
//               </p>
//               {subProducts.length === 0 && (
//                 <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
//                   <Plus className="w-4 h-4 mr-2" />
//                   Add Sub-Product
//                 </Button>
//               )}
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full">
//                 <thead className="bg-gray-50">
//                   <tr>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Sub Product
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Product
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Category
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Size/Weight
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Status
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Created At
//                     </th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Actions
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="bg-white divide-y divide-gray-200">
//                   {filteredSubProducts.map((subProduct: SubProduct) => (
//                     <tr key={subProduct._id} className={!subProduct.isActive ? "bg-gray-50 opacity-75" : ""}>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="flex items-center">
//                           {subProduct.imageURL ? (
//                             <img
//                               src={subProduct.imageURL}
//                               alt={subProduct.name}
//                               className="w-10 h-10 rounded-lg object-cover"
//                               onError={(e) => {
//                                 e.currentTarget.src = "";
//                                 e.currentTarget.style.display = "none";
//                               }}
//                             />
//                           ) : (
//                             <div
//                               className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
//                                 subProduct.isActive ? "bg-gray-100" : "bg-gray-200"
//                               }`}
//                             >
//                               📦
//                             </div>
//                           )}
//                           <div className="ml-3">
//                             <p
//                               className={`text-sm font-medium ${
//                                 subProduct.isActive ? "text-gray-900" : "text-gray-500"
//                               }`}
//                             >
//                               {subProduct.name}
//                             </p>
//                             <p className="text-sm text-gray-500">{subProduct.description || "No description"}</p>
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                         {subProduct.parentProduct?.name || getProductName(subProduct.parentProduct._id)}
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                         {subProduct.parentProduct?.category?.name || "N/A"}
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="text-sm text-gray-900">
//                           {subProduct.size && <span className="font-medium">{subProduct.size}</span>}
//                           {subProduct.weight && <div className="text-gray-500">{subProduct.weight}</div>}
//                           {subProduct.volume && <div className="text-gray-500">{subProduct.volume}</div>}
//                           {!subProduct.size && !subProduct.weight && !subProduct.volume && (
//                             <span className="text-gray-400">N/A</span>
//                           )}
//                         </div>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <Badge
//                           variant={subProduct.isActive ? "default" : "secondary"}
//                           className={subProduct.isActive ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"}
//                         >
//                           {subProduct.isActive ? "Active" : "Disabled"}
//                         </Badge>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
//                         {new Date(subProduct.createdAt).toLocaleDateString("en-GB", {
//                           day: "2-digit",
//                           month: "2-digit",
//                           year: "numeric",
//                         })}
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                         <div className="flex space-x-1">
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             onClick={() => handleEditSubProduct(subProduct)}
//                             className="text-purple-500 hover:text-purple-600 hover:bg-purple-50"
//                             title="Edit Sub-Product"
//                           >
//                             <Edit className="w-4 h-4" />
//                           </Button>
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             onClick={() => handleAddStock(subProduct)}
//                             className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
//                             title="Add Stock Entry"
//                           >
//                             <PackagePlus className="w-4 h-4" />
//                           </Button>
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             onClick={() => handleToggleActive(subProduct._id, subProduct.isActive)}
//                             disabled={toggleSubProductMutation.isPending}
//                             className={
//                               subProduct.isActive
//                                 ? "text-orange-500 hover:text-orange-600 hover:bg-orange-50"
//                                 : "text-green-500 hover:text-green-600 hover:bg-green-50"
//                             }
//                             title={subProduct.isActive ? "Disable Sub-Product" : "Enable Sub-Product"}
//                           >
//                             {toggleSubProductMutation.isPending ? (
//                               <Loader2 className="w-4 h-4 animate-spin" />
//                             ) : subProduct.isActive ? (
//                               <EyeOff className="w-4 h-4" />
//                             ) : (
//                               <Eye className="w-4 h-4" />
//                             )}
//                           </Button>
//                           <Button
//                             variant="ghost"
//                             size="sm"
//                             onClick={() => handleDeleteSubProduct(subProduct._id, subProduct.name)}
//                             disabled={deleteSubProductMutation.isPending}
//                             className="text-red-500 hover:text-red-600 hover:bg-red-50"
//                             title="Delete Sub-Product"
//                           >
//                             {deleteSubProductMutation.isPending ? (
//                               <Loader2 className="w-4 h-4 animate-spin" />
//                             ) : (
//                               <Trash2 className="w-4 h-4" />
//                             )}
//                           </Button>
//                         </div>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </CardContent>
//       </Card>

//       <AddSubProductModal open={showAddModal} onOpenChange={setShowAddModal} />
//       <EditSubProductModal open={showEditModal} onOpenChange={setShowEditModal} subProduct={selectedSubProduct} />
//       <AddStockEntryModal
//         open={stockModalState.open}
//         onOpenChange={(open) => setStockModalState((prev) => ({ ...prev, open }))}
//         subProductId={stockModalState.subProductId}
//         subProductName={stockModalState.subProductName}
//         productId={stockModalState.productId}
//         categoryId={stockModalState.categoryId}
//       />
//     </div>
//   );
// }




// // "use client"

// // import { useState, useMemo, useCallback } from "react"
// // import { useQuery, useQueryClient } from "@tanstack/react-query"
// // import { Button } from "@/components/ui/button"
// // import { Input } from "@/components/ui/input"
// // import { Label } from "@/components/ui/label"
// // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// // import {
// //   Select,
// //   SelectContent,
// //   SelectItem,
// //   SelectTrigger,
// //   SelectValue,
// // } from "@/components/ui/select"
// // import { Badge } from "@/components/ui/badge"
// // import { Switch } from "@/components/ui/switch"
// // import {
// //   Plus,
// //   Search,
// //   AlertTriangle,
// //   Trash2,
// //   Eye,
// //   EyeOff,
// //   Download,
// //   Loader2,
// //   PackagePlus,
// //   Edit,
// // } from "lucide-react"
// // import { toast } from "sonner"
// // import AddSubProductModal from "@/components/modals/add-sub-product-modal"
// // import EditSubProductModal from "@/components/modals/edit-sub-product-modal"
// // import AddStockEntryModal from "@/components/modals/add-stock-entry-modal"
// // import {
// //   useDeleteSubProduct,
// //   useToggleSubProductStatus,
// // } from "@/hooks/use-sub-product-mutations"
// // import type { SubProductsListResponse, ProductsListResponse } from "@/types"
// // import { SubProduct } from "@/lib/types/subproduct"

// // // =============================================
// // // Types
// // // =============================================
// // interface Product {
// //   id: string
// //   name: string
// //   category: {
// //     id: string
// //     name: string
// //   }
// // }

// // interface FilterState {
// //   searchTerm: string
// //   selectedProduct: string
// //   showInactive: boolean
// // }

// // interface StockModalState {
// //   open: boolean
// //   subProductId: string
// //   subProductName: string
// //   currentSellingPrice: number
// // }

// // // =============================================
// // // Main Component
// // // =============================================
// // export default function SubProductsTab() {
// //   const [filterState, setFilterState] = useState<FilterState>({
// //     searchTerm: "",
// //     selectedProduct: "all",
// //     showInactive: false,
// //   })
// //   const [showAddModal, setShowAddModal] = useState(false)
// //   const [showEditModal, setShowEditModal] = useState(false)
// //   const [selectedSubProduct, setSelectedSubProduct] = useState<SubProduct | null>(null)
// //   const [stockModalState, setStockModalState] = useState<StockModalState>({
// //     open: false,
// //     subProductId: "",
// //     subProductName: "",
// //     currentSellingPrice: 0,
// //   })

// //   const queryClient = useQueryClient()

// //   // =============================================
// //   // Use New Mutation Hooks
// //   // =============================================
// //   const deleteSubProductMutation = useDeleteSubProduct()
// //   const toggleSubProductMutation = useToggleSubProductStatus()

// //   // =============================================
// //   // Fetch SubProducts Query
// //   // =============================================
// //   const {
// //     data: subProducts = [],
// //     isLoading: isSubProductsLoading,
// //     error: subProductsError,
// //     isError: isSubProductsError,
// //   } = useQuery<SubProduct[]>({
// //     queryKey: ["sub-products", filterState.showInactive],
// //     queryFn: async (): Promise<SubProduct[]> => {
// //       const params = new URLSearchParams()
// //       if (filterState.showInactive) {
// //         params.append("includeInactive", "true")
// //       }

// //       const response = await fetch(`/api/sub-products?${params}`)

// //       if (!response.ok) {
// //         throw new Error(`Failed to fetch sub-products: ${response.status}`)
// //       }

// //       const data: SubProductsListResponse = await response.json()

// //       if (!data.success || !data.data.subProducts) {
// //         throw new Error("Invalid response format")
// //       }

// //       return data.data.subProducts
// //     },
// //     retry: 2,
// //     staleTime: 5 * 60 * 1000,
// //     gcTime: 10 * 60 * 1000,
// //   })

// //   // =============================================
// //   // Fetch Products Query
// //   // =============================================
// //   const {
// //     data: products = [],
// //     isLoading: isProductsLoading,
// //     error: productsError,
// //   } = useQuery<Product[]>({
// //     queryKey: ["products"],
// //     queryFn: async (): Promise<Product[]> => {
// //       const response = await fetch("/api/products")

// //       if (!response.ok) {
// //         throw new Error(`Failed to fetch products: ${response.status}`)
// //       }

// //       const data: ProductsListResponse = await response.json()

// //       if (data.success && data.data.products) {
// //         return data.data.products.map((p) => ({
// //           id: p.id,
// //           name: p.name,
// //           category: p.category || { id: "", name: "No Category" },
// //         }))
// //       }

// //       return []
// //     },
// //     retry: 2,
// //     staleTime: 10 * 60 * 1000,
// //   })

// //   // =============================================
// //   // Product Name Map (Memoized)
// //   // =============================================
// //   const productNameMap = useMemo(() => {
// //     return products.reduce((acc, product) => {
// //       acc[product.id] = product.name
// //       return acc
// //     }, {} as Record<string, string>)
// //   }, [products])

// //   const getProductName = useCallback(
// //     (productId: string): string => {
// //       return productNameMap[productId] || "Unknown Product"
// //     },
// //     [productNameMap]
// //   )

// //   // =============================================
// //   // Filtered SubProducts (Memoized)
// //   // =============================================
// //   const filteredSubProducts = useMemo(() => {
// //     if (!Array.isArray(subProducts)) {
// //       console.warn("subProducts is not an array:", subProducts)
// //       return []
// //     }

// //     return subProducts.filter((subProduct) => {
// //       if (!subProduct) return false

// //       const searchTerm = filterState.searchTerm.toLowerCase().trim()
// //       const matchesSearch =
// //         !searchTerm ||
// //         subProduct.name?.toLowerCase().includes(searchTerm) ||
// //         subProduct.size?.toLowerCase().includes(searchTerm) ||
// //         subProduct.description?.toLowerCase().includes(searchTerm)

// //       const matchesProduct =
// //         filterState.selectedProduct === "all" ||
// //         subProduct.productId === filterState.selectedProduct

// //       return matchesSearch && matchesProduct
// //     })
// //   }, [subProducts, filterState])

// //   // =============================================
// //   // Event Handlers
// //   // =============================================
// //   const handleFilterChange = useCallback((key: keyof FilterState, value: string | boolean) => {
// //     setFilterState((prev) => ({ ...prev, [key]: value }))
// //   }, [])

// //   const handleToggleActive = useCallback(
// //     (subProductId: string, currentStatus: boolean) => {
// //       toggleSubProductMutation.mutate({ id: subProductId, isActive: !currentStatus })
// //     },
// //     [toggleSubProductMutation]
// //   )

// //   const handleDeleteSubProduct = useCallback(
// //     (subProductId: string, subProductName: string) => {
// //       if (
// //         window.confirm(
// //           `Are you sure you want to delete "${subProductName}"? This action cannot be undone.`
// //         )
// //       ) {
// //         deleteSubProductMutation.mutate(subProductId)
// //       }
// //     },
// //     [deleteSubProductMutation]
// //   )

// //   const handleAddStock = useCallback((subProduct: SubProduct) => {
// //     setStockModalState({
// //       open: true,
// //       subProductId: subProduct.id,
// //       subProductName: subProduct.name,
// //       currentSellingPrice: 0, // You might want to fetch this from stock transactions
// //     })
// //   }, [])

// //   const handleEditSubProduct = useCallback((subProduct: SubProduct) => {
// //     setSelectedSubProduct(subProduct)
// //     setShowEditModal(true)
// //   }, [])

// //   // =============================================
// //   // Export Functionality
// //   // =============================================
// //   const handleExport = useCallback(() => {
// //     try {
// //       const headers = [
// //         "Sub-Product Name",
// //         "Parent Product",
// //         "Category",
// //         "Size",
// //         "Weight",
// //         "Volume",
// //         "Barcode",
// //         "Description",
// //         "Status",
// //         "Created At",
// //       ]

// //       const rows = filteredSubProducts.map((subProduct) => {
// //         const productName = subProduct.parentProduct?.name || getProductName(subProduct.productId)
// //         const categoryName = subProduct.parentProduct?.category?.name || "N/A"
// //         const createdDate = new Date(subProduct.createdAt).toLocaleDateString("en-GB", {
// //           day: "2-digit",
// //           month: "2-digit",
// //           year: "numeric",
// //         })

// //         return [
// //           `"${subProduct.name}"`,
// //           `"${productName}"`,
// //           `"${categoryName}"`,
// //           `"${subProduct.size || "N/A"}"`,
// //           `"${subProduct.weight || "N/A"}"`,
// //           `"${subProduct.volume || "N/A"}"`,
// //           `"${subProduct.barcode || "N/A"}"`,
// //           `"${subProduct.description || "N/A"}"`,
// //           subProduct.isActive ? "Active" : "Disabled",
// //           createdDate,
// //         ].join(",")
// //       })

// //       const csvContent = [headers.join(","), ...rows].join("\n")

// //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
// //       const url = window.URL.createObjectURL(blob)
// //       const link = document.createElement("a")
// //       link.href = url
// //       link.download = `sub-products-${new Date().toISOString().split("T")[0]}.csv`
// //       document.body.appendChild(link)
// //       link.click()
// //       document.body.removeChild(link)
// //       window.URL.revokeObjectURL(url)

// //       toast.success("Sub-products exported successfully!")
// //     } catch (error) {
// //       console.error("Export error:", error)
// //       toast.error("Failed to export sub-products")
// //     }
// //   }, [filteredSubProducts, getProductName])

// //   const isLoading = isSubProductsLoading || isProductsLoading

// //   // =============================================
// //   // Error State
// //   // =============================================
// //   if (isSubProductsError) {
// //     return (
// //       <Card className="p-8">
// //         <div className="text-center">
// //           <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
// //           <h3 className="text-lg font-semibold text-gray-900 mb-2">
// //             Failed to Load Sub-Products
// //           </h3>
// //           <p className="text-gray-600 mb-4">
// //             {subProductsError instanceof Error
// //               ? subProductsError.message
// //               : "An unknown error occurred"}
// //           </p>
// //           <Button
// //             onClick={() => queryClient.invalidateQueries({ queryKey: ["sub-products"] })}
// //             variant="outline"
// //           >
// //             Try Again
// //           </Button>
// //         </div>
// //       </Card>
// //     )
// //   }

// //   // =============================================
// //   // Loading State
// //   // =============================================
// //   if (isLoading) {
// //     return (
// //       <Card className="p-8">
// //         <div className="text-center">
// //           <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
// //           <p className="text-gray-600">Loading sub-products...</p>
// //         </div>
// //       </Card>
// //     )
// //   }

// //   // =============================================
// //   // Main Render
// //   // =============================================
// //   return (
// //     <div className="space-y-6">
// //       {/* Header */}
// //       <div className="flex justify-between items-center">
// //         <div>
// //           <h2 className="text-2xl font-bold text-gray-900">Sub-Products Management</h2>
// //           <p className="text-gray-600 mt-1">
// //             {filteredSubProducts.length} of {subProducts.length} sub-products
// //           </p>
// //         </div>
// //         <div className="flex space-x-2">
// //           <Button
// //             onClick={handleExport}
// //             variant="outline"
// //             disabled={filteredSubProducts.length === 0}
// //           >
// //             <Download className="w-4 h-4 mr-2" />
// //             Export
// //           </Button>
// //           <Button
// //             onClick={() => setShowAddModal(true)}
// //             className="bg-blue-500 hover:bg-blue-600 text-white"
// //           >
// //             <Plus className="w-4 h-4 mr-2" />
// //             Add Sub-Product
// //           </Button>
// //         </div>
// //       </div>

// //       {/* Search and Filter */}
// //       <Card>
// //         <CardContent className="p-6">
// //           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">
// //                 Search Sub-Products
// //               </Label>
// //               <div className="relative">
// //                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// //                 <Input
// //                   placeholder="Name, size, or description..."
// //                   value={filterState.searchTerm}
// //                   onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
// //                   className="pl-10"
// //                 />
// //               </div>
// //             </div>
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">
// //                 Parent Product
// //               </Label>
// //               <Select
// //                 value={filterState.selectedProduct}
// //                 onValueChange={(value) => handleFilterChange("selectedProduct", value)}
// //               >
// //                 <SelectTrigger>
// //                   <SelectValue placeholder="All Products" />
// //                 </SelectTrigger>
// //                 <SelectContent>
// //                   <SelectItem value="all">All Products</SelectItem>
// //                   {products.map((product) => (
// //                     <SelectItem key={product.id} value={product.id}>
// //                       {product.name}
// //                     </SelectItem>
// //                   ))}
// //                 </SelectContent>
// //               </Select>
// //               {productsError && (
// //                 <p className="text-xs text-red-500 mt-1">Failed to load products</p>
// //               )}
// //             </div>
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">
// //                 Show Inactive
// //               </Label>
// //               <div className="flex items-center space-x-2 mt-3">
// //                 <Switch
// //                   checked={filterState.showInactive}
// //                   onCheckedChange={(checked) => handleFilterChange("showInactive", checked)}
// //                 />
// //                 <span className="text-sm text-gray-600">Include disabled variants</span>
// //               </div>
// //             </div>
// //           </div>
// //         </CardContent>
// //       </Card>

// //       {/* SubProducts List */}
// //       <Card>
// //         <CardHeader>
// //           <CardTitle className="text-lg font-semibold text-gray-900">
// //             Sub-Products Inventory
// //           </CardTitle>
// //         </CardHeader>
// //         <CardContent className="p-0">
// //           {filteredSubProducts.length === 0 ? (
// //             <div className="text-center py-12">
// //               <div className="text-gray-400 mb-4">📦</div>
// //               <h3 className="text-lg font-medium text-gray-900 mb-2">No sub-products found</h3>
// //               <p className="text-gray-500 mb-4">
// //                 {subProducts.length === 0
// //                   ? "Get started by adding your first sub-product."
// //                   : "Try adjusting your search or filters."}
// //               </p>
// //               {subProducts.length === 0 && (
// //                 <Button
// //                   onClick={() => setShowAddModal(true)}
// //                   className="bg-blue-500 hover:bg-blue-600 text-white"
// //                 >
// //                   <Plus className="w-4 h-4 mr-2" />
// //                   Add Sub-Product
// //                 </Button>
// //               )}
// //             </div>
// //           ) : (
// //             <div className="overflow-x-auto">
// //               <table className="w-full">
// //                 <thead className="bg-gray-50">
// //                   <tr>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                       Sub Product
// //                     </th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                       Product
// //                     </th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                       Category
// //                     </th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                       Size/Weight
// //                     </th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                       Status
// //                     </th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                       Created At
// //                     </th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                       Actions
// //                     </th>
// //                   </tr>
// //                 </thead>
// //                 <tbody className="bg-white divide-y divide-gray-200">
// //                   {filteredSubProducts.map((subProduct) => (
// //                     <tr
// //                       key={subProduct.id}
// //                       className={!subProduct.isActive ? "bg-gray-50 opacity-75" : ""}
// //                     >
// //                       <td className="px-6 py-4 whitespace-nowrap">
// //                         <div className="flex items-center">
// //                           {subProduct.imageURL ? (
// //                             <img
// //                               src={subProduct.imageURL}
// //                               alt={subProduct.name}
// //                               className="w-10 h-10 rounded-lg object-cover"
// //                               onError={(e) => {
// //                                 e.currentTarget.style.display = "none"
// //                               }}
// //                             />
// //                           ) : (
// //                             <div
// //                               className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
// //                                 subProduct.isActive ? "bg-gray-100" : "bg-gray-200"
// //                               }`}
// //                             >
// //                               📦
// //                             </div>
// //                           )}
// //                           <div className="ml-3">
// //                             <p
// //                               className={`text-sm font-medium ${
// //                                 subProduct.isActive ? "text-gray-900" : "text-gray-500"
// //                               }`}
// //                             >
// //                               {subProduct.name}
// //                             </p>
// //                             <p className="text-sm text-gray-500">
// //                               {subProduct.description || "No description"}
// //                             </p>
// //                           </div>
// //                         </div>
// //                       </td>
// //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
// //                         {subProduct.parentProduct?.name || getProductName(subProduct.productId)}
// //                       </td>
// //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 ">
// //                         {subProduct.parentProduct?.category?.name || "N/A"}
// //                       </td>
// //                       <td className="px-6 py-4 whitespace-nowrap">
// //                         <div className="text-sm text-gray-900">
// //                           {subProduct.size && (
// //                             <span className="font-medium">{subProduct.size}</span>
// //                           )}
// //                           {subProduct.weight && (
// //                             <div className="text-gray-500">{subProduct.weight}</div>
// //                           )}
// //                           {subProduct.volume && (
// //                             <div className="text-gray-500">{subProduct.volume}</div>
// //                           )}
// //                           {!subProduct.size && !subProduct.weight && !subProduct.volume && (
// //                             <span className="text-gray-400">N/A</span>
// //                           )}
// //                         </div>
// //                       </td>
// //                       <td className="px-6 py-4 whitespace-nowrap">
// //                         <Badge
// //                           variant={subProduct.isActive ? "default" : "secondary"}
// //                           className={
// //                             subProduct.isActive
// //                               ? "bg-green-500 hover:bg-green-600"
// //                               : "bg-gray-400"
// //                           }
// //                         >
// //                           {subProduct.isActive ? "Active" : "Disabled"}
// //                         </Badge>
// //                       </td>
// //                       <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">
// //                         {new Date(subProduct.createdAt).toLocaleDateString("en-GB", {
// //                           day: "2-digit",
// //                           month: "2-digit",
// //                           year: "numeric",
// //                         })}
// //                       </td>
// //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
// //                         <div className="flex space-x-1">
// //                           <Button
// //                             variant="ghost"
// //                             size="sm"
// //                             onClick={() => handleEditSubProduct(subProduct)}
// //                             className="text-purple-500 hover:text-purple-600 hover:bg-purple-50"
// //                             title="Edit Sub-Product"
// //                           >
// //                             <Edit className="w-4 h-4" />
// //                           </Button>
// //                           <Button
// //                             variant="ghost"
// //                             size="sm"
// //                             onClick={() => handleAddStock(subProduct)}
// //                             className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
// //                             title="Add Stock Entry"
// //                           >
// //                             <PackagePlus className="w-4 h-4" />
// //                           </Button>
// //                           <Button
// //                             variant="ghost"
// //                             size="sm"
// //                             onClick={() =>
// //                               handleToggleActive(subProduct.id, subProduct.isActive)
// //                             }
// //                             disabled={toggleSubProductMutation.isPending}
// //                             className={
// //                               subProduct.isActive
// //                                 ? "text-orange-500 hover:text-orange-600 hover:bg-orange-50"
// //                                 : "text-green-500 hover:text-green-600 hover:bg-green-50"
// //                             }
// //                             title={
// //                               subProduct.isActive ? "Disable Sub-Product" : "Enable Sub-Product"
// //                             }
// //                           >
// //                             {toggleSubProductMutation.isPending ? (
// //                               <Loader2 className="w-4 h-4 animate-spin" />
// //                             ) : subProduct.isActive ? (
// //                               <EyeOff className="w-4 h-4" />
// //                             ) : (
// //                               <Eye className="w-4 h-4" />
// //                             )}
// //                           </Button>
// //                           <Button
// //                             variant="ghost"
// //                             size="sm"
// //                             onClick={() =>
// //                               handleDeleteSubProduct(subProduct.id, subProduct.name)
// //                             }
// //                             disabled={deleteSubProductMutation.isPending}
// //                             className="text-red-500 hover:text-red-600 hover:bg-red-50"
// //                             title="Delete Sub-Product"
// //                           >
// //                             {deleteSubProductMutation.isPending ? (
// //                               <Loader2 className="w-4 h-4 animate-spin" />
// //                             ) : (
// //                               <Trash2 className="w-4 h-4" />
// //                             )}
// //                           </Button>
// //                         </div>
// //                       </td>
// //                     </tr>
// //                   ))}
// //                 </tbody>
// //               </table>
// //             </div>
// //           )}
// //         </CardContent>
// //       </Card>

// //       {/* Modals */}
// //       <AddSubProductModal open={showAddModal} onOpenChange={setShowAddModal} />
// //       <EditSubProductModal
// //         open={showEditModal}
// //         onOpenChange={setShowEditModal}
// //         subProduct={selectedSubProduct}
// //       />
// //       <AddStockEntryModal
// //         open={stockModalState.open}
// //         onOpenChange={(open) => setStockModalState((prev) => ({ ...prev, open }))}
// //         subProductId={stockModalState.subProductId}
// //         subProductName={stockModalState.subProductName}
// //         currentSellingPrice={stockModalState.currentSellingPrice}
// //         mode="add"
// //       />
// //     </div>
// //   )
// // }