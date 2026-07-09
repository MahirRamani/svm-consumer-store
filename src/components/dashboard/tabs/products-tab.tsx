// app/dashboard/products-tab.tsx
"use client";

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Edit, Search, Trash2, Eye, EyeOff, Download, Loader2, 
  AlertTriangle, PackagePlus, FileSpreadsheet, ArrowLeft, ChevronRight
} from "lucide-react";
import { toast } from 'sonner';
import AddProductModal from '@/components/modals/add-product-modal';
import EditProductModal from '@/components/modals/edit-product-modal';
import AddStockEntryModal from '@/components/modals/add-stock-entry-modal';
import StockReportModal from '@/components/modals/stock-report-modal';

import type { Product, ProductsResponse, ProductFilterState } from '@/types/seller/product';
import type { Category, CategoriesResponse } from '@/types/seller/category';
import { ApiResponse } from '@/lib/api/base-handler';

// Helper function to format stock entries as "latest + ... + oldest"
const formatStockEntries = (entries: Array<{ quantity: number; createdAt: string }> | undefined) => {
  if (!entries || entries.length === 0) {
    return <span className="text-gray-400">No stock</span>;
  }
  
  // Sort by date descending (latest first)
  const sorted = [...entries].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return (
    <div className="flex items-center flex-wrap gap-0.5 font-mono text-xs">
      {sorted.map((entry, i) => (
        <span key={i} className="flex items-center">
          <span 
            className={`inline-block px-1.5 py-0.5 rounded font-medium ${
              i === sorted.length - 1 && sorted.length > 1? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {entry.quantity}
          </span>
          {i < sorted.length - 1 && (
            <span className="text-gray-400 mx-0.5">+</span>
          )}
        </span>
      ))}
    </div>
  );
};

// Helper function to calculate total stock
const getTotalStock = (entries: Array<{ quantity: number; createdAt: string }> | undefined): number => {
  if (!entries || entries.length === 0) return 0;
  return entries.reduce((sum, e) => sum + e.quantity, 0);
};

export default function ProductsTab() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [filterState, setFilterState] = useState<ProductFilterState>({
    searchTerm: "",
    selectedCategory: "all",
    showInactive: false,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [showStockReportModal, setShowStockReportModal] = useState(false);
  const [stockReportProductId, setStockReportProductId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const {
    data: productsResponse,
    isLoading: productsLoading,
    error: productsError,
    isError: isProductsError,
  } = useQuery<ApiResponse<ProductsResponse>, Error>({
    queryKey: ["products", filterState.showInactive],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterState.showInactive) params.append("includeInactive", "true");

      const response = await fetch(`/api/products?sortBy=name&sortOrder=asc&${params}`);
      if (!response.ok) throw new Error(`Failed to fetch products: ${response.status}`);

      const data: ApiResponse<ProductsResponse> = await response.json();
      if (!data.success || !data.data) throw new Error(data.error?.message || "Failed to fetch products");

      return data;
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoriesResponse } = useQuery<ApiResponse<CategoriesResponse>, Error>({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");

      const data: ApiResponse<CategoriesResponse> = await response.json();
      if (!data.success || !data.data) throw new Error(data.error?.message || "Failed to fetch categories");

      return data;
    },
  });

  const products = productsResponse?.data?.products || [];
  const categories = categoriesResponse?.data?.categories || [];

  const deleteProductMutation = useMutation<ApiResponse<null>, Error, string>({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      const result: ApiResponse<null> = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Failed to delete product");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted successfully.");
    },
    onError: (error: Error) => toast.error(`Failed to delete product: ${error.message}`),
  });

  const toggleProductMutation = useMutation<ApiResponse<Product>, Error, { productId: string; isActive: boolean }>({
    mutationFn: async ({ productId, isActive }) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const result: ApiResponse<Product> = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Failed to update product");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product status updated successfully.");
    },
    onError: (error: Error) => toast.error(`Failed to update product: ${error.message}`),
  });

  const getCategoryIcon = useCallback((categoryName: string): string => {
    switch (categoryName.toLowerCase()) {
      case "food": return "🍜";
      case "stationery": return "📚";
      case "daily use": return "🧴";
      case "pooja": return "🔥";
      default: return "📦";
    }
  }, []);

  const getCategoryName = useCallback((product: Product): string => {
    if (product.category && typeof product.category === "object" && "name" in product.category) {
      return product.category.name;
    }
    const category = categories.find((cat) => cat._id === product.categoryId);
    return category?.name || "Uncategorized";
  }, [categories]);

  const getCategoryId = useCallback((product: Product): string => {
    if (product.category && typeof product.category === "object" && "_id" in product.category) {
      return product.category._id;
    }
    return product.categoryId;
  }, []);

  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((product: Product) => {
      if (product?.categoryId) counts[product.categoryId] = (counts[product.categoryId] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredCategories = useMemo(() => {
    if (!categorySearchTerm.trim()) return categories;
    return categories.filter((cat) => cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()));
  }, [categories, categorySearchTerm]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return [];
    
    return products.filter((product: Product) => {
      if (!product || product.categoryId !== selectedCategoryId) return false;

      const searchTerm = filterState.searchTerm.toLowerCase().trim();
      return !searchTerm || 
        product.name?.toLowerCase().includes(searchTerm) ||
        product.description?.toLowerCase().includes(searchTerm) ||
        product.size?.toLowerCase().includes(searchTerm) ||
        product.barcode?.toLowerCase().includes(searchTerm);
    });
  }, [products, selectedCategoryId, filterState.searchTerm]);

  // Get products filtered by selected category for stock report
  const categoryFilteredProducts = useMemo(() => {
    if (!selectedCategoryId) return products;
    return products.filter((product: Product) => product.categoryId === selectedCategoryId);
  }, [products, selectedCategoryId]);

  const handleExportAll = useCallback(() => {
    try {
      const headers = ["Product Name", "Category", "Size", "Weight", "Volume", "Total Stock", "Low Stock Threshold", "Description", "Status", "Created At"];
      const rows = products.map((p: Product) => [
        `"${p.name}"`, `"${getCategoryName(p)}"`, `"${p.size || "N/A"}"`, `"${p.weight || "N/A"}"`,
        `"${p.volume || "N/A"}"`, getTotalStock(p.stockEntries), p.lowStockThreshold || 10,
        `"${p.description || "N/A"}"`, p.isActive ? "Active" : "Disabled",
        new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
      ].join(","));

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `all-products-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("All products exported!");
    } catch (error) {
      toast.error("Failed to export products");
    }
  }, [products, getCategoryName]);

  const handleExportCategory = useCallback(() => {
    const category = categories.find(c => c._id === selectedCategoryId);
    if (!category) return;

    try {
      const headers = ["Product Name", "Category", "Size", "Weight", "Volume", "Total Stock", "Low Stock Threshold", "Description", "Status", "Created At"];
      const rows = filteredProducts.map((p: Product) => [
        `"${p.name}"`, `"${category.name}"`, `"${p.size || "N/A"}"`, `"${p.weight || "N/A"}"`,
        `"${p.volume || "N/A"}"`, getTotalStock(p.stockEntries), p.lowStockThreshold || 10,
        `"${p.description || "N/A"}"`, p.isActive ? "Active" : "Disabled",
        new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
      ].join(","));

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${category.name.toLowerCase()}-products-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`${category.name} products exported!`);
    } catch (error) {
      toast.error("Failed to export products");
    }
  }, [filteredProducts, selectedCategoryId, categories]);

  if (isProductsError) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to Load Products</h3>
          <p className="text-gray-600 mb-4">{productsError instanceof Error ? productsError.message : "Unknown error"}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["products"] })} variant="outline">Try Again</Button>
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

  // STEP 1: Category Selection (ORIGINAL SIZE)
  if (!selectedCategoryId) {
    return (
      <div className="">
        {/* <div className="flex justify-between items-center"> */}
          {/* <h2 className="text-2xl font-bold text-gray-900">Select Category</h2> */}
        {/* </div> */}

        <Card className="mt-0 mb-1.5 p-0 overflow-auto">
          <div className="flex space-x-2 p-1.5 justify-between items-center">
            <div>
              <CardContent className="p-2">
                <Label className="block text-sm font-medium text-gray-700 mb-2">Search Categories</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input placeholder="Search for a category..." value={categorySearchTerm} onChange={(e) => setCategorySearchTerm(e.target.value)} className="pl-10" />
                </div>
              </CardContent>
            </div>
            <div className="flex space-x-2">
              <Button onClick={() => setShowStockReportModal(true)} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                <FileSpreadsheet className="w-4 h-4 mr-2" />Stock Report
              </Button>
              <Button onClick={handleExportAll} variant="outline" disabled={products.length === 0}>
                <Download className="w-4 h-4 mr-2" />Export All
              </Button>
              <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
                <Plus className="w-4 h-4 mr-2" />Add Product
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-2 overflow-auto gap-0.5">
          <CardHeader className="p-1 m-0">
            <CardTitle className="">Available Categories ({filteredCategories.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-1 mt-0">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-medium mb-2">No categories found</h3>
                <p className="text-gray-500">Try adjusting your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-9 gap-1.5">
                {filteredCategories.map((category) => (
                  <Card key={category._id} className="cursor-pointer transition-all hover:shadow-lg hover:scale-102 border-2 hover:border-blue-400" onClick={() => setSelectedCategoryId(category._id)}>
                    <CardContent className="p-0 text-center overflow-auto">
                      <div className="text-5xl mb-3">{getCategoryIcon(category.name)}</div>
                      <h3 className="font-semibold text-lg capitalize mb-1.5">{category.name}</h3>
                      <div className="flex items-center justify-center space-x-2">
                        <p className="text-3xl font-bold text-blue-600">{categoryProductCounts[category._id] || 0}</p>
                        <span className="text-sm text-gray-500">{(categoryProductCounts[category._id] || 0) === 1 ? "product" : "products"}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-center text-blue-500 text-sm font-medium">
                        View Products<ChevronRight className="w-4 h-4 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
        <StockReportModal 
          open={showStockReportModal} 
          onOpenChange={setShowStockReportModal} 
          products={products} 
          preSelectedProductId={stockReportProductId} 
        />
      </div>
    );
  }

  // STEP 2: Products List with Stock Information (Barcode removed, Stock added)
  const selectedCategory = categories.find(c => c._id === selectedCategoryId);
  const categoryName = selectedCategory?.name || "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Button onClick={() => setSelectedCategoryId(null)} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />Back
          </Button>
          <h2 className="text-2xl font-bold capitalize flex items-center">
            <span className="text-3xl mr-2">{getCategoryIcon(categoryName)}</span>{categoryName} Products
          </h2>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowStockReportModal(true)} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
            <FileSpreadsheet className="w-4 h-4 mr-2" />Stock Report
          </Button>
          <Button onClick={handleExportCategory} variant="outline" disabled={filteredProducts.length === 0}>
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
            <Plus className="w-4 h-4 mr-2" />Add Product
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Search Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Name, size, barcode..." value={filterState.searchTerm} onChange={(e) => setFilterState(p => ({ ...p, searchTerm: e.target.value }))} className="pl-10" />
              </div>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Show Inactive Products</Label>
              <div className="flex items-center space-x-2 mt-3">
                <Switch checked={filterState.showInactive} onCheckedChange={(checked) => setFilterState(p => ({ ...p, showInactive: checked }))} />
                <span className="text-sm text-gray-600">Include disabled products</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>Products Inventory</CardTitle>
            <p className="text-sm text-gray-600 pt-1">[{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}]</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">{getCategoryIcon(categoryName)}</div>
              <h3 className="text-lg font-medium mb-2">No products found</h3>
              <p className="text-gray-500 mb-4">{filterState.searchTerm ? "Try adjusting your search." : `No products in ${categoryName} yet.`}</p>
              <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
                <Plus className="w-4 h-4 mr-2" />Add Product
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size/Weight</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock (Latest → Oldest)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product: Product) => {
                    const totalStock = getTotalStock(product.stockEntries);
                    const isLowStock = totalStock < (product.lowStockThreshold || 20);
                    
                    return (
                      <tr key={product._id} className={!product.isActive ? "bg-gray-50 opacity-75" : ""}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {product.imageURL ? (
                              <img src={product.imageURL} alt={product.name} className="w-10 h-10 rounded-lg object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                            ) : (
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${product.isActive ? "bg-gray-100" : "bg-gray-200"}`}>
                                {getCategoryIcon(categoryName)}
                              </div>
                            )}
                            <div className="ml-3">
                              <p className={`text-sm font-medium ${product.isActive ? "text-gray-900" : "text-gray-500"}`}>{product.name}</p>
                              <p className="text-sm text-gray-500 truncate max-w-xs">{product.description || "No description"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {product.size && <span className="font-medium">{product.size}</span>}
                          {product.weight && <div className="text-gray-500">{product.weight}</div>}
                          {product.volume && <div className="text-gray-500">{product.volume}</div>}
                          {!product.size && !product.weight && !product.volume && <span className="text-gray-400">N/A</span>}
                        </td>
                        <td className="px-6 py-4">
                          {formatStockEntries(product.stockEntries)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${
                            isLowStock ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {totalStock}
                            {isLowStock && <AlertTriangle className="w-4 h-4 ml-1" />}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={product.isActive ? "default" : "secondary"} className={product.isActive ? "bg-green-500" : "bg-gray-400"}>
                            {product.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => { setStockReportProductId(product._id); setShowStockReportModal(true); }} className="text-green-500 hover:bg-green-50" title="Stock Report">
                              <FileSpreadsheet className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setStockProduct(product)} className="text-blue-500 hover:bg-blue-50" title="Add Stock">
                              <PackagePlus className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedProduct(product); setShowEditModal(true); }} className="text-purple-500 hover:bg-purple-50" title="Edit">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => toggleProductMutation.mutate({ productId: product._id, isActive: !product.isActive })} disabled={toggleProductMutation.isPending} className={product.isActive ? "text-orange-500 hover:bg-orange-50" : "text-green-500 hover:bg-green-50"}>
                              {toggleProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : product.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Delete "${product.name}"?`)) deleteProductMutation.mutate(product._id); }} disabled={deleteProductMutation.isPending} className="text-red-500 hover:bg-red-50">
                              {deleteProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
      <EditProductModal open={showEditModal} onOpenChange={setShowEditModal} product={selectedProduct} />
      {stockProduct && (
        <AddStockEntryModal open={!!stockProduct} onOpenChange={(open) => !open && setStockProduct(null)} productId={stockProduct._id} productName={stockProduct.name} categoryId={getCategoryId(stockProduct)} />
      )}
      <StockReportModal 
        open={showStockReportModal} 
        onOpenChange={(open) => { 
          setShowStockReportModal(open); 
          if (!open) setStockReportProductId(null); 
        }} 
        products={categoryFilteredProducts} 
        preSelectedProductId={stockReportProductId}
        categoryId={selectedCategoryId}
      />
    </div>
  );
}



// // app/dashboard/products-tab.tsx
// "use client";

// import { useState, useMemo, useCallback } from 'react';
// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
// import { Switch } from '@/components/ui/switch';
// import { 
//   Plus, Edit, Search, Trash2, Eye, EyeOff, Download, Loader2, 
//   AlertTriangle, PackagePlus, FileSpreadsheet, ArrowLeft, ChevronRight
// } from "lucide-react";
// import { toast } from 'sonner';
// import AddProductModal from '@/components/modals/add-product-modal';
// import EditProductModal from '@/components/modals/edit-product-modal';
// import AddStockEntryModal from '@/components/modals/add-stock-entry-modal';
// import StockReportModal from '@/components/modals/stock-report-modal';

// import type { 
//   ApiResponse, Product, ProductsResponse, ProductFilterState 
// } from "@/types/product";
// import type { Category, CategoriesResponse } from '@/types/category';

// export default function ProductsTab() {
//   const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
//   const [categorySearchTerm, setCategorySearchTerm] = useState("");
//   const [filterState, setFilterState] = useState<ProductFilterState>({
//     searchTerm: "",
//     selectedCategory: "all",
//     showInactive: false,
//   });
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [showEditModal, setShowEditModal] = useState(false);
//   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
//   const [stockProduct, setStockProduct] = useState<Product | null>(null);
//   const [showStockReportModal, setShowStockReportModal] = useState(false);
//   const [stockReportProductId, setStockReportProductId] = useState<string | null>(null);
  
//   const queryClient = useQueryClient();

//   const {
//     data: productsResponse,
//     isLoading: productsLoading,
//     error: productsError,
//     isError: isProductsError,
//   } = useQuery<ApiResponse<ProductsResponse>, Error>({
//     queryKey: ["products", filterState.showInactive],
//     queryFn: async () => {
//       const params = new URLSearchParams();
//       if (filterState.showInactive) params.append("includeInactive", "true");

//       const response = await fetch(`/api/products?${params}`);
//       if (!response.ok) throw new Error(`Failed to fetch products: ${response.status}`);

//       const data: ApiResponse<ProductsResponse> = await response.json();
//       if (!data.success || !data.data) throw new Error(data.error?.message || "Failed to fetch products");

//       return data;
//     },
//     retry: 2,
//     staleTime: 5 * 60 * 1000,
//   });

//   const { data: categoriesResponse } = useQuery<ApiResponse<CategoriesResponse>, Error>({
//     queryKey: ["categories"],
//     queryFn: async () => {
//       const response = await fetch("/api/categories");
//       if (!response.ok) throw new Error("Failed to fetch categories");

//       const data: ApiResponse<CategoriesResponse> = await response.json();
//       if (!data.success || !data.data) throw new Error(data.error?.message || "Failed to fetch categories");

//       return data;
//     },
//   });

//   const products = productsResponse?.data?.products || [];
//   const categories = categoriesResponse?.data?.categories || [];

//   const deleteProductMutation = useMutation<ApiResponse<null>, Error, string>({
//     mutationFn: async (productId: string) => {
//       const response = await fetch(`/api/products/${productId}`, { method: "DELETE" });
//       const result: ApiResponse<null> = await response.json();
//       if (!response.ok) throw new Error(result.error?.message || "Failed to delete product");
//       return result;
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["products"] });
//       toast.success("Product deleted successfully.");
//     },
//     onError: (error: Error) => toast.error(`Failed to delete product: ${error.message}`),
//   });

//   const toggleProductMutation = useMutation<ApiResponse<Product>, Error, { productId: string; isActive: boolean }>({
//     mutationFn: async ({ productId, isActive }) => {
//       const response = await fetch(`/api/products/${productId}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ isActive }),
//       });
//       const result: ApiResponse<Product> = await response.json();
//       if (!response.ok) throw new Error(result.error?.message || "Failed to update product");
//       return result;
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["products"] });
//       toast.success("Product status updated successfully.");
//     },
//     onError: (error: Error) => toast.error(`Failed to update product: ${error.message}`),
//   });

//   const getCategoryIcon = useCallback((categoryName: string): string => {
//     switch (categoryName.toLowerCase()) {
//       case "food": return "🍜";
//       case "stationery": return "📚";
//       case "daily use": return "🧴";
//       case "pooja": return "🔥";
//       default: return "📦";
//     }
//   }, []);

//   const getCategoryName = useCallback((product: Product): string => {
//     if (product.category && typeof product.category === "object" && "name" in product.category) {
//       return product.category.name;
//     }
//     const category = categories.find((cat) => cat._id === product.categoryId);
//     return category?.name || "Uncategorized";
//   }, [categories]);

//   const getCategoryId = useCallback((product: Product): string => {
//     if (product.category && typeof product.category === "object" && "_id" in product.category) {
//       return product.category._id;
//     }
//     return product.categoryId;
//   }, []);

//   const categoryProductCounts = useMemo(() => {
//     const counts: Record<string, number> = {};
//     products.forEach((product: Product) => {
//       if (product?.categoryId) counts[product.categoryId] = (counts[product.categoryId] || 0) + 1;
//     });
//     return counts;
//   }, [products]);

//   const filteredCategories = useMemo(() => {
//     if (!categorySearchTerm.trim()) return categories;
//     return categories.filter((cat) => cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()));
//   }, [categories, categorySearchTerm]);

//   const filteredProducts = useMemo(() => {
//     if (!selectedCategoryId) return [];
    
//     return products.filter((product: Product) => {
//       if (!product || product.categoryId !== selectedCategoryId) return false;

//       const searchTerm = filterState.searchTerm.toLowerCase().trim();
//       return !searchTerm || 
//         product.name?.toLowerCase().includes(searchTerm) ||
//         product.description?.toLowerCase().includes(searchTerm) ||
//         product.size?.toLowerCase().includes(searchTerm) ||
//         product.barcode?.toLowerCase().includes(searchTerm);
//     });
//   }, [products, selectedCategoryId, filterState.searchTerm]);

//   // Get products filtered by selected category for stock report
//   const categoryFilteredProducts = useMemo(() => {
//     if (!selectedCategoryId) return products;
//     return products.filter((product: Product) => product.categoryId === selectedCategoryId);
//   }, [products, selectedCategoryId]);

//   const handleExportAll = useCallback(() => {
//     try {
//       const headers = ["Product Name", "Category", "Size", "Weight", "Volume", "Barcode", "Low Stock Threshold", "Description", "Status", "Created At"];
//       const rows = products.map((p: Product) => [
//         `"${p.name}"`, `"${getCategoryName(p)}"`, `"${p.size || "N/A"}"`, `"${p.weight || "N/A"}"`,
//         `"${p.volume || "N/A"}"`, `"${p.barcode || "N/A"}"`, p.lowStockThreshold || 10,
//         `"${p.description || "N/A"}"`, p.isActive ? "Active" : "Disabled",
//         new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
//       ].join(","));

//       const csvContent = [headers.join(","), ...rows].join("\n");
//       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
//       const url = window.URL.createObjectURL(blob);
//       const link = document.createElement("a");
//       link.href = url;
//       link.download = `all-products-${new Date().toISOString().split("T")[0]}.csv`;
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);
//       toast.success("All products exported!");
//     } catch (error) {
//       toast.error("Failed to export products");
//     }
//   }, [products, getCategoryName]);

//   const handleExportCategory = useCallback(() => {
//     const category = categories.find(c => c._id === selectedCategoryId);
//     if (!category) return;

//     try {
//       const headers = ["Product Name", "Category", "Size", "Weight", "Volume", "Barcode", "Low Stock Threshold", "Description", "Status", "Created At"];
//       const rows = filteredProducts.map((p: Product) => [
//         `"${p.name}"`, `"${category.name}"`, `"${p.size || "N/A"}"`, `"${p.weight || "N/A"}"`,
//         `"${p.volume || "N/A"}"`, `"${p.barcode || "N/A"}"`, p.lowStockThreshold || 10,
//         `"${p.description || "N/A"}"`, p.isActive ? "Active" : "Disabled",
//         new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
//       ].join(","));

//       const csvContent = [headers.join(","), ...rows].join("\n");
//       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
//       const url = window.URL.createObjectURL(blob);
//       const link = document.createElement("a");
//       link.href = url;
//       link.download = `${category.name.toLowerCase()}-products-${new Date().toISOString().split("T")[0]}.csv`;
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);
//       toast.success(`${category.name} products exported!`);
//     } catch (error) {
//       toast.error("Failed to export products");
//     }
//   }, [filteredProducts, selectedCategoryId, categories]);

//   if (isProductsError) {
//     return (
//       <Card className="p-8">
//         <div className="text-center">
//           <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
//           <h3 className="text-lg font-semibold mb-2">Failed to Load Products</h3>
//           <p className="text-gray-600 mb-4">{productsError instanceof Error ? productsError.message : "Unknown error"}</p>
//           <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["products"] })} variant="outline">Try Again</Button>
//         </div>
//       </Card>
//     );
//   }

//   if (productsLoading) {
//     return (
//       <Card className="p-8">
//         <div className="text-center">
//           <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
//           <p className="text-gray-600">Loading products...</p>
//         </div>
//       </Card>
//     );
//   }

//   // STEP 1: Category Selection
//   if (!selectedCategoryId) {
//     return (
//       <div className="space-y-6">
//         <div className="flex justify-between items-center">
//           <h2 className="text-2xl font-bold text-gray-900">Select Category</h2>
//           <div className="flex space-x-2">
//             <Button onClick={() => setShowStockReportModal(true)} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
//               <FileSpreadsheet className="w-4 h-4 mr-2" />Stock Report
//             </Button>
//             <Button onClick={handleExportAll} variant="outline" disabled={products.length === 0}>
//               <Download className="w-4 h-4 mr-2" />Export All
//             </Button>
//             <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
//               <Plus className="w-4 h-4 mr-2" />Add Product
//             </Button>
//           </div>
//         </div>

//         <Card>
//           <CardContent className="p-6">
//             <Label className="block text-sm font-medium text-gray-700 mb-2">Search Categories</Label>
//             <div className="relative">
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//               <Input placeholder="Search for a category..." value={categorySearchTerm} onChange={(e) => setCategorySearchTerm(e.target.value)} className="pl-10" />
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle>Available Categories ({filteredCategories.length})</CardTitle>
//           </CardHeader>
//           <CardContent>
//             {filteredCategories.length === 0 ? (
//               <div className="text-center py-12">
//                 <div className="text-4xl mb-4">🔍</div>
//                 <h3 className="text-lg font-medium mb-2">No categories found</h3>
//                 <p className="text-gray-500">Try adjusting your search.</p>
//               </div>
//             ) : (
//               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
//                 {filteredCategories.map((category) => (
//                   <Card key={category._id} className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-blue-400" onClick={() => setSelectedCategoryId(category._id)}>
//                     <CardContent className="p-6 text-center">
//                       <div className="text-5xl mb-3">{getCategoryIcon(category.name)}</div>
//                       <h3 className="font-semibold text-lg capitalize mb-2">{category.name}</h3>
//                       <div className="flex items-center justify-center space-x-2">
//                         <p className="text-3xl font-bold text-blue-600">{categoryProductCounts[category._id] || 0}</p>
//                         <span className="text-sm text-gray-500">{(categoryProductCounts[category._id] || 0) === 1 ? "product" : "products"}</span>
//                       </div>
//                       <div className="mt-3 flex items-center justify-center text-blue-500 text-sm font-medium">
//                         View Products<ChevronRight className="w-4 h-4 ml-1" />
//                       </div>
//                     </CardContent>
//                   </Card>
//                 ))}
//               </div>
//             )}
//           </CardContent>
//         </Card>

//         <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
//         <StockReportModal 
//           open={showStockReportModal} 
//           onOpenChange={setShowStockReportModal} 
//           products={products} 
//           preSelectedProductId={stockReportProductId} 
//         />
//       </div>
//     );
//   }

//   // STEP 2: Products List
//   const selectedCategory = categories.find(c => c._id === selectedCategoryId);
//   const categoryName = selectedCategory?.name || "Unknown";

//   return (
//     <div className="space-y-6">
//       <div className="flex justify-between items-center">
//         <div className="flex items-center space-x-3">
//           <Button onClick={() => setSelectedCategoryId(null)} variant="outline" size="sm">
//             <ArrowLeft className="w-4 h-4 mr-2" />Back
//           </Button>
//           <h2 className="text-2xl font-bold capitalize flex items-center">
//             <span className="text-3xl mr-2">{getCategoryIcon(categoryName)}</span>{categoryName} Products
//           </h2>
//         </div>
//         <div className="flex space-x-2">
//           <Button onClick={() => setShowStockReportModal(true)} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
//             <FileSpreadsheet className="w-4 h-4 mr-2" />Stock Report
//           </Button>
//           <Button onClick={handleExportCategory} variant="outline" disabled={filteredProducts.length === 0}>
//             <Download className="w-4 h-4 mr-2" />Export
//           </Button>
//           <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
//             <Plus className="w-4 h-4 mr-2" />Add Product
//           </Button>
//         </div>
//       </div>

//       <Card>
//         <CardContent className="p-6">
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">Search Products</Label>
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//                 <Input placeholder="Name, size, barcode..." value={filterState.searchTerm} onChange={(e) => setFilterState(p => ({ ...p, searchTerm: e.target.value }))} className="pl-10" />
//               </div>
//             </div>
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">Show Inactive Products</Label>
//               <div className="flex items-center space-x-2 mt-3">
//                 <Switch checked={filterState.showInactive} onCheckedChange={(checked) => setFilterState(p => ({ ...p, showInactive: checked }))} />
//                 <span className="text-sm text-gray-600">Include disabled products</span>
//               </div>
//             </div>
//           </div>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardHeader>
//           <div className="flex items-center gap-3">
//             <CardTitle>Products Inventory</CardTitle>
//             <p className="text-sm text-gray-600 pt-1">[{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}]</p>
//           </div>
//         </CardHeader>
//         <CardContent className="p-0">
//           {filteredProducts.length === 0 ? (
//             <div className="text-center py-12">
//               <div className="text-5xl mb-4">{getCategoryIcon(categoryName)}</div>
//               <h3 className="text-lg font-medium mb-2">No products found</h3>
//               <p className="text-gray-500 mb-4">{filterState.searchTerm ? "Try adjusting your search." : `No products in ${categoryName} yet.`}</p>
//               <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
//                 <Plus className="w-4 h-4 mr-2" />Add Product
//               </Button>
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full">
//                 <thead className="bg-gray-50">
//                   <tr>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size/Weight</th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
//                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="bg-white divide-y divide-gray-200">
//                   {filteredProducts.map((product: Product) => (
//                     <tr key={product._id} className={!product.isActive ? "bg-gray-50 opacity-75" : ""}>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="flex items-center">
//                           {product.imageURL ? (
//                             <img src={product.imageURL} alt={product.name} className="w-10 h-10 rounded-lg object-cover" onError={(e) => e.currentTarget.style.display = "none"} />
//                           ) : (
//                             <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${product.isActive ? "bg-gray-100" : "bg-gray-200"}`}>
//                               {getCategoryIcon(categoryName)}
//                             </div>
//                           )}
//                           <div className="ml-3">
//                             <p className={`text-sm font-medium ${product.isActive ? "text-gray-900" : "text-gray-500"}`}>{product.name}</p>
//                             <p className="text-sm text-gray-500 truncate max-w-xs">{product.description || "No description"}</p>
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm">
//                         {product.size && <span className="font-medium">{product.size}</span>}
//                         {product.weight && <div className="text-gray-500">{product.weight}</div>}
//                         {product.volume && <div className="text-gray-500">{product.volume}</div>}
//                         {!product.size && !product.weight && !product.volume && <span className="text-gray-400">N/A</span>}
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm">{product.barcode || <span className="text-gray-400">N/A</span>}</td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <Badge variant={product.isActive ? "default" : "secondary"} className={product.isActive ? "bg-green-500" : "bg-gray-400"}>
//                           {product.isActive ? "Active" : "Disabled"}
//                         </Badge>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="flex space-x-1">
//                           <Button variant="ghost" size="sm" onClick={() => { setStockReportProductId(product._id); setShowStockReportModal(true); }} className="text-green-500 hover:bg-green-50" title="Stock Report">
//                             <FileSpreadsheet className="w-4 h-4" />
//                           </Button>
//                           <Button variant="ghost" size="sm" onClick={() => setStockProduct(product)} className="text-blue-500 hover:bg-blue-50" title="Add Stock">
//                             <PackagePlus className="w-4 h-4" />
//                           </Button>
//                           <Button variant="ghost" size="sm" onClick={() => { setSelectedProduct(product); setShowEditModal(true); }} className="text-purple-500 hover:bg-purple-50" title="Edit">
//                             <Edit className="w-4 h-4" />
//                           </Button>
//                           <Button variant="ghost" size="sm" onClick={() => toggleProductMutation.mutate({ productId: product._id, isActive: !product.isActive })} disabled={toggleProductMutation.isPending} className={product.isActive ? "text-orange-500 hover:bg-orange-50" : "text-green-500 hover:bg-green-50"}>
//                             {toggleProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : product.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
//                           </Button>
//                           <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Delete "${product.name}"?`)) deleteProductMutation.mutate(product._id); }} disabled={deleteProductMutation.isPending} className="text-red-500 hover:bg-red-50">
//                             {deleteProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

//       <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
//       <EditProductModal open={showEditModal} onOpenChange={setShowEditModal} product={selectedProduct} />
//       {stockProduct && (
//         <AddStockEntryModal open={!!stockProduct} onOpenChange={(open) => !open && setStockProduct(null)} productId={stockProduct._id} productName={stockProduct.name} categoryId={getCategoryId(stockProduct)} />
//       )}
//       <StockReportModal 
//         open={showStockReportModal} 
//         onOpenChange={(open) => { 
//           setShowStockReportModal(open); 
//           if (!open) setStockReportProductId(null); 
//         }} 
//         products={categoryFilteredProducts} 
//         preSelectedProductId={stockReportProductId}
//         categoryId={selectedCategoryId}
//       />
//     </div>
//   );
// }


// // //NOTE - Working but Report not working
// // // app/dashboard/products-tab.tsx
// // "use client";

// // import { useState, useMemo, useCallback } from 'react';
// // import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// // import { Button } from '@/components/ui/button';
// // import { Input } from '@/components/ui/input';
// // import { Label } from '@/components/ui/label';
// // import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// // import { Badge } from '@/components/ui/badge';
// // import { Switch } from '@/components/ui/switch';
// // import { 
// //   Plus, Edit, Search, Trash2, Eye, EyeOff, Download, Loader2, 
// //   AlertTriangle, PackagePlus, FileSpreadsheet, ArrowLeft, ChevronRight
// // } from "lucide-react";
// // import { toast } from 'sonner';
// // import AddProductModal from '@/components/modals/add-product-modal';
// // import EditProductModal from '@/components/modals/edit-product-modal';
// // import AddStockEntryModal from '@/components/modals/add-stock-entry-modal';
// // import StockReportModal from '@/components/modals/stock-report-modal';

// // import type { 
// //   ApiResponse, Product, ProductsResponse, ProductFilterState 
// // } from "@/types/product";
// // import type { Category, CategoriesResponse } from '@/types/category';

// // export default function ProductsTab() {
// //   const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
// //   const [categorySearchTerm, setCategorySearchTerm] = useState("");
// //   const [filterState, setFilterState] = useState<ProductFilterState>({
// //     searchTerm: "",
// //     selectedCategory: "all",
// //     showInactive: false,
// //   });
// //   const [showAddModal, setShowAddModal] = useState(false);
// //   const [showEditModal, setShowEditModal] = useState(false);
// //   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
// //   const [stockProduct, setStockProduct] = useState<Product | null>(null);
// //   const [showStockReportModal, setShowStockReportModal] = useState(false);
// //   const [stockReportProductId, setStockReportProductId] = useState<string | null>(null);
  
// //   const queryClient = useQueryClient();

// //   const {
// //     data: productsResponse,
// //     isLoading: productsLoading,
// //     error: productsError,
// //     isError: isProductsError,
// //   } = useQuery<ApiResponse<ProductsResponse>, Error>({
// //     queryKey: ["products", filterState.showInactive],
// //     queryFn: async () => {
// //       const params = new URLSearchParams();
// //       if (filterState.showInactive) params.append("includeInactive", "true");

// //       const response = await fetch(`/api/products?${params}`);
// //       if (!response.ok) throw new Error(`Failed to fetch products: ${response.status}`);

// //       const data: ApiResponse<ProductsResponse> = await response.json();
// //       if (!data.success || !data.data) throw new Error(data.error?.message || "Failed to fetch products");

// //       return data;
// //     },
// //     retry: 2,
// //     staleTime: 5 * 60 * 1000,
// //   });

// //   const { data: categoriesResponse } = useQuery<ApiResponse<CategoriesResponse>, Error>({
// //     queryKey: ["categories"],
// //     queryFn: async () => {
// //       const response = await fetch("/api/categories");
// //       if (!response.ok) throw new Error("Failed to fetch categories");

// //       const data: ApiResponse<CategoriesResponse> = await response.json();
// //       if (!data.success || !data.data) throw new Error(data.error?.message || "Failed to fetch categories");

// //       return data;
// //     },
// //   });

// //   const products = productsResponse?.data?.products || [];
// //   const categories = categoriesResponse?.data?.categories || [];

// //   const deleteProductMutation = useMutation<ApiResponse<null>, Error, string>({
// //     mutationFn: async (productId: string) => {
// //       const response = await fetch(`/api/products/${productId}`, { method: "DELETE" });
// //       const result: ApiResponse<null> = await response.json();
// //       if (!response.ok) throw new Error(result.error?.message || "Failed to delete product");
// //       return result;
// //     },
// //     onSuccess: () => {
// //       queryClient.invalidateQueries({ queryKey: ["products"] });
// //       toast.success("Product deleted successfully.");
// //     },
// //     onError: (error: Error) => toast.error(`Failed to delete product: ${error.message}`),
// //   });

// //   const toggleProductMutation = useMutation<ApiResponse<Product>, Error, { productId: string; isActive: boolean }>({
// //     mutationFn: async ({ productId, isActive }) => {
// //       const response = await fetch(`/api/products/${productId}`, {
// //         method: "PATCH",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify({ isActive }),
// //       });
// //       const result: ApiResponse<Product> = await response.json();
// //       if (!response.ok) throw new Error(result.error?.message || "Failed to update product");
// //       return result;
// //     },
// //     onSuccess: () => {
// //       queryClient.invalidateQueries({ queryKey: ["products"] });
// //       toast.success("Product status updated successfully.");
// //     },
// //     onError: (error: Error) => toast.error(`Failed to update product: ${error.message}`),
// //   });

// //   const getCategoryIcon = useCallback((categoryName: string): string => {
// //     switch (categoryName.toLowerCase()) {
// //       case "food": return "🍜";
// //       case "stationery": return "📚";
// //       case "daily use": return "🧴";
// //       case "pooja": return "🔥";
// //       default: return "📦";
// //     }
// //   }, []);

// //   const getCategoryName = useCallback((product: Product): string => {
// //     if (product.category && typeof product.category === "object" && "name" in product.category) {
// //       return product.category.name;
// //     }
// //     const category = categories.find((cat) => cat._id === product.categoryId);
// //     return category?.name || "Uncategorized";
// //   }, [categories]);

// //   const getCategoryId = useCallback((product: Product): string => {
// //     if (product.category && typeof product.category === "object" && "_id" in product.category) {
// //       return product.category._id;
// //     }
// //     return product.categoryId;
// //   }, []);

// //   const categoryProductCounts = useMemo(() => {
// //     const counts: Record<string, number> = {};
// //     products.forEach((product: Product) => {
// //       if (product?.categoryId) counts[product.categoryId] = (counts[product.categoryId] || 0) + 1;
// //     });
// //     return counts;
// //   }, [products]);

// //   const filteredCategories = useMemo(() => {
// //     if (!categorySearchTerm.trim()) return categories;
// //     return categories.filter((cat) => cat.name.toLowerCase().includes(categorySearchTerm.toLowerCase()));
// //   }, [categories, categorySearchTerm]);

// //   const filteredProducts = useMemo(() => {
// //     if (!selectedCategoryId) return [];
    
// //     return products.filter((product: Product) => {
// //       if (!product || product.categoryId !== selectedCategoryId) return false;

// //       const searchTerm = filterState.searchTerm.toLowerCase().trim();
// //       return !searchTerm || 
// //         product.name?.toLowerCase().includes(searchTerm) ||
// //         product.description?.toLowerCase().includes(searchTerm) ||
// //         product.size?.toLowerCase().includes(searchTerm) ||
// //         product.barcode?.toLowerCase().includes(searchTerm);
// //     });
// //   }, [products, selectedCategoryId, filterState.searchTerm]);

// //   const handleExportAll = useCallback(() => {
// //     try {
// //       const headers = ["Product Name", "Category", "Size", "Weight", "Volume", "Barcode", "Low Stock Threshold", "Description", "Status", "Created At"];
// //       const rows = products.map((p: Product) => [
// //         `"${p.name}"`, `"${getCategoryName(p)}"`, `"${p.size || "N/A"}"`, `"${p.weight || "N/A"}"`,
// //         `"${p.volume || "N/A"}"`, `"${p.barcode || "N/A"}"`, p.lowStockThreshold || 10,
// //         `"${p.description || "N/A"}"`, p.isActive ? "Active" : "Disabled",
// //         new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
// //       ].join(","));

// //       const csvContent = [headers.join(","), ...rows].join("\n");
// //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// //       const url = window.URL.createObjectURL(blob);
// //       const link = document.createElement("a");
// //       link.href = url;
// //       link.download = `all-products-${new Date().toISOString().split("T")[0]}.csv`;
// //       document.body.appendChild(link);
// //       link.click();
// //       document.body.removeChild(link);
// //       window.URL.revokeObjectURL(url);
// //       toast.success("All products exported!");
// //     } catch (error) {
// //       toast.error("Failed to export products");
// //     }
// //   }, [products, getCategoryName]);

// //   const handleExportCategory = useCallback(() => {
// //     const category = categories.find(c => c._id === selectedCategoryId);
// //     if (!category) return;

// //     try {
// //       const headers = ["Product Name", "Category", "Size", "Weight", "Volume", "Barcode", "Low Stock Threshold", "Description", "Status", "Created At"];
// //       const rows = filteredProducts.map((p: Product) => [
// //         `"${p.name}"`, `"${category.name}"`, `"${p.size || "N/A"}"`, `"${p.weight || "N/A"}"`,
// //         `"${p.volume || "N/A"}"`, `"${p.barcode || "N/A"}"`, p.lowStockThreshold || 10,
// //         `"${p.description || "N/A"}"`, p.isActive ? "Active" : "Disabled",
// //         new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
// //       ].join(","));

// //       const csvContent = [headers.join(","), ...rows].join("\n");
// //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// //       const url = window.URL.createObjectURL(blob);
// //       const link = document.createElement("a");
// //       link.href = url;
// //       link.download = `${category.name.toLowerCase()}-products-${new Date().toISOString().split("T")[0]}.csv`;
// //       document.body.appendChild(link);
// //       link.click();
// //       document.body.removeChild(link);
// //       window.URL.revokeObjectURL(url);
// //       toast.success(`${category.name} products exported!`);
// //     } catch (error) {
// //       toast.error("Failed to export products");
// //     }
// //   }, [filteredProducts, selectedCategoryId, categories]);

// //   if (isProductsError) {
// //     return (
// //       <Card className="p-8">
// //         <div className="text-center">
// //           <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
// //           <h3 className="text-lg font-semibold mb-2">Failed to Load Products</h3>
// //           <p className="text-gray-600 mb-4">{productsError instanceof Error ? productsError.message : "Unknown error"}</p>
// //           <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["products"] })} variant="outline">Try Again</Button>
// //         </div>
// //       </Card>
// //     );
// //   }

// //   if (productsLoading) {
// //     return (
// //       <Card className="p-8">
// //         <div className="text-center">
// //           <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
// //           <p className="text-gray-600">Loading products...</p>
// //         </div>
// //       </Card>
// //     );
// //   }

// //   // STEP 1: Category Selection
// //   if (!selectedCategoryId) {
// //     return (
// //       <div className="space-y-6">
// //         <div className="flex justify-between items-center">
// //           <h2 className="text-2xl font-bold text-gray-900">Select Category</h2>
// //           <div className="flex space-x-2">
// //             <Button onClick={() => setShowStockReportModal(true)} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
// //               <FileSpreadsheet className="w-4 h-4 mr-2" />Stock Report
// //             </Button>
// //             <Button onClick={handleExportAll} variant="outline" disabled={products.length === 0}>
// //               <Download className="w-4 h-4 mr-2" />Export All
// //             </Button>
// //             <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
// //               <Plus className="w-4 h-4 mr-2" />Add Product
// //             </Button>
// //           </div>
// //         </div>

// //         <Card>
// //           <CardContent className="p-6">
// //             <Label className="block text-sm font-medium text-gray-700 mb-2">Search Categories</Label>
// //             <div className="relative">
// //               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// //               <Input placeholder="Search for a category..." value={categorySearchTerm} onChange={(e) => setCategorySearchTerm(e.target.value)} className="pl-10" />
// //             </div>
// //           </CardContent>
// //         </Card>

// //         <Card>
// //           <CardHeader>
// //             <CardTitle>Available Categories ({filteredCategories.length})</CardTitle>
// //           </CardHeader>
// //           <CardContent>
// //             {filteredCategories.length === 0 ? (
// //               <div className="text-center py-12">
// //                 <div className="text-4xl mb-4">🔍</div>
// //                 <h3 className="text-lg font-medium mb-2">No categories found</h3>
// //                 <p className="text-gray-500">Try adjusting your search.</p>
// //               </div>
// //             ) : (
// //               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
// //                 {filteredCategories.map((category) => (
// //                   <Card key={category._id} className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 hover:border-blue-400" onClick={() => setSelectedCategoryId(category._id)}>
// //                     <CardContent className="p-6 text-center">
// //                       <div className="text-5xl mb-3">{getCategoryIcon(category.name)}</div>
// //                       <h3 className="font-semibold text-lg capitalize mb-2">{category.name}</h3>
// //                       <div className="flex items-center justify-center space-x-2">
// //                         <p className="text-3xl font-bold text-blue-600">{categoryProductCounts[category._id] || 0}</p>
// //                         <span className="text-sm text-gray-500">{(categoryProductCounts[category._id] || 0) === 1 ? "product" : "products"}</span>
// //                       </div>
// //                       <div className="mt-3 flex items-center justify-center text-blue-500 text-sm font-medium">
// //                         View Products<ChevronRight className="w-4 h-4 ml-1" />
// //                       </div>
// //                     </CardContent>
// //                   </Card>
// //                 ))}
// //               </div>
// //             )}
// //           </CardContent>
// //         </Card>

// //         <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
// //         <StockReportModal open={showStockReportModal} onOpenChange={setShowStockReportModal} products={products} preSelectedProductId={stockReportProductId} />
// //       </div>
// //     );
// //   }

// //   // STEP 2: Products List
// //   const selectedCategory = categories.find(c => c._id === selectedCategoryId);
// //   const categoryName = selectedCategory?.name || "Unknown";

// //   return (
// //     <div className="space-y-6">
// //       <div className="flex justify-between items-center">
// //         <div className="flex items-center space-x-3">
// //           <Button onClick={() => setSelectedCategoryId(null)} variant="outline" size="sm">
// //             <ArrowLeft className="w-4 h-4 mr-2" />Back
// //           </Button>
// //           <h2 className="text-2xl font-bold capitalize flex items-center">
// //             <span className="text-3xl mr-2">{getCategoryIcon(categoryName)}</span>{categoryName} Products
// //           </h2>
// //         </div>
// //         <div className="flex space-x-2">
// //           <Button onClick={() => setShowStockReportModal(true)} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
// //             <FileSpreadsheet className="w-4 h-4 mr-2" />Stock Report
// //           </Button>
// //           <Button onClick={handleExportCategory} variant="outline" disabled={filteredProducts.length === 0}>
// //             <Download className="w-4 h-4 mr-2" />Export
// //           </Button>
// //           <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
// //             <Plus className="w-4 h-4 mr-2" />Add Product
// //           </Button>
// //         </div>
// //       </div>

// //       <Card>
// //         <CardContent className="p-6">
// //           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search Products</Label>
// //               <div className="relative">
// //                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// //                 <Input placeholder="Name, size, barcode..." value={filterState.searchTerm} onChange={(e) => setFilterState(p => ({ ...p, searchTerm: e.target.value }))} className="pl-10" />
// //               </div>
// //             </div>
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">Show Inactive Products</Label>
// //               <div className="flex items-center space-x-2 mt-3">
// //                 <Switch checked={filterState.showInactive} onCheckedChange={(checked) => setFilterState(p => ({ ...p, showInactive: checked }))} />
// //                 <span className="text-sm text-gray-600">Include disabled products</span>
// //               </div>
// //             </div>
// //           </div>
// //         </CardContent>
// //       </Card>

// //       <Card>
// //         <CardHeader>
// //           <div className="flex items-center gap-3">
// //             <CardTitle>Products Inventory</CardTitle>
// //             <p className="text-sm text-gray-600 pt-1">[{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}]</p>
// //           </div>
// //         </CardHeader>
// //         <CardContent className="p-0">
// //           {filteredProducts.length === 0 ? (
// //             <div className="text-center py-12">
// //               <div className="text-5xl mb-4">{getCategoryIcon(categoryName)}</div>
// //               <h3 className="text-lg font-medium mb-2">No products found</h3>
// //               <p className="text-gray-500 mb-4">{filterState.searchTerm ? "Try adjusting your search." : `No products in ${categoryName} yet.`}</p>
// //               <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600 text-white">
// //                 <Plus className="w-4 h-4 mr-2" />Add Product
// //               </Button>
// //             </div>
// //           ) : (
// //             <div className="overflow-x-auto">
// //               <table className="w-full">
// //                 <thead className="bg-gray-50">
// //                   <tr>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size/Weight</th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Barcode</th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
// //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
// //                   </tr>
// //                 </thead>
// //                 <tbody className="bg-white divide-y divide-gray-200">
// //                   {filteredProducts.map((product: Product) => (
// //                     <tr key={product._id} className={!product.isActive ? "bg-gray-50 opacity-75" : ""}>
// //                       <td className="px-6 py-4 whitespace-nowrap">
// //                         <div className="flex items-center">
// //                           {product.imageURL ? (
// //                             <img src={product.imageURL} alt={product.name} className="w-10 h-10 rounded-lg object-cover" onError={(e) => e.currentTarget.style.display = "none"} />
// //                           ) : (
// //                             <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${product.isActive ? "bg-gray-100" : "bg-gray-200"}`}>
// //                               {getCategoryIcon(categoryName)}
// //                             </div>
// //                           )}
// //                           <div className="ml-3">
// //                             <p className={`text-sm font-medium ${product.isActive ? "text-gray-900" : "text-gray-500"}`}>{product.name}</p>
// //                             <p className="text-sm text-gray-500 truncate max-w-xs">{product.description || "No description"}</p>
// //                           </div>
// //                         </div>
// //                       </td>
// //                       <td className="px-6 py-4 whitespace-nowrap text-sm">
// //                         {product.size && <span className="font-medium">{product.size}</span>}
// //                         {product.weight && <div className="text-gray-500">{product.weight}</div>}
// //                         {product.volume && <div className="text-gray-500">{product.volume}</div>}
// //                         {!product.size && !product.weight && !product.volume && <span className="text-gray-400">N/A</span>}
// //                       </td>
// //                       <td className="px-6 py-4 whitespace-nowrap text-sm">{product.barcode || <span className="text-gray-400">N/A</span>}</td>
// //                       <td className="px-6 py-4 whitespace-nowrap">
// //                         <Badge variant={product.isActive ? "default" : "secondary"} className={product.isActive ? "bg-green-500" : "bg-gray-400"}>
// //                           {product.isActive ? "Active" : "Disabled"}
// //                         </Badge>
// //                       </td>
// //                       <td className="px-6 py-4 whitespace-nowrap">
// //                         <div className="flex space-x-1">
// //                           <Button variant="ghost" size="sm" onClick={() => { setStockReportProductId(product._id); setShowStockReportModal(true); }} className="text-green-500 hover:bg-green-50" title="Stock Report">
// //                             <FileSpreadsheet className="w-4 h-4" />
// //                           </Button>
// //                           <Button variant="ghost" size="sm" onClick={() => setStockProduct(product)} className="text-blue-500 hover:bg-blue-50" title="Add Stock">
// //                             <PackagePlus className="w-4 h-4" />
// //                           </Button>
// //                           <Button variant="ghost" size="sm" onClick={() => { setSelectedProduct(product); setShowEditModal(true); }} className="text-purple-500 hover:bg-purple-50" title="Edit">
// //                             <Edit className="w-4 h-4" />
// //                           </Button>
// //                           <Button variant="ghost" size="sm" onClick={() => toggleProductMutation.mutate({ productId: product._id, isActive: !product.isActive })} disabled={toggleProductMutation.isPending} className={product.isActive ? "text-orange-500 hover:bg-orange-50" : "text-green-500 hover:bg-green-50"}>
// //                             {toggleProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : product.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
// //                           </Button>
// //                           <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Delete "${product.name}"?`)) deleteProductMutation.mutate(product._id); }} disabled={deleteProductMutation.isPending} className="text-red-500 hover:bg-red-50">
// //                             {deleteProductMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

// //       <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
// //       <EditProductModal open={showEditModal} onOpenChange={setShowEditModal} product={selectedProduct} />
// //       {stockProduct && (
// //         <AddStockEntryModal open={!!stockProduct} onOpenChange={(open) => !open && setStockProduct(null)} productId={stockProduct._id} productName={stockProduct.name} categoryId={getCategoryId(stockProduct)} />
// //       )}
// //       <StockReportModal open={showStockReportModal} onOpenChange={(open) => { setShowStockReportModal(open); if (!open) setStockReportProductId(null); }} products={products} preSelectedProductId={stockReportProductId} />
// //     </div>
// //   );
// // }

// // // // app/dashboard/products-tab.tsx
// // // "use client";

// // // import { useState, useMemo, useCallback } from 'react';
// // // import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// // // import { Button } from '@/components/ui/button';
// // // import { Input } from '@/components/ui/input';
// // // import { Label } from '@/components/ui/label';
// // // import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// // // import { Badge } from '@/components/ui/badge';
// // // import { Switch } from '@/components/ui/switch';
// // // import { 
// // //   Plus, 
// // //   Edit, 
// // //   Search, 
// // //   Trash2, 
// // //   Eye, 
// // //   EyeOff, 
// // //   Download, 
// // //   Loader2, 
// // //   AlertTriangle,
// // //   PackagePlus, 
// // //   FileSpreadsheet
// // // } from "lucide-react";
// // // import { toast } from 'sonner';
// // // import AddProductModal from '@/components/modals/add-product-modal';
// // // import EditProductModal from '@/components/modals/edit-product-modal';
// // // import AddStockEntryModal from '@/components/modals/add-stock-entry-modal';

// // // import type { 
// // //   ApiResponse, 
// // //   Product, 
// // //   ProductsResponse, 
// // //   ProductFilterState 
// // // } from "@/types/product";
// // // import type { Category, CategoriesResponse } from '@/types/category';
// // // import StockReportModal from '@/components/modals/stock-report-modal';

// // // export default function ProductsTab() {
// // //   const [filterState, setFilterState] = useState<ProductFilterState>({
// // //     searchTerm: "",
// // //     selectedCategory: "all",
// // //     showInactive: false,
// // //   });
// // //   const [showAddModal, setShowAddModal] = useState(false);
// // //   const [showEditModal, setShowEditModal] = useState(false);
// // //   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
// // //   const [stockProduct, setStockProduct] = useState<Product | null>(null);
// // //   const [showStockReportModal, setShowStockReportModal] = useState(false);
// // //   const [stockReportProductId, setStockReportProductId] = useState<string | null>(null);
  
// // //   const queryClient = useQueryClient();

// // //   // Fetch products with type-safe response
// // //   const {
// // //     data: productsResponse,
// // //     isLoading: productsLoading,
// // //     error: productsError,
// // //     isError: isProductsError,
// // //   } = useQuery<ApiResponse<ProductsResponse>, Error>({
// // //     queryKey: ["products", filterState.showInactive],
// // //     queryFn: async () => {
// // //       const params = new URLSearchParams();
// // //       if (filterState.showInactive) {
// // //         params.append("includeInactive", "true");
// // //       }

// // //       const response = await fetch(`/api/products?${params}`);
// // //       if (!response.ok) {
// // //         throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
// // //       }

// // //       const data: ApiResponse<ProductsResponse> = await response.json();

// // //       if (!data.success || !data.data) {
// // //         throw new Error(data.error?.message || "Failed to fetch products");
// // //       }

// // //       return data;
// // //     },
// // //     retry: 2,
// // //     staleTime: 5 * 60 * 1000,
// // //     gcTime: 10 * 60 * 1000,
// // //   });

// // //   // Fetch categories
// // //   const { data: categoriesResponse } = useQuery<ApiResponse<CategoriesResponse>, Error>({
// // //     queryKey: ["categories"],
// // //     queryFn: async () => {
// // //       const response = await fetch("/api/categories");
// // //       if (!response.ok) {
// // //         throw new Error("Failed to fetch categories");
// // //       }

// // //       const data: ApiResponse<CategoriesResponse> = await response.json();

// // //       if (!data.success || !data.data) {
// // //         throw new Error(data.error?.message || "Failed to fetch categories");
// // //       }

// // //       return data;
// // //     },
// // //   });

// // //   const products = productsResponse?.data?.products || [];
// // //   const categories = categoriesResponse?.data?.categories || [];

// // //   // Delete product mutation
// // //   const deleteProductMutation = useMutation<ApiResponse<null>, Error, string>({
// // //     mutationFn: async (productId: string) => {
// // //       const response = await fetch(`/api/products/${productId}`, {
// // //         method: "DELETE",
// // //       });

// // //       const result: ApiResponse<null> = await response.json();

// // //       if (!response.ok) {
// // //         throw new Error(result.error?.message || `Failed to delete product: ${response.status}`);
// // //       }

// // //       return result;
// // //     },
// // //     onSuccess: () => {
// // //       queryClient.invalidateQueries({ queryKey: ["products"] });
// // //       toast.success("Product deleted successfully.");
// // //     },
// // //     onError: (error: Error) => {
// // //       console.error("Delete product error:", error);
// // //       toast.error(`Failed to delete product: ${error.message}`);
// // //     },
// // //   });

// // //   // Toggle product status mutation
// // //   const toggleProductMutation = useMutation<
// // //     ApiResponse<Product>,
// // //     Error,
// // //     { productId: string; isActive: boolean }
// // //   >({
// // //     mutationFn: async ({ productId, isActive }) => {
// // //       const response = await fetch(`/api/products/${productId}`, {
// // //         method: "PATCH",
// // //         headers: { "Content-Type": "application/json" },
// // //         body: JSON.stringify({ isActive }),
// // //       });

// // //       const result: ApiResponse<Product> = await response.json();

// // //       if (!response.ok) {
// // //         throw new Error(result.error?.message || `Failed to update product: ${response.status}`);
// // //       }

// // //       return result;
// // //     },
// // //     onSuccess: () => {
// // //       queryClient.invalidateQueries({ queryKey: ["products"] });
// // //       toast.success("Product status updated successfully.");
// // //     },
// // //     onError: (error: Error) => {
// // //       console.error("Toggle product error:", error);
// // //       toast.error(`Failed to update product: ${error.message}`);
// // //     },
// // //   });

// // //   const handleFilterChange = useCallback((key: keyof ProductFilterState, value: string | boolean) => {
// // //     setFilterState((prev) => ({ ...prev, [key]: value }));
// // //   }, []);

// // //   const handleEditProduct = useCallback((product: Product) => {
// // //     setSelectedProduct(product);
// // //     setShowEditModal(true);
// // //   }, []);

// // //   const handleAddStock = useCallback((product: Product) => {
// // //     setStockProduct(product);
// // //   }, []);

// // //   const handleToggleActive = useCallback(
// // //     (productId: string, currentStatus: boolean) => {
// // //       toggleProductMutation.mutate({ productId, isActive: !currentStatus });
// // //     },
// // //     [toggleProductMutation]
// // //   );

// // //   const handleDeleteProduct = useCallback(
// // //     (productId: string, productName: string) => {
// // //       if (
// // //         window.confirm(
// // //           `Are you sure you want to delete "${productName}"? This action cannot be undone.`
// // //         )
// // //       ) {
// // //         deleteProductMutation.mutate(productId);
// // //       }
// // //     },
// // //     [deleteProductMutation]
// // //   );

// // //   const handleOpenStockReport = useCallback((productId?: string) => {
// // //     setStockReportProductId(productId || null);
// // //     setShowStockReportModal(true);
// // //   }, []);

// // //   const getCategoryIcon = useCallback((categoryName: string): string => {
// // //     if (!categoryName) return "📦";

// // //     switch (categoryName.toLowerCase()) {
// // //       case "food":
// // //         return "🍜";
// // //       case "stationery":
// // //         return "📚";
// // //       case "daily use":
// // //         return "🧴";
// // //       case "pooja":
// // //         return "🔥";
// // //       default:
// // //         return "📦";
// // //     }
// // //   }, []);

// // //   const getCategoryName = useCallback(
// // //     (product: Product): string => {
// // //       if (product.category && typeof product.category === "object" && "name" in product.category) {
// // //         return product.category.name;
// // //       }

// // //       const category = categories.find((cat) => cat._id === product.categoryId);
// // //       return category?.name || "Uncategorized";
// // //     },
// // //     [categories]
// // //   );

// // //   const getCategoryId = useCallback(
// // //     (product: Product): string => {
// // //       if (product.category && typeof product.category === "object" && "_id" in product.category) {
// // //         return product.category._id;
// // //       }
// // //       return product.categoryId;
// // //     },
// // //     []
// // //   );

// // //   // Memoized filtered products
// // //   const filteredProducts = useMemo(() => {
// // //     if (!Array.isArray(products)) {
// // //       console.warn("products is not an array:", products);
// // //       return [];
// // //     }

// // //     return products.filter((product: Product) => {
// // //       if (!product) return false;

// // //       const searchTerm = filterState.searchTerm.toLowerCase().trim();
// // //       const matchesSearch =
// // //         !searchTerm ||
// // //         product.name?.toLowerCase().includes(searchTerm) ||
// // //         product.description?.toLowerCase().includes(searchTerm) ||
// // //         product.size?.toLowerCase().includes(searchTerm) ||
// // //         product.barcode?.toLowerCase().includes(searchTerm);

// // //       let matchesCategory = true;
// // //       if (filterState.selectedCategory !== "all") {
// // //         matchesCategory = product.categoryId === filterState.selectedCategory;
// // //       }

// // //       return matchesSearch && matchesCategory;
// // //     });
// // //   }, [products, filterState.searchTerm, filterState.selectedCategory]);

// // //   // CLIENT-SIDE EXPORT FUNCTIONALITY
// // //   const handleExport = useCallback(() => {
// // //     try {
// // //       const headers = [
// // //         "Product Name",
// // //         "Category",
// // //         "Size",
// // //         "Weight",
// // //         "Volume",
// // //         "Barcode",
// // //         "Low Stock Threshold",
// // //         "Description",
// // //         "Status",
// // //         "Created At",
// // //       ];

// // //       const rows = filteredProducts.map((product: Product) => {
// // //         const categoryName = getCategoryName(product);
// // //         const createdDate = new Date(product.createdAt).toLocaleDateString("en-GB", {
// // //           day: "2-digit",
// // //           month: "2-digit",
// // //           year: "numeric",
// // //         });

// // //         return [
// // //           `"${product.name}"`,
// // //           `"${categoryName}"`,
// // //           `"${product.size || "N/A"}"`,
// // //           `"${product.weight || "N/A"}"`,
// // //           `"${product.volume || "N/A"}"`,
// // //           `"${product.barcode || "N/A"}"`,
// // //           product.lowStockThreshold || 10,
// // //           `"${product.description || "N/A"}"`,
// // //           product.isActive ? "Active" : "Disabled",
// // //           createdDate,
// // //         ].join(",");
// // //       });

// // //       const csvContent = [headers.join(","), ...rows].join("\n");

// // //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// // //       const url = window.URL.createObjectURL(blob);
// // //       const link = document.createElement("a");
// // //       link.href = url;
// // //       link.download = `products-${new Date().toISOString().split("T")[0]}.csv`;
// // //       document.body.appendChild(link);
// // //       link.click();
// // //       document.body.removeChild(link);
// // //       window.URL.revokeObjectURL(url);

// // //       toast.success("Products exported successfully!");
// // //     } catch (error) {
// // //       console.error("Export error:", error);
// // //       toast.error("Failed to export products");
// // //     }
// // //   }, [filteredProducts, getCategoryName]);

// // //   // Error state
// // //   if (isProductsError) {
// // //     return (
// // //       <Card className="p-8">
// // //         <div className="text-center">
// // //           <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
// // //           <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Products</h3>
// // //           <p className="text-gray-600 mb-4">
// // //             {productsError instanceof Error ? productsError.message : "An unknown error occurred"}
// // //           </p>
// // //           <Button
// // //             onClick={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
// // //             variant="outline"
// // //           >
// // //             Try Again
// // //           </Button>
// // //         </div>
// // //       </Card>
// // //     );
// // //   }

// // //   if (productsLoading) {
// // //     return (
// // //       <Card className="p-8">
// // //         <div className="text-center">
// // //           <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
// // //           <p className="text-gray-600">Loading products...</p>
// // //         </div>
// // //       </Card>
// // //     );
// // //   }

// // //   return (
// // //     <div className="space-y-6">
// // //       {/* <div className="flex justify-between items-center">
// // //         <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
// // //         <div className="flex space-x-2">
// // //           <Button onClick={handleExport} variant="outline" disabled={filteredProducts.length === 0}>
// // //             <Download className="w-4 h-4 mr-2" />
// // //             Export
// // //           </Button>
// // //           <Button
// // //             onClick={() => setShowAddModal(true)}
// // //             className="bg-blue-500 hover:bg-blue-600 text-white"
// // //           >
// // //             <Plus className="w-4 h-4 mr-2" />
// // //             Add Product
// // //           </Button>
// // //         </div>
// // //       </div> */}

// // //       <div className="flex justify-between items-center">
// // //         <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
// // //         <div className="flex space-x-2">
// // //           {/* Stock Report Button - For All Products */}
// // //           <Button
// // //             onClick={() => handleOpenStockReport()}
// // //             variant="outline"
// // //             className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
// // //           >
// // //             <FileSpreadsheet className="w-4 h-4 mr-2" />
// // //             Stock Report
// // //           </Button>

// // //           {/* Export Products Button */}
// // //           <Button
// // //             onClick={handleExport}
// // //             variant="outline"
// // //             disabled={filteredProducts.length === 0}
// // //           >
// // //             <Download className="w-4 h-4 mr-2" />
// // //             Export
// // //           </Button>

// // //           {/* Add Product Button */}
// // //           <Button
// // //             onClick={() => setShowAddModal(true)}
// // //             className="bg-blue-500 hover:bg-blue-600 text-white"
// // //           >
// // //             <Plus className="w-4 h-4 mr-2" />
// // //             Add Product
// // //           </Button>
// // //         </div>
// // //       </div>

// // //       {/* Search and Filter */}
// // //       <Card>
// // //         <CardContent className="p-6">
// // //           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search Products</Label>
// // //               <div className="relative">
// // //                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // //                 <Input
// // //                   placeholder="Name, size, barcode..."
// // //                   value={filterState.searchTerm}
// // //                   onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
// // //                   className="pl-10"
// // //                 />
// // //               </div>
// // //             </div>
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Category</Label>
// // //               <Select
// // //                 value={filterState.selectedCategory}
// // //                 onValueChange={(value) => handleFilterChange("selectedCategory", value)}
// // //               >
// // //                 <SelectTrigger>
// // //                   <SelectValue placeholder="All Categories" />
// // //                 </SelectTrigger>
// // //                 <SelectContent>
// // //                   <SelectItem value="all">All Categories</SelectItem>
// // //                   {categories.map((category) => (
// // //                     <SelectItem key={category._id} value={category._id}>
// // //                       {category.name}
// // //                     </SelectItem>
// // //                   ))}
// // //                 </SelectContent>
// // //               </Select>
// // //             </div>
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">
// // //                 Show Inactive Products
// // //               </Label>
// // //               <div className="flex items-center space-x-2 mt-3">
// // //                 <Switch
// // //                   checked={filterState.showInactive}
// // //                   onCheckedChange={(checked) => handleFilterChange("showInactive", checked)}
// // //                 />
// // //                 <span className="text-sm text-gray-600">Include disabled products</span>
// // //               </div>
// // //             </div>
// // //           </div>
// // //         </CardContent>
// // //       </Card>

// // //       {/* Products List */}
// // //       <Card>
// // //         <CardHeader>
// // //           <div className="flex items-center gap-3">
// // //             <CardTitle className="text-lg font-semibold text-gray-900">Products Inventory</CardTitle>
// // //             <p className="text-sm text-gray-600 m-0 pt-1">
// // //               [{filteredProducts.length} of {products.length} products]
// // //             </p>
// // //           </div>
// // //         </CardHeader>
// // //         <CardContent className="p-0">
// // //           {filteredProducts.length === 0 ? (
// // //             <div className="text-center py-12">
// // //               <div className="text-gray-400 mb-4">📦</div>
// // //               <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
// // //               <p className="text-gray-500 mb-4">
// // //                 {products.length === 0
// // //                   ? "Get started by adding your first product."
// // //                   : "Try adjusting your search or filters."}
// // //               </p>
// // //               {products.length === 0 && (
// // //                 <Button
// // //                   onClick={() => setShowAddModal(true)}
// // //                   className="bg-blue-500 hover:bg-blue-600 text-white"
// // //                 >
// // //                   <Plus className="w-4 h-4 mr-2" />
// // //                   Add Product
// // //                 </Button>
// // //               )}
// // //             </div>
// // //           ) : (
// // //             <div className="overflow-x-auto">
// // //               <table className="w-full">
// // //                 <thead className="bg-gray-50">
// // //                   <tr>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                       Product
// // //                     </th>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                       Category
// // //                     </th>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                       Size/Weight
// // //                     </th>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                       Barcode
// // //                     </th>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                       Status
// // //                     </th>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                       Actions
// // //                     </th>
// // //                   </tr>
// // //                 </thead>
// // //                 <tbody className="bg-white divide-y divide-gray-200">
// // //                   {filteredProducts.map((product: Product) => (
// // //                     <tr
// // //                       key={product._id}
// // //                       className={!product.isActive ? "bg-gray-50 opacity-75" : ""}
// // //                     >
// // //                       <td className="px-6 py-4 whitespace-nowrap">
// // //                         <div className="flex items-center">
// // //                           {product.imageURL ? (
// // //                             <img
// // //                               src={product.imageURL}
// // //                               alt={product.name}
// // //                               className="w-10 h-10 rounded-lg object-cover"
// // //                               onError={(e) => {
// // //                                 e.currentTarget.style.display = "none";
// // //                               }}
// // //                             />
// // //                           ) : (
// // //                             <div
// // //                               className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
// // //                                 product.isActive ? "bg-gray-100" : "bg-gray-200"
// // //                               }`}
// // //                             >
// // //                               {getCategoryIcon(getCategoryName(product))}
// // //                             </div>
// // //                           )}
// // //                           <div className="ml-3">
// // //                             <p
// // //                               className={`text-sm font-medium ${
// // //                                 product.isActive ? "text-gray-900" : "text-gray-500"
// // //                               }`}
// // //                             >
// // //                               {product.name}
// // //                             </p>
// // //                             <p className="text-sm text-gray-500 truncate max-w-xs">
// // //                               {product.description || "No description"}
// // //                             </p>
// // //                           </div>
// // //                         </div>
// // //                       </td>
// // //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
// // //                         {getCategoryName(product)}
// // //                       </td>
// // //                       <td className="px-6 py-4 whitespace-nowrap">
// // //                         <div className="text-sm text-gray-900">
// // //                           {product.size && <span className="font-medium">{product.size}</span>}
// // //                           {product.weight && <div className="text-gray-500">{product.weight}</div>}
// // //                           {product.volume && <div className="text-gray-500">{product.volume}</div>}
// // //                           {!product.size && !product.weight && !product.volume && (
// // //                             <span className="text-gray-400">N/A</span>
// // //                           )}
// // //                         </div>
// // //                       </td>
// // //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
// // //                         {product.barcode || <span className="text-gray-400">N/A</span>}
// // //                       </td>
// // //                       <td className="px-6 py-4 whitespace-nowrap">
// // //                         <Badge
// // //                           variant={product.isActive ? "default" : "secondary"}
// // //                           className={
// // //                             product.isActive ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"
// // //                           }
// // //                         >
// // //                           {product.isActive ? "Active" : "Disabled"}
// // //                         </Badge>
// // //                       </td>
// // //                       {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
// // //                         <div className="flex space-x-1">
// // //                           <Button
// // //                             variant="ghost"
// // //                             size="sm"
// // //                             onClick={() => handleAddStock(product)}
// // //                             className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
// // //                             title="Add Stock Entry"
// // //                           >
// // //                             <PackagePlus className="w-4 h-4" />
// // //                           </Button>
// // //                           <Button
// // //                             variant="ghost"
// // //                             size="sm"
// // //                             onClick={() => handleEditProduct(product)}
// // //                             className="text-purple-500 hover:text-purple-600 hover:bg-purple-50"
// // //                             title="Edit Product"
// // //                           >
// // //                             <Edit className="w-4 h-4" />
// // //                           </Button>
// // //                           <Button
// // //                             variant="ghost"
// // //                             size="sm"
// // //                             onClick={() => handleToggleActive(product._id, product.isActive)}
// // //                             disabled={toggleProductMutation.isPending}
// // //                             className={
// // //                               product.isActive
// // //                                 ? "text-orange-500 hover:text-orange-600 hover:bg-orange-50"
// // //                                 : "text-green-500 hover:text-green-600 hover:bg-green-50"
// // //                             }
// // //                             title={product.isActive ? "Disable Product" : "Enable Product"}
// // //                           >
// // //                             {toggleProductMutation.isPending ? (
// // //                               <Loader2 className="w-4 h-4 animate-spin" />
// // //                             ) : product.isActive ? (
// // //                               <EyeOff className="w-4 h-4" />
// // //                             ) : (
// // //                               <Eye className="w-4 h-4" />
// // //                             )}
// // //                           </Button>
// // //                           <Button
// // //                             variant="ghost"
// // //                             size="sm"
// // //                             onClick={() => handleDeleteProduct(product._id, product.name)}
// // //                             disabled={deleteProductMutation.isPending}
// // //                             className="text-red-500 hover:text-red-600 hover:bg-red-50"
// // //                             title="Delete Product"
// // //                           >
// // //                             {deleteProductMutation.isPending ? (
// // //                               <Loader2 className="w-4 h-4 animate-spin" />
// // //                             ) : (
// // //                               <Trash2 className="w-4 h-4" />
// // //                             )}
// // //                           </Button>
// // //                         </div>
// // //                       </td> */}
// // //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
// // //                         <div className="flex space-x-1">
// // //                           {/* Stock Report for Individual Product */}
// // //                           <Button
// // //                             variant="ghost"
// // //                             size="sm"
// // //                             onClick={() => handleOpenStockReport(product._id)}
// // //                             className="text-green-500 hover:text-green-600 hover:bg-green-50"
// // //                             title="Stock Report"
// // //                           >
// // //                             <FileSpreadsheet className="w-4 h-4" />
// // //                           </Button>

// // //                           {/* Add Stock Entry */}
// // //                           <Button
// // //                             variant="ghost"
// // //                             size="sm"
// // //                             onClick={() => handleAddStock(product)}
// // //                             className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
// // //                             title="Add Stock Entry"
// // //                           >
// // //                             <PackagePlus className="w-4 h-4" />
// // //                           </Button>

// // //                           {/* Edit Product */}
// // //                           <Button
// // //                             variant="ghost"
// // //                             size="sm"
// // //                             onClick={() => handleEditProduct(product)}
// // //                             className="text-purple-500 hover:text-purple-600 hover:bg-purple-50"
// // //                             title="Edit Product"
// // //                           >
// // //                             <Edit className="w-4 h-4" />
// // //                           </Button>

// // //                           {/* Toggle Active/Inactive */}
// // //                           <Button
// // //                             variant="ghost"
// // //                             size="sm"
// // //                             onClick={() => handleToggleActive(product._id, product.isActive)}
// // //                             disabled={toggleProductMutation.isPending}
// // //                             className={
// // //                               product.isActive
// // //                                 ? "text-orange-500 hover:text-orange-600 hover:bg-orange-50"
// // //                                 : "text-green-500 hover:text-green-600 hover:bg-green-50"
// // //                             }
// // //                             title={product.isActive ? "Disable Product" : "Enable Product"}
// // //                           >
// // //                             {toggleProductMutation.isPending ? (
// // //                               <Loader2 className="w-4 h-4 animate-spin" />
// // //                             ) : product.isActive ? (
// // //                               <EyeOff className="w-4 h-4" />
// // //                             ) : (
// // //                               <Eye className="w-4 h-4" />
// // //                             )}
// // //                           </Button>

// // //                           {/* Delete Product */}
// // //                           <Button
// // //                             variant="ghost"
// // //                             size="sm"
// // //                             onClick={() => handleDeleteProduct(product._id, product.name)}
// // //                             disabled={deleteProductMutation.isPending}
// // //                             className="text-red-500 hover:text-red-600 hover:bg-red-50"
// // //                             title="Delete Product"
// // //                           >
// // //                             {deleteProductMutation.isPending ? (
// // //                               <Loader2 className="w-4 h-4 animate-spin" />
// // //                             ) : (
// // //                               <Trash2 className="w-4 h-4" />
// // //                             )}
// // //                           </Button>
// // //                         </div>
// // //                       </td>
// // //                     </tr>
// // //                   ))}
// // //                 </tbody>
// // //               </table>
// // //             </div>
// // //           )}
// // //         </CardContent>
// // //       </Card>

// // //       {/* <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
// // //       <EditProductModal
// // //         open={showEditModal}
// // //         onOpenChange={setShowEditModal}
// // //         product={selectedProduct}
// // //       />
      
// // //       {stockProduct && (
// // //         <AddStockEntryModal
// // //           open={!!stockProduct}
// // //           onOpenChange={(open) => !open && setStockProduct(null)}
// // //           productId={stockProduct._id}
// // //           productName={stockProduct.name}
// // //           categoryId={getCategoryId(stockProduct)}
// // //         />
// // //       )}

// // //       <StockReportModal
// // //         open={showStockReportModal}
// // //         onOpenChange={setShowStockReportModal}
// // //         products={products}
// // //         preSelectedProductId={stockReportProductId}
// // //       /> */}

// // //       <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
      
// // //       <EditProductModal
// // //         open={showEditModal}
// // //         onOpenChange={setShowEditModal}
// // //         product={selectedProduct}
// // //       />
      
// // //       {stockProduct && (
// // //         <AddStockEntryModal
// // //           open={!!stockProduct}
// // //           onOpenChange={(open) => !open && setStockProduct(null)}
// // //           productId={stockProduct._id}
// // //           productName={stockProduct.name}
// // //           categoryId={getCategoryId(stockProduct)}
// // //         />
// // //       )}

// // //       {/* Stock Report Modal - THIS WAS MISSING! */}
// // //       <StockReportModal
// // //         open={showStockReportModal}
// // //         onOpenChange={(open) => {
// // //           setShowStockReportModal(open);
// // //           if (!open) {
// // //             setStockReportProductId(null);
// // //           }
// // //         }}
// // //         products={products}
// // //         preSelectedProductId={stockReportProductId}
// // //       />
      
// // //     </div>
// // //   );
// // // }


// // // // // app/dashboard/products-tab.tsx
// // // // "use client";

// // // // import { useState, useMemo, useCallback } from 'react';
// // // // import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// // // // import { Button } from '@/components/ui/button';
// // // // import { Input } from '@/components/ui/input';
// // // // import { Label } from '@/components/ui/label';
// // // // import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// // // // import { Badge } from '@/components/ui/badge';
// // // // import { Switch } from '@/components/ui/switch';
// // // // import { Plus, Edit, Search, Trash2, Eye, EyeOff, Download, Loader2, AlertTriangle } from 'lucide-react';
// // // // import { toast } from 'sonner';
// // // // import AddProductModal from '@/components/modals/add-product-modal';
// // // // import EditProductModal from '@/components/modals/edit-product-modal';

// // // // import type { 
// // // //   ApiResponse, 
// // // //   Product, 
// // // //   ProductsResponse, 
// // // //   ProductFilterState 
// // // // } from "@/types/product";
// // // // import type { Category, CategoriesResponse } from '@/types/category';

// // // // export default function ProductsTab() {
// // // //   const [filterState, setFilterState] = useState<ProductFilterState>({
// // // //     searchTerm: "",
// // // //     selectedCategory: "all",
// // // //     showInactive: false,
// // // //   });
// // // //   const [showAddModal, setShowAddModal] = useState(false);
// // // //   const [showEditModal, setShowEditModal] = useState(false);
// // // //   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
// // // //   const queryClient = useQueryClient();

// // // //   // Fetch products with type-safe response
// // // //   const {
// // // //     data: productsResponse,
// // // //     isLoading: productsLoading,
// // // //     error: productsError,
// // // //     isError: isProductsError,
// // // //   } = useQuery<ApiResponse<ProductsResponse>, Error>({
// // // //     queryKey: ["products", filterState.showInactive],
// // // //     queryFn: async () => {
// // // //       const params = new URLSearchParams();
// // // //       if (filterState.showInactive) {
// // // //         params.append("includeInactive", "true");
// // // //       }

// // // //       const response = await fetch(`/api/products?${params}`);
// // // //       if (!response.ok) {
// // // //         throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
// // // //       }

// // // //       const data: ApiResponse<ProductsResponse> = await response.json();

// // // //       if (!data.success || !data.data) {
// // // //         throw new Error(data.error?.message || "Failed to fetch products");
// // // //       }

// // // //       return data;
// // // //     },
// // // //     retry: 2,
// // // //     staleTime: 5 * 60 * 1000,
// // // //     gcTime: 10 * 60 * 1000,
// // // //   });

// // // //   // Fetch categories
// // // //   const { data: categoriesResponse } = useQuery<ApiResponse<CategoriesResponse>, Error>({
// // // //     queryKey: ["categories"],
// // // //     queryFn: async () => {
// // // //       const response = await fetch("/api/categories");
// // // //       if (!response.ok) {
// // // //         throw new Error("Failed to fetch categories");
// // // //       }

// // // //       const data: ApiResponse<CategoriesResponse> = await response.json();

// // // //       if (!data.success || !data.data) {
// // // //         throw new Error(data.error?.message || "Failed to fetch categories");
// // // //       }

// // // //       return data;
// // // //     },
// // // //   });

// // // //   const products = productsResponse?.data?.products || [];
// // // //   const categories = categoriesResponse?.data?.categories || [];

// // // //   // Delete product mutation
// // // //   const deleteProductMutation = useMutation<ApiResponse<null>, Error, string>({
// // // //     mutationFn: async (productId: string) => {
// // // //       const response = await fetch(`/api/products/${productId}`, {
// // // //         method: "DELETE",
// // // //       });

// // // //       const result: ApiResponse<null> = await response.json();

// // // //       if (!response.ok) {
// // // //         throw new Error(result.error?.message || `Failed to delete product: ${response.status}`);
// // // //       }

// // // //       return result;
// // // //     },
// // // //     onSuccess: () => {
// // // //       queryClient.invalidateQueries({ queryKey: ["products"] });
// // // //       toast.success("Product deleted successfully.");
// // // //     },
// // // //     onError: (error: Error) => {
// // // //       console.error("Delete product error:", error);
// // // //       toast.error(`Failed to delete product: ${error.message}`);
// // // //     },
// // // //   });

// // // //   // Toggle product status mutation
// // // //   const toggleProductMutation = useMutation<
// // // //     ApiResponse<Product>,
// // // //     Error,
// // // //     { productId: string; isActive: boolean }
// // // //   >({
// // // //     mutationFn: async ({ productId, isActive }) => {
// // // //       const response = await fetch(`/api/products/${productId}`, {
// // // //         method: "PATCH",
// // // //         headers: { "Content-Type": "application/json" },
// // // //         body: JSON.stringify({ isActive }),
// // // //       });

// // // //       const result: ApiResponse<Product> = await response.json();

// // // //       if (!response.ok) {
// // // //         throw new Error(result.error?.message || `Failed to update product: ${response.status}`);
// // // //       }

// // // //       return result;
// // // //     },
// // // //     onSuccess: () => {
// // // //       queryClient.invalidateQueries({ queryKey: ["products"] });
// // // //       toast.success("Product status updated successfully.");
// // // //     },
// // // //     onError: (error: Error) => {
// // // //       console.error("Toggle product error:", error);
// // // //       toast.error(`Failed to update product: ${error.message}`);
// // // //     },
// // // //   });

// // // //   const handleFilterChange = useCallback((key: keyof ProductFilterState, value: string | boolean) => {
// // // //     setFilterState((prev) => ({ ...prev, [key]: value }));
// // // //   }, []);

// // // //   const handleEditProduct = useCallback((product: Product) => {
// // // //     setSelectedProduct(product);
// // // //     setShowEditModal(true);
// // // //   }, []);

// // // //   const handleToggleActive = useCallback(
// // // //     (productId: string, currentStatus: boolean) => {
// // // //       toggleProductMutation.mutate({ productId, isActive: !currentStatus });
// // // //     },
// // // //     [toggleProductMutation]
// // // //   );

// // // //   const handleDeleteProduct = useCallback(
// // // //     (productId: string, productName: string) => {
// // // //       if (
// // // //         window.confirm(
// // // //           `Are you sure you want to delete "${productName}"? This action cannot be undone.`
// // // //         )
// // // //       ) {
// // // //         deleteProductMutation.mutate(productId);
// // // //       }
// // // //     },
// // // //     [deleteProductMutation]
// // // //   );

// // // //   const getCategoryIcon = useCallback((categoryName: string): string => {
// // // //     if (!categoryName) return "📦";

// // // //     switch (categoryName.toLowerCase()) {
// // // //       case "food":
// // // //         return "🍜";
// // // //       case "stationery":
// // // //         return "📚";
// // // //       case "daily use":
// // // //         return "🧴";
// // // //       case "pooja":
// // // //         return "🔥";
// // // //       default:
// // // //         return "📦";
// // // //     }
// // // //   }, []);

// // // //   const getCategoryName = useCallback(
// // // //     (product: Product): string => {
// // // //       // Check if category is populated
// // // //       if (product.category && typeof product.category === "object" && "name" in product.category) {
// // // //         return product.category.name;
// // // //       }

// // // //       // Fallback to looking up by categoryId
// // // //       const category = categories.find((cat) => cat._id === product.categoryId);
// // // //       return category?.name || "Uncategorized";
// // // //     },
// // // //     [categories]
// // // //   );

// // // //   // Memoized filtered products
// // // //   const filteredProducts = useMemo(() => {
// // // //     if (!Array.isArray(products)) {
// // // //       console.warn("products is not an array:", products);
// // // //       return [];
// // // //     }

// // // //     return products.filter((product: Product) => {
// // // //       if (!product) return false;

// // // //       const searchTerm = filterState.searchTerm.toLowerCase().trim();
// // // //       const matchesSearch =
// // // //         !searchTerm ||
// // // //         product.name?.toLowerCase().includes(searchTerm) ||
// // // //         product.description?.toLowerCase().includes(searchTerm);

// // // //       let matchesCategory = true;
// // // //       if (filterState.selectedCategory !== "all") {
// // // //         matchesCategory = product.categoryId === filterState.selectedCategory;
// // // //       }

// // // //       return matchesSearch && matchesCategory;
// // // //     });
// // // //   }, [products, filterState.searchTerm, filterState.selectedCategory]);

// // // //   // CLIENT-SIDE EXPORT FUNCTIONALITY
// // // //   const handleExport = useCallback(() => {
// // // //     try {
// // // //       const headers = [
// // // //         "Product Name",
// // // //         "Category",
// // // //         "Description",
// // // //         "Has Variants",
// // // //         "Variant Count",
// // // //         "Status",
// // // //         "Created At",
// // // //       ];

// // // //       const rows = filteredProducts.map((product: Product) => {
// // // //         const categoryName = getCategoryName(product);
// // // //         const createdDate = new Date(product.createdAt).toLocaleDateString("en-GB", {
// // // //           day: "2-digit",
// // // //           month: "2-digit",
// // // //           year: "numeric",
// // // //         });

// // // //         return [
// // // //           `"${product.name}"`,
// // // //           `"${categoryName}"`,
// // // //           `"${product.description || "N/A"}"`,
// // // //           product.hasVariants ? "Yes" : "No",
// // // //           product.variantCount || 0,
// // // //           product.isActive ? "Active" : "Disabled",
// // // //           createdDate,
// // // //         ].join(",");
// // // //       });

// // // //       const csvContent = [headers.join(","), ...rows].join("\n");

// // // //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// // // //       const url = window.URL.createObjectURL(blob);
// // // //       const link = document.createElement("a");
// // // //       link.href = url;
// // // //       link.download = `products-${new Date().toISOString().split("T")[0]}.csv`;
// // // //       document.body.appendChild(link);
// // // //       link.click();
// // // //       document.body.removeChild(link);
// // // //       window.URL.revokeObjectURL(url);

// // // //       toast.success("Products exported successfully!");
// // // //     } catch (error) {
// // // //       console.error("Export error:", error);
// // // //       toast.error("Failed to export products");
// // // //     }
// // // //   }, [filteredProducts, getCategoryName]);

// // // //   // Error state
// // // //   if (isProductsError) {
// // // //     return (
// // // //       <Card className="p-8">
// // // //         <div className="text-center">
// // // //           <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
// // // //           <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Products</h3>
// // // //           <p className="text-gray-600 mb-4">
// // // //             {productsError instanceof Error ? productsError.message : "An unknown error occurred"}
// // // //           </p>
// // // //           <Button
// // // //             onClick={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
// // // //             variant="outline"
// // // //           >
// // // //             Try Again
// // // //           </Button>
// // // //         </div>
// // // //       </Card>
// // // //     );
// // // //   }

// // // //   if (productsLoading) {
// // // //     return (
// // // //       <Card className="p-8">
// // // //         <div className="text-center">
// // // //           <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
// // // //           <p className="text-gray-600">Loading products...</p>
// // // //         </div>
// // // //       </Card>
// // // //     );
// // // //   }

// // // //   return (
// // // //     <div className="space-y-6">
// // // //       <div className="flex justify-between items-center">
// // // //         <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
// // // //         <div className="flex space-x-2">
// // // //           <Button onClick={handleExport} variant="outline" disabled={filteredProducts.length === 0}>
// // // //             <Download className="w-4 h-4 mr-2" />
// // // //             Export
// // // //           </Button>
// // // //           <Button
// // // //             onClick={() => setShowAddModal(true)}
// // // //             className="bg-blue-500 hover:bg-blue-600 text-white"
// // // //           >
// // // //             <Plus className="w-4 h-4 mr-2" />
// // // //             Add Product
// // // //           </Button>
// // // //         </div>
// // // //       </div>

// // // //       {/* Search and Filter */}
// // // //       <Card>
// // // //         <CardContent className="p-6">
// // // //           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search Products</Label>
// // // //               <div className="relative">
// // // //                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // // //                 <Input
// // // //                   placeholder="Product name..."
// // // //                   value={filterState.searchTerm}
// // // //                   onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
// // // //                   className="pl-10"
// // // //                 />
// // // //               </div>
// // // //             </div>
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Category</Label>
// // // //               <Select
// // // //                 value={filterState.selectedCategory}
// // // //                 onValueChange={(value) => handleFilterChange("selectedCategory", value)}
// // // //               >
// // // //                 <SelectTrigger>
// // // //                   <SelectValue placeholder="All Categories" />
// // // //                 </SelectTrigger>
// // // //                 <SelectContent>
// // // //                   <SelectItem value="all">All Categories</SelectItem>
// // // //                   {categories.map((category) => (
// // // //                     <SelectItem key={category._id} value={category._id}>
// // // //                       {category.name}
// // // //                     </SelectItem>
// // // //                   ))}
// // // //                 </SelectContent>
// // // //               </Select>
// // // //             </div>
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">
// // // //                 Show Inactive Products
// // // //               </Label>
// // // //               <div className="flex items-center space-x-2 mt-3">
// // // //                 <Switch
// // // //                   checked={filterState.showInactive}
// // // //                   onCheckedChange={(checked) => handleFilterChange("showInactive", checked)}
// // // //                 />
// // // //                 <span className="text-sm text-gray-600">Include disabled products</span>
// // // //               </div>
// // // //             </div>
// // // //           </div>
// // // //         </CardContent>
// // // //       </Card>

// // // //       {/* Products List */}
// // // //       <Card>
// // // //         <CardHeader>
// // // //           <div className="flex items-center gap-3">
// // // //             <CardTitle className="text-lg font-semibold text-gray-900">Products Inventory</CardTitle>
// // // //             <p className="text-sm text-gray-600 m-0 pt-1">
// // // //               [{filteredProducts.length} of {products.length} products]
// // // //             </p>
// // // //           </div>
// // // //         </CardHeader>
// // // //         <CardContent className="p-0">
// // // //           {filteredProducts.length === 0 ? (
// // // //             <div className="text-center py-12">
// // // //               <div className="text-gray-400 mb-4">📦</div>
// // // //               <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
// // // //               <p className="text-gray-500 mb-4">
// // // //                 {products.length === 0
// // // //                   ? "Get started by adding your first product."
// // // //                   : "Try adjusting your search or filters."}
// // // //               </p>
// // // //               {products.length === 0 && (
// // // //                 <Button
// // // //                   onClick={() => setShowAddModal(true)}
// // // //                   className="bg-blue-500 hover:bg-blue-600 text-white"
// // // //                 >
// // // //                   <Plus className="w-4 h-4 mr-2" />
// // // //                   Add Product
// // // //                 </Button>
// // // //               )}
// // // //             </div>
// // // //           ) : (
// // // //             <div className="overflow-x-auto">
// // // //               <table className="w-full">
// // // //                 <thead className="bg-gray-50">
// // // //                   <tr>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                       Product
// // // //                     </th>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                       Category
// // // //                     </th>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                       Variants
// // // //                     </th>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                       Created At
// // // //                     </th>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                       Status
// // // //                     </th>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                       Actions
// // // //                     </th>
// // // //                   </tr>
// // // //                 </thead>
// // // //                 <tbody className="bg-white divide-y divide-gray-200">
// // // //                   {filteredProducts.map((product: Product) => (
// // // //                     <tr
// // // //                       key={product._id}
// // // //                       className={!product.isActive ? "bg-gray-50 opacity-75" : ""}
// // // //                     >
// // // //                       <td className="px-6 py-4 whitespace-nowrap">
// // // //                         <div className="flex items-center">
// // // //                           <div
// // // //                             className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
// // // //                               product.isActive ? "bg-gray-100" : "bg-gray-200"
// // // //                             }`}
// // // //                           >
// // // //                             {getCategoryIcon(getCategoryName(product))}
// // // //                           </div>
// // // //                           <div className="ml-3">
// // // //                             <p
// // // //                               className={`text-sm font-medium ${
// // // //                                 product.isActive ? "text-gray-900" : "text-gray-500"
// // // //                               }`}
// // // //                             >
// // // //                               {product.name}
// // // //                             </p>
// // // //                             <p className="text-sm text-gray-500">
// // // //                               {product.description || "No description"}
// // // //                             </p>
// // // //                           </div>
// // // //                         </div>
// // // //                       </td>
// // // //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
// // // //                         {getCategoryName(product)}
// // // //                       </td>
// // // //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
// // // //                         <Badge variant="outline" className="bg-blue-50 text-blue-700">
// // // //                           {product.hasVariants
// // // //                             ? `${product.variantCount || 0} variants`
// // // //                             : "No variants"}
// // // //                         </Badge>
// // // //                       </td>
// // // //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
// // // //                         {new Date(product.createdAt).toLocaleDateString("en-GB", {
// // // //                           day: "2-digit",
// // // //                           month: "2-digit",
// // // //                           year: "numeric",
// // // //                         })}
// // // //                       </td>
// // // //                       <td className="px-6 py-4 whitespace-nowrap">
// // // //                         <Badge
// // // //                           variant={product.isActive ? "default" : "secondary"}
// // // //                           className={
// // // //                             product.isActive ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"
// // // //                           }
// // // //                         >
// // // //                           {product.isActive ? "Active" : "Disabled"}
// // // //                         </Badge>
// // // //                       </td>
// // // //                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
// // // //                         <div className="flex space-x-2">
// // // //                           <Button
// // // //                             variant="ghost"
// // // //                             size="sm"
// // // //                             onClick={() => handleToggleActive(product._id, product.isActive)}
// // // //                             disabled={toggleProductMutation.isPending}
// // // //                             className={
// // // //                               product.isActive
// // // //                                 ? "text-orange-500 hover:text-orange-600"
// // // //                                 : "text-green-500 hover:text-green-600"
// // // //                             }
// // // //                             title={product.isActive ? "Disable Product" : "Enable Product"}
// // // //                           >
// // // //                             {toggleProductMutation.isPending ? (
// // // //                               <Loader2 className="w-4 h-4 animate-spin" />
// // // //                             ) : product.isActive ? (
// // // //                               <EyeOff className="w-4 h-4" />
// // // //                             ) : (
// // // //                               <Eye className="w-4 h-4" />
// // // //                             )}
// // // //                           </Button>
// // // //                           <Button
// // // //                             variant="ghost"
// // // //                             size="sm"
// // // //                             onClick={() => handleEditProduct(product)}
// // // //                             className="text-purple-500 hover:text-purple-600"
// // // //                             title="Edit Product"
// // // //                           >
// // // //                             <Edit className="w-4 h-4" />
// // // //                           </Button>
// // // //                           <Button
// // // //                             variant="ghost"
// // // //                             size="sm"
// // // //                             onClick={() => handleDeleteProduct(product._id, product.name)}
// // // //                             disabled={deleteProductMutation.isPending}
// // // //                             className="text-red-500 hover:text-red-600"
// // // //                             title="Delete Product"
// // // //                           >
// // // //                             {deleteProductMutation.isPending ? (
// // // //                               <Loader2 className="w-4 h-4 animate-spin" />
// // // //                             ) : (
// // // //                               <Trash2 className="w-4 h-4" />
// // // //                             )}
// // // //                           </Button>
// // // //                         </div>
// // // //                       </td>
// // // //                     </tr>
// // // //                   ))}
// // // //                 </tbody>
// // // //               </table>
// // // //             </div>
// // // //           )}
// // // //         </CardContent>
// // // //       </Card>

// // // //       <AddProductModal open={showAddModal} onOpenChange={setShowAddModal} />
// // // //       <EditProductModal
// // // //         open={showEditModal}
// // // //         onOpenChange={setShowEditModal}
// // // //         product={selectedProduct}
// // // //       />
// // // //     </div>
// // // //   );
// // // // }