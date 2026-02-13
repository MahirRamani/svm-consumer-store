// components/dashboard/tabs/stock-transactions-management.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Edit, 
  Package,
  TrendingUp,
  TrendingDown,
  Settings,
  Download,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import EditStockTransactionModal from "@/components/modals/edit-stock-transaction-modal";
import type { Category, CategoriesListResponse } from "@/types";
import type { StockTransaction, StockTransactionsListResponse } from "@/types/stock-transaction";

interface StockTransactionsApiResponse extends StockTransactionsListResponse {}

export default function StockTransactionsManagement() {
  // =============================================
  // STATE
  // =============================================
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<StockTransaction | null>(null);

  // =============================================
  // QUERIES
  // =============================================
  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ["stock-transactions", page, limit, sortBy, sortOrder, selectedCategory, selectedType],
    queryFn: async (): Promise<StockTransactionsApiResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });

      if (selectedCategory !== "all") {
        params.append("categoryId", selectedCategory);
      }
      if (selectedType !== "all") {
        params.append("stockType", selectedType);
      }

      const response = await fetch(`/api/stock-transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch stock transactions");
      return response.json();
    },
  });

  // Fetch categories for filter
  const { data: categoriesData } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data: CategoriesListResponse = await response.json();
      return data.data?.categories || [];
    },
  });

  const transactions: StockTransaction[] = transactionsData?.data?.transactions || [];
  const pagination = transactionsData?.metadata;
  // const categories: Category[] = categoriesData || [];
  const categories: Category[] = Array.isArray(categoriesData) ? categoriesData : [];

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================
  const convertToNumber = useCallback((value: any): number => {
    if (typeof value === 'number') return value;
    if (value?.$numberDecimal) return parseFloat(value.$numberDecimal);
    return 0;
  }, []);

  // =============================================
  // MEMOIZED VALUES
  // =============================================
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    
    return transactions.filter((txn) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        txn.productId?.name.toLowerCase().includes(searchLower) ||
        txn.categoryId?.name.toLowerCase().includes(searchLower) ||
        txn.createdBy?.username.toLowerCase().includes(searchLower)
      );
    });
  }, [transactions, searchTerm]);

  // =============================================
  // CALLBACKS
  // =============================================
  const handleEditTransaction = useCallback((transaction: StockTransaction) => {
    setSelectedTransaction(transaction);
    setShowEditModal(true);
  }, []);

  const handleEditModalClose = useCallback((open: boolean) => {
    setShowEditModal(open);
    if (!open) {
      setSelectedTransaction(null);
    }
  }, []);

  const handleExportTransactions = useCallback(() => {
    try {
      const headers = [
        "Date",
        "Product",
        "Category",
        "Type",
        "Initial Qty",
        "Qty Left",
        "Buying Price",
        "Selling Price",
        "Reason",
        "Created By",
      ];

      const rows = filteredTransactions.map((txn) => [
        new Date(txn.purchaseDate || txn.date || txn.createdAt).toLocaleDateString(),
        `"${txn.productId?.name || 'Unknown'}${txn.productId?.size ? ` (${txn.productId.size})` : ""}"`,
        `"${txn.categoryId?.name || 'N/A'}"`,
        txn.stockType,
        txn.initialQuantity,
        txn.quantityLeft,
        txn.buyingPrice ? convertToNumber(txn.buyingPrice).toFixed(2) : "N/A",
        convertToNumber(txn.sellingPrice).toFixed(2),
        `"${txn.reason || ""}"`,
        `"${txn.createdBy?.username || 'N/A'}"`,
      ].join(","));

      const csvContent = [headers.join(","), ...rows].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stock-transactions-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Transactions exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export transactions");
    }
  }, [filteredTransactions, convertToNumber]);

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================
  const getTransactionTypeConfig = useCallback((type: string) => {
    switch (type) {
      case "Buy":
        return {
          icon: <TrendingUp className="w-4 h-4" />,
          variant: "default" as const,
          className: "bg-green-500 hover:bg-green-600",
        };
      case "Sell":
        return {
          icon: <TrendingDown className="w-4 h-4" />,
          variant: "destructive" as const,
          className: "",
        };
      case "Adjustment":
        return {
          icon: <Settings className="w-4 h-4" />,
          variant: "secondary" as const,
          className: "",
        };
      default:
        return {
          icon: <Package className="w-4 h-4" />,
          variant: "secondary" as const,
          className: "",
        };
    }
  }, []);

  const formatCurrency = useCallback((amount: any) => {
    const num = convertToNumber(amount);
    return `₹${num.toFixed(2)}`;
  }, [convertToNumber]);

  const formatDate = useCallback((dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

  // =============================================
  // LOADING STATE
  // =============================================
  if (isLoading) {
    return <div className="text-center py-8">Loading stock transactions...</div>;
  }

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Transactions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track all inventory movements
          </p>
        </div>
        <div className="flex space-x-2">
          {/* Export Button */}
          <Button
            onClick={handleExportTransactions}
            variant="outline"
            disabled={filteredTransactions.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Product, category, user..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
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
                  {categories.map((category: Category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transaction Type Filter */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Type
              </Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Buy">Buy</SelectItem>
                  <SelectItem value="Sell">Sell</SelectItem>
                  <SelectItem value="Adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </Label>
              <Select 
                value={`${sortBy}-${sortOrder}`} 
                onValueChange={(value) => {
                  const [newSortBy, newSortOrder] = value.split("-");
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder as "asc" | "desc");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date (Newest)</SelectItem>
                  <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                  <SelectItem value="sellingPrice-desc">Price (High to Low)</SelectItem>
                  <SelectItem value="sellingPrice-asc">Price (Low to High)</SelectItem>
                  <SelectItem value="initialQuantity-desc">Quantity (High to Low)</SelectItem>
                  <SelectItem value="initialQuantity-asc">Quantity (Low to High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Transactions
            {pagination && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({pagination.totalCount} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium">No transactions found</p>
              <p className="text-sm mt-1">
                {searchTerm ? "Try adjusting your search or filters" : "Stock transactions will appear here"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prices
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTransactions.map((txn) => {
                      const typeConfig = getTransactionTypeConfig(txn.stockType);
                      
                      return (
                        <tr key={txn._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(txn.purchaseDate || txn.date || txn.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {txn.productId?.imageURL ? (
                                <img
                                  src={txn.productId.imageURL}
                                  alt={txn.productId.name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div className="ml-3">
                                <p className="text-sm font-medium text-gray-900">
                                  {txn.productId?.name || 'Unknown Product'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {txn.categoryId?.name}
                                  {txn.productId?.size && ` • ${txn.productId.size}`}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={typeConfig.variant} className={typeConfig.className}>
                              <span className="flex items-center gap-1">
                                {typeConfig.icon}
                                {txn.stockType}
                              </span>
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {txn.quantityLeft} / {txn.initialQuantity}
                              </div>
                              <div className="text-xs text-gray-500">
                                Left / Initial
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="font-medium text-green-600">
                                Sell: {formatCurrency(txn.sellingPrice)}
                              </div>
                              {txn.buyingPrice && (
                                <div className="text-xs text-gray-500">
                                  Buy: {formatCurrency(txn.buyingPrice)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {txn.createdBy?.username || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTransaction(txn)}
                              className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                              title="Edit Transaction"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing page {pagination.page} of {pagination.totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page === pagination.totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <EditStockTransactionModal
        open={showEditModal}
        onOpenChange={handleEditModalClose}
        transaction={selectedTransaction}
      />
    </div>
  );
}


// // components/dashboard/tabs/stock-transactions-management.tsx
// "use client";

// import { useState, useMemo, useCallback } from "react";
// import { useQuery } from "@tanstack/react-query";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Badge } from "@/components/ui/badge";
// import { 
//   Search, 
//   Edit, 
//   Package,
//   TrendingUp,
//   TrendingDown,
//   Settings,
//   Download,
//   ChevronLeft,
//   ChevronRight
// } from "lucide-react";
// import { toast } from "sonner";
// import EditStockTransactionModal from "@/components/modals/edit-stock-transaction-modal";
// import type { Category, CategoriesListResponse } from "@/types";
// import type { StockTransaction, StockTransactionsListResponse } from "@/types/stock-transaction";

// interface StockTransactionsApiResponse extends StockTransactionsListResponse {}

// export default function StockTransactionsManagement() {
//   // =============================================
//   // STATE
//   // =============================================
//   const [searchTerm, setSearchTerm] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState<string>("all");
//   const [selectedType, setSelectedType] = useState<string>("all");
//   const [page, setPage] = useState(1);
//   const [limit] = useState(20);
//   const [sortBy, setSortBy] = useState<string>("date");
//   const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
//   const [showEditModal, setShowEditModal] = useState(false);
//   const [selectedTransaction, setSelectedTransaction] = useState<StockTransaction | null>(null);

//   // =============================================
//   // QUERIES
//   // =============================================
//   const { data: transactionsData, isLoading } = useQuery({
//     queryKey: ["stock-transactions", page, limit, sortBy, sortOrder, selectedCategory, selectedType],
//     queryFn: async (): Promise<StockTransactionsApiResponse> => {
//       const params = new URLSearchParams({
//         page: page.toString(),
//         limit: limit.toString(),
//         sortBy,
//         sortOrder,
//       });

//       if (selectedCategory !== "all") {
//         params.append("categoryId", selectedCategory);
//       }
//       if (selectedType !== "all") {
//         params.append("transactionType", selectedType);
//       }

//       const response = await fetch(`/api/stock-transactions?${params}`);
//       if (!response.ok) throw new Error("Failed to fetch stock transactions");
//       return response.json();
//     },
//   });

//   // Fetch categories for filter
//   const { data: categoriesData } = useQuery<Category[]>({
//     queryKey: ["categories"],
//     queryFn: async () => {
//       const response = await fetch("/api/categories");
//       if (!response.ok) throw new Error("Failed to fetch categories");
//       const data: CategoriesListResponse = await response.json();
//       return data.data?.categories || [];
//     },
//   });

//   const transactions: StockTransaction[] = transactionsData?.data?.transactions || [];
//   const pagination = transactionsData?.metadata;
//   const categories: Category[] = categoriesData || [];

//   // =============================================
//   // MEMOIZED VALUES
//   // =============================================
//   const filteredTransactions = useMemo(() => {
//     if (!searchTerm) return transactions;
    
//     return transactions.filter((txn) => {
//       const searchLower = searchTerm.toLowerCase();
//       return (
//         txn.productId?.name.toLowerCase().includes(searchLower) ||
//         txn.categoryId?.name.toLowerCase().includes(searchLower) ||
//         txn.createdBy?.username.toLowerCase().includes(searchLower)
//       );
//     });
//   }, [transactions, searchTerm]);

//   // =============================================
//   // CALLBACKS
//   // =============================================
//   const handleEditTransaction = useCallback((transaction: StockTransaction) => {
//     setSelectedTransaction(transaction);
//     setShowEditModal(true);
//   }, []);

//   const handleEditModalClose = useCallback((open: boolean) => {
//     setShowEditModal(open);
//     if (!open) {
//       setSelectedTransaction(null);
//     }
//   }, []);

//   const handleExportTransactions = useCallback(() => {
//     try {
//       const headers = [
//         "Date",
//         "Product",
//         "Category",
//         "Type",
//         "Initial Qty",
//         "Qty Left",
//         "Buying Price",
//         "Selling Price",
//         "Reason",
//         "Created By",
//       ];

//       const rows = filteredTransactions.map((txn) => [
//         new Date(txn.purchaseDate || txn.date || txn.createdAt).toLocaleDateString(),
//         `"${txn.productId?.name || 'Unknown'}${txn.productId?.size ? ` (${txn.productId.size})` : ""}"`,
//         `"${txn.categoryId?.name || 'N/A'}"`,
//         txn.transactionType,
//         txn.initialQuantity,
//         txn.quantityLeft,
//         txn.buyingPrice ? convertToNumber(txn.buyingPrice).toFixed(2) : "N/A",
//         convertToNumber(txn.sellingPrice).toFixed(2),
//         `"${txn.reason || ""}"`,
//         `"${txn.createdBy?.username || 'N/A'}"`,
//       ].join(","));

//       const csvContent = [headers.join(","), ...rows].join("\n");

//       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
//       const url = window.URL.createObjectURL(blob);
//       const link = document.createElement("a");
//       link.href = url;
//       link.download = `stock-transactions-${new Date().toISOString().split("T")[0]}.csv`;
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       window.URL.revokeObjectURL(url);

//       toast.success("Transactions exported successfully!");
//     } catch (error) {
//       console.error("Export error:", error);
//       toast.error("Failed to export transactions");
//     }
//   }, [filteredTransactions, convertToNumber]);

//   // =============================================
//   // UTILITY FUNCTIONS
//   // =============================================
//   const convertToNumber = useCallback((value: any): number => {
//     if (typeof value === 'number') return value;
//     if (value?.$numberDecimal) return parseFloat(value.$numberDecimal);
//     return 0;
//   }, []);

//   const getTransactionTypeConfig = useCallback((type: string) => {
//     switch (type) {
//       case "Buy":
//         return {
//           icon: <TrendingUp className="w-4 h-4" />,
//           variant: "default" as const,
//           className: "bg-green-500 hover:bg-green-600",
//         };
//       case "Sell":
//         return {
//           icon: <TrendingDown className="w-4 h-4" />,
//           variant: "destructive" as const,
//           className: "",
//         };
//       case "Adjustment":
//         return {
//           icon: <Settings className="w-4 h-4" />,
//           variant: "secondary" as const,
//           className: "",
//         };
//       default:
//         return {
//           icon: <Package className="w-4 h-4" />,
//           variant: "secondary" as const,
//           className: "",
//         };
//     }
//   }, []);

//   const formatCurrency = useCallback((amount: any) => {
//     const num = convertToNumber(amount);
//     return `₹${num.toFixed(2)}`;
//   }, [convertToNumber]);

//   const formatDate = useCallback((dateString: string | Date) => {
//     return new Date(dateString).toLocaleDateString("en-IN", {
//       day: "2-digit",
//       month: "short",
//       year: "numeric",
//     });
//   }, []);

//   // =============================================
//   // LOADING STATE
//   // =============================================
//   if (isLoading) {
//     return <div className="text-center py-8">Loading stock transactions...</div>;
//   }

//   // =============================================
//   // RENDER
//   // =============================================
//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex justify-between items-center">
//         <div>
//           <h2 className="text-2xl font-bold text-gray-900">Stock Transactions</h2>
//           <p className="text-sm text-gray-500 mt-1">
//             Manage and track all inventory movements
//           </p>
//         </div>
//         <div className="flex space-x-2">
//           {/* Export Button */}
//           <Button
//             onClick={handleExportTransactions}
//             variant="outline"
//             disabled={filteredTransactions.length === 0}
//           >
//             <Download className="w-4 h-4 mr-2" />
//             Export
//           </Button>
//         </div>
//       </div>

//       {/* Filters */}
//       <Card>
//         <CardContent className="p-6">
//           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//             {/* Search */}
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">
//                 Search
//               </Label>
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//                 <Input
//                   placeholder="Product, category, user..."
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="pl-10"
//                 />
//               </div>
//             </div>

//             {/* Category Filter */}
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">
//                 Category
//               </Label>
//               <Select value={selectedCategory} onValueChange={setSelectedCategory}>
//                 <SelectTrigger>
//                   <SelectValue placeholder="All Categories" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All Categories</SelectItem>
//                   {categories.map((category: Category) => (
//                     <SelectItem key={category._id} value={category._id}>
//                       {category.name}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* Transaction Type Filter */}
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">
//                 Transaction Type
//               </Label>
//               <Select value={selectedType} onValueChange={setSelectedType}>
//                 <SelectTrigger>
//                   <SelectValue placeholder="All Types" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All Types</SelectItem>
//                   <SelectItem value="Buy">Buy</SelectItem>
//                   <SelectItem value="Sell">Sell</SelectItem>
//                   <SelectItem value="Adjustment">Adjustment</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* Sort */}
//             <div>
//               <Label className="block text-sm font-medium text-gray-700 mb-2">
//                 Sort By
//               </Label>
//               <Select 
//                 value={`${sortBy}-${sortOrder}`} 
//                 onValueChange={(value) => {
//                   const [newSortBy, newSortOrder] = value.split("-");
//                   setSortBy(newSortBy);
//                   setSortOrder(newSortOrder as "asc" | "desc");
//                 }}
//               >
//                 <SelectTrigger>
//                   <SelectValue />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="date-desc">Date (Newest)</SelectItem>
//                   <SelectItem value="date-asc">Date (Oldest)</SelectItem>
//                   <SelectItem value="sellingPrice-desc">Price (High to Low)</SelectItem>
//                   <SelectItem value="sellingPrice-asc">Price (Low to High)</SelectItem>
//                   <SelectItem value="initialQuantity-desc">Quantity (High to Low)</SelectItem>
//                   <SelectItem value="initialQuantity-asc">Quantity (Low to High)</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Transactions Table */}
//       <Card>
//         <CardHeader>
//           <CardTitle className="text-lg font-semibold text-gray-900">
//             Transactions
//             {pagination && (
//               <span className="ml-2 text-sm font-normal text-gray-500">
//                 ({pagination.totalCount} total)
//               </span>
//             )}
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="p-0">
//           {filteredTransactions.length === 0 ? (
//             <div className="text-center py-12 text-gray-500">
//               <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
//               <p className="text-lg font-medium">No transactions found</p>
//               <p className="text-sm mt-1">
//                 {searchTerm ? "Try adjusting your search or filters" : "Stock transactions will appear here"}
//               </p>
//             </div>
//           ) : (
//             <>
//               <div className="overflow-x-auto">
//                 <table className="w-full">
//                   <thead className="bg-gray-50">
//                     <tr>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Date
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Product
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Type
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Quantity
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Prices
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Created By
//                       </th>
//                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                         Actions
//                       </th>
//                     </tr>
//                   </thead>
//                   <tbody className="bg-white divide-y divide-gray-200">
//                     {filteredTransactions.map((txn) => {
//                       const typeConfig = getTransactionTypeConfig(txn.transactionType);
                      
//                       return (
//                         <tr key={txn._id} className="hover:bg-gray-50">
//                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                             {formatDate(txn.purchaseDate || txn.date || txn.createdAt)}
//                           </td>
//                           <td className="px-6 py-4 whitespace-nowrap">
//                             <div className="flex items-center">
//                               {txn.productId?.imageURL ? (
//                                 <img
//                                   src={txn.productId.imageURL}
//                                   alt={txn.productId.name}
//                                   className="w-10 h-10 rounded object-cover"
//                                 />
//                               ) : (
//                                 <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
//                                   <Package className="w-5 h-5 text-gray-400" />
//                                 </div>
//                               )}
//                               <div className="ml-3">
//                                 <p className="text-sm font-medium text-gray-900">
//                                   {txn.productId?.name || 'Unknown Product'}
//                                 </p>
//                                 <p className="text-xs text-gray-500">
//                                   {txn.categoryId?.name}
//                                   {txn.productId?.size && ` • ${txn.productId.size}`}
//                                 </p>
//                               </div>
//                             </div>
//                           </td>
//                           <td className="px-6 py-4 whitespace-nowrap">
//                             <Badge variant={typeConfig.variant} className={typeConfig.className}>
//                               <span className="flex items-center gap-1">
//                                 {typeConfig.icon}
//                                 {txn.transactionType}
//                               </span>
//                             </Badge>
//                           </td>
//                           <td className="px-6 py-4 whitespace-nowrap">
//                             <div className="text-sm">
//                               <div className="font-medium text-gray-900">
//                                 {txn.quantityLeft} / {txn.initialQuantity}
//                               </div>
//                               <div className="text-xs text-gray-500">
//                                 Left / Initial
//                               </div>
//                             </div>
//                           </td>
//                           <td className="px-6 py-4 whitespace-nowrap">
//                             <div className="text-sm">
//                               <div className="font-medium text-green-600">
//                                 Sell: {formatCurrency(txn.sellingPrice)}
//                               </div>
//                               {txn.buyingPrice && (
//                                 <div className="text-xs text-gray-500">
//                                   Buy: {formatCurrency(txn.buyingPrice)}
//                                 </div>
//                               )}
//                             </div>
//                           </td>
//                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                             {txn.createdBy?.username || 'N/A'}
//                           </td>
//                           <td className="px-6 py-4 whitespace-nowrap text-sm">
//                             <Button
//                               variant="ghost"
//                               size="sm"
//                               onClick={() => handleEditTransaction(txn)}
//                               className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
//                               title="Edit Transaction"
//                             >
//                               <Edit className="w-4 h-4" />
//                             </Button>
//                           </td>
//                         </tr>
//                       );
//                     })}
//                   </tbody>
//                 </table>
//               </div>

//               {/* Pagination */}
//               {pagination && pagination.totalPages > 1 && (
//                 <div className="px-6 py-4 border-t border-gray-200">
//                   <div className="flex items-center justify-between">
//                     <div className="text-sm text-gray-700">
//                       Showing page {pagination.page} of {pagination.totalPages}
//                     </div>
//                     <div className="flex gap-2">
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={() => setPage(page - 1)}
//                         disabled={page === 1}
//                       >
//                         <ChevronLeft className="w-4 h-4" />
//                       </Button>
//                       <Button
//                         variant="outline"
//                         size="sm"
//                         onClick={() => setPage(page + 1)}
//                         disabled={page === pagination.totalPages}
//                       >
//                         <ChevronRight className="w-4 h-4" />
//                       </Button>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </>
//           )}
//         </CardContent>
//       </Card>

//       {/* Edit Modal */}
//       <EditStockTransactionModal
//         open={showEditModal}
//         onOpenChange={handleEditModalClose}
//         transaction={selectedTransaction}
//       />
//     </div>
//   );
// }
// // // components/dashboard/tabs/stock-transactions-management.tsx
// // "use client";

// // import { useState, useMemo, useCallback } from "react";
// // import { useQuery } from "@tanstack/react-query";
// // import { Button } from "@/components/ui/button";
// // import { Input } from "@/components/ui/input";
// // import { Label } from "@/components/ui/label";
// // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // import { Badge } from "@/components/ui/badge";
// // import { 
// //   Search, 
// //   Edit, 
// //   Package,
// //   TrendingUp,
// //   TrendingDown,
// //   Settings,
// //   Download,
// //   ChevronLeft,
// //   ChevronRight
// // } from "lucide-react";
// // import { toast } from "sonner";
// // import EditStockTransactionModal from "@/components/modals/edit-stock-transaction-modal";
// // import type { StockTransaction, ApiPaginatedResponse, CategoriesListResponse } from "@/types";
// // import { Category } from "@/lib/types/category";

// // interface StockTransactionsApiResponse extends ApiPaginatedResponse<{
// //   transactions: StockTransaction[];
// // }> {}

// // export default function StockTransactionsManagement() {
// //   // =============================================
// //   // STATE
// //   // =============================================
// //   const [searchTerm, setSearchTerm] = useState("");
// //   const [selectedCategory, setSelectedCategory] = useState<string>("all");
// //   const [selectedType, setSelectedType] = useState<string>("all");
// //   const [page, setPage] = useState(1);
// //   const [limit] = useState(20);
// //   const [sortBy, setSortBy] = useState<string>("date");
// //   const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
// //   const [showEditModal, setShowEditModal] = useState(false);
// //   const [selectedTransaction, setSelectedTransaction] = useState<StockTransaction | null>(null);

// //   // =============================================
// //   // QUERIES
// //   // =============================================
// //   const { data: transactionsData, isLoading } = useQuery({
// //     queryKey: ["stock-transactions", page, limit, sortBy, sortOrder, selectedCategory, selectedType],
// //     queryFn: async (): Promise<StockTransactionsApiResponse> => {
// //       const params = new URLSearchParams({
// //         page: page.toString(),
// //         limit: limit.toString(),
// //         sortBy,
// //         sortOrder,
// //       });

// //       if (selectedCategory !== "all") {
// //         params.append("categoryId", selectedCategory);
// //       }
// //       if (selectedType !== "all") {
// //         params.append("transactionType", selectedType);
// //       }

// //       const response = await fetch(`/api/stock-transactions?${params}`);
// //       if (!response.ok) throw new Error("Failed to fetch stock transactions");
// //       return response.json();
// //     },
// //   });

// //   // Fetch categories for filter
// //   const { data: categoriesData } = useQuery<Category[]>({
// //     queryKey: ["categories"],
// //     queryFn: async () => {
// //       const response = await fetch("/api/categories");
// //       if (!response.ok) throw new Error("Failed to fetch categories");
// //       const data: CategoriesListResponse = await response.json();
// //       console.log("🚀 ~ StockTransactionsManagement ~ data.categories:", data.data.categories)
// //       return data.data?.categories;
// //     },
// //   });

// //   const transactions: StockTransaction[] = transactionsData?.data?.transactions || [];
// //   const pagination = transactionsData?.metadata;
// //   //   const categories: Category[] = categoriesData || [];
// //   const categories: Category[] = Array.isArray(categoriesData) ? categoriesData : [];


// //   // =============================================
// //   // MEMOIZED VALUES
// //   // =============================================
// //   const filteredTransactions = useMemo(() => {
// //     if (!searchTerm) return transactions;
    
// //     return transactions.filter((txn) => {
// //       const searchLower = searchTerm.toLowerCase();
// //       return (
// //         txn.productId.name.toLowerCase().includes(searchLower) ||
// //         txn.subProductId.toLowerCase().includes(searchLower) ||
// //         txn.categoryId.name.toLowerCase().includes(searchLower) ||
// //         txn.createdBy.username.toLowerCase().includes(searchLower)
// //       );
// //     });
// //   }, [transactions, searchTerm]);

// //   // =============================================
// //   // CALLBACKS
// //   // =============================================
// //   const handleEditTransaction = useCallback((transaction: StockTransaction) => {
// //     setSelectedTransaction(transaction);
// //     setShowEditModal(true);
// //   }, []);

// //   const handleEditModalClose = useCallback((open: boolean) => {
// //     setShowEditModal(open);
// //     if (!open) {
// //       setSelectedTransaction(null);
// //     }
// //   }, []);

// //   const handleExportTransactions = useCallback(() => {
// //     try {
// //       const headers = [
// //         "Date",
// //         "Product",
// //         "Category",
// //         "Type",
// //         "Initial Qty",
// //         "Qty Left",
// //         "Buying Price",
// //         "Selling Price",
// //         "Reason",
// //         "Created By",
// //       ];

// //       const rows = filteredTransactions.map((txn) => [
// //         new Date(txn.date).toLocaleDateString(),
// //         `"${txn.productId.name}${txn.productId.size ? ` (${txn.productId.size})` : ""}"`,
// //         `"${txn.categoryId.name}"`,
// //         txn.transactionType,
// //         txn.initialQuantity,
// //         txn.quantityLeft,
// //         txn.buyingPrice?.toFixed(2) || "N/A",
// //         txn.sellingPrice.toFixed(2),
// //         `"${txn.reason || ""}"`,
// //         `"${txn.createdBy.username}"`,
// //       ].join(","));

// //       const csvContent = [headers.join(","), ...rows].join("\n");

// //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// //       const url = window.URL.createObjectURL(blob);
// //       const link = document.createElement("a");
// //       link.href = url;
// //       link.download = `stock-transactions-${new Date().toISOString().split("T")[0]}.csv`;
// //       document.body.appendChild(link);
// //       link.click();
// //       document.body.removeChild(link);
// //       window.URL.revokeObjectURL(url);

// //       toast.success("Transactions exported successfully!");
// //     } catch (error) {
// //       console.error("Export error:", error);
// //       toast.error("Failed to export transactions");
// //     }
// //   }, [filteredTransactions]);

// //   // =============================================
// //   // UTILITY FUNCTIONS
// //   // =============================================
// //   const getTransactionTypeConfig = useCallback((type: string) => {
// //     switch (type) {
// //       case "Buy":
// //         return {
// //           icon: <TrendingUp className="w-4 h-4" />,
// //           variant: "default" as const,
// //           className: "bg-green-500 hover:bg-green-600",
// //         };
// //       case "Sell":
// //         return {
// //           icon: <TrendingDown className="w-4 h-4" />,
// //           variant: "destructive" as const,
// //           className: "",
// //         };
// //       case "Adjustment":
// //         return {
// //           icon: <Settings className="w-4 h-4" />,
// //           variant: "secondary" as const,
// //           className: "",
// //         };
// //       default:
// //         return {
// //           icon: <Package className="w-4 h-4" />,
// //           variant: "secondary" as const,
// //           className: "",
// //         };
// //     }
// //   }, []);

// //   const formatCurrency = useCallback((amount: number) => {
// //     // const num = Number(amount);
// //     // if (isNaN(num)) return '₹0.00'; // Or handle invalid input appropriately
// //     // return `₹${num.toFixed(2)}`;
// //     // return `₹${amount.toFixed(2)}`;
// //     return `₹${amount}`;
// //   }, []);

// //   const formatDate = useCallback((dateString: string) => {
// //     return new Date(dateString).toLocaleDateString("en-IN", {
// //       day: "2-digit",
// //       month: "short",
// //       year: "numeric",
// //     });
// //   }, []);

// //   // =============================================
// //   // LOADING STATE
// //   // =============================================
// //   if (isLoading) {
// //     return <div className="text-center py-8">Loading stock transactions...</div>;
// //   }

// //   // =============================================
// //   // RENDER
// //   // =============================================
// //   return (
// //     <div className="space-y-6">
// //       {/* Header */}
// //       <div className="flex justify-between items-center">
// //         <div>
// //           <h2 className="text-2xl font-bold text-gray-900">Stock Transactions</h2>
// //           <p className="text-sm text-gray-500 mt-1">
// //             Manage and track all inventory movements
// //           </p>
// //         </div>
// //         <div className="flex space-x-2">
// //           {/* Export Button */}
// //           <Button
// //             onClick={handleExportTransactions}
// //             variant="outline"
// //             disabled={filteredTransactions.length === 0}
// //           >
// //             <Download className="w-4 h-4 mr-2" />
// //             Export
// //           </Button>
// //         </div>
// //       </div>

// //       {/* Filters */}
// //       <Card>
// //         <CardContent className="p-6">
// //           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// //             {/* Search */}
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">
// //                 Search
// //               </Label>
// //               <div className="relative">
// //                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// //                 <Input
// //                   placeholder="Product, category, user..."
// //                   value={searchTerm}
// //                   onChange={(e) => setSearchTerm(e.target.value)}
// //                   className="pl-10"
// //                 />
// //               </div>
// //             </div>

// //             {/* Category Filter */}
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">
// //                 Category
// //               </Label>
// //               <Select value={selectedCategory} onValueChange={setSelectedCategory}>
// //                 <SelectTrigger>
// //                   <SelectValue placeholder="All Categories" />
// //                 </SelectTrigger>
// //                 <SelectContent>
// //                   <SelectItem value="all">All Categories</SelectItem>
// //                   {categories.map((category: Category) => (
// //                     <SelectItem key={category._id} value={category._id}>
// //                       {category.name}
// //                     </SelectItem>
// //                   ))}
// //                 </SelectContent>
// //               </Select>
// //             </div>

// //             {/* Transaction Type Filter */}
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">
// //                 Transaction Type
// //               </Label>
// //               <Select value={selectedType} onValueChange={setSelectedType}>
// //                 <SelectTrigger>
// //                   <SelectValue placeholder="All Types" />
// //                 </SelectTrigger>
// //                 <SelectContent>
// //                   <SelectItem value="all">All Types</SelectItem>
// //                   <SelectItem value="Buy">Buy</SelectItem>
// //                   <SelectItem value="Sell">Sell</SelectItem>
// //                   <SelectItem value="Adjustment">Adjustment</SelectItem>
// //                 </SelectContent>
// //               </Select>
// //             </div>

// //             {/* Sort */}
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">
// //                 Sort By
// //               </Label>
// //               <Select 
// //                 value={`${sortBy}-${sortOrder}`} 
// //                 onValueChange={(value) => {
// //                   const [newSortBy, newSortOrder] = value.split("-");
// //                   setSortBy(newSortBy);
// //                   setSortOrder(newSortOrder as "asc" | "desc");
// //                 }}
// //               >
// //                 <SelectTrigger>
// //                   <SelectValue />
// //                 </SelectTrigger>
// //                 <SelectContent>
// //                   <SelectItem value="date-desc">Date (Newest)</SelectItem>
// //                   <SelectItem value="date-asc">Date (Oldest)</SelectItem>
// //                   <SelectItem value="sellingPrice-desc">Price (High to Low)</SelectItem>
// //                   <SelectItem value="sellingPrice-asc">Price (Low to High)</SelectItem>
// //                   <SelectItem value="initialQuantity-desc">Quantity (High to Low)</SelectItem>
// //                   <SelectItem value="initialQuantity-asc">Quantity (Low to High)</SelectItem>
// //                 </SelectContent>
// //               </Select>
// //             </div>
// //           </div>
// //         </CardContent>
// //       </Card>

// //       {/* Transactions Table */}
// //       <Card>
// //         <CardHeader>
// //           <CardTitle className="text-lg font-semibold text-gray-900">
// //             Transactions
// //             {pagination && (
// //               <span className="ml-2 text-sm font-normal text-gray-500">
// //                 ({pagination.totalCount} total)
// //               </span>
// //             )}
// //           </CardTitle>
// //         </CardHeader>
// //         <CardContent className="p-0">
// //           {filteredTransactions.length === 0 ? (
// //             <div className="text-center py-12 text-gray-500">
// //               <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
// //               <p className="text-lg font-medium">No transactions found</p>
// //               <p className="text-sm mt-1">
// //                 {searchTerm ? "Try adjusting your search or filters" : "Stock transactions will appear here"}
// //               </p>
// //             </div>
// //           ) : (
// //             <>
// //               <div className="overflow-x-auto">
// //                 <table className="w-full">
// //                   <thead className="bg-gray-50">
// //                     <tr>
// //                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                         Date
// //                       </th>
// //                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                         Product
// //                       </th>
// //                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                         Type
// //                       </th>
// //                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                         Quantity
// //                       </th>
// //                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                         Prices
// //                       </th>
// //                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                         Created By
// //                       </th>
// //                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// //                         Actions
// //                       </th>
// //                     </tr>
// //                   </thead>
// //                   <tbody className="bg-white divide-y divide-gray-200">
// //                     {filteredTransactions.map((txn) => {
// //                       const typeConfig = getTransactionTypeConfig(txn.transactionType);
                      
// //                       return (
// //                         <tr key={txn._id} className="hover:bg-gray-50">
// //                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
// //                             {formatDate(txn.date)}
// //                           </td>
// //                           <td className="px-6 py-4 whitespace-nowrap">
// //                             <div className="flex items-center">
// //                               {txn.productId?.imageURL ? (
// //                                 <img
// //                                   src={txn.productId?.imageURL}
// //                                   alt={txn.productId?.name}
// //                                   className="w-10 h-10 rounded object-cover"
// //                                 />
// //                               ) : (
// //                                 <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
// //                                   <Package className="w-5 h-5 text-gray-400" />
// //                                 </div>
// //                               )}
// //                               <div className="ml-3">
// //                                 <p className="text-sm font-medium text-gray-900">
// //                                   {txn.productId?.name}
// //                                 </p>
// //                                 <p className="text-xs text-gray-500">
// //                                   {txn.categoryId?.name}
// //                                   {txn.productId?.size && ` • ${txn.productId?.size}`}
// //                                 </p>
// //                               </div>
// //                             </div>
// //                           </td>
// //                           <td className="px-6 py-4 whitespace-nowrap">
// //                             <Badge variant={typeConfig.variant} className={typeConfig.className}>
// //                               <span className="flex items-center gap-1">
// //                                 {typeConfig.icon}
// //                                 {txn.transactionType}
// //                               </span>
// //                             </Badge>
// //                           </td>
// //                           <td className="px-6 py-4 whitespace-nowrap">
// //                             <div className="text-sm">
// //                               <div className="font-medium text-gray-900">
// //                                 {txn.quantityLeft} / {txn.initialQuantity}
// //                               </div>
// //                               <div className="text-xs text-gray-500">
// //                                 Left / Initial
// //                               </div>
// //                             </div>
// //                           </td>
// //                           <td className="px-6 py-4 whitespace-nowrap">
// //                             <div className="text-sm">
// //                               <div className="font-medium text-green-600">
// //                                 {/* Sell: {formatCurrency(txn.sellingPrice[0])} */}
// //                                 {txn.sellingPrice.$numberDecimal}
// //                               </div>
// //                               {txn.buyingPrice && (
// //                                 <div className="text-xs text-gray-500">
// //                                   {/* Buy: {formatCurrency(txn.buyingPrice)} */}
// //                                   {txn.buyingPrice.$numberDecimal}
// //                                 </div>
// //                               )}
// //                             </div>
// //                           </td>
// //                           <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
// //                             {txn.createdBy.username}
// //                           </td>
// //                           <td className="px-6 py-4 whitespace-nowrap text-sm">
// //                             <Button
// //                               variant="ghost"
// //                               size="sm"
// //                               onClick={() => handleEditTransaction(txn)}
// //                               className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
// //                               title="Edit Transaction"
// //                             >
// //                               <Edit className="w-4 h-4" />
// //                             </Button>
// //                           </td>
// //                         </tr>
// //                       );
// //                     })}
// //                   </tbody>
// //                 </table>
// //               </div>

// //               {/* Pagination */}
// //               {pagination && pagination.totalPages > 1 && (
// //                 <div className="px-6 py-4 border-t border-gray-200">
// //                   <div className="flex items-center justify-between">
// //                     <div className="text-sm text-gray-700">
// //                       Showing page {pagination.page} of {pagination.totalPages}
// //                     </div>
// //                     <div className="flex gap-2">
// //                       <Button
// //                         variant="outline"
// //                         size="sm"
// //                         onClick={() => setPage(page - 1)}
// //                         disabled={page === 1}
// //                       >
// //                         <ChevronLeft className="w-4 h-4" />
// //                       </Button>
// //                       <Button
// //                         variant="outline"
// //                         size="sm"
// //                         onClick={() => setPage(page + 1)}
// //                         disabled={page === pagination.totalPages}
// //                       >
// //                         <ChevronRight className="w-4 h-4" />
// //                       </Button>
// //                     </div>
// //                   </div>
// //                 </div>
// //               )}
// //             </>
// //           )}
// //         </CardContent>
// //       </Card>

// //       {/* Edit Modal */}
// //       <EditStockTransactionModal
// //         open={showEditModal}
// //         onOpenChange={handleEditModalClose}
// //         transaction={selectedTransaction}
// //       />
// //     </div>
// //   );
// // }