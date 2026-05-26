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
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  X
} from "lucide-react";
import { toast } from "sonner";
import EditStockTransactionModal from "@/components/modals/edit-stock-transaction-modal";
import type { Category, CategoriesListResponse } from "@/types";
import type { StockTransaction, StockTransactionsResponse } from "@/types/stock-transaction";

// interface StockTransactionsApiResponse extends StockTransactionsListResponse { }

export default function StockTransactionsManagement() {
  // =============================================
  // STATE
  // =============================================
  // const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  // const [page, setPage] = useState(1);
  // const [limit] = useState(20);
  const [sortBy, setSortBy] = useState<string>("purchaseDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<StockTransaction | null>(null);

  // Replace search, page, limit state and query
  const [searchTerm, setSearchTerm] = useState("");
  const [committedSearch, setCommittedSearch] = useState(""); // ✅ committed on Enter/button
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20); // ✅ proper state now

  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Update query key and queryFn
  const { data: transactionsData, isLoading, isFetching } = useQuery({
    queryKey: ["stock-transactions", page, limit, sortBy, sortOrder, selectedCategory, selectedType, committedSearch],
    queryFn: async (): Promise<StockTransactionsResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });

      if (selectedCategory !== "all") params.append("categoryId", selectedCategory);
      if (selectedType !== "all") params.append("stockType", selectedType);
      if (committedSearch) params.append("search", committedSearch); // ✅ send to server

      const response = await fetch(`/api/stock-transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch stock transactions");
      return response.json();
    },
    placeholderData: (prev) => prev,
  });

  // ✅ No more filteredTransactions — use transactions directly
  const transactions: StockTransaction[] = transactionsData?.data?.transactions || [];

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

  const pagination = transactionsData?.pagination; // ✅ correct key

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

  // const handleExportTransactions = useCallback(() => {
  //   try {
  //     const headers = [
  //       "Date",
  //       "Product",
  //       "Category",
  //       "Type",
  //       "Initial Qty",
  //       "Qty Left",
  //       "Buying Price",
  //       "Selling Price",
  //       "Reason",
  //       "Created By",
  //     ];

  //     // const rows = filteredTransactions.map((txn) => [
  //     const rows = transactions.map((txn) => [
  //       new Date(txn.purchaseDate || txn.date || txn.createdAt).toLocaleDateString(),
  //       `"${txn.productId?.name || 'Unknown'}${txn.productId?.size ? ` (${txn.productId.size})` : ""}"`,
  //       `"${txn.categoryId?.name || 'N/A'}"`,
  //       txn.stockType,
  //       txn.initialQuantity,
  //       txn.quantityLeft,
  //       txn.buyingPrice ? convertToNumber(txn.buyingPrice).toFixed(2) : "N/A",
  //       convertToNumber(txn.sellingPrice).toFixed(2),
  //       `"${txn.reason || ""}"`,
  //       `"${txn.createdBy?.username || 'N/A'}"`,
  //     ].join(","));

  //     const csvContent = [headers.join(","), ...rows].join("\n");

  //     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  //     const url = window.URL.createObjectURL(blob);
  //     const link = document.createElement("a");
  //     link.href = url;
  //     link.download = `stock-transactions-${new Date().toISOString().split("T")[0]}.csv`;
  //     document.body.appendChild(link);
  //     link.click();
  //     document.body.removeChild(link);
  //     window.URL.revokeObjectURL(url);

  //     toast.success("Transactions exported successfully!");
  //   } catch (error) {
  //     console.error("Export error:", error);
  //     toast.error("Failed to export transactions");
  //   }
  // }, [filteredTransactions, convertToNumber]);

  const handleExportTransactions = useCallback(async () => {
  setIsExporting(true);
  try {
    // ── Fetch ALL matching records (no pagination limit) ───────────────────
    const params = new URLSearchParams({
      page:      "1",
      limit:     "99999",   // effectively "all" — adjust if your API caps this
      sortBy,
      sortOrder,
      export:    "true",    // optional: lets the backend skip pagination entirely
    });
    if (selectedCategory !== "all") params.append("categoryId", selectedCategory);
    if (selectedType     !== "all") params.append("stockType",  selectedType);
    if (committedSearch)            params.append("search",     committedSearch);
 
    const response = await fetch(`/api/stock-transactions?${params}`);
    if (!response.ok) throw new Error("Export fetch failed");
    const exportData = await response.json();
    const allTransactions: StockTransaction[] =
      exportData?.data?.transactions ?? exportData?.transactions ?? [];
 
    if (allTransactions.length === 0) {
      toast.info("No transactions to export.");
      return;
    }
 
    // ── Build CSV ─────────────────────────────────────────────────────────
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
 
    const rows = allTransactions.map((txn) => [
      new Date(txn.purchaseDate || txn.date || txn.createdAt).toLocaleDateString("en-IN"),
      `"${txn.productId?.name || "Unknown"}${txn.productId?.size ? ` (${txn.productId.size})` : ""}"`,
      `"${txn.categoryId?.name || "N/A"}"`,
      txn.stockType,
      txn.initialQuantity,
      txn.quantityLeft,
      txn.buyingPrice ? convertToNumber(txn.buyingPrice).toFixed(2) : "N/A",
      convertToNumber(txn.sellingPrice).toFixed(2),
      `"${txn.reason || ""}"`,
      `"${txn.createdBy?.username || "N/A"}"`,
    ].join(","));
 
    const csvContent = [headers.join(","), ...rows].join("\n");
 
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url  = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = `stock-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
 
    toast.success(`Exported ${allTransactions.length} transactions successfully!`);
  } catch (error) {
    console.error("Export error:", error);
    toast.error("Failed to export transactions");
  } finally {
    setIsExporting(false);
  }
  }, [sortBy, sortOrder, selectedCategory, selectedType, committedSearch, convertToNumber]);
  
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
          {/* <Button
            onClick={handleExportTransactions}
            variant="outline"
            // disabled={filteredTransactions.length === 0}
            disabled={transactions.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button> */}

             <Button
    onClick={handleExportTransactions}
    variant="outline"
    disabled={isExporting || transactions.length === 0}
  >
    {isExporting
      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting…</>
      : <><Download className="w-4 h-4 mr-2" />Export</>
    }
  </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Product, category, user..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setCommittedSearch(searchTerm.trim());
                        setPage(1);
                      }
                    }}
                    className="pl-10 pr-8"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setCommittedSearch("");
                        setPage(1);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      type="button"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Button
                  size="icon"
                  className="shrink-0"
                  disabled={isFetching}
                  onClick={() => {
                    setCommittedSearch(searchTerm.trim());
                    setPage(1);
                  }}
                >
                  {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
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
                Stock Type
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
                  <SelectItem value="purchaseDate-desc">Date (Newest)</SelectItem>
                  <SelectItem value="purchaseDate-asc">Date (Oldest)</SelectItem>
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

              {pagination && pagination.totalPages >= 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">
                      {((page - 1) * limit) + 1}–{Math.min(page * limit, pagination.totalCount)} of {pagination.totalCount}
                    </span>
                    <Select value={limit.toString()} onValueChange={(v) => { setLimit(parseInt(v)); setPage(1); }}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-700">per page</span>
                  </div>

                  {pagination.totalPages >= 1 && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>
                        <ChevronsLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      {(() => {
                        const totalPages = pagination.totalPages;
                        const maxVisible = 5;
                        const pages: number[] = [];
                        if (totalPages <= maxVisible) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else if (page <= 3) {
                          for (let i = 1; i <= maxVisible; i++) pages.push(i);
                        } else if (page >= totalPages - 2) {
                          for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          for (let i = page - 2; i <= page + 2; i++) pages.push(i);
                        }
                        return pages.map((n) => (
                          <Button key={n} variant={page === n ? "default" : "outline"} size="sm" onClick={() => setPage(n)} className="w-8 h-8">
                            {n}
                          </Button>
                        ));
                      })()}
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === pagination.totalPages}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(pagination.totalPages)} disabled={page === pagination.totalPages}>
                        <ChevronsRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
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