"use client";

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Calendar,
  X,
  RotateCcw,
} from "lucide-react";
import { toast } from 'sonner';
import RevertTransactionModal, {
  type RevertTransaction,
  type RevertTransactionItem,
} from "@/components/modals/revert-transaction-modal";
import type { Transaction, TransactionItem, TransactionsResponse, PaginationMetadata, TransactionType } from '@/types';

type DateRangeType = "today" | "week" | "month" | "custom" | "all";
type StatusType = "all" | "Completed" | "Pending" | "Cancelled";

interface FilterState {
  statusFilter: StatusType;
  dateRange: DateRangeType;
  startDate: string;
  endDate: string;
  currentPage: number;
  pageSize: number;
}

// Skeleton Component for Table Loading
const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <tbody className="bg-white divide-y divide-gray-200">
    {Array.from({ length: rows }).map((_, index) => (
      <tr key={index} className="animate-pulse">
        <td className="px-6 py-4">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-3 bg-gray-200 rounded w-20"></div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="h-4 bg-gray-200 rounded w-40"></div>
        </td>
        <td className="px-6 py-4 text-center">
          <div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div>
        </td>
        <td className="px-6 py-4 text-right">
          <div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </td>
        <td className="px-6 py-4 text-center">
          <div className="h-6 bg-gray-200 rounded-full w-20 mx-auto"></div>
        </td>
        <td className="px-6 py-4 text-center">
          <div className="h-6 bg-gray-200 rounded-full w-16 mx-auto"></div>
        </td>
        <td className="px-6 py-4 text-center">
          <div className="h-8 bg-gray-200 rounded w-16 mx-auto"></div>
        </td>
      </tr>
    ))}
  </tbody>
);

export default function TransactionsTab() {
  // Separate search input state from committed search
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");

  const [filters, setFilters] = useState<FilterState>({
    statusFilter: "all",
    dateRange: "today",
    startDate: "",
    endDate: "",
    currentPage: 1,
    pageSize: 10,
  });

  const [isExporting, setIsExporting] = useState(false);

  // Revert modal state - using proper type
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<RevertTransaction | null>(null);

  // Search handlers
  const handleSearch = useCallback(() => {
    setCommittedSearch(searchInput.trim());
    setFilters(prev => ({ ...prev, currentPage: 1 }));
  }, [searchInput]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  }, [handleSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setCommittedSearch("");
    setFilters(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  // Add this helper
  const getYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split("T")[0]; // "2026-03-06" for date input
  };

  // Add this helper above your component
  const getUTCBoundaries = (
    dateRange: string,
    startDate: string,
    endDate: string
  ): { startDate: string; endDate: string } | null => {
    const now = new Date();

    switch (dateRange) {
      case "today": {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case "week": {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case "month": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case "custom": {
        if (!startDate || !endDate) return null;
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      default:
        return null;
    }
  };
  // Updated useQuery — only change is in queryFn params building
  const { data: response, isLoading, isFetching } = useQuery<TransactionsResponse>({
    queryKey: [
      "transactions",
      committedSearch,
      filters.statusFilter,
      filters.dateRange,
      filters.startDate,
      filters.endDate,
      filters.currentPage,
      filters.pageSize,
    ],
    queryFn: async (): Promise<TransactionsResponse> => {
      const params = new URLSearchParams();

      if (committedSearch) params.append("search", committedSearch);
      if (filters.statusFilter !== "all") params.append("status", filters.statusFilter);

      // ✅ Client computes UTC boundaries, server stays timezone-agnostic
      if (filters.dateRange !== "all") {
        const boundaries = getUTCBoundaries(
          filters.dateRange,
          filters.startDate,
          filters.endDate
        );
        if (boundaries) {
          params.append("startDate", boundaries.startDate);
          params.append("endDate", boundaries.endDate);
        }
      }

      params.append("page", filters.currentPage.toString());
      params.append("limit", filters.pageSize.toString());

      const response = await fetch(`/api/transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json();
    },
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  
  const transactions = response?.data || [];
  const pagination = response?.pagination;

  // const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
  //   setFilters((prev) => ({
  //     ...prev,
  //     [key]: value,
  //     ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
  //   }));
  // }, []);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => {
      // ✅ Pre-fill yesterday when switching to custom
      if (key === "dateRange" && value === "custom") {
        const yesterday = getYesterday();
        return {
          ...prev,
          dateRange: "custom" as FilterState["dateRange"],
          startDate: yesterday,
          endDate: yesterday,
          currentPage: 1,
        };
      }

      // ✅ Clear dates when switching away from custom
      if (key === "dateRange" && value !== "custom") {
        return {
          ...prev,
          [key]: value,
          startDate: "",
          endDate: "",
          currentPage: 1,
        };
      }

      return {
        ...prev,
        [key]: value,
        ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
      };
    });
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, currentPage: newPage }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePageSizeChange = useCallback((newSize: string) => {
    setFilters((prev) => ({
      ...prev,
      pageSize: parseInt(newSize),
      currentPage: 1,
    }));
  }, []);

  const parseTransactionItems = useCallback((itemsJson: string): TransactionItem[] => {
    try {
      const parsed = JSON.parse(itemsJson || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to parse transaction items:", error);
      return [];
    }
  }, []);

  const getStatusBadgeVariant = useCallback(
    (status: string): "default" | "secondary" | "destructive" => {
      switch (status.toLowerCase()) {
        case "completed":
          return "default";
        case "pending":
          return "secondary";
        case "cancelled":
          return "destructive";
        default:
          return "secondary";
      }
    },
    []
  );

  const formatDate = useCallback((dateString: string | Date): string => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, []);

  const formatTime = useCallback((dateString: string | Date): string => {
    return new Date(dateString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // Handle revert button click - properly typed with transformation
  const handleRevertClick = useCallback((apiTransaction: Transaction) => {
    // Parse items if they're in string format
    let apiItems: TransactionItem[];

    if (Array.isArray(apiTransaction.items)) {
      apiItems = apiTransaction.items;
    } else if (typeof apiTransaction.items === "string") {
      apiItems = parseTransactionItems(apiTransaction.items);
    } else if (apiTransaction.items) {
      apiItems = parseTransactionItems(JSON.stringify(apiTransaction.items));
    } else {
      apiItems = [];
    }

    // Transform API items to modal format
    const revertItems: RevertTransactionItem[] = apiItems.map(item => ({
      categoryId: item.categoryId,
      productId: item.productId, // Provide default if undefined
      stockTransactionId: item.stockTransactionId,
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.totalPrice,
      name: item.name,
      // size: item.size,
    }));
    
    // Create properly formatted transaction object for the modal
    const formattedTransaction: RevertTransaction = {
      _id: apiTransaction._id,
      student: {
        name: apiTransaction.student?.name || "Unknown",
        rollNumber: apiTransaction.student?.rollNumber,
      },
      items: revertItems,
      totalAmount: Number(apiTransaction.totalAmount),
      status: apiTransaction.status,
      createdAt: apiTransaction.createdAt,
      type: (apiTransaction.type as TransactionType) || "Purchase",
    };

    setSelectedTransaction(formattedTransaction);
    setShowRevertModal(true);
  }, [parseTransactionItems]);

  const canRevert = useCallback((transaction: Transaction): boolean => {
    const type = transaction.type as TransactionType;

    // Can only revert completed original transactions
    const isOriginalTransaction = ["Purchase", "Topup", "Deduction"].includes(type);

    return transaction.status === "Completed" && isOriginalTransaction;
  }, []);

  const handleExport = useCallback(() => {
    try {
      setIsExporting(true);

      const headers = [
        "Transaction ID",
        "Student Name",
        "Roll Number",
        "Item Name",
        "Quantity",
        "Unit Price",
        "Item Total",
        "Transaction Total",
        "Status",
        "Type",
        "Date",
        "Time",
      ];

      const rows: string[] = [];

      transactions.forEach((transaction) => {
        const items = Array.isArray(transaction.items)
          ? transaction.items
          : parseTransactionItems(
            typeof transaction.items === "string"
              ? transaction.items
              : JSON.stringify(transaction.items || [])
          );
        const transactionDate = new Date(transaction.createdAt);
        const dateStr = transactionDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const timeStr = transactionDate.toLocaleTimeString();

        const txnId = `TXN${transaction._id.toString().padStart(6, "0")}`;
        const studentName = transaction.student?.name || "Unknown";
        const rollNumber = transaction.student?.rollNumber || "N/A";
        const totalAmount = Number(transaction.totalAmount).toFixed(2);
        const status = transaction.status;
        const type = transaction.type || "N/A";

        if (items.length === 0) {
          rows.push(
            [txnId, studentName, rollNumber, "No items", "0", "0", "0", totalAmount, status, type, dateStr, timeStr]
              .map((cell) => `"${cell}"`)
              .join(",")
          );
        } else {
          items.forEach((item, index) => {
            const itemTotal = (item.quantity * Number(item.price)).toFixed(2);
            rows.push(
              [
                txnId,
                studentName,
                rollNumber,
                item.name || "Unknown Item",
                item.quantity.toString(),
                Number(item.price).toFixed(2),
                itemTotal,
                index === 0 ? totalAmount : "",
                index === 0 ? status : "",
                index === 0 ? type : "",
                index === 0 ? dateStr : "",
                index === 0 ? timeStr : "",
              ]
                .map((cell) => `"${cell}"`)
                .join(",")
            );
          });
        }
      });

      const csvContent = [headers.join(","), ...rows].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Transactions exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export transactions");
    } finally {
      setIsExporting(false);
    }
  }, [transactions, parseTransactionItems]);

  const PaginationControls = useCallback(() => {
    if (!pagination) return null;

    const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;

    const currentPage = filters.currentPage;

    const getPageNumbers = (): number[] => {
      const maxVisible = 5;
      const pages: number[] = [];

      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else if (currentPage <= 3) {
        for (let i = 1; i <= maxVisible; i++) {
          pages.push(i);
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
          pages.push(i);
        }
      }

      return pages;
    };

    return (
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700">
            Showing {startIndex} to {endIndex} of {totalCount} results
          </span>
          <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-700">per page</span>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={!hasPreviousPage}>
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPreviousPage}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center space-x-1">
            {getPageNumbers().map((pageNumber) => (
              <Button
                key={pageNumber}
                variant={currentPage === pageNumber ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(pageNumber)}
                className="w-8 h-8"
              >
                {pageNumber}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={!hasNextPage}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={!hasNextPage}>
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }, [pagination, filters.currentPage, filters.pageSize, handlePageChange, handlePageSizeChange]);

  // Show skeleton on initial load
  const showSkeleton = isLoading || isFetching;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
        <Button onClick={handleExport} variant="outline" disabled={isExporting || transactions.length === 0}>
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </>
          )}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search with Button */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Student name or roll number..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-10 pr-8"
                  />
                  {searchInput && (
                    <button
                      onClick={handleClearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      type="button"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={isFetching}
                  size="icon"
                  className="shrink-0"
                >
                  {isFetching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {committedSearch && (
                <p className="text-xs text-gray-500 mt-1">
                  Results for: &quot;{committedSearch}&quot;
                </p>
              )}
            </div>

            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Status</Label>
              <Select value={filters.statusFilter} onValueChange={(value: StatusType) => updateFilter("statusFilter", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Date Range</Label>
              <Select value={filters.dateRange} onValueChange={(value: DateRangeType) => updateFilter("dateRange", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filters.dateRange === "custom" && (
              <div className="md:col-span-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Start Date
                    </Label>
                    <Input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => updateFilter("startDate", e.target.value)}
                      max={filters.endDate || undefined}
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      End Date
                    </Label>
                    <Input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => updateFilter("endDate", e.target.value)}
                      min={filters.startDate || undefined}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            Recent Transactions
            {pagination && (
              <span className="ml-2 text-sm font-normal text-gray-500">({pagination.totalCount} total)</span>
            )}
            {isFetching && !isLoading && (
              <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Details</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>

              {/* Show Skeleton or Data */}
              {showSkeleton ? (
                <TableSkeleton rows={filters.pageSize} />
              ) : (
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        No transactions found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((transaction) => {
                      const items = Array.isArray(transaction.items)
                        ? transaction.items
                        : parseTransactionItems(
                          typeof transaction.items === "string"
                            ? transaction.items
                            : JSON.stringify(transaction.items || [])
                        );

                      if (items.length === 0) {
                        return (
                          <tr key={transaction._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{transaction.student?.name || "Unknown"}</p>
                                <p className="text-sm text-gray-500">{transaction.student?.rollNumber || "N/A"}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">No items</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">-</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">-</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-right">
                              ₹{Number(transaction.totalAmount).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div>
                                <p>{formatDate(transaction.createdAt)}</p>
                                <p className="text-xs text-gray-400">{formatTime(transaction.createdAt)}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <Badge variant={getStatusBadgeVariant(transaction.status)} className={transaction.status === "Completed" ? "bg-green-500" : ""}>
                                {transaction.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <Badge variant="outline">{transaction.type || "N/A"}</Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevertClick(transaction)}
                                disabled={!canRevert(transaction)}
                                className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={canRevert(transaction) ? "Revert Transaction" : "Cannot revert this transaction"}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      }

                      return items.map((item, index) => (
                        <tr key={`${transaction._id}-${index}`} className="hover:bg-gray-50">
                          {index === 0 && (
                            <td className="px-6 py-4 whitespace-nowrap" rowSpan={items.length}>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{transaction.student?.name || "Unknown"}</p>
                                <p className="text-sm text-gray-500">{transaction.student?.rollNumber || "N/A"}</p>
                              </div>
                            </td>
                          )}

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name || "Unknown Item"}</td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">{item.quantity}</td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">
                            ₹{Number(item.price).toFixed(2)}
                          </td>

                          {index === 0 && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-right" rowSpan={items.length}>
                              ₹{Number(transaction.totalAmount).toFixed(2)}
                            </td>
                          )}

                          {index === 0 && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" rowSpan={items.length}>
                              <div>
                                <p>{formatDate(transaction.createdAt)}</p>
                                <p className="text-xs text-gray-400">{formatTime(transaction.createdAt)}</p>
                              </div>
                            </td>
                          )}

                          {index === 0 && (
                            <td className="px-6 py-4 whitespace-nowrap text-center" rowSpan={items.length}>
                              <Badge variant={getStatusBadgeVariant(transaction.status)} className={transaction.status === "Completed" ? "bg-green-500" : ""}>
                                {transaction.status}
                              </Badge>
                            </td>
                          )}

                          {index === 0 && (
                            <td className="px-6 py-4 whitespace-nowrap text-center" rowSpan={items.length}>
                              <Badge variant="outline">{transaction.type || "N/A"}</Badge>
                            </td>
                          )}

                          {index === 0 && (
                            <td className="px-6 py-4 whitespace-nowrap text-center" rowSpan={items.length}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevertClick(transaction)}
                                disabled={!canRevert(transaction)}
                                className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={canRevert(transaction) ? "Revert Transaction" : "Cannot revert this transaction"}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ));
                    })
                  )}
                </tbody>
              )}
            </table>
          </div>

          {/* Pagination Controls */}
          <PaginationControls />
        </CardContent>
      </Card>

      {/* Revert Transaction Modal */}
      <RevertTransactionModal
        open={showRevertModal}
        onOpenChange={setShowRevertModal}
        transaction={selectedTransaction}
      />
    </div>
  );
}