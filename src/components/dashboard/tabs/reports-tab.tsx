"use client";

// components/InventoryReportDashboard.tsx

import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  Loader2,
  Calendar,
  X,
  Search,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Package,
  TrendingUp,
  Layers,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import type {
  SoldProduct,
  SoldBatch,
  StockProduct,
  StockBatch,
  StockStatus,
  SoldReportResponse,
  StockReportResponse,
} from "@/lib/types/reports";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActiveTab = "sold" | "stock";
type DateMode = "today" | "custom";
type SortDir = "asc" | "desc";

type SoldSortKey  = "categoryName" | "productName" | "totalQtySold" | "totalRevenue";
type StockSortKey = "categoryName" | "productName" | "stockStatus" | "totalLeft" | "totalSold" | "newestBatch";

interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const toDateStr = (d: Date): string => d.toISOString().split("T")[0];
const today = new Date();

const formatINR = (n: number): string =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (dt: string | Date): string =>
  new Date(dt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ─────────────────────────────────────────────────────────────────────────────
// Stock status helpers
// ─────────────────────────────────────────────────────────────────────────────

const stockStatusLabel: Record<StockStatus, string> = {
  ok:    "In Stock",
  low:   "Low Stock",
  empty: "Out of Stock",
};

// For sorting: empty (worst) first when asc
const stockStatusOrder: Record<StockStatus, number> = {
  empty: 0,
  low:   1,
  ok:    2,
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const stockStatusBadgeVariant = (status: StockStatus): BadgeVariant => {
  switch (status) {
    case "ok":    return "default";
    case "low":   return "secondary";
    case "empty": return "destructive";
  }
};

const stockStatusBarColor = (status: StockStatus): string => {
  switch (status) {
    case "ok":    return "#10b981";
    case "low":   return "#f59e0b";
    case "empty": return "#ef4444";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SortableHeader — reusable clickable <th>
// ─────────────────────────────────────────────────────────────────────────────

interface SortableHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  current: SortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "center" | "right";
}

function SortableHeader<K extends string>({
  label,
  sortKey,
  current,
  onSort,
  align = "left",
}: SortableHeaderProps<K>) {
  const isActive = current.key === sortKey;
  const alignClass =
    align === "center"
      ? "justify-center"
      : align === "right"
      ? "justify-end"
      : "justify-start";

  const Icon = isActive
    ? current.dir === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors
        ${isActive
          ? "text-indigo-600 bg-indigo-50/70"
          : "text-gray-500 hover:text-gray-800 hover:bg-gray-100/70"
        }`}
    >
      <div className={`flex items-center gap-1.5 ${alignClass}`}>
        <span>{label}</span>
        <Icon
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isActive ? "text-indigo-400" : "text-gray-300"
          }`}
        />
      </div>
    </th>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

const StatCard = ({ icon, label, value, sub, accent = "#6366f1" }: StatCardProps) => (
  <Card className="border-slate-100 shadow-sm">
    <CardContent className="p-5 flex gap-4 items-start">
      <div className="rounded-xl p-3 flex-shrink-0" style={{ background: `${accent}18` }}>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </CardContent>
  </Card>
);

// ─────────────────────────────────────────────────────────────────────────────
// SkeletonRow
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonRow = ({ cols }: { cols: number }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-full" />
      </td>
    ))}
  </tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// SoldBatchRows — indented batch detail rows
// ─────────────────────────────────────────────────────────────────────────────

const SoldBatchRows = ({ batches }: { batches: SoldBatch[] }) => (
  <>
    {batches.map((b) => (
      <tr key={b.batchId} className="bg-slate-50 border-l-4 border-l-slate-200">
        <td className="pl-14 pr-4 py-2.5 text-xs text-slate-500 font-mono" colSpan={2}>
          Batch …{b.batchId.slice(-8)}
          <span className="ml-3 text-slate-400">{formatDate(b.purchaseDate)}</span>
        </td>
        <td className="px-6 py-2.5 text-center text-xs font-semibold text-slate-600">
          {b.qtySold}
        </td>
        <td className="px-6 py-2.5 text-right text-xs font-semibold text-emerald-600 font-mono">
          {formatINR(b.revenue)}
        </td>
        <td className="px-6 py-2.5 text-center text-xs text-slate-400 font-mono">
          cost: {formatINR(b.buyingPrice)}
        </td>
      </tr>
    ))}
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// StockBatchRows — indented batch detail rows
// ─────────────────────────────────────────────────────────────────────────────

const StockBatchRows = ({ batches }: { batches: StockBatch[] }) => (
  <>
    {batches.map((b, i) => {
      const borderColor =
        b.status === "empty" ? "#ef4444" : b.status === "low" ? "#f59e0b" : "#e2e8f0";
      return (
        <tr
          key={b.batchId}
          className="bg-slate-50"
          style={{ borderLeft: `4px solid ${borderColor}` }}
        >
          <td className="pl-14 pr-4 py-2.5 text-xs text-slate-500 font-mono" colSpan={2}>
            Batch {i + 1}
            <span className="ml-3 text-slate-400">{formatDate(b.purchaseDate)}</span>
          </td>
          <td className="px-6 py-2.5 text-center">
            <Badge variant={stockStatusBadgeVariant(b.status)} className="text-xs">
              {stockStatusLabel[b.status]}
            </Badge>
          </td>
          <td className="px-6 py-2.5 text-center text-xs font-mono text-slate-500">
            {b.initialQuantity}
          </td>
          <td className="px-6 py-2.5 text-center">
            <span
              className={`text-xs font-bold font-mono ${
                b.status === "empty"
                  ? "text-red-500"
                  : b.status === "low"
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`}
            >
              {b.quantityLeft}
            </span>
          </td>
          <td className="px-6 py-2.5 text-center text-xs font-mono text-slate-500">
            {b.soldQuantity}
          </td>
          <td className="px-6 py-2.5 text-center text-xs text-slate-400 font-mono">
            {formatINR(b.buyingPrice)}/unit
          </td>
        </tr>
      );
    })}
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function InventoryReportDashboard() {
  const [activeTab, setActiveTab]       = useState<ActiveTab>("sold");
  const [dateMode, setDateMode]         = useState<DateMode>("today");
  const [customDate, setCustomDate]     = useState<string>(toDateStr(today));
  const [searchQuery, setSearchQuery]   = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting]   = useState<boolean>(false);

  // Default: category asc (groups by category, then product within)
  const [soldSort, setSoldSort]   = useState<SortState<SoldSortKey>>({ key: "categoryName", dir: "asc" });
  const [stockSort, setStockSort] = useState<SortState<StockSortKey>>({ key: "newestBatch", dir: "desc" });

  // ── Derived date ──────────────────────────────────────────────────────────
  const selectedDate = useMemo<string>(
    () => (dateMode === "today" ? toDateStr(today) : customDate),
    [dateMode, customDate]
  );

  // ── Fetch sold report ─────────────────────────────────────────────────────
  const { data: soldResponse, isLoading: soldLoading, isFetching: soldFetching } =
    useQuery<SoldReportResponse>({
      queryKey: ["report-sold", selectedDate],
      queryFn: async (): Promise<SoldReportResponse> => {
        const res = await fetch(`/api/reports/sold?date=${selectedDate}`);
        if (!res.ok) throw new Error("Failed to fetch sold report");
        return res.json();
      },
      enabled: activeTab === "sold",
      staleTime: 30 * 1000,
      placeholderData: (prev) => prev,
    });

  // ── Fetch stock report ────────────────────────────────────────────────────
  const { data: stockResponse, isLoading: stockLoading, isFetching: stockFetching } =
    useQuery<StockReportResponse>({
      queryKey: ["report-stock"],
      queryFn: async (): Promise<StockReportResponse> => {
        const res = await fetch("/api/reports/stock");
        if (!res.ok) throw new Error("Failed to fetch stock report");
        return res.json();
      },
      enabled: activeTab === "stock",
      staleTime: 60 * 1000,
      placeholderData: (prev) => prev,
    });

  // ── Sort handlers — toggle dir on same key, reset to asc on new key ───────
  const handleSoldSort = useCallback((key: SoldSortKey) => {
    setSoldSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
    setExpandedRows({});
  }, []);

  const handleStockSort = useCallback((key: StockSortKey) => {
    setStockSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
    setExpandedRows({});
  }, []);

  // ── Filtered + sorted: sold ───────────────────────────────────────────────
  const sortedSold = useMemo<SoldProduct[]>(() => {
    const rows = soldResponse?.data ?? [];

    const filtered = searchQuery.trim()
      ? rows.filter((r) => {
          const q = searchQuery.toLowerCase();
          return r.productName.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q);
        })
      : rows;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (soldSort.key) {
        case "categoryName":
          // Secondary sort: productName asc always
          cmp = a.categoryName.localeCompare(b.categoryName);
          if (cmp === 0) cmp = a.productName.localeCompare(b.productName);
          break;
        case "productName":
          cmp = a.productName.localeCompare(b.productName);
          if (cmp === 0) cmp = a.categoryName.localeCompare(b.categoryName);
          break;
        case "totalQtySold":
          cmp = a.totalQtySold - b.totalQtySold;
          break;
        case "totalRevenue":
          cmp = a.totalRevenue - b.totalRevenue;
          break;
      }
      return soldSort.dir === "asc" ? cmp : -cmp;
    });
  }, [soldResponse, searchQuery, soldSort]);

  // ── Filtered + sorted: stock ──────────────────────────────────────────────
  const sortedStock = useMemo<StockProduct[]>(() => {
    const rows = stockResponse?.data ?? [];

    const filtered = searchQuery.trim()
      ? rows.filter((r) => {
          const q = searchQuery.toLowerCase();
          return r.productName.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q);
        })
      : rows;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (stockSort.key) {
        case "categoryName":
          cmp = a.categoryName.localeCompare(b.categoryName);
          if (cmp === 0) cmp = a.productName.localeCompare(b.productName);
          break;
        case "productName":
          cmp = a.productName.localeCompare(b.productName);
          if (cmp === 0) cmp = a.categoryName.localeCompare(b.categoryName);
          break;
        case "stockStatus":
          cmp = stockStatusOrder[a.stockStatus] - stockStatusOrder[b.stockStatus];
          if (cmp === 0) cmp = a.productName.localeCompare(b.productName);
          break;
        case "totalLeft":
          cmp = a.totalLeft - b.totalLeft;
          break;
        case "totalSold":
          cmp = a.totalSold - b.totalSold;
          break;
        case "newestBatch": {
          const aDate = a.batches.length > 0
            ? Math.max(...a.batches.map(b => new Date(b.purchaseDate).getTime()))
            : 0;
          const bDate = b.batches.length > 0
            ? Math.max(...b.batches.map(b => new Date(b.purchaseDate).getTime()))
            : 0;
          cmp = aDate - bDate;
          break;
        }
      }
      return stockSort.dir === "asc" ? cmp : -cmp;
    });
  }, [stockResponse, searchQuery, stockSort]);

  // ── Summaries ─────────────────────────────────────────────────────────────
  const soldSummary = useMemo(() => ({
    totalProducts: sortedSold.length,
    totalUnits:    sortedSold.reduce((a, b) => a + b.totalQtySold, 0),
    totalRevenue:  sortedSold.reduce((a, b) => a + b.totalRevenue, 0),
  }), [sortedSold]);

  const stockSummary = useMemo(() => ({
    totalProducts: sortedStock.length,
    totalLeft:     sortedStock.reduce((a, b) => a + b.totalLeft, 0),
    lowCount:      sortedStock.filter((p) => p.stockStatus === "low").length,
    emptyCount:    sortedStock.filter((p) => p.stockStatus === "empty").length,
  }), [sortedStock]);

  // ── Row expand toggle ─────────────────────────────────────────────────────
  const toggleRow = useCallback((key: string) => {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Tab switch ────────────────────────────────────────────────────────────
  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchQuery("");
    setExpandedRows({});
  }, []);

  // ── CSV Export (respects current sort order) ──────────────────────────────
  const handleExport = useCallback(() => {
    setIsExporting(true);
    try {
      let csvContent = "";

      if (activeTab === "sold") {
        const headers = [
          "Category", "Product", "Total Qty Sold", "Total Revenue (₹)",
          "Batch ID", "Batch Purchase Date", "Buying Price (₹)", "Qty from Batch", "Revenue from Batch (₹)",
        ];
        const rows: string[] = [];
        sortedSold.forEach((p) => {
          if (p.batches.length === 0) {
            rows.push(
              [p.categoryName, p.productName, p.totalQtySold, p.totalRevenue.toFixed(2), "", "", "", "", ""]
                .map((v) => `"${v}"`).join(",")
            );
          } else {
            p.batches.forEach((b, i) => {
              rows.push(
                [
                  i === 0 ? p.categoryName : "",
                  i === 0 ? p.productName : "",
                  i === 0 ? p.totalQtySold : "",
                  i === 0 ? p.totalRevenue.toFixed(2) : "",
                  b.batchId,
                  formatDate(b.purchaseDate),
                  b.buyingPrice.toFixed(2),
                  b.qtySold,
                  b.revenue.toFixed(2),
                ].map((v) => `"${v}"`).join(",")
              );
            });
          }
        });
        csvContent = [headers.join(","), ...rows].join("\n");
      } else {
        const headers = [
          "Category", "Product", "Stock Status", "Total Stock", "Total Remaining", "Total Sold",
          "Batch ID", "Batch Purchase Date", "Buying Price (₹)", "Initial Qty", "Remaining Qty", "Sold Qty", "Batch Status",
        ];
        const rows: string[] = [];
        sortedStock.forEach((p) => {
          p.batches.forEach((b, i) => {
            rows.push(
              [
                i === 0 ? p.categoryName : "",
                i === 0 ? p.productName : "",
                i === 0 ? stockStatusLabel[p.stockStatus] : "",
                i === 0 ? p.totalInitial : "",
                i === 0 ? p.totalLeft : "",
                i === 0 ? p.totalSold : "",
                b.batchId,
                formatDate(b.purchaseDate),
                b.buyingPrice.toFixed(2),
                b.initialQuantity,
                b.quantityLeft,
                b.soldQuantity,
                stockStatusLabel[b.status],
              ].map((v) => `"${v}"`).join(",")
            );
          });
        });
        csvContent = [headers.join(","), ...rows].join("\n");
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href     = url;
      link.download = `${activeTab}-report-${selectedDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Report exported successfully!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export report");
    } finally {
      setTimeout(() => setIsExporting(false), 600);
    }
  }, [activeTab, sortedSold, sortedStock, selectedDate]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const isFetching = activeTab === "sold" ? soldFetching : stockFetching;
  const isLoading  = activeTab === "sold" ? soldLoading  : stockLoading;

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory &amp; Sales Report</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            View sold products and remaining stock with batch-level detail
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          )}
          <Button
            onClick={handleExport}
            variant="outline"
            disabled={
              isExporting ||
              (activeTab === "sold" ? sortedSold.length === 0 : sortedStock.length === 0)
            }
          >
            {isExporting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting…</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />Export CSV</>
            )}
          </Button>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(
          [
            ["sold",  TrendingUp, "Sold Products"],
            ["stock", Package,    "Stock Report"],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Filters — date + search only, no category dropdown ── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end gap-4">

            {/* Date — sold tab only */}
            {activeTab === "sold" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Date
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                    {(
                      [
                        ["today",  "Today"],
                        ["custom", "Pick Date"],
                      ] as [DateMode, string][]
                    ).map(([mode, lbl]) => (
                      <button
                        key={mode}
                        onClick={() => setDateMode(mode)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                          dateMode === mode
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  {dateMode === "custom" && (
                    <input
                      type="date"
                      value={customDate}
                      max={toDateStr(today)}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-44 text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                  )}
                  <span className="text-xs text-gray-400 font-mono tabular-nums">
                    {formatDate(selectedDate)}
                  </span>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="space-y-1.5 flex-1 min-w-52">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Product or category name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Hint */}
            <p className="text-xs text-gray-400 pb-2 self-end">
              ↕ Click column headers to sort
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          SOLD PRODUCTS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "sold" && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Products Sold"
              value={soldSummary.totalProducts}
              sub={`on ${formatDate(selectedDate)}`}
              accent="#6366f1"
            />
            <StatCard
              icon={<Layers className="w-5 h-5" />}
              label="Total Units Sold"
              value={soldSummary.totalUnits.toLocaleString("en-IN")}
              sub="across all products"
              accent="#8b5cf6"
            />
            <StatCard
              icon={<BarChart3 className="w-5 h-5" />}
              label="Total Revenue"
              value={formatINR(soldSummary.totalRevenue)}
              sub="from completed purchases"
              accent="#10b981"
            />
          </div>

          {/* Sold Table */}
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                Sold Products — Batch Breakdown
                <span className="text-sm font-normal text-gray-400">
                  ({sortedSold.length} products · click row to expand batches)
                </span>
                {soldFetching && !soldLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-auto" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <SortableHeader label="Category"  sortKey="categoryName"  current={soldSort} onSort={handleSoldSort} align="left"   />
                      <SortableHeader label="Product"   sortKey="productName"   current={soldSort} onSort={handleSoldSort} align="left"   />
                      <SortableHeader label="Qty Sold"  sortKey="totalQtySold"  current={soldSort} onSort={handleSoldSort} align="center" />
                      <SortableHeader label="Revenue"   sortKey="totalRevenue"  current={soldSort} onSort={handleSoldSort} align="right"  />
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
                        Batches
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {soldLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonRow key={i} cols={5} />
                      ))
                    ) : sortedSold.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                          No products sold on this date with current filters.
                        </td>
                      </tr>
                    ) : (
                      sortedSold.map((row) => {
                        const isOpen = !!expandedRows[row.productId];
                        return (
                          <React.Fragment key={row.productId}>
                            <tr
                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => toggleRow(row.productId)}
                            >
                              <td className="px-6 py-3.5">
                                <Badge variant="outline">{row.categoryName}</Badge>
                              </td>
                              <td className="px-6 py-3.5 font-medium text-gray-900">
                                <div className="flex items-center gap-2">
                                  <ChevronDown
                                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                                      isOpen ? "rotate-180" : ""
                                    }`}
                                  />
                                  {row.productName}
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-violet-50 text-violet-700 font-bold text-sm">
                                  {row.totalQtySold}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right font-semibold text-gray-800 font-mono">
                                {formatINR(row.totalRevenue)}
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                {row.batches.length > 0 ? (
                                  <Badge variant="secondary">
                                    {row.batches.length} batch{row.batches.length > 1 ? "es" : ""}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                            {isOpen && row.batches.length > 0 && (
                              <SoldBatchRows key={`${row.productId}-b`} batches={row.batches} />
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>

                  {!soldLoading && sortedSold.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                        <td className="px-6 py-3.5 text-gray-700" colSpan={2}>Total</td>
                        <td className="px-6 py-3.5 text-center text-violet-700">
                          {soldSummary.totalUnits}
                        </td>
                        <td className="px-6 py-3.5 text-right text-emerald-700 font-mono">
                          {formatINR(soldSummary.totalRevenue)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STOCK REPORT TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "stock" && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={<Package className="w-5 h-5" />}
              label="Total Products"
              value={stockSummary.totalProducts}
              sub="tracked in system"
              accent="#6366f1"
            />
            <StatCard
              icon={<Layers className="w-5 h-5" />}
              label="Units Remaining"
              value={stockSummary.totalLeft.toLocaleString("en-IN")}
              sub="across all batches"
              accent="#8b5cf6"
            />
            <StatCard
              icon={<AlertTriangle className="w-5 h-5" />}
              label="Low Stock"
              value={stockSummary.lowCount}
              sub="products need reorder"
              accent="#f59e0b"
            />
            <StatCard
              icon={<X className="w-5 h-5" />}
              label="Out of Stock"
              value={stockSummary.emptyCount}
              sub="fully depleted"
              accent="#ef4444"
            />
          </div>

          {/* Stock Table */}
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                Stock — Batch-wise Breakdown
                <span className="text-sm font-normal text-gray-400">
                  ({sortedStock.length} products · click row to expand batches)
                </span>
                {stockFetching && !stockLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-auto" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <SortableHeader label="Category"     sortKey="categoryName" current={stockSort} onSort={handleStockSort} align="left"   />
                      <SortableHeader label="Product"      sortKey="productName"  current={stockSort} onSort={handleStockSort} align="left"   />
                      <SortableHeader label="Status"       sortKey="stockStatus"  current={stockSort} onSort={handleStockSort} align="center" />
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
                        Total Stock
                      </th>
                      <SortableHeader label="Remaining"    sortKey="totalLeft"    current={stockSort} onSort={handleStockSort} align="center" />
                      <SortableHeader label="Sold"         sortKey="totalSold"    current={stockSort} onSort={handleStockSort} align="center" />
                      <SortableHeader label="Newest Batch" sortKey="newestBatch"  current={stockSort} onSort={handleStockSort} align="center" />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {stockLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonRow key={i} cols={7} />
                      ))
                    ) : sortedStock.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                          No products match the current filters.
                        </td>
                      </tr>
                    ) : (
                      sortedStock.map((row) => {
                        const key    = `stock-${row.productId}`;
                        const isOpen = !!expandedRows[key];
                        const pct    = row.totalInitial > 0 ? (row.totalLeft / row.totalInitial) * 100 : 0;
                        const rowBg  =
                          row.stockStatus === "empty"
                            ? "bg-red-50/50"
                            : row.stockStatus === "low"
                            ? "bg-amber-50/50"
                            : "";

                        return (
                          <React.Fragment key={row.productId}>
                            <tr
                              className={`hover:bg-gray-50 cursor-pointer transition-colors ${rowBg}`}
                              onClick={() => toggleRow(key)}
                            >
                              <td className="px-6 py-3.5">
                                <Badge variant="outline">{row.categoryName}</Badge>
                              </td>
                              <td className="px-6 py-3.5 font-medium text-gray-900">
                                <div className="flex items-center gap-2">
                                  <ChevronDown
                                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                                      isOpen ? "rotate-180" : ""
                                    }`}
                                  />
                                  {row.productName}
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <Badge
                                  variant={stockStatusBadgeVariant(row.stockStatus)}
                                  className={row.stockStatus === "ok" ? "bg-green-500 text-white" : ""}
                                >
                                  {stockStatusLabel[row.stockStatus]}
                                </Badge>
                              </td>
                              <td className="px-6 py-3.5 text-center text-gray-600 font-mono">
                                {row.totalInitial}
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="flex flex-col items-center gap-1">
                                  <span
                                    className={`font-bold font-mono text-sm ${
                                      row.stockStatus === "empty"
                                        ? "text-red-600"
                                        : row.stockStatus === "low"
                                        ? "text-amber-600"
                                        : "text-emerald-600"
                                    }`}
                                  >
                                    {row.totalLeft}
                                  </span>
                                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${Math.max(pct, 2)}%`,
                                        backgroundColor: stockStatusBarColor(row.stockStatus),
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-3.5 text-center text-gray-500 font-mono">
                                {row.totalSold}
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <Badge variant="secondary" className="text-xs">
                                    {row.batches.length} batch{row.batches.length > 1 ? "es" : ""}
                                  </Badge>
                                  {row.batches.length > 0 && (
                                    <span className="text-xs text-gray-400 font-mono">
                                      {formatDate(
                                        row.batches.reduce((latest, b) =>
                                          new Date(b.purchaseDate) > new Date(latest.purchaseDate) ? b : latest
                                        ).purchaseDate
                                      )}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isOpen && row.batches.length > 0 && (
                              <StockBatchRows key={`${row.productId}-b`} batches={row.batches} />
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>

                  {!stockLoading && sortedStock.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                        <td className="px-6 py-3.5 text-gray-700" colSpan={2}>Total</td>
                        <td />
                        <td className="px-6 py-3.5 text-center text-gray-700 font-mono">
                          {sortedStock.reduce((a, b) => a + b.totalInitial, 0)}
                        </td>
                        <td className="px-6 py-3.5 text-center text-emerald-700 font-bold font-mono">
                          {stockSummary.totalLeft}
                        </td>
                        <td className="px-6 py-3.5 text-center text-gray-600 font-mono">
                          {sortedStock.reduce((a, b) => a + b.totalSold, 0)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// "use client";

// // components/InventoryReportDashboard.tsx

// import { useState, useCallback, useMemo } from "react";
// import { useQuery } from "@tanstack/react-query";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import {
//   Download,
//   Loader2,
//   Calendar,
//   X,
//   Search,
//   ChevronDown,
//   ChevronsUpDown,
//   ChevronUp,
//   Package,
//   TrendingUp,
//   Layers,
//   AlertTriangle,
//   BarChart3,
// } from "lucide-react";
// import { toast } from "sonner";
// import type {
//   SoldProduct,
//   SoldBatch,
//   StockProduct,
//   StockBatch,
//   StockStatus,
//   SoldReportResponse,
//   StockReportResponse,
// } from "@/types/reports";

// // ─────────────────────────────────────────────────────────────────────────────
// // Types
// // ─────────────────────────────────────────────────────────────────────────────

// type ActiveTab = "sold" | "stock";
// type DateMode = "today" | "custom";
// type SortDir = "asc" | "desc";

// type SoldSortKey  = "categoryName" | "productName" | "totalQtySold" | "totalRevenue";
// type StockSortKey = "categoryName" | "productName" | "stockStatus" | "totalLeft" | "totalSold";

// interface SortState<K extends string> {
//   key: K;
//   dir: SortDir;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────────────────────────────────────

// const toDateStr = (d: Date): string => d.toISOString().split("T")[0];
// const today = new Date();

// const formatINR = (n: number): string =>
//   `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// const formatDate = (dt: string | Date): string =>
//   new Date(dt).toLocaleDateString("en-GB", {
//     day: "2-digit",
//     month: "short",
//     year: "numeric",
//   });

// // ─────────────────────────────────────────────────────────────────────────────
// // Stock status helpers
// // ─────────────────────────────────────────────────────────────────────────────

// const stockStatusLabel: Record<StockStatus, string> = {
//   ok:    "In Stock",
//   low:   "Low Stock",
//   empty: "Out of Stock",
// };

// // For sorting: empty (worst) first when asc
// const stockStatusOrder: Record<StockStatus, number> = {
//   empty: 0,
//   low:   1,
//   ok:    2,
// };

// type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

// const stockStatusBadgeVariant = (status: StockStatus): BadgeVariant => {
//   switch (status) {
//     case "ok":    return "default";
//     case "low":   return "secondary";
//     case "empty": return "destructive";
//   }
// };

// const stockStatusBarColor = (status: StockStatus): string => {
//   switch (status) {
//     case "ok":    return "#10b981";
//     case "low":   return "#f59e0b";
//     case "empty": return "#ef4444";
//   }
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // SortableHeader — reusable clickable <th>
// // ─────────────────────────────────────────────────────────────────────────────

// interface SortableHeaderProps<K extends string> {
//   label: string;
//   sortKey: K;
//   current: SortState<K>;
//   onSort: (key: K) => void;
//   align?: "left" | "center" | "right";
// }

// function SortableHeader<K extends string>({
//   label,
//   sortKey,
//   current,
//   onSort,
//   align = "left",
// }: SortableHeaderProps<K>) {
//   const isActive = current.key === sortKey;
//   const alignClass =
//     align === "center"
//       ? "justify-center"
//       : align === "right"
//       ? "justify-end"
//       : "justify-start";

//   const Icon = isActive
//     ? current.dir === "asc"
//       ? ChevronUp
//       : ChevronDown
//     : ChevronsUpDown;

//   return (
//     <th
//       onClick={() => onSort(sortKey)}
//       className={`px-6 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors
//         ${isActive
//           ? "text-indigo-600 bg-indigo-50/70"
//           : "text-gray-500 hover:text-gray-800 hover:bg-gray-100/70"
//         }`}
//     >
//       <div className={`flex items-center gap-1.5 ${alignClass}`}>
//         <span>{label}</span>
//         <Icon
//           className={`w-3.5 h-3.5 flex-shrink-0 ${
//             isActive ? "text-indigo-400" : "text-gray-300"
//           }`}
//         />
//       </div>
//     </th>
//   );
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // StatCard
// // ─────────────────────────────────────────────────────────────────────────────

// interface StatCardProps {
//   icon: React.ReactNode;
//   label: string;
//   value: string | number;
//   sub?: string;
//   accent?: string;
// }

// const StatCard = ({ icon, label, value, sub, accent = "#6366f1" }: StatCardProps) => (
//   <Card className="border-slate-100 shadow-sm">
//     <CardContent className="p-5 flex gap-4 items-start">
//       <div className="rounded-xl p-3 flex-shrink-0" style={{ background: `${accent}18` }}>
//         <span style={{ color: accent }}>{icon}</span>
//       </div>
//       <div className="min-w-0">
//         <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
//         <p className="text-2xl font-bold text-slate-800 mt-0.5 leading-tight">{value}</p>
//         {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
//       </div>
//     </CardContent>
//   </Card>
// );

// // ─────────────────────────────────────────────────────────────────────────────
// // SkeletonRow
// // ─────────────────────────────────────────────────────────────────────────────

// const SkeletonRow = ({ cols }: { cols: number }) => (
//   <tr className="animate-pulse">
//     {Array.from({ length: cols }).map((_, i) => (
//       <td key={i} className="px-6 py-4">
//         <div className="h-4 bg-gray-200 rounded w-full" />
//       </td>
//     ))}
//   </tr>
// );

// // ─────────────────────────────────────────────────────────────────────────────
// // SoldBatchRows — indented batch detail rows
// // ─────────────────────────────────────────────────────────────────────────────

// const SoldBatchRows = ({ batches }: { batches: SoldBatch[] }) => (
//   <>
//     {batches.map((b) => (
//       <tr key={b.batchId} className="bg-slate-50 border-l-4 border-l-slate-200">
//         <td className="pl-14 pr-4 py-2.5 text-xs text-slate-500 font-mono" colSpan={2}>
//           Batch …{b.batchId.slice(-8)}
//           <span className="ml-3 text-slate-400">{formatDate(b.purchaseDate)}</span>
//         </td>
//         <td className="px-6 py-2.5 text-center text-xs font-semibold text-slate-600">
//           {b.qtySold}
//         </td>
//         <td className="px-6 py-2.5 text-right text-xs font-semibold text-emerald-600 font-mono">
//           {formatINR(b.revenue)}
//         </td>
//         <td className="px-6 py-2.5 text-center text-xs text-slate-400 font-mono">
//           cost: {formatINR(b.buyingPrice)}
//         </td>
//       </tr>
//     ))}
//   </>
// );

// // ─────────────────────────────────────────────────────────────────────────────
// // StockBatchRows — indented batch detail rows
// // ─────────────────────────────────────────────────────────────────────────────

// const StockBatchRows = ({ batches }: { batches: StockBatch[] }) => (
//   <>
//     {batches.map((b, i) => {
//       const borderColor =
//         b.status === "empty" ? "#ef4444" : b.status === "low" ? "#f59e0b" : "#e2e8f0";
//       return (
//         <tr
//           key={b.batchId}
//           className="bg-slate-50"
//           style={{ borderLeft: `4px solid ${borderColor}` }}
//         >
//           <td className="pl-14 pr-4 py-2.5 text-xs text-slate-500 font-mono" colSpan={2}>
//             Batch {i + 1}
//             <span className="ml-3 text-slate-400">{formatDate(b.purchaseDate)}</span>
//           </td>
//           <td className="px-6 py-2.5 text-center">
//             <Badge variant={stockStatusBadgeVariant(b.status)} className="text-xs">
//               {stockStatusLabel[b.status]}
//             </Badge>
//           </td>
//           <td className="px-6 py-2.5 text-center text-xs font-mono text-slate-500">
//             {b.initialQuantity}
//           </td>
//           <td className="px-6 py-2.5 text-center">
//             <span
//               className={`text-xs font-bold font-mono ${
//                 b.status === "empty"
//                   ? "text-red-500"
//                   : b.status === "low"
//                   ? "text-amber-600"
//                   : "text-emerald-600"
//               }`}
//             >
//               {b.quantityLeft}
//             </span>
//           </td>
//           <td className="px-6 py-2.5 text-center text-xs font-mono text-slate-500">
//             {b.soldQuantity}
//           </td>
//           <td className="px-6 py-2.5 text-center text-xs text-slate-400 font-mono">
//             {formatINR(b.buyingPrice)}/unit
//           </td>
//         </tr>
//       );
//     })}
//   </>
// );

// // ─────────────────────────────────────────────────────────────────────────────
// // Main Component
// // ─────────────────────────────────────────────────────────────────────────────

// export default function InventoryReportDashboard() {
//   const [activeTab, setActiveTab]       = useState<ActiveTab>("sold");
//   const [dateMode, setDateMode]         = useState<DateMode>("today");
//   const [customDate, setCustomDate]     = useState<string>(toDateStr(today));
//   const [searchQuery, setSearchQuery]   = useState<string>("");
//   const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
//   const [isExporting, setIsExporting]   = useState<boolean>(false);

//   // Default: category asc (groups by category, then product within)
//   const [soldSort, setSoldSort]   = useState<SortState<SoldSortKey>>({ key: "categoryName", dir: "asc" });
//   const [stockSort, setStockSort] = useState<SortState<StockSortKey>>({ key: "stockStatus", dir: "asc" });

//   // ── Derived date ──────────────────────────────────────────────────────────
//   const selectedDate = useMemo<string>(
//     () => (dateMode === "today" ? toDateStr(today) : customDate),
//     [dateMode, customDate]
//   );

//   // ── Fetch sold report ─────────────────────────────────────────────────────
//   const { data: soldResponse, isLoading: soldLoading, isFetching: soldFetching } =
//     useQuery<SoldReportResponse>({
//       queryKey: ["report-sold", selectedDate],
//       queryFn: async (): Promise<SoldReportResponse> => {
//         const res = await fetch(`/api/reports/sold?date=${selectedDate}`);
//         if (!res.ok) throw new Error("Failed to fetch sold report");
//         return res.json();
//       },
//       enabled: activeTab === "sold",
//       staleTime: 30 * 1000,
//       placeholderData: (prev) => prev,
//     });

//   // ── Fetch stock report ────────────────────────────────────────────────────
//   const { data: stockResponse, isLoading: stockLoading, isFetching: stockFetching } =
//     useQuery<StockReportResponse>({
//       queryKey: ["report-stock"],
//       queryFn: async (): Promise<StockReportResponse> => {
//         const res = await fetch("/api/reports/stock");
//         if (!res.ok) throw new Error("Failed to fetch stock report");
//         return res.json();
//       },
//       enabled: activeTab === "stock",
//       staleTime: 60 * 1000,
//       placeholderData: (prev) => prev,
//     });

//   // ── Sort handlers — toggle dir on same key, reset to asc on new key ───────
//   const handleSoldSort = useCallback((key: SoldSortKey) => {
//     setSoldSort((prev) => ({
//       key,
//       dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
//     }));
//     setExpandedRows({});
//   }, []);

//   const handleStockSort = useCallback((key: StockSortKey) => {
//     setStockSort((prev) => ({
//       key,
//       dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
//     }));
//     setExpandedRows({});
//   }, []);

//   // ── Filtered + sorted: sold ───────────────────────────────────────────────
//   const sortedSold = useMemo<SoldProduct[]>(() => {
//     const rows = soldResponse?.data ?? [];

//     const filtered = searchQuery.trim()
//       ? rows.filter((r) => {
//           const q = searchQuery.toLowerCase();
//           return r.productName.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q);
//         })
//       : rows;

//     return [...filtered].sort((a, b) => {
//       let cmp = 0;
//       switch (soldSort.key) {
//         case "categoryName":
//           // Secondary sort: productName asc always
//           cmp = a.categoryName.localeCompare(b.categoryName);
//           if (cmp === 0) cmp = a.productName.localeCompare(b.productName);
//           break;
//         case "productName":
//           cmp = a.productName.localeCompare(b.productName);
//           if (cmp === 0) cmp = a.categoryName.localeCompare(b.categoryName);
//           break;
//         case "totalQtySold":
//           cmp = a.totalQtySold - b.totalQtySold;
//           break;
//         case "totalRevenue":
//           cmp = a.totalRevenue - b.totalRevenue;
//           break;
//       }
//       return soldSort.dir === "asc" ? cmp : -cmp;
//     });
//   }, [soldResponse, searchQuery, soldSort]);

//   // ── Filtered + sorted: stock ──────────────────────────────────────────────
//   const sortedStock = useMemo<StockProduct[]>(() => {
//     const rows = stockResponse?.data ?? [];

//     const filtered = searchQuery.trim()
//       ? rows.filter((r) => {
//           const q = searchQuery.toLowerCase();
//           return r.productName.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q);
//         })
//       : rows;

//     return [...filtered].sort((a, b) => {
//       let cmp = 0;
//       switch (stockSort.key) {
//         case "categoryName":
//           cmp = a.categoryName.localeCompare(b.categoryName);
//           if (cmp === 0) cmp = a.productName.localeCompare(b.productName);
//           break;
//         case "productName":
//           cmp = a.productName.localeCompare(b.productName);
//           if (cmp === 0) cmp = a.categoryName.localeCompare(b.categoryName);
//           break;
//         case "stockStatus":
//           cmp = stockStatusOrder[a.stockStatus] - stockStatusOrder[b.stockStatus];
//           if (cmp === 0) cmp = a.productName.localeCompare(b.productName);
//           break;
//         case "totalLeft":
//           cmp = a.totalLeft - b.totalLeft;
//           break;
//         case "totalSold":
//           cmp = a.totalSold - b.totalSold;
//           break;
//       }
//       return stockSort.dir === "asc" ? cmp : -cmp;
//     });
//   }, [stockResponse, searchQuery, stockSort]);

//   // ── Summaries ─────────────────────────────────────────────────────────────
//   const soldSummary = useMemo(() => ({
//     totalProducts: sortedSold.length,
//     totalUnits:    sortedSold.reduce((a, b) => a + b.totalQtySold, 0),
//     totalRevenue:  sortedSold.reduce((a, b) => a + b.totalRevenue, 0),
//   }), [sortedSold]);

//   const stockSummary = useMemo(() => ({
//     totalProducts: sortedStock.length,
//     totalLeft:     sortedStock.reduce((a, b) => a + b.totalLeft, 0),
//     lowCount:      sortedStock.filter((p) => p.stockStatus === "low").length,
//     emptyCount:    sortedStock.filter((p) => p.stockStatus === "empty").length,
//   }), [sortedStock]);

//   // ── Row expand toggle ─────────────────────────────────────────────────────
//   const toggleRow = useCallback((key: string) => {
//     setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
//   }, []);

//   // ── Tab switch ────────────────────────────────────────────────────────────
//   const handleTabChange = useCallback((tab: ActiveTab) => {
//     setActiveTab(tab);
//     setSearchQuery("");
//     setExpandedRows({});
//   }, []);

//   // ── CSV Export (respects current sort order) ──────────────────────────────
//   const handleExport = useCallback(() => {
//     setIsExporting(true);
//     try {
//       let csvContent = "";

//       if (activeTab === "sold") {
//         const headers = [
//           "Category", "Product", "Total Qty Sold", "Total Revenue (₹)",
//           "Batch ID", "Batch Purchase Date", "Buying Price (₹)", "Qty from Batch", "Revenue from Batch (₹)",
//         ];
//         const rows: string[] = [];
//         sortedSold.forEach((p) => {
//           if (p.batches.length === 0) {
//             rows.push(
//               [p.categoryName, p.productName, p.totalQtySold, p.totalRevenue.toFixed(2), "", "", "", "", ""]
//                 .map((v) => `"${v}"`).join(",")
//             );
//           } else {
//             p.batches.forEach((b, i) => {
//               rows.push(
//                 [
//                   i === 0 ? p.categoryName : "",
//                   i === 0 ? p.productName : "",
//                   i === 0 ? p.totalQtySold : "",
//                   i === 0 ? p.totalRevenue.toFixed(2) : "",
//                   b.batchId,
//                   formatDate(b.purchaseDate),
//                   b.buyingPrice.toFixed(2),
//                   b.qtySold,
//                   b.revenue.toFixed(2),
//                 ].map((v) => `"${v}"`).join(",")
//               );
//             });
//           }
//         });
//         csvContent = [headers.join(","), ...rows].join("\n");
//       } else {
//         const headers = [
//           "Category", "Product", "Stock Status", "Total Stock", "Total Remaining", "Total Sold",
//           "Batch ID", "Batch Purchase Date", "Buying Price (₹)", "Initial Qty", "Remaining Qty", "Sold Qty", "Batch Status",
//         ];
//         const rows: string[] = [];
//         sortedStock.forEach((p) => {
//           p.batches.forEach((b, i) => {
//             rows.push(
//               [
//                 i === 0 ? p.categoryName : "",
//                 i === 0 ? p.productName : "",
//                 i === 0 ? stockStatusLabel[p.stockStatus] : "",
//                 i === 0 ? p.totalInitial : "",
//                 i === 0 ? p.totalLeft : "",
//                 i === 0 ? p.totalSold : "",
//                 b.batchId,
//                 formatDate(b.purchaseDate),
//                 b.buyingPrice.toFixed(2),
//                 b.initialQuantity,
//                 b.quantityLeft,
//                 b.soldQuantity,
//                 stockStatusLabel[b.status],
//               ].map((v) => `"${v}"`).join(",")
//             );
//           });
//         });
//         csvContent = [headers.join(","), ...rows].join("\n");
//       }

//       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
//       const url  = URL.createObjectURL(blob);
//       const link = document.createElement("a");
//       link.href     = url;
//       link.download = `${activeTab}-report-${selectedDate}.csv`;
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       URL.revokeObjectURL(url);
//       toast.success("Report exported successfully!");
//     } catch (err) {
//       console.error("Export error:", err);
//       toast.error("Failed to export report");
//     } finally {
//       setTimeout(() => setIsExporting(false), 600);
//     }
//   }, [activeTab, sortedSold, sortedStock, selectedDate]);

//   // ─────────────────────────────────────────────────────────────────────────
//   // Render
//   // ─────────────────────────────────────────────────────────────────────────

//   const isFetching = activeTab === "sold" ? soldFetching : stockFetching;
//   const isLoading  = activeTab === "sold" ? soldLoading  : stockLoading;

//   return (
//     <div className="space-y-6">

//       {/* ── Page Header ── */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h2 className="text-2xl font-bold text-gray-900">Inventory &amp; Sales Report</h2>
//           <p className="text-sm text-gray-500 mt-0.5">
//             View sold products and remaining stock with batch-level detail
//           </p>
//         </div>
//         <div className="flex items-center gap-3">
//           {isFetching && !isLoading && (
//             <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
//           )}
//           <Button
//             onClick={handleExport}
//             variant="outline"
//             disabled={
//               isExporting ||
//               (activeTab === "sold" ? sortedSold.length === 0 : sortedStock.length === 0)
//             }
//           >
//             {isExporting ? (
//               <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting…</>
//             ) : (
//               <><Download className="w-4 h-4 mr-2" />Export CSV</>
//             )}
//           </Button>
//         </div>
//       </div>

//       {/* ── Tab Switcher ── */}
//       <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
//         {(
//           [
//             ["sold",  TrendingUp, "Sold Products"],
//             ["stock", Package,    "Stock Report"],
//           ] as const
//         ).map(([key, Icon, label]) => (
//           <button
//             key={key}
//             onClick={() => handleTabChange(key)}
//             className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
//               activeTab === key
//                 ? "bg-white text-gray-900 shadow-sm"
//                 : "text-gray-500 hover:text-gray-700"
//             }`}
//           >
//             <Icon className="w-4 h-4" />
//             {label}
//           </button>
//         ))}
//       </div>

//       {/* ── Filters — date + search only, no category dropdown ── */}
//       <Card>
//         <CardContent className="p-5">
//           <div className="flex flex-wrap items-end gap-4">

//             {/* Date — sold tab only */}
//             {activeTab === "sold" && (
//               <div className="space-y-1.5">
//                 <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
//                   <Calendar className="w-3.5 h-3.5" />
//                   Date
//                 </Label>
//                 <div className="flex items-center gap-2">
//                   <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
//                     {(
//                       [
//                         ["today",  "Today"],
//                         ["custom", "Pick Date"],
//                       ] as [DateMode, string][]
//                     ).map(([mode, lbl]) => (
//                       <button
//                         key={mode}
//                         onClick={() => setDateMode(mode)}
//                         className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
//                           dateMode === mode
//                             ? "bg-white text-gray-900 shadow-sm"
//                             : "text-gray-500 hover:text-gray-700"
//                         }`}
//                       >
//                         {lbl}
//                       </button>
//                     ))}
//                   </div>
//                   {dateMode === "custom" && (
//                     <input
//                       type="date"
//                       value={customDate}
//                       max={toDateStr(today)}
//                       onChange={(e) => setCustomDate(e.target.value)}
//                       className="w-44 text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
//                     />
//                   )}
//                   <span className="text-xs text-gray-400 font-mono tabular-nums">
//                     {formatDate(selectedDate)}
//                   </span>
//                 </div>
//               </div>
//             )}

//             {/* Search */}
//             <div className="space-y-1.5 flex-1 min-w-52">
//               <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
//                 <Search className="w-3.5 h-3.5" />
//                 Search
//               </Label>
//               <div className="relative">
//                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
//                 <Input
//                   placeholder="Product or category name…"
//                   value={searchQuery}
//                   onChange={(e) => setSearchQuery(e.target.value)}
//                   className="pl-9 pr-9"
//                 />
//                 {searchQuery && (
//                   <button
//                     onClick={() => setSearchQuery("")}
//                     className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
//                   >
//                     <X className="w-4 h-4" />
//                   </button>
//                 )}
//               </div>
//             </div>

//             {/* Hint */}
//             <p className="text-xs text-gray-400 pb-2 self-end">
//               ↕ Click column headers to sort
//             </p>
//           </div>
//         </CardContent>
//       </Card>

//       {/* ══════════════════════════════════════════════════════════════════════
//           SOLD PRODUCTS TAB
//       ══════════════════════════════════════════════════════════════════════ */}
//       {activeTab === "sold" && (
//         <>
//           {/* Stat Cards */}
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//             <StatCard
//               icon={<TrendingUp className="w-5 h-5" />}
//               label="Products Sold"
//               value={soldSummary.totalProducts}
//               sub={`on ${formatDate(selectedDate)}`}
//               accent="#6366f1"
//             />
//             <StatCard
//               icon={<Layers className="w-5 h-5" />}
//               label="Total Units Sold"
//               value={soldSummary.totalUnits.toLocaleString("en-IN")}
//               sub="across all products"
//               accent="#8b5cf6"
//             />
//             <StatCard
//               icon={<BarChart3 className="w-5 h-5" />}
//               label="Total Revenue"
//               value={formatINR(soldSummary.totalRevenue)}
//               sub="from completed purchases"
//               accent="#10b981"
//             />
//           </div>

//           {/* Sold Table */}
//           <Card>
//             <CardHeader className="pb-0">
//               <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
//                 Sold Products — Batch Breakdown
//                 <span className="text-sm font-normal text-gray-400">
//                   ({sortedSold.length} products · click row to expand batches)
//                 </span>
//                 {soldFetching && !soldLoading && (
//                   <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-auto" />
//                 )}
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="p-0 mt-4">
//               <div className="overflow-x-auto">
//                 <table className="w-full text-sm">
//                   <thead className="bg-gray-50 border-b border-gray-200">
//                     <tr>
//                       <SortableHeader label="Category"  sortKey="categoryName"  current={soldSort} onSort={handleSoldSort} align="left"   />
//                       <SortableHeader label="Product"   sortKey="productName"   current={soldSort} onSort={handleSoldSort} align="left"   />
//                       <SortableHeader label="Qty Sold"  sortKey="totalQtySold"  current={soldSort} onSort={handleSoldSort} align="center" />
//                       <SortableHeader label="Revenue"   sortKey="totalRevenue"  current={soldSort} onSort={handleSoldSort} align="right"  />
//                       <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
//                         Batches
//                       </th>
//                     </tr>
//                   </thead>
//                   <tbody className="bg-white divide-y divide-gray-100">
//                     {soldLoading ? (
//                       Array.from({ length: 5 }).map((_, i) => (
//                         <SkeletonRow key={i} cols={5} />
//                       ))
//                     ) : sortedSold.length === 0 ? (
//                       <tr>
//                         <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
//                           No products sold on this date with current filters.
//                         </td>
//                       </tr>
//                     ) : (
//                       sortedSold.map((row) => {
//                         const isOpen = !!expandedRows[row.productId];
//                         return (
//                           <>
//                             <tr
//                               key={row.productId}
//                               className="hover:bg-gray-50 cursor-pointer transition-colors"
//                               onClick={() => toggleRow(row.productId)}
//                             >
//                               <td className="px-6 py-3.5">
//                                 <Badge variant="outline">{row.categoryName}</Badge>
//                               </td>
//                               <td className="px-6 py-3.5 font-medium text-gray-900">
//                                 <div className="flex items-center gap-2">
//                                   <ChevronDown
//                                     className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
//                                       isOpen ? "rotate-180" : ""
//                                     }`}
//                                   />
//                                   {row.productName}
//                                 </div>
//                               </td>
//                               <td className="px-6 py-3.5 text-center">
//                                 <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-violet-50 text-violet-700 font-bold text-sm">
//                                   {row.totalQtySold}
//                                 </span>
//                               </td>
//                               <td className="px-6 py-3.5 text-right font-semibold text-gray-800 font-mono">
//                                 {formatINR(row.totalRevenue)}
//                               </td>
//                               <td className="px-6 py-3.5 text-center">
//                                 {row.batches.length > 0 ? (
//                                   <Badge variant="secondary">
//                                     {row.batches.length} batch{row.batches.length > 1 ? "es" : ""}
//                                   </Badge>
//                                 ) : (
//                                   <span className="text-gray-300">—</span>
//                                 )}
//                               </td>
//                             </tr>
//                             {isOpen && row.batches.length > 0 && (
//                               <SoldBatchRows key={`${row.productId}-b`} batches={row.batches} />
//                             )}
//                           </>
//                         );
//                       })
//                     )}
//                   </tbody>

//                   {!soldLoading && sortedSold.length > 0 && (
//                     <tfoot>
//                       <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
//                         <td className="px-6 py-3.5 text-gray-700" colSpan={2}>Total</td>
//                         <td className="px-6 py-3.5 text-center text-violet-700">
//                           {soldSummary.totalUnits}
//                         </td>
//                         <td className="px-6 py-3.5 text-right text-emerald-700 font-mono">
//                           {formatINR(soldSummary.totalRevenue)}
//                         </td>
//                         <td />
//                       </tr>
//                     </tfoot>
//                   )}
//                 </table>
//               </div>
//             </CardContent>
//           </Card>
//         </>
//       )}

//       {/* ══════════════════════════════════════════════════════════════════════
//           STOCK REPORT TAB
//       ══════════════════════════════════════════════════════════════════════ */}
//       {activeTab === "stock" && (
//         <>
//           {/* Stat Cards */}
//           <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
//             <StatCard
//               icon={<Package className="w-5 h-5" />}
//               label="Total Products"
//               value={stockSummary.totalProducts}
//               sub="tracked in system"
//               accent="#6366f1"
//             />
//             <StatCard
//               icon={<Layers className="w-5 h-5" />}
//               label="Units Remaining"
//               value={stockSummary.totalLeft.toLocaleString("en-IN")}
//               sub="across all batches"
//               accent="#8b5cf6"
//             />
//             <StatCard
//               icon={<AlertTriangle className="w-5 h-5" />}
//               label="Low Stock"
//               value={stockSummary.lowCount}
//               sub="products need reorder"
//               accent="#f59e0b"
//             />
//             <StatCard
//               icon={<X className="w-5 h-5" />}
//               label="Out of Stock"
//               value={stockSummary.emptyCount}
//               sub="fully depleted"
//               accent="#ef4444"
//             />
//           </div>

//           {/* Stock Table */}
//           <Card>
//             <CardHeader className="pb-0">
//               <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
//                 Stock — Batch-wise Breakdown
//                 <span className="text-sm font-normal text-gray-400">
//                   ({sortedStock.length} products · click row to expand batches)
//                 </span>
//                 {stockFetching && !stockLoading && (
//                   <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-auto" />
//                 )}
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="p-0 mt-4">
//               <div className="overflow-x-auto">
//                 <table className="w-full text-sm">
//                   <thead className="bg-gray-50 border-b border-gray-200">
//                     <tr>
//                       <SortableHeader label="Category"  sortKey="categoryName" current={stockSort} onSort={handleStockSort} align="left"   />
//                       <SortableHeader label="Product"   sortKey="productName"  current={stockSort} onSort={handleStockSort} align="left"   />
//                       <SortableHeader label="Status"    sortKey="stockStatus"  current={stockSort} onSort={handleStockSort} align="center" />
//                       <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
//                         Total Stock
//                       </th>
//                       <SortableHeader label="Remaining" sortKey="totalLeft"   current={stockSort} onSort={handleStockSort} align="center" />
//                       <SortableHeader label="Sold"      sortKey="totalSold"   current={stockSort} onSort={handleStockSort} align="center" />
//                       <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
//                         Batches
//                       </th>
//                     </tr>
//                   </thead>
//                   <tbody className="bg-white divide-y divide-gray-100">
//                     {stockLoading ? (
//                       Array.from({ length: 6 }).map((_, i) => (
//                         <SkeletonRow key={i} cols={7} />
//                       ))
//                     ) : sortedStock.length === 0 ? (
//                       <tr>
//                         <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
//                           No products match the current filters.
//                         </td>
//                       </tr>
//                     ) : (
//                       sortedStock.map((row) => {
//                         const key    = `stock-${row.productId}`;
//                         const isOpen = !!expandedRows[key];
//                         const pct    = row.totalInitial > 0 ? (row.totalLeft / row.totalInitial) * 100 : 0;
//                         const rowBg  =
//                           row.stockStatus === "empty"
//                             ? "bg-red-50/50"
//                             : row.stockStatus === "low"
//                             ? "bg-amber-50/50"
//                             : "";

//                         return (
//                           <>
//                             <tr
//                               key={row.productId}
//                               className={`hover:bg-gray-50 cursor-pointer transition-colors ${rowBg}`}
//                               onClick={() => toggleRow(key)}
//                             >
//                               <td className="px-6 py-3.5">
//                                 <Badge variant="outline">{row.categoryName}</Badge>
//                               </td>
//                               <td className="px-6 py-3.5 font-medium text-gray-900">
//                                 <div className="flex items-center gap-2">
//                                   <ChevronDown
//                                     className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
//                                       isOpen ? "rotate-180" : ""
//                                     }`}
//                                   />
//                                   {row.productName}
//                                 </div>
//                               </td>
//                               <td className="px-6 py-3.5 text-center">
//                                 <Badge
//                                   variant={stockStatusBadgeVariant(row.stockStatus)}
//                                   className={row.stockStatus === "ok" ? "bg-green-500 text-white" : ""}
//                                 >
//                                   {stockStatusLabel[row.stockStatus]}
//                                 </Badge>
//                               </td>
//                               <td className="px-6 py-3.5 text-center text-gray-600 font-mono">
//                                 {row.totalInitial}
//                               </td>
//                               <td className="px-6 py-3.5">
//                                 <div className="flex flex-col items-center gap-1">
//                                   <span
//                                     className={`font-bold font-mono text-sm ${
//                                       row.stockStatus === "empty"
//                                         ? "text-red-600"
//                                         : row.stockStatus === "low"
//                                         ? "text-amber-600"
//                                         : "text-emerald-600"
//                                     }`}
//                                   >
//                                     {row.totalLeft}
//                                   </span>
//                                   <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
//                                     <div
//                                       className="h-full rounded-full transition-all"
//                                       style={{
//                                         width: `${Math.max(pct, 2)}%`,
//                                         backgroundColor: stockStatusBarColor(row.stockStatus),
//                                       }}
//                                     />
//                                   </div>
//                                   <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
//                                 </div>
//                               </td>
//                               <td className="px-6 py-3.5 text-center text-gray-500 font-mono">
//                                 {row.totalSold}
//                               </td>
//                               <td className="px-6 py-3.5 text-center">
//                                 <Badge variant="secondary">
//                                   {row.batches.length} batch{row.batches.length > 1 ? "es" : ""}
//                                 </Badge>
//                               </td>
//                             </tr>
//                             {isOpen && row.batches.length > 0 && (
//                               <StockBatchRows key={`${row.productId}-b`} batches={row.batches} />
//                             )}
//                           </>
//                         );
//                       })
//                     )}
//                   </tbody>

//                   {!stockLoading && sortedStock.length > 0 && (
//                     <tfoot>
//                       <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
//                         <td className="px-6 py-3.5 text-gray-700" colSpan={2}>Total</td>
//                         <td />
//                         <td className="px-6 py-3.5 text-center text-gray-700 font-mono">
//                           {sortedStock.reduce((a, b) => a + b.totalInitial, 0)}
//                         </td>
//                         <td className="px-6 py-3.5 text-center text-emerald-700 font-bold font-mono">
//                           {stockSummary.totalLeft}
//                         </td>
//                         <td className="px-6 py-3.5 text-center text-gray-600 font-mono">
//                           {sortedStock.reduce((a, b) => a + b.totalSold, 0)}
//                         </td>
//                         <td />
//                       </tr>
//                     </tfoot>
//                   )}
//                 </table>
//               </div>
//             </CardContent>
//           </Card>
//         </>
//       )}
//     </div>
//   );
// }



// // "use client";

// // // components/InventoryReportDashboard.tsx

// // import { useState, useCallback, useMemo } from "react";
// // import { useQuery } from "@tanstack/react-query";
// // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // import { Input } from "@/components/ui/input";
// // import { Label } from "@/components/ui/label";
// // import {
// //   Select,
// //   SelectContent,
// //   SelectItem,
// //   SelectTrigger,
// //   SelectValue,
// // } from "@/components/ui/select";
// // import { Badge } from "@/components/ui/badge";
// // import { Button } from "@/components/ui/button";
// // import {
// //   Download,
// //   Loader2,
// //   Calendar,
// //   X,
// //   Search,
// //   ChevronDown,
// //   Package,
// //   TrendingUp,
// //   Layers,
// //   AlertTriangle,
// //   BarChart3,
// //   Tag,
// // } from "lucide-react";
// // import { toast } from "sonner";
// // import type {
// //   SoldProduct,
// //   SoldBatch,
// //   StockProduct,
// //   StockBatch,
// //   StockStatus,
// //   SoldReportResponse,
// //   StockReportResponse,
// //   CategoryOption,
// // } from "@/lib/types/reports";

// // // ─────────────────────────────────────────────────────────────────────────────
// // // Helpers
// // // ─────────────────────────────────────────────────────────────────────────────

// // type ActiveTab = "sold" | "stock";
// // type DateMode = "today" | "custom";

// // const toDateStr = (d: Date): string => d.toISOString().split("T")[0];
// // const today = new Date();

// // const formatINR = (n: number): string =>
// //   `₹${n.toLocaleString("en-IN", {
// //     minimumFractionDigits: 2,
// //     maximumFractionDigits: 2,
// //   })}`;

// // const formatDate = (dt: string | Date): string =>
// //   new Date(dt).toLocaleDateString("en-GB", {
// //     day: "2-digit",
// //     month: "short",
// //     year: "numeric",
// //   });

// // // ─────────────────────────────────────────────────────────────────────────────
// // // Stock status helpers
// // // ─────────────────────────────────────────────────────────────────────────────

// // const stockStatusLabel: Record<StockStatus, string> = {
// //   ok: "In Stock",
// //   low: "Low Stock",
// //   empty: "Out of Stock",
// // };

// // type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

// // const stockStatusBadgeVariant = (status: StockStatus): BadgeVariant => {
// //   switch (status) {
// //     case "ok":
// //       return "default";
// //     case "low":
// //       return "secondary";
// //     case "empty":
// //       return "destructive";
// //   }
// // };

// // const stockStatusBarColor = (status: StockStatus): string => {
// //   switch (status) {
// //     case "ok":
// //       return "#10b981";
// //     case "low":
// //       return "#f59e0b";
// //     case "empty":
// //       return "#ef4444";
// //   }
// // };

// // // ─────────────────────────────────────────────────────────────────────────────
// // // Skeleton row
// // // ─────────────────────────────────────────────────────────────────────────────

// // const SkeletonRow = ({ cols }: { cols: number }) => (
// //   <tr className="animate-pulse">
// //     {Array.from({ length: cols }).map((_, i) => (
// //       <td key={i} className="px-6 py-4">
// //         <div className="h-4 bg-gray-200 rounded w-full" />
// //       </td>
// //     ))}
// //   </tr>
// // );

// // // ─────────────────────────────────────────────────────────────────────────────
// // // Stat card
// // // ─────────────────────────────────────────────────────────────────────────────

// // interface StatCardProps {
// //   icon: React.ReactNode;
// //   label: string;
// //   value: string | number;
// //   sub?: string;
// //   accent?: string;
// // }

// // const StatCard = ({
// //   icon,
// //   label,
// //   value,
// //   sub,
// //   accent = "#6366f1",
// // }: StatCardProps) => (
// //   <Card className="border-slate-100 shadow-sm">
// //     <CardContent className="p-5 flex gap-4 items-start">
// //       <div
// //         className="rounded-xl p-3 flex-shrink-0"
// //         style={{ background: `${accent}18` }}
// //       >
// //         <span style={{ color: accent }}>{icon}</span>
// //       </div>
// //       <div className="min-w-0">
// //         <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
// //           {label}
// //         </p>
// //         <p className="text-2xl font-bold text-slate-800 mt-0.5 leading-tight">
// //           {value}
// //         </p>
// //         {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
// //       </div>
// //     </CardContent>
// //   </Card>
// // );

// // // ─────────────────────────────────────────────────────────────────────────────
// // // Sold Batch Rows (expandable)
// // // ─────────────────────────────────────────────────────────────────────────────

// // const SoldBatchRows = ({ batches }: { batches: SoldBatch[] }) => (
// //   <>
// //     {batches.map((b) => (
// //       <tr key={b.batchId} className="bg-slate-50 border-l-4 border-l-slate-200">
// //         <td className="pl-14 pr-4 py-2.5 text-xs text-slate-500 font-mono">
// //           …{b.batchId.slice(-8)}
// //         </td>
// //         <td className="px-6 py-2.5 text-xs text-slate-400">
// //           {formatDate(b.purchaseDate)}
// //         </td>
// //         <td className="px-6 py-2.5 text-center text-xs font-semibold text-slate-600">
// //           {b.qtySold}
// //         </td>
// //         <td className="px-6 py-2.5 text-right text-xs font-semibold text-emerald-600 font-mono">
// //           {formatINR(b.revenue)}
// //         </td>
// //         <td className="px-6 py-2.5 text-center">
// //           <span className="text-xs text-slate-400 font-mono">
// //             cost: {formatINR(b.buyingPrice)}
// //           </span>
// //         </td>
// //       </tr>
// //     ))}
// //   </>
// // );

// // // ─────────────────────────────────────────────────────────────────────────────
// // // Stock Batch Rows (expandable)
// // // ─────────────────────────────────────────────────────────────────────────────

// // const StockBatchRows = ({ batches }: { batches: StockBatch[] }) => (
// //   <>
// //     {batches.map((b, i) => {
// //       const borderColor =
// //         b.status === "empty"
// //           ? "#ef4444"
// //           : b.status === "low"
// //           ? "#f59e0b"
// //           : "#e2e8f0";
// //       return (
// //         <tr
// //           key={b.batchId}
// //           className="bg-slate-50"
// //           style={{ borderLeft: `4px solid ${borderColor}` }}
// //         >
// //           <td className="pl-14 pr-4 py-2.5 text-xs text-slate-500">
// //             <span className="font-mono">Batch {i + 1}</span>
// //           </td>
// //           <td className="px-6 py-2.5 text-xs text-slate-400">
// //             {formatDate(b.purchaseDate)}
// //           </td>
// //           <td className="px-6 py-2.5 text-center">
// //             <Badge variant={stockStatusBadgeVariant(b.status)} className="text-xs">
// //               {stockStatusLabel[b.status]}
// //             </Badge>
// //           </td>
// //           <td className="px-6 py-2.5 text-center text-xs font-mono text-slate-500">
// //             {b.initialQuantity}
// //           </td>
// //           <td className="px-6 py-2.5 text-center">
// //             <span
// //               className={`text-xs font-bold font-mono ${
// //                 b.status === "empty"
// //                   ? "text-red-500"
// //                   : b.status === "low"
// //                   ? "text-amber-600"
// //                   : "text-emerald-600"
// //               }`}
// //             >
// //               {b.quantityLeft}
// //             </span>
// //           </td>
// //           <td className="px-6 py-2.5 text-center text-xs font-mono text-slate-500">
// //             {b.soldQuantity}
// //           </td>
// //           <td className="px-6 py-2.5 text-center text-xs text-slate-400 font-mono">
// //             {formatINR(b.buyingPrice)}/unit
// //           </td>
// //         </tr>
// //       );
// //     })}
// //   </>
// // );

// // // ─────────────────────────────────────────────────────────────────────────────
// // // Main Component
// // // ─────────────────────────────────────────────────────────────────────────────

// // export default function InventoryReportDashboard() {
// //   const [activeTab, setActiveTab] = useState<ActiveTab>("sold");
// //   const [dateMode, setDateMode] = useState<DateMode>("today");
// //   const [customDate, setCustomDate] = useState<string>(toDateStr(today));
// //   const [categoryFilter, setCategoryFilter] = useState<string>("all");
// //   const [searchQuery, setSearchQuery] = useState<string>("");
// //   const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
// //   const [isExporting, setIsExporting] = useState<boolean>(false);

// //   // ── Derived date ──────────────────────────────────────────────────────────
// //   const selectedDate = useMemo<string>(
// //     () => (dateMode === "today" ? toDateStr(today) : customDate),
// //     [dateMode, customDate]
// //   );

// //   // ── Fetch categories ──────────────────────────────────────────────────────
// //   const { data: categoriesData } = useQuery<{ data: CategoryOption[] }>({
// //     queryKey: ["report-categories"],
// //     queryFn: async () => {
// //       const res = await fetch("/api/reports/categories");
// //       if (!res.ok) throw new Error("Failed to fetch categories");
// //       return res.json();
// //     },
// //     staleTime: 5 * 60 * 1000,
// //   });

// //   const categories = categoriesData?.data ?? [];

// //   // ── Fetch sold report ─────────────────────────────────────────────────────
// //   const {
// //     data: soldResponse,
// //     isLoading: soldLoading,
// //     isFetching: soldFetching,
// //   } = useQuery<SoldReportResponse>({
// //     queryKey: ["report-sold", selectedDate, categoryFilter],
// //     queryFn: async (): Promise<SoldReportResponse> => {
// //       const params = new URLSearchParams({ date: selectedDate });
// //       if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
// //       const res = await fetch(`/api/reports/sold?${params}`);
// //       if (!res.ok) throw new Error("Failed to fetch sold report");
// //       return res.json();
// //     },
// //     enabled: activeTab === "sold",
// //     staleTime: 30 * 1000,
// //     placeholderData: (prev) => prev,
// //   });

// //   // ── Fetch stock report ────────────────────────────────────────────────────
// //   const {
// //     data: stockResponse,
// //     isLoading: stockLoading,
// //     isFetching: stockFetching,
// //   } = useQuery<StockReportResponse>({
// //     queryKey: ["report-stock", categoryFilter],
// //     queryFn: async (): Promise<StockReportResponse> => {
// //       const params = new URLSearchParams();
// //       if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
// //       const res = await fetch(`/api/reports/stock?${params}`);
// //       if (!res.ok) throw new Error("Failed to fetch stock report");
// //       return res.json();
// //     },
// //     enabled: activeTab === "stock",
// //     staleTime: 60 * 1000,
// //     placeholderData: (prev) => prev,
// //   });

// //   // ── Client-side search filter ─────────────────────────────────────────────
// //   const filteredSold = useMemo<SoldProduct[]>(() => {
// //     const rows = soldResponse?.data ?? [];
// //     if (!searchQuery.trim()) return rows;
// //     const q = searchQuery.toLowerCase();
// //     return rows.filter(
// //       (r) =>
// //         r.productName.toLowerCase().includes(q) ||
// //         r.categoryName.toLowerCase().includes(q)
// //     );
// //   }, [soldResponse, searchQuery]);

// //   const filteredStock = useMemo<StockProduct[]>(() => {
// //     const rows = stockResponse?.data ?? [];
// //     if (!searchQuery.trim()) return rows;
// //     const q = searchQuery.toLowerCase();
// //     return rows.filter(
// //       (r) =>
// //         r.productName.toLowerCase().includes(q) ||
// //         r.categoryName.toLowerCase().includes(q)
// //     );
// //   }, [stockResponse, searchQuery]);

// //   // ── Derived summaries (client-side after search filter) ───────────────────
// //   const soldSummary = useMemo(
// //     () => ({
// //       totalProducts: filteredSold.length,
// //       totalUnits: filteredSold.reduce((a, b) => a + b.totalQtySold, 0),
// //       totalRevenue: filteredSold.reduce((a, b) => a + b.totalRevenue, 0),
// //     }),
// //     [filteredSold]
// //   );

// //   const stockSummary = useMemo(
// //     () => ({
// //       totalProducts: filteredStock.length,
// //       totalLeft: filteredStock.reduce((a, b) => a + b.totalLeft, 0),
// //       lowCount: filteredStock.filter((p) => p.stockStatus === "low").length,
// //       emptyCount: filteredStock.filter((p) => p.stockStatus === "empty").length,
// //     }),
// //     [filteredStock]
// //   );

// //   // ── Toggle row expansion ──────────────────────────────────────────────────
// //   const toggleRow = useCallback((key: string) => {
// //     setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
// //   }, []);

// //   // ── Tab switch resets search & expansion ─────────────────────────────────
// //   const handleTabChange = useCallback((tab: ActiveTab) => {
// //     setActiveTab(tab);
// //     setSearchQuery("");
// //     setExpandedRows({});
// //   }, []);

// //   // ── CSV Export ────────────────────────────────────────────────────────────
// //   const handleExport = useCallback(() => {
// //     setIsExporting(true);
// //     try {
// //       let csvContent = "";

// //       if (activeTab === "sold") {
// //         const headers = [
// //           "Product",
// //           "Category",
// //           "Total Qty Sold",
// //           "Total Revenue (₹)",
// //           "Batch ID",
// //           "Batch Purchase Date",
// //           "Batch Buying Price (₹)",
// //           "Qty from Batch",
// //           "Revenue from Batch (₹)",
// //         ];
// //         const rows: string[] = [];

// //         filteredSold.forEach((p) => {
// //           if (p.batches.length === 0) {
// //             rows.push(
// //               [
// //                 p.productName,
// //                 p.categoryName,
// //                 p.totalQtySold,
// //                 p.totalRevenue.toFixed(2),
// //                 "",
// //                 "",
// //                 "",
// //                 "",
// //                 "",
// //               ]
// //                 .map((v) => `"${v}"`)
// //                 .join(",")
// //             );
// //           } else {
// //             p.batches.forEach((b, i) => {
// //               rows.push(
// //                 [
// //                   i === 0 ? p.productName : "",
// //                   i === 0 ? p.categoryName : "",
// //                   i === 0 ? p.totalQtySold : "",
// //                   i === 0 ? p.totalRevenue.toFixed(2) : "",
// //                   b.batchId,
// //                   formatDate(b.purchaseDate),
// //                   b.buyingPrice.toFixed(2),
// //                   b.qtySold,
// //                   b.revenue.toFixed(2),
// //                 ]
// //                   .map((v) => `"${v}"`)
// //                   .join(",")
// //               );
// //             });
// //           }
// //         });

// //         csvContent = [headers.join(","), ...rows].join("\n");
// //       } else {
// //         const headers = [
// //           "Product",
// //           "Category",
// //           "Stock Status",
// //           "Total Stock",
// //           "Total Remaining",
// //           "Total Sold",
// //           "Batch ID",
// //           "Batch Purchase Date",
// //           "Buying Price (₹)",
// //           "Initial Qty",
// //           "Remaining Qty",
// //           "Sold Qty",
// //           "Batch Status",
// //         ];
// //         const rows: string[] = [];

// //         filteredStock.forEach((p) => {
// //           p.batches.forEach((b, i) => {
// //             rows.push(
// //               [
// //                 i === 0 ? p.productName : "",
// //                 i === 0 ? p.categoryName : "",
// //                 i === 0 ? stockStatusLabel[p.stockStatus] : "",
// //                 i === 0 ? p.totalInitial : "",
// //                 i === 0 ? p.totalLeft : "",
// //                 i === 0 ? p.totalSold : "",
// //                 b.batchId,
// //                 formatDate(b.purchaseDate),
// //                 b.buyingPrice.toFixed(2),
// //                 b.initialQuantity,
// //                 b.quantityLeft,
// //                 b.soldQuantity,
// //                 stockStatusLabel[b.status],
// //               ]
// //                 .map((v) => `"${v}"`)
// //                 .join(",")
// //             );
// //           });
// //         });

// //         csvContent = [headers.join(","), ...rows].join("\n");
// //       }

// //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// //       const url = URL.createObjectURL(blob);
// //       const link = document.createElement("a");
// //       link.href = url;
// //       link.download = `${activeTab}-report-${selectedDate}.csv`;
// //       document.body.appendChild(link);
// //       link.click();
// //       document.body.removeChild(link);
// //       URL.revokeObjectURL(url);

// //       toast.success("Report exported successfully!");
// //     } catch (err) {
// //       console.error("Export error:", err);
// //       toast.error("Failed to export report");
// //     } finally {
// //       setTimeout(() => setIsExporting(false), 600);
// //     }
// //   }, [activeTab, filteredSold, filteredStock, selectedDate]);

// //   // ─────────────────────────────────────────────────────────────────────────
// //   // Render
// //   // ─────────────────────────────────────────────────────────────────────────

// //   const isFetching = activeTab === "sold" ? soldFetching : stockFetching;
// //   const isLoading = activeTab === "sold" ? soldLoading : stockLoading;

// //   return (
// //     <div className="space-y-6">
// //       {/* ── Page Header ── */}
// //       <div className="flex items-center justify-between">
// //         <div>
// //           <h2 className="text-2xl font-bold text-gray-900">
// //             Inventory &amp; Sales Report
// //           </h2>
// //           <p className="text-sm text-gray-500 mt-0.5">
// //             View sold products and remaining stock with batch-level detail
// //           </p>
// //         </div>

// //         <div className="flex items-center gap-3">
// //           {isFetching && !isLoading && (
// //             <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
// //           )}
// //           <Button
// //             onClick={handleExport}
// //             variant="outline"
// //             disabled={
// //               isExporting ||
// //               (activeTab === "sold"
// //                 ? filteredSold.length === 0
// //                 : filteredStock.length === 0)
// //             }
// //           >
// //             {isExporting ? (
// //               <>
// //                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
// //                 Exporting…
// //               </>
// //             ) : (
// //               <>
// //                 <Download className="w-4 h-4 mr-2" />
// //                 Export CSV
// //               </>
// //             )}
// //           </Button>
// //         </div>
// //       </div>

// //       {/* ── Tab Switcher ── */}
// //       <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
// //         {(
// //           [
// //             ["sold", TrendingUp, "Sold Products"],
// //             ["stock", Package, "Stock Report"],
// //           ] as const
// //         ).map(([key, Icon, label]) => (
// //           <button
// //             key={key}
// //             onClick={() => handleTabChange(key)}
// //             className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
// //               activeTab === key
// //                 ? "bg-white text-gray-900 shadow-sm"
// //                 : "text-gray-500 hover:text-gray-700"
// //             }`}
// //           >
// //             <Icon className="w-4 h-4" />
// //             {label}
// //           </button>
// //         ))}
// //       </div>

// //       {/* ── Filters ── */}
// //       <Card>
// //         <CardContent className="p-5">
// //           <div className="flex flex-wrap items-end gap-4">
// //             {/* Date — only on Sold tab */}
// //             {activeTab === "sold" && (
// //               <div className="space-y-1.5">
// //                 <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
// //                   <Calendar className="w-3.5 h-3.5" />
// //                   Date
// //                 </Label>
// //                 <div className="flex items-center gap-2">
// //                   <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
// //                     {(
// //                       [
// //                         ["today", "Today"],
// //                         ["custom", "Pick Date"],
// //                       ] as [DateMode, string][]
// //                     ).map(([mode, lbl]) => (
// //                       <button
// //                         key={mode}
// //                         onClick={() => setDateMode(mode)}
// //                         className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
// //                           dateMode === mode
// //                             ? "bg-white text-gray-900 shadow-sm"
// //                             : "text-gray-500 hover:text-gray-700"
// //                         }`}
// //                       >
// //                         {lbl}
// //                       </button>
// //                     ))}
// //                   </div>

// //                   {dateMode === "custom" && (
// //                     <Input
// //                       type="date"
// //                       value={customDate}
// //                       max={toDateStr(today)}
// //                       onChange={(e) => setCustomDate(e.target.value)}
// //                       className="w-44 text-sm"
// //                     />
// //                   )}

// //                   <span className="text-xs text-gray-400 font-mono">
// //                     {formatDate(selectedDate)}
// //                   </span>
// //                 </div>
// //               </div>
// //             )}

// //             {/* Category */}
// //             <div className="space-y-1.5">
// //               <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
// //                 <Tag className="w-3.5 h-3.5" />
// //                 Category
// //               </Label>
// //               <Select
// //                 value={categoryFilter}
// //                 onValueChange={(v) => {
// //                   setCategoryFilter(v);
// //                   setExpandedRows({});
// //                 }}
// //               >
// //                 <SelectTrigger className="w-44">
// //                   <SelectValue placeholder="All Categories" />
// //                 </SelectTrigger>
// //                 <SelectContent>
// //                   <SelectItem value="all">All Categories</SelectItem>
// //                   {categories.map((c) => (
// //                     <SelectItem key={c._id} value={c._id}>
// //                       {c.name}
// //                     </SelectItem>
// //                   ))}
// //                 </SelectContent>
// //               </Select>
// //             </div>

// //             {/* Search */}
// //             <div className="space-y-1.5 flex-1 min-w-52">
// //               <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
// //                 <Search className="w-3.5 h-3.5" />
// //                 Search
// //               </Label>
// //               <div className="relative">
// //                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
// //                 <Input
// //                   placeholder="Product or category name…"
// //                   value={searchQuery}
// //                   onChange={(e) => setSearchQuery(e.target.value)}
// //                   className="pl-9 pr-9"
// //                 />
// //                 {searchQuery && (
// //                   <button
// //                     onClick={() => setSearchQuery("")}
// //                     className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
// //                   >
// //                     <X className="w-4 h-4" />
// //                   </button>
// //                 )}
// //               </div>
// //             </div>
// //           </div>
// //         </CardContent>
// //       </Card>

// //       {/* ══════════════════════════════════════════════════════════════════════
// //           SOLD PRODUCTS TAB
// //       ══════════════════════════════════════════════════════════════════════ */}
// //       {activeTab === "sold" && (
// //         <>
// //           {/* Stat Cards */}
// //           <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
// //             <StatCard
// //               icon={<TrendingUp className="w-5 h-5" />}
// //               label="Products Sold"
// //               value={soldSummary.totalProducts}
// //               sub={`on ${formatDate(selectedDate)}`}
// //               accent="#6366f1"
// //             />
// //             <StatCard
// //               icon={<Layers className="w-5 h-5" />}
// //               label="Total Units Sold"
// //               value={soldSummary.totalUnits.toLocaleString("en-IN")}
// //               sub="across all products"
// //               accent="#8b5cf6"
// //             />
// //             <StatCard
// //               icon={<BarChart3 className="w-5 h-5" />}
// //               label="Total Revenue"
// //               value={formatINR(soldSummary.totalRevenue)}
// //               sub="from completed purchases"
// //               accent="#10b981"
// //             />
// //           </div>

// //           {/* Sold Table */}
// //           <Card>
// //             <CardHeader className="pb-0">
// //               <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
// //                 Sold Products — Batch Breakdown
// //                 <span className="text-sm font-normal text-gray-400">
// //                   ({filteredSold.length} products · click row to expand batches)
// //                 </span>
// //                 {soldFetching && !soldLoading && (
// //                   <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-auto" />
// //                 )}
// //               </CardTitle>
// //             </CardHeader>
// //             <CardContent className="p-0 mt-4">
// //               <div className="overflow-x-auto">
// //                 <table className="w-full text-sm">
// //                   <thead className="bg-gray-50">
// //                     <tr>
// //                       {[
// //                         ["Product", "text-left"],
// //                         ["Category", "text-left"],
// //                         ["Qty Sold", "text-center"],
// //                         ["Revenue", "text-right"],
// //                         ["Batches", "text-center"],
// //                       ].map(([h, align]) => (
// //                         <th 
// //                           key={h}
// //                           className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${align}`}
// //                         >
// //                           {h}
// //                         </th>
// //                       ))}
// //                     </tr>
// //                   </thead>
// //                   <tbody className="bg-white divide-y divide-gray-100">
// //                     {soldLoading ? (
// //                       Array.from({ length: 5 }).map((_, i) => (
// //                         <SkeletonRow key={i} cols={5} />
// //                       ))
// //                     ) : filteredSold.length === 0 ? (
// //                       <tr>
// //                         <td
// //                           colSpan={5}
// //                           className="px-6 py-12 text-center text-gray-400"
// //                         >
// //                           No products sold on this date with current filters.
// //                         </td>
// //                       </tr>
// //                     ) : (
// //                       filteredSold.map((row) => {
// //                         const isOpen = !!expandedRows[row.productId];
// //                         return (
// //                           <>
// //                             <tr
// //                               key={row.productId}
// //                               className="hover:bg-gray-50 cursor-pointer transition-colors"
// //                               onClick={() => toggleRow(row.productId)}
// //                             >
// //                               <td className="px-6 py-3.5 font-medium text-gray-900">
// //                                 <div className="flex items-center gap-2">
// //                                   <ChevronDown
// //                                     className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
// //                                       isOpen ? "rotate-180" : ""
// //                                     }`}
// //                                   />
// //                                   {row.productName}
// //                                 </div>
// //                               </td>
// //                               <td className="px-6 py-3.5">
// //                                 <Badge variant="outline">
// //                                   {row.categoryName}
// //                                 </Badge>
// //                               </td>
// //                               <td className="px-6 py-3.5 text-center">
// //                                 <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-violet-50 text-violet-700 font-bold text-sm">
// //                                   {row.totalQtySold}
// //                                 </span>
// //                               </td>
// //                               <td className="px-6 py-3.5 text-right font-semibold text-gray-800 font-mono">
// //                                 {formatINR(row.totalRevenue)}
// //                               </td>
// //                               <td className="px-6 py-3.5 text-center">
// //                                 {row.batches.length > 0 ? (
// //                                   <Badge variant="secondary">
// //                                     {row.batches.length} batch
// //                                     {row.batches.length > 1 ? "es" : ""}
// //                                   </Badge>
// //                                 ) : (
// //                                   <span className="text-gray-300">—</span>
// //                                 )}
// //                               </td>
// //                             </tr>

// //                             {isOpen && row.batches.length > 0 && (
// //                               <SoldBatchRows batches={row.batches} />
// //                             )}
// //                           </>
// //                         );
// //                       })
// //                     )}
// //                   </tbody>

// //                   {/* Footer totals */}
// //                   {!soldLoading && filteredSold.length > 0 && (
// //                     <tfoot>
// //                       <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
// //                         <td className="px-6 py-3.5 text-gray-700">Total</td>
// //                         <td />
// //                         <td className="px-6 py-3.5 text-center text-violet-700">
// //                           {soldSummary.totalUnits}
// //                         </td>
// //                         <td className="px-6 py-3.5 text-right text-emerald-700 font-mono">
// //                           {formatINR(soldSummary.totalRevenue)}
// //                         </td>
// //                         <td />
// //                       </tr>
// //                     </tfoot>
// //                   )}
// //                 </table>
// //               </div>
// //             </CardContent>
// //           </Card>
// //         </>
// //       )}

// //       {/* ══════════════════════════════════════════════════════════════════════
// //           STOCK REPORT TAB
// //       ══════════════════════════════════════════════════════════════════════ */}
// //       {activeTab === "stock" && (
// //         <>
// //           {/* Stat Cards */}
// //           <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
// //             <StatCard
// //               icon={<Package className="w-5 h-5" />}
// //               label="Total Products"
// //               value={stockSummary.totalProducts}
// //               sub="tracked in system"
// //               accent="#6366f1"
// //             />
// //             <StatCard
// //               icon={<Layers className="w-5 h-5" />}
// //               label="Units Remaining"
// //               value={stockSummary.totalLeft.toLocaleString("en-IN")}
// //               sub="across all batches"
// //               accent="#8b5cf6"
// //             />
// //             <StatCard
// //               icon={<AlertTriangle className="w-5 h-5" />}
// //               label="Low Stock"
// //               value={stockSummary.lowCount}
// //               sub="products need reorder"
// //               accent="#f59e0b"
// //             />
// //             <StatCard
// //               icon={<X className="w-5 h-5" />}
// //               label="Out of Stock"
// //               value={stockSummary.emptyCount}
// //               sub="fully depleted"
// //               accent="#ef4444"
// //             />
// //           </div>

// //           {/* Stock Table */}
// //           <Card>
// //             <CardHeader className="pb-0">
// //               <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
// //                 Stock — Batch-wise Breakdown
// //                 <span className="text-sm font-normal text-gray-400">
// //                   ({filteredStock.length} products · click row to expand batches)
// //                 </span>
// //                 {stockFetching && !stockLoading && (
// //                   <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-auto" />
// //                 )}
// //               </CardTitle>
// //             </CardHeader>
// //             <CardContent className="p-0 mt-4">
// //               <div className="overflow-x-auto">
// //                 <table className="w-full text-sm">
// //                   <thead className="bg-gray-50">
// //                     <tr>
// //                       {[
// //                         ["Product", "text-left"],
// //                         ["Category", "text-left"],
// //                         ["Status", "text-center"],
// //                         ["Total Stock", "text-center"],
// //                         ["Remaining", "text-center"],
// //                         ["Sold", "text-center"],
// //                         ["Batches", "text-center"],
// //                       ].map(([h, align]) => (
// //                         <th
// //                           key={h}
// //                           className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${align}`}
// //                         >
// //                           {h}
// //                         </th>
// //                       ))}
// //                     </tr>
// //                   </thead>
// //                   <tbody className="bg-white divide-y divide-gray-100">
// //                     {stockLoading ? (
// //                       Array.from({ length: 6 }).map((_, i) => (
// //                         <SkeletonRow key={i} cols={7} />
// //                       ))
// //                     ) : filteredStock.length === 0 ? (
// //                       <tr>
// //                         <td
// //                           colSpan={7}
// //                           className="px-6 py-12 text-center text-gray-400"
// //                         >
// //                           No products match the current filters.
// //                         </td>
// //                       </tr>
// //                     ) : (
// //                       filteredStock.map((row) => {
// //                         const key = `stock-${row.productId}`;
// //                         const isOpen = !!expandedRows[key];
// //                         const pct =
// //                           row.totalInitial > 0
// //                             ? (row.totalLeft / row.totalInitial) * 100
// //                             : 0;
// //                         const rowBg =
// //                           row.stockStatus === "empty"
// //                             ? "bg-red-50/50"
// //                             : row.stockStatus === "low"
// //                             ? "bg-amber-50/50"
// //                             : "";

// //                         return (
// //                           <>
// //                             <tr
// //                               key={row.productId}
// //                               className={`hover:bg-gray-50 cursor-pointer transition-colors ${rowBg}`}
// //                               onClick={() => toggleRow(key)}
// //                             >
// //                               <td className="px-6 py-3.5 font-medium text-gray-900">
// //                                 <div className="flex items-center gap-2">
// //                                   <ChevronDown
// //                                     className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
// //                                       isOpen ? "rotate-180" : ""
// //                                     }`}
// //                                   />
// //                                   {row.productName}
// //                                 </div>
// //                               </td>
// //                               <td className="px-6 py-3.5">
// //                                 <Badge variant="outline">
// //                                   {row.categoryName}
// //                                 </Badge>
// //                               </td>
// //                               <td className="px-6 py-3.5 text-center">
// //                                 <Badge
// //                                   variant={stockStatusBadgeVariant(
// //                                     row.stockStatus
// //                                   )}
// //                                   className={
// //                                     row.stockStatus === "ok"
// //                                       ? "bg-green-500 text-white"
// //                                       : ""
// //                                   }
// //                                 >
// //                                   {stockStatusLabel[row.stockStatus]}
// //                                 </Badge>
// //                               </td>
// //                               <td className="px-6 py-3.5 text-center text-gray-600 font-mono">
// //                                 {row.totalInitial}
// //                               </td>
// //                               <td className="px-6 py-3.5">
// //                                 <div className="flex flex-col items-center gap-1">
// //                                   <span
// //                                     className={`font-bold font-mono text-sm ${
// //                                       row.stockStatus === "empty"
// //                                         ? "text-red-600"
// //                                         : row.stockStatus === "low"
// //                                         ? "text-amber-600"
// //                                         : "text-emerald-600"
// //                                     }`}
// //                                   >
// //                                     {row.totalLeft}
// //                                   </span>
// //                                   {/* Stock level bar */}
// //                                   <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
// //                                     <div
// //                                       className="h-full rounded-full transition-all"
// //                                       style={{
// //                                         width: `${Math.max(pct, 2)}%`,
// //                                         backgroundColor: stockStatusBarColor(
// //                                           row.stockStatus
// //                                         ),
// //                                       }}
// //                                     />
// //                                   </div>
// //                                   <span className="text-xs text-gray-400">
// //                                     {pct.toFixed(0)}%
// //                                   </span>
// //                                 </div>
// //                               </td>
// //                               <td className="px-6 py-3.5 text-center text-gray-500 font-mono">
// //                                 {row.totalSold}
// //                               </td>
// //                               <td className="px-6 py-3.5 text-center">
// //                                 <Badge variant="secondary">
// //                                   {row.batches.length} batch
// //                                   {row.batches.length > 1 ? "es" : ""}
// //                                 </Badge>
// //                               </td>
// //                             </tr>

// //                             {isOpen && row.batches.length > 0 && (
// //                               <StockBatchRows batches={row.batches} />
// //                             )}
// //                           </>
// //                         );
// //                       })
// //                     )}
// //                   </tbody>

// //                   {/* Footer totals */}
// //                   {!stockLoading && filteredStock.length > 0 && (
// //                     <tfoot>
// //                       <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
// //                         <td className="px-6 py-3.5 text-gray-700">Total</td>
// //                         <td />
// //                         <td />
// //                         <td className="px-6 py-3.5 text-center text-gray-700 font-mono">
// //                           {filteredStock.reduce(
// //                             (a, b) => a + b.totalInitial,
// //                             0
// //                           )}
// //                         </td>
// //                         <td className="px-6 py-3.5 text-center text-emerald-700 font-bold font-mono">
// //                           {stockSummary.totalLeft}
// //                         </td>
// //                         <td className="px-6 py-3.5 text-center text-gray-600 font-mono">
// //                           {filteredStock.reduce((a, b) => a + b.totalSold, 0)}
// //                         </td>
// //                         <td />
// //                       </tr>
// //                     </tfoot>
// //                   )}
// //                 </table>
// //               </div>
// //             </CardContent>
// //           </Card>
// //         </>
// //       )}
// //     </div>
// //   );
// // }




// // // // components/dashboard/tabs/stock-report-tab.tsx
// // // "use client";

// // // import { useState, useCallback, useMemo } from "react";
// // // import { useQuery } from "@tanstack/react-query";
// // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // import { Input } from "@/components/ui/input";
// // // import { Label } from "@/components/ui/label";
// // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // import { Badge } from "@/components/ui/badge";
// // // import { Button } from "@/components/ui/button";
// // // import {
// // //   Search,
// // //   Download,
// // //   ChevronLeft,
// // //   ChevronRight,
// // //   ChevronsLeft,
// // //   ChevronsRight,
// // //   Loader2,
// // //   Calendar,
// // //   X,
// // //   Package,
// // //   TrendingDown,
// // //   AlertCircle,
// // //   Info,
// // // } from "lucide-react";
// // // import { toast } from "sonner";
// // // import type { Category, CategoriesListResponse } from "@/types";

// // // // Types
// // // interface DailySalesItem {
// // //   date: string;
// // //   productId: string;
// // //   productName: string;
// // //   productImage?: string;
// // //   categoryName: string;
// // //   quantitySold: number;
// // //   revenue: number;
// // //   transactionCount: number;
// // //   remainingStock: number;
// // // }

// // // interface ProductSummary {
// // //   productId: string;
// // //   productName: string;
// // //   productImage?: string;
// // //   categoryName: string;
// // //   totalInitialQuantity: number;
// // //   remainingStock: number;
// // //   quantitySold: number;
// // //   totalSold: number;
// // //   batchCount: number;
// // //   revenue: number;
// // // }

// // // interface StockBatch {
// // //   _id: string;
// // //   productId: string;
// // //   productName: string;
// // //   productImage?: string;
// // //   categoryName: string;
// // //   initialQuantity: number;
// // //   quantityLeft: number;
// // //   quantitySold: number;
// // //   buyingPrice?: any;
// // //   sellingPrice: any;
// // //   purchaseDate: string;
// // //   createdBy?: string;
// // // }

// // // interface StockReportResponse {
// // //   success: boolean;
// // //   data: {
// // //     dailySales?: DailySalesItem[];
// // //     products?: ProductSummary[];
// // //     batches?: StockBatch[];
// // //     summary?: {
// // //       totalQuantitySold?: number;
// // //       totalRevenue?: number;
// // //       totalTransactions?: number;
// // //       totalProducts?: number;
// // //       totalStock?: number;
// // //       totalSold?: number;
// // //     };
// // //   };
// // //   metadata: {
// // //     page: number;
// // //     limit: number;
// // //     totalCount: number;
// // //     totalPages: number;
// // //     hasNextPage: boolean;
// // //     hasPreviousPage: boolean;
// // //   };
// // // }

// // // type ViewMode = "batches" | "products" | "daily";
// // // type DateRangeType = "today" | "week" | "month" | "custom" | "all";

// // // interface FilterState {
// // //   viewMode: ViewMode;
// // //   categoryFilter: string;
// // //   dateRange: DateRangeType;
// // //   startDate: string;
// // //   endDate: string;
// // //   stockStatus: "all" | "in-stock" | "low-stock" | "out-of-stock";
// // //   currentPage: number;
// // //   pageSize: number;
// // // }

// // // // Skeleton Component
// // // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// // //   <tbody className="bg-white divide-y divide-gray-200">
// // //     {Array.from({ length: rows }).map((_, index) => (
// // //       <tr key={index} className="animate-pulse">
// // //         <td className="px-6 py-4">
// // //           <div className="h-4 bg-gray-200 rounded w-32"></div>
// // //         </td>
// // //         <td className="px-6 py-4">
// // //           <div className="h-4 bg-gray-200 rounded w-40"></div>
// // //         </td>
// // //         <td className="px-6 py-4">
// // //           <div className="h-4 bg-gray-200 rounded w-20"></div>
// // //         </td>
// // //         <td className="px-6 py-4">
// // //           <div className="h-4 bg-gray-200 rounded w-20"></div>
// // //         </td>
// // //         <td className="px-6 py-4">
// // //           <div className="h-4 bg-gray-200 rounded w-24"></div>
// // //         </td>
// // //       </tr>
// // //     ))}
// // //   </tbody>
// // // );

// // // export default function StockReportTab() {
// // //   const [searchInput, setSearchInput] = useState("");
// // //   const [committedSearch, setCommittedSearch] = useState("");

// // //   const [filters, setFilters] = useState<FilterState>({
// // //     viewMode: "batches",
// // //     categoryFilter: "all",
// // //     dateRange: "all",
// // //     startDate: "",
// // //     endDate: "",
// // //     stockStatus: "all",
// // //     currentPage: 1,
// // //     pageSize: 20,
// // //   });

// // //   const [isExporting, setIsExporting] = useState(false);

// // //   // Search handlers
// // //   const handleSearch = useCallback(() => {
// // //     setCommittedSearch(searchInput.trim());
// // //     setFilters(prev => ({ ...prev, currentPage: 1 }));
// // //   }, [searchInput]);

// // //   const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
// // //     if (e.key === "Enter") {
// // //       handleSearch();
// // //     }
// // //   }, [handleSearch]);

// // //   const handleClearSearch = useCallback(() => {
// // //     setSearchInput("");
// // //     setCommittedSearch("");
// // //     setFilters(prev => ({ ...prev, currentPage: 1 }));
// // //   }, []);

// // //   // Fetch stock report data
// // //   const { data: reportData, isLoading, isFetching } = useQuery<StockReportResponse>({
// // //     queryKey: [
// // //       "stock-report",
// // //       committedSearch,
// // //       filters.viewMode,
// // //       filters.categoryFilter,
// // //       filters.dateRange,
// // //       filters.startDate,
// // //       filters.endDate,
// // //       filters.stockStatus,
// // //       filters.currentPage,
// // //       filters.pageSize,
// // //     ],
// // //     queryFn: async (): Promise<StockReportResponse> => {
// // //       const params = new URLSearchParams();

// // //       if (committedSearch) params.append("search", committedSearch);
// // //       params.append("viewMode", filters.viewMode);
// // //       if (filters.categoryFilter !== "all") params.append("categoryId", filters.categoryFilter);
// // //       if (filters.dateRange !== "all") params.append("dateRange", filters.dateRange);
// // //       if (filters.dateRange === "custom" && filters.startDate) params.append("startDate", filters.startDate);
// // //       if (filters.dateRange === "custom" && filters.endDate) params.append("endDate", filters.endDate);
// // //       if (filters.stockStatus !== "all") params.append("stockStatus", filters.stockStatus);
// // //       params.append("page", filters.currentPage.toString());
// // //       params.append("limit", filters.pageSize.toString());

// // //       const response = await fetch(`/api/report?${params}`);
// // //       if (!response.ok) throw new Error("Failed to fetch stock report");
// // //       return response.json();
// // //     },
// // //     staleTime: 30 * 1000,
// // //     placeholderData: (previousData) => previousData,
// // //   });

// // //   // Fetch categories
// // //   const { data: categoriesData } = useQuery<Category[]>({
// // //     queryKey: ["categories"],
// // //     queryFn: async () => {
// // //       const response = await fetch("/api/categories");
// // //       if (!response.ok) throw new Error("Failed to fetch categories");
// // //       const data: CategoriesListResponse = await response.json();
// // //       return data.data?.categories || [];
// // //     },
// // //   });

// // //   const categories: Category[] = Array.isArray(categoriesData) ? categoriesData : [];
// // //   const dailySales = reportData?.data?.dailySales || [];
// // //   const products = reportData?.data?.products || [];
// // //   const batches = reportData?.data?.batches || [];
// // //   const summary = reportData?.data?.summary;
// // //   const pagination = reportData?.metadata;

// // //   // Update filter
// // //   const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
// // //     setFilters((prev) => ({
// // //       ...prev,
// // //       [key]: value,
// // //       ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
// // //     }));
// // //   }, []);

// // //   // Pagination handlers
// // //   const handlePageChange = useCallback((newPage: number) => {
// // //     setFilters((prev) => ({ ...prev, currentPage: newPage }));
// // //     window.scrollTo({ top: 0, behavior: "smooth" });
// // //   }, []);

// // //   const handlePageSizeChange = useCallback((newSize: string) => {
// // //     setFilters((prev) => ({
// // //       ...prev,
// // //       pageSize: parseInt(newSize),
// // //       currentPage: 1,
// // //     }));
// // //   }, []);

// // //   // Utility functions
// // //   const convertToNumber = useCallback((value: any): number => {
// // //     if (typeof value === 'number') return value;
// // //     if (value?.$numberDecimal) return parseFloat(value.$numberDecimal);
// // //     return 0;
// // //   }, []);

// // //   const formatCurrency = useCallback((amount: any) => {
// // //     const num = convertToNumber(amount);
// // //     return `₹${num.toFixed(2)}`;
// // //   }, [convertToNumber]);

// // //   const formatDate = useCallback((dateString: string): string => {
// // //     return new Date(dateString).toLocaleDateString("en-IN", {
// // //       day: "2-digit",
// // //       month: "short",
// // //       year: "numeric",
// // //     });
// // //   }, []);

// // //   const getStockStatusBadge = useCallback((quantityLeft: number, initialQuantity: number) => {
// // //     const percentage = (quantityLeft / initialQuantity) * 100;
    
// // //     if (quantityLeft === 0) {
// // //       return <Badge variant="destructive">Out of Stock</Badge>;
// // //     } else if (percentage <= 20) {
// // //       return <Badge className="bg-orange-500">Low Stock</Badge>;
// // //     } else if (percentage <= 50) {
// // //       return <Badge className="bg-yellow-500">Medium Stock</Badge>;
// // //     } else {
// // //       return <Badge className="bg-green-500">In Stock</Badge>;
// // //     }
// // //   }, []);

// // //   // Export functionality
// // //   const handleExport = useCallback(() => {
// // //     try {
// // //       setIsExporting(true);

// // //       let headers: string[] = [];
// // //       let rows: string[] = [];

// // //       if (filters.viewMode === "daily") {
// // //         headers = ["Date", "Product", "Category", "Sold Qty", "Remaining Stock", "Revenue", "Transactions"];
// // //         rows = dailySales.map((sale) => [
// // //           formatDate(sale.date),
// // //           `"${sale.productName}"`,
// // //           `"${sale.categoryName}"`,
// // //           sale.quantitySold.toString(),
// // //           sale.remainingStock.toString(),
// // //           sale.revenue.toFixed(2),
// // //           sale.transactionCount.toString(),
// // //         ].join(","));
// // //       } else if (filters.viewMode === "products") {
// // //         headers = ["Product", "Category", "Remaining Stock", "Sold (Period)", "Total Sold", "Batches", "Revenue"];
// // //         rows = products.map((product) => [
// // //           `"${product.productName}"`,
// // //           `"${product.categoryName}"`,
// // //           product.remainingStock.toString(),
// // //           product.quantitySold.toString(),
// // //           product.totalSold.toString(),
// // //           product.batchCount.toString(),
// // //           product.revenue.toFixed(2),
// // //         ].join(","));
// // //       } else {
// // //         headers = ["Product", "Category", "Purchase Date", "Initial Qty", "Remaining", "Sold", "Buying Price", "Selling Price", "Created By"];
// // //         rows = batches.map((batch) => [
// // //           `"${batch.productName || 'Unknown'}"`,
// // //           `"${batch.categoryName || 'N/A'}"`,
// // //           formatDate(batch.purchaseDate),
// // //           batch.initialQuantity.toString(),
// // //           batch.quantityLeft.toString(),
// // //           batch.quantitySold.toString(),
// // //           batch.buyingPrice ? convertToNumber(batch.buyingPrice).toFixed(2) : "N/A",
// // //           convertToNumber(batch.sellingPrice).toFixed(2),
// // //           `"${batch.createdBy || 'N/A'}"`,
// // //         ].join(","));
// // //       }

// // //       const csvContent = [headers.join(","), ...rows].join("\n");

// // //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// // //       const url = window.URL.createObjectURL(blob);
// // //       const link = document.createElement("a");
// // //       link.href = url;
// // //       link.download = `stock-report-${filters.viewMode}-${new Date().toISOString().split("T")[0]}.csv`;
// // //       document.body.appendChild(link);
// // //       link.click();
// // //       document.body.removeChild(link);
// // //       window.URL.revokeObjectURL(url);

// // //       toast.success("Report exported successfully!");
// // //     } catch (error) {
// // //       console.error("Export error:", error);
// // //       toast.error("Failed to export report");
// // //     } finally {
// // //       setIsExporting(false);
// // //     }
// // //   }, [filters.viewMode, dailySales, products, batches, convertToNumber, formatDate]);

// // //   // Pagination Controls
// // //   const PaginationControls = useCallback(() => {
// // //     if (!pagination) return null;

// // //     const { currentPage, totalPages, totalCount, hasNextPage, hasPreviousPage } = pagination;
// // //     const startIndex = (currentPage - 1) * filters.pageSize + 1;
// // //     const endIndex = Math.min(currentPage * filters.pageSize, totalCount);

// // //     const getPageNumbers = (): number[] => {
// // //       const maxVisible = 5;
// // //       const pages: number[] = [];

// // //       if (totalPages <= maxVisible) {
// // //         for (let i = 1; i <= totalPages; i++) pages.push(i);
// // //       } else if (currentPage <= 3) {
// // //         for (let i = 1; i <= maxVisible; i++) pages.push(i);
// // //       } else if (currentPage >= totalPages - 2) {
// // //         for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
// // //       } else {
// // //         for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
// // //       }

// // //       return pages;
// // //     };

// // //     return (
// // //       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
// // //         <div className="flex items-center space-x-2">
// // //           <span className="text-sm text-gray-700">
// // //             Showing {startIndex} to {endIndex} of {totalCount} results
// // //           </span>
// // //           <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
// // //             <SelectTrigger className="w-20">
// // //               <SelectValue />
// // //             </SelectTrigger>
// // //             <SelectContent>
// // //               <SelectItem value="10">10</SelectItem>
// // //               <SelectItem value="20">20</SelectItem>
// // //               <SelectItem value="50">50</SelectItem>
// // //               <SelectItem value="100">100</SelectItem>
// // //             </SelectContent>
// // //           </Select>
// // //           <span className="text-sm text-gray-700">per page</span>
// // //         </div>

// // //         <div className="flex items-center space-x-2">
// // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={!hasPreviousPage}>
// // //             <ChevronsLeft className="w-4 h-4" />
// // //           </Button>
// // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={!hasPreviousPage}>
// // //             <ChevronLeft className="w-4 h-4" />
// // //           </Button>

// // //           <div className="flex items-center space-x-1">
// // //             {getPageNumbers().map((pageNumber) => (
// // //               <Button
// // //                 key={pageNumber}
// // //                 variant={currentPage === pageNumber ? "default" : "outline"}
// // //                 size="sm"
// // //                 onClick={() => handlePageChange(pageNumber)}
// // //                 className="w-8 h-8"
// // //               >
// // //                 {pageNumber}
// // //               </Button>
// // //             ))}
// // //           </div>

// // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={!hasNextPage}>
// // //             <ChevronRight className="w-4 h-4" />
// // //           </Button>
// // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={!hasNextPage}>
// // //             <ChevronsRight className="w-4 h-4" />
// // //           </Button>
// // //         </div>
// // //       </div>
// // //     );
// // //   }, [pagination, filters.pageSize, handlePageChange, handlePageSizeChange]);

// // //   const showSkeleton = isLoading || isFetching;

// // //   return (
// // //     <div className="space-y-6">
// // //       {/* Header */}
// // //       <div className="flex justify-between items-center">
// // //         <div>
// // //           <h2 className="text-2xl font-bold text-gray-900">Stock Report</h2>
// // //           <p className="text-sm text-gray-500 mt-1">
// // //             Track daily sales, remaining stock, and batch-wise inventory
// // //           </p>
// // //         </div>
// // //         <Button onClick={handleExport} variant="outline" disabled={isExporting}>
// // //           {isExporting ? (
// // //             <>
// // //               <Loader2 className="w-4 h-4 mr-2 animate-spin" />
// // //               Exporting...
// // //             </>
// // //           ) : (
// // //             <>
// // //               <Download className="w-4 h-4 mr-2" />
// // //               Export Report
// // //             </>
// // //           )}
// // //         </Button>
// // //       </div>

// // //       {/* Summary Cards */}
// // //       {summary && (
// // //         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // //           {filters.viewMode === 'daily' && (
// // //             <>
// // //               <Card>
// // //                 <CardContent className="p-6">
// // //                   <div className="flex items-center justify-between">
// // //                     <div>
// // //                       <p className="text-sm text-gray-500">Total Sold</p>
// // //                       <p className="text-2xl font-bold text-gray-900">{summary.totalQuantitySold || 0}</p>
// // //                     </div>
// // //                     <TrendingDown className="w-8 h-8 text-blue-500" />
// // //                   </div>
// // //                 </CardContent>
// // //               </Card>

// // //               <Card>
// // //                 <CardContent className="p-6">
// // //                   <div className="flex items-center justify-between">
// // //                     <div>
// // //                       <p className="text-sm text-gray-500">Total Revenue</p>
// // //                       <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalRevenue || 0)}</p>
// // //                     </div>
// // //                     <Info className="w-8 h-8 text-green-500" />
// // //                   </div>
// // //                 </CardContent>
// // //               </Card>

// // //               <Card>
// // //                 <CardContent className="p-6">
// // //                   <div className="flex items-center justify-between">
// // //                     <div>
// // //                       <p className="text-sm text-gray-500">Transactions</p>
// // //                       <p className="text-2xl font-bold text-gray-900">{summary.totalTransactions || 0}</p>
// // //                     </div>
// // //                     <Package className="w-8 h-8 text-purple-500" />
// // //                   </div>
// // //                 </CardContent>
// // //               </Card>
// // //             </>
// // //           )}

// // //           {filters.viewMode === 'products' && (
// // //             <>
// // //               <Card>
// // //                 <CardContent className="p-6">
// // //                   <div className="flex items-center justify-between">
// // //                     <div>
// // //                       <p className="text-sm text-gray-500">Total Products</p>
// // //                       <p className="text-2xl font-bold text-gray-900">{summary.totalProducts || 0}</p>
// // //                     </div>
// // //                     <Package className="w-8 h-8 text-blue-500" />
// // //                   </div>
// // //                 </CardContent>
// // //               </Card>

// // //               <Card>
// // //                 <CardContent className="p-6">
// // //                   <div className="flex items-center justify-between">
// // //                     <div>
// // //                       <p className="text-sm text-gray-500">Current Stock</p>
// // //                       <p className="text-2xl font-bold text-gray-900">{summary.totalStock || 0}</p>
// // //                     </div>
// // //                     <TrendingDown className="w-8 h-8 text-green-500" />
// // //                   </div>
// // //                 </CardContent>
// // //               </Card>

// // //               <Card>
// // //                 <CardContent className="p-6">
// // //                   <div className="flex items-center justify-between">
// // //                     <div>
// // //                       <p className="text-sm text-gray-500">Total Sold</p>
// // //                       <p className="text-2xl font-bold text-gray-900">{summary.totalSold || 0}</p>
// // //                     </div>
// // //                     <AlertCircle className="w-8 h-8 text-orange-500" />
// // //                   </div>
// // //                 </CardContent>
// // //               </Card>

// // //               <Card>
// // //                 <CardContent className="p-6">
// // //                   <div className="flex items-center justify-between">
// // //                     <div>
// // //                       <p className="text-sm text-gray-500">Revenue</p>
// // //                       <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalRevenue || 0)}</p>
// // //                     </div>
// // //                     <Info className="w-8 h-8 text-indigo-500" />
// // //                   </div>
// // //                 </CardContent>
// // //               </Card>
// // //             </>
// // //           )}
// // //         </div>
// // //       )}

// // //       {/* Filters */}
// // //       <Card>
// // //         <CardContent className="p-6">
// // //           <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
// // //             {/* View Mode */}
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">View Mode</Label>
// // //               <Select value={filters.viewMode} onValueChange={(value: ViewMode) => updateFilter("viewMode", value)}>
// // //                 <SelectTrigger>
// // //                   <SelectValue />
// // //                 </SelectTrigger>
// // //                 <SelectContent>
// // //                   <SelectItem value="batches">Batch-wise</SelectItem>
// // //                   <SelectItem value="products">Product Summary</SelectItem>
// // //                   <SelectItem value="daily">Daily Sales</SelectItem>
// // //                 </SelectContent>
// // //               </Select>
// // //             </div>

// // //             {/* Search */}
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
// // //               <div className="flex gap-2">
// // //                 <div className="relative flex-1">
// // //                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // //                   <Input
// // //                     placeholder="Product name..."
// // //                     value={searchInput}
// // //                     onChange={(e) => setSearchInput(e.target.value)}
// // //                     onKeyDown={handleSearchKeyDown}
// // //                     className="pl-10 pr-8"
// // //                   />
// // //                   {searchInput && (
// // //                     <button
// // //                       onClick={handleClearSearch}
// // //                       className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
// // //                       type="button"
// // //                     >
// // //                       <X className="w-4 h-4" />
// // //                     </button>
// // //                   )}
// // //                 </div>
// // //                 <Button onClick={handleSearch} disabled={isFetching} size="icon" className="shrink-0">
// // //                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// // //                 </Button>
// // //               </div>
// // //             </div>

// // //             {/* Category Filter */}
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Category</Label>
// // //               <Select value={filters.categoryFilter} onValueChange={(value) => updateFilter("categoryFilter", value)}>
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

// // //             {/* Stock Status */}
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</Label>
// // //               <Select value={filters.stockStatus} onValueChange={(value: any) => updateFilter("stockStatus", value)}>
// // //                 <SelectTrigger>
// // //                   <SelectValue />
// // //                 </SelectTrigger>
// // //                 <SelectContent>
// // //                   <SelectItem value="all">All Status</SelectItem>
// // //                   <SelectItem value="in-stock">In Stock</SelectItem>
// // //                   <SelectItem value="low-stock">Low Stock</SelectItem>
// // //                   <SelectItem value="out-of-stock">Out of Stock</SelectItem>
// // //                 </SelectContent>
// // //               </Select>
// // //             </div>

// // //             {/* Date Range */}
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Date Range</Label>
// // //               <Select value={filters.dateRange} onValueChange={(value: DateRangeType) => updateFilter("dateRange", value)}>
// // //                 <SelectTrigger>
// // //                   <SelectValue />
// // //                 </SelectTrigger>
// // //                 <SelectContent>
// // //                   <SelectItem value="today">Today</SelectItem>
// // //                   <SelectItem value="week">This Week</SelectItem>
// // //                   <SelectItem value="month">This Month</SelectItem>
// // //                   <SelectItem value="custom">Custom Range</SelectItem>
// // //                   <SelectItem value="all">All Time</SelectItem>
// // //                 </SelectContent>
// // //               </Select>
// // //             </div>

// // //             {/* Custom Date Range */}
// // //             {filters.dateRange === "custom" && (
// // //               <div className="md:col-span-5">
// // //                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
// // //                   <div>
// // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // //                       <Calendar className="w-4 h-4" />
// // //                       Start Date
// // //                     </Label>
// // //                     <Input
// // //                       type="date"
// // //                       value={filters.startDate}
// // //                       onChange={(e) => updateFilter("startDate", e.target.value)}
// // //                       max={filters.endDate || undefined}
// // //                     />
// // //                   </div>
// // //                   <div>
// // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // //                       <Calendar className="w-4 h-4" />
// // //                       End Date
// // //                     </Label>
// // //                     <Input
// // //                       type="date"
// // //                       value={filters.endDate}
// // //                       onChange={(e) => updateFilter("endDate", e.target.value)}
// // //                       min={filters.startDate || undefined}
// // //                     />
// // //                   </div>
// // //                 </div>
// // //               </div>
// // //             )}
// // //           </div>
// // //         </CardContent>
// // //       </Card>

// // //       {/* Data Table */}
// // //       <Card>
// // //         <CardHeader>
// // //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// // //             {filters.viewMode === "batches" && "Stock Batches"}
// // //             {filters.viewMode === "products" && "Product Summary"}
// // //             {filters.viewMode === "daily" && "Daily Sales Report"}
// // //             {pagination && (
// // //               <span className="ml-2 text-sm font-normal text-gray-500">
// // //                 ({pagination.totalCount} {filters.viewMode === "batches" ? "batches" : filters.viewMode === "products" ? "products" : "days"})
// // //               </span>
// // //             )}
// // //             {isFetching && !isLoading && (
// // //               <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />
// // //             )}
// // //           </CardTitle>
// // //         </CardHeader>
// // //         <CardContent className="p-0">
// // //           <div className="overflow-x-auto">
// // //             {/* Batch-wise View - Individual batch tracking */}
// // //             {filters.viewMode === "batches" && (
// // //               <table className="w-full">
// // //                 <thead className="bg-gray-50">
// // //                   <tr>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Initial Qty</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Remaining</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sold</th>
// // //                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prices</th>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
// // //                   </tr>
// // //                 </thead>

// // //                 {showSkeleton ? (
// // //                   <TableSkeleton rows={filters.pageSize} />
// // //                 ) : batches.length === 0 ? (
// // //                   <tbody>
// // //                     <tr>
// // //                       <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
// // //                         No stock batches found for the selected criteria.
// // //                       </td>
// // //                     </tr>
// // //                   </tbody>
// // //                 ) : (
// // //                   <tbody className="bg-white divide-y divide-gray-200">
// // //                     {batches.map((batch) => (
// // //                       <tr key={batch._id} className="hover:bg-gray-50">
// // //                         <td className="px-6 py-4">
// // //                           <div className="flex items-center">
// // //                             {batch.productImage ? (
// // //                               <img src={batch.productImage} alt={batch.productName} className="w-10 h-10 rounded object-cover" />
// // //                             ) : (
// // //                               <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
// // //                                 <Package className="w-5 h-5 text-gray-400" />
// // //                               </div>
// // //                             )}
// // //                             <div className="ml-3">
// // //                               <p className="text-sm font-medium text-gray-900">{batch.productName || "Unknown"}</p>
// // //                               <p className="text-xs text-gray-500">{batch.categoryName}</p>
// // //                             </div>
// // //                           </div>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-sm text-gray-700">{formatDate(batch.purchaseDate)}</td>
// // //                         <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{batch.initialQuantity}</td>
// // //                         <td className="px-6 py-4 text-center">
// // //                           <span className={`text-sm font-bold ${
// // //                             batch.quantityLeft === 0 ? 'text-red-600' : 
// // //                             batch.quantityLeft < batch.initialQuantity * 0.2 ? 'text-orange-600' : 
// // //                             'text-green-600'
// // //                           }`}>
// // //                             {batch.quantityLeft}
// // //                           </span>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center text-sm font-medium text-blue-600">
// // //                           {batch.quantitySold}
// // //                         </td>
// // //                         <td className="px-6 py-4 text-right">
// // //                           <div className="text-sm">
// // //                             <div className="font-medium text-green-600">Sell: {formatCurrency(batch.sellingPrice)}</div>
// // //                             {batch.buyingPrice && (
// // //                               <div className="text-xs text-gray-500">Buy: {formatCurrency(batch.buyingPrice)}</div>
// // //                             )}
// // //                           </div>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-sm text-gray-700">{batch.createdBy || "N/A"}</td>
// // //                       </tr>
// // //                     ))}
// // //                   </tbody>
// // //                 )}
// // //               </table>
// // //             )}

// // //             {/* Product Summary View - Shows product-wise stock status */}
// // //             {filters.viewMode === "products" && (
// // //               <table className="w-full">
// // //                 <thead className="bg-gray-50">
// // //                   <tr>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Remaining Stock</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sold (Period)</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Sold</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Batches</th>
// // //                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
// // //                   </tr>
// // //                 </thead>

// // //                 {showSkeleton ? (
// // //                   <TableSkeleton rows={filters.pageSize} />
// // //                 ) : products.length === 0 ? (
// // //                   <tbody>
// // //                     <tr>
// // //                       <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
// // //                         No products found for the selected criteria.
// // //                       </td>
// // //                     </tr>
// // //                   </tbody>
// // //                 ) : (
// // //                   <tbody className="bg-white divide-y divide-gray-200">
// // //                     {products.map((product) => (
// // //                       <tr key={product.productId} className="hover:bg-gray-50">
// // //                         <td className="px-6 py-4">
// // //                           <div className="flex items-center">
// // //                             {product.productImage ? (
// // //                               <img src={product.productImage} alt={product.productName} className="w-10 h-10 rounded object-cover" />
// // //                             ) : (
// // //                               <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
// // //                                 <Package className="w-5 h-5 text-gray-400" />
// // //                               </div>
// // //                             )}
// // //                             <div className="ml-3">
// // //                               <p className="text-sm font-medium text-gray-900">{product.productName}</p>
// // //                               <p className="text-xs text-gray-500">{product.categoryName}</p>
// // //                             </div>
// // //                           </div>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center">
// // //                           <span className={`text-sm font-bold ${
// // //                             product.remainingStock === 0 ? 'text-red-600' : 
// // //                             product.remainingStock < 20 ? 'text-orange-600' : 
// // //                             'text-green-600'
// // //                           }`}>
// // //                             {product.remainingStock}
// // //                           </span>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center text-sm font-medium text-blue-600">
// // //                           {product.quantitySold}
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
// // //                           {product.totalSold}
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center text-sm text-gray-700">{product.batchCount}</td>
// // //                         <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">
// // //                           {formatCurrency(product.revenue)}
// // //                         </td>
// // //                       </tr>
// // //                     ))}
// // //                   </tbody>
// // //                 )}
// // //               </table>
// // //             )}

// // //             {/* Daily Sales View - Shows date-wise sold items and remaining stock */}
// // //             {filters.viewMode === 'daily' && (
// // //               <table className="w-full">
// // //                 <thead className="bg-gray-50">
// // //                   <tr>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
// // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sold Qty</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Remaining Stock</th>
// // //                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
// // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Transactions</th>
// // //                   </tr>
// // //                 </thead>

// // //                 {showSkeleton ? (
// // //                   <TableSkeleton rows={filters.pageSize} />
// // //                 ) : dailySales.length === 0 ? (
// // //                   <tbody>
// // //                     <tr>
// // //                       <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
// // //                         No sales data found for the selected criteria.
// // //                       </td>
// // //                     </tr>
// // //                   </tbody>
// // //                 ) : (
// // //                   <tbody className="bg-white divide-y divide-gray-200">
// // //                     {dailySales.map((sale, index) => (
// // //                       <tr key={`${sale.date}-${sale.productId}-${index}`} className="hover:bg-gray-50">
// // //                         <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatDate(sale.date)}</td>
// // //                         <td className="px-6 py-4">
// // //                           <div className="flex items-center">
// // //                             {sale.productImage ? (
// // //                               <img src={sale.productImage} alt={sale.productName} className="w-10 h-10 rounded object-cover" />
// // //                             ) : (
// // //                               <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
// // //                                 <Package className="w-5 h-5 text-gray-400" />
// // //                               </div>
// // //                             )}
// // //                             <div className="ml-3">
// // //                               <p className="text-sm font-medium text-gray-900">{sale.productName}</p>
// // //                               <p className="text-xs text-gray-500">{sale.categoryName}</p>
// // //                             </div>
// // //                           </div>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center">
// // //                           <span className="text-sm font-bold text-blue-600">{sale.quantitySold}</span>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center">
// // //                           <span className={`text-sm font-semibold ${
// // //                             sale.remainingStock === 0 ? 'text-red-600' : 
// // //                             sale.remainingStock < 10 ? 'text-orange-600' : 
// // //                             'text-green-600'
// // //                           }`}>
// // //                             {sale.remainingStock}
// // //                           </span>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">
// // //                           {formatCurrency(sale.revenue)}
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center text-sm text-gray-700">{sale.transactionCount}</td>
// // //                       </tr>
// // //                     ))}
// // //                   </tbody>
// // //                 )}
// // //               </table>
// // //             )}
// // //           </div>

// // //           {/* Pagination */}
// // //           <PaginationControls />
// // //         </CardContent>
// // //       </Card>
// // //     </div>
// // //   );
// // // }


// // // // // components/dashboard/tabs/stock-report-tab.tsx
// // // // "use client";

// // // // import { useState, useCallback, useMemo } from "react";
// // // // import { useQuery } from "@tanstack/react-query";
// // // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // // import { Input } from "@/components/ui/input";
// // // // import { Label } from "@/components/ui/label";
// // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// // // // import { Badge } from "@/components/ui/badge";
// // // // import { Button } from "@/components/ui/button";
// // // // import {
// // // //   Search,
// // // //   Download,
// // // //   ChevronLeft,
// // // //   ChevronRight,
// // // //   ChevronsLeft,
// // // //   ChevronsRight,
// // // //   Loader2,
// // // //   Calendar,
// // // //   X,
// // // //   Package,
// // // //   TrendingDown,
// // // //   AlertCircle,
// // // //   Info,
// // // // } from "lucide-react";
// // // // import { toast } from "sonner";
// // // // import type { Category, CategoriesListResponse } from "@/types";

// // // // // Types
// // // // interface StockBatch {
// // // //   _id: string;
// // // //   productId: {
// // // //     _id: string;
// // // //     name: string;
// // // //     imageURL?: string;
// // // //     size?: string;
// // // //   };
// // // //   categoryId: {
// // // //     _id: string;
// // // //     name: string;
// // // //   };
// // // //   buyingPrice?: {
// // // //     $numberDecimal: string;
// // // //   } | number;
// // // //   sellingPrice: {
// // // //     $numberDecimal: string;
// // // //   } | number;
// // // //   initialQuantity: number;
// // // //   quantityLeft: number;
// // // //   purchaseDate: string;
// // // //   createdBy: {
// // // //     username: string;
// // // //   };
// // // //   stockType: "Buy" | "Sell" | "Adjustment";
// // // // }

// // // // interface DailySales {
// // // //   date: string;
// // // //   totalQuantitySold: number;
// // // //   totalRevenue: number;
// // // //   transactionCount: number;
// // // // }

// // // // interface ProductStockSummary {
// // // //   productId: string;
// // // //   productName: string;
// // // //   productImage?: string;
// // // //   categoryName: string;
// // // //   totalInitialQuantity: number;
// // // //   totalQuantityLeft: number;
// // // //   totalQuantitySold: number;
// // // //   batchCount: number;
// // // //   totalValue: number;
// // // // }

// // // // interface StockReportResponse {
// // // //   success: boolean;
// // // //   data: {
// // // //     batches: StockBatch[];
// // // //     dailySales: DailySales[];
// // // //     productSummaries: ProductStockSummary[];
// // // //     totals: {
// // // //       totalBatches: number;
// // // //       totalProducts: number;
// // // //       totalStock: number;
// // // //       totalValue: number;
// // // //       lowStockCount: number;
// // // //     };
// // // //   };
// // // //   metadata: {
// // // //     page: number;
// // // //     limit: number;
// // // //     totalCount: number;
// // // //     totalPages: number;
// // // //     hasNextPage: boolean;
// // // //     hasPreviousPage: boolean;
// // // //   };
// // // // }

// // // // type ViewMode = "batches" | "products" | "daily";
// // // // type DateRangeType = "today" | "week" | "month" | "custom" | "all";

// // // // interface FilterState {
// // // //   viewMode: ViewMode;
// // // //   categoryFilter: string;
// // // //   dateRange: DateRangeType;
// // // //   startDate: string;
// // // //   endDate: string;
// // // //   stockStatus: "all" | "in-stock" | "low-stock" | "out-of-stock";
// // // //   currentPage: number;
// // // //   pageSize: number;
// // // // }

// // // // // Skeleton Component
// // // // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// // // //   <tbody className="bg-white divide-y divide-gray-200">
// // // //     {Array.from({ length: rows }).map((_, index) => (
// // // //       <tr key={index} className="animate-pulse">
// // // //         <td className="px-6 py-4">
// // // //           <div className="h-4 bg-gray-200 rounded w-32"></div>
// // // //         </td>
// // // //         <td className="px-6 py-4">
// // // //           <div className="h-4 bg-gray-200 rounded w-40"></div>
// // // //         </td>
// // // //         <td className="px-6 py-4">
// // // //           <div className="h-4 bg-gray-200 rounded w-20"></div>
// // // //         </td>
// // // //         <td className="px-6 py-4">
// // // //           <div className="h-4 bg-gray-200 rounded w-20"></div>
// // // //         </td>
// // // //         <td className="px-6 py-4">
// // // //           <div className="h-4 bg-gray-200 rounded w-24"></div>
// // // //         </td>
// // // //       </tr>
// // // //     ))}
// // // //   </tbody>
// // // // );

// // // // export default function StockReportTab() {
// // // //   const [searchInput, setSearchInput] = useState("");
// // // //   const [committedSearch, setCommittedSearch] = useState("");

// // // //   const [filters, setFilters] = useState<FilterState>({
// // // //     viewMode: "batches",
// // // //     categoryFilter: "all",
// // // //     dateRange: "all",
// // // //     startDate: "",
// // // //     endDate: "",
// // // //     stockStatus: "all",
// // // //     currentPage: 1,
// // // //     pageSize: 20,
// // // //   });

// // // //   const [isExporting, setIsExporting] = useState(false);

// // // //   // Search handlers
// // // //   const handleSearch = useCallback(() => {
// // // //     setCommittedSearch(searchInput.trim());
// // // //     setFilters(prev => ({ ...prev, currentPage: 1 }));
// // // //   }, [searchInput]);

// // // //   const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
// // // //     if (e.key === "Enter") {
// // // //       handleSearch();
// // // //     }
// // // //   }, [handleSearch]);

// // // //   const handleClearSearch = useCallback(() => {
// // // //     setSearchInput("");
// // // //     setCommittedSearch("");
// // // //     setFilters(prev => ({ ...prev, currentPage: 1 }));
// // // //   }, []);

// // // //   // Fetch stock report data
// // // //   const { data: reportData, isLoading, isFetching } = useQuery<StockReportResponse>({
// // // //     queryKey: [
// // // //       "stock-report",
// // // //       committedSearch,
// // // //       filters.viewMode,
// // // //       filters.categoryFilter,
// // // //       filters.dateRange,
// // // //       filters.startDate,
// // // //       filters.endDate,
// // // //       filters.stockStatus,
// // // //       filters.currentPage,
// // // //       filters.pageSize,
// // // //     ],
// // // //     queryFn: async (): Promise<StockReportResponse> => {
// // // //       const params = new URLSearchParams();

// // // //       if (committedSearch) params.append("search", committedSearch);
// // // //       params.append("viewMode", filters.viewMode);
// // // //       if (filters.categoryFilter !== "all") params.append("categoryId", filters.categoryFilter);
// // // //       if (filters.dateRange !== "all") params.append("dateRange", filters.dateRange);
// // // //       if (filters.dateRange === "custom" && filters.startDate) params.append("startDate", filters.startDate);
// // // //       if (filters.dateRange === "custom" && filters.endDate) params.append("endDate", filters.endDate);
// // // //       if (filters.stockStatus !== "all") params.append("stockStatus", filters.stockStatus);
// // // //       params.append("page", filters.currentPage.toString());
// // // //       params.append("limit", filters.pageSize.toString());

// // // //       const response = await fetch(`/api/report?${params}`);
// // // //       if (!response.ok) throw new Error("Failed to fetch stock report");
// // // //       return response.json();
// // // //     },
// // // //     staleTime: 30 * 1000,
// // // //     placeholderData: (previousData) => previousData,
// // // //   });

// // // //   // Fetch categories
// // // //   const { data: categoriesData } = useQuery<Category[]>({
// // // //     queryKey: ["categories"],
// // // //     queryFn: async () => {
// // // //       const response = await fetch("/api/categories");
// // // //       if (!response.ok) throw new Error("Failed to fetch categories");
// // // //       const data: CategoriesListResponse = await response.json();
// // // //       return data.data?.categories || [];
// // // //     },
// // // //   });

// // // //   const categories: Category[] = Array.isArray(categoriesData) ? categoriesData : [];
// // // //   const batches = reportData?.data?.batches || [];
// // // //   const productSummaries = reportData?.data?.productSummaries || [];
// // // //   const dailySales = reportData?.data?.dailySales || [];
// // // //   const totals = reportData?.data?.totals;
// // // //   const pagination = reportData?.metadata;

// // // //   // Update filter
// // // //   const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
// // // //     setFilters((prev) => ({
// // // //       ...prev,
// // // //       [key]: value,
// // // //       ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
// // // //     }));
// // // //   }, []);

// // // //   // Pagination handlers
// // // //   const handlePageChange = useCallback((newPage: number) => {
// // // //     setFilters((prev) => ({ ...prev, currentPage: newPage }));
// // // //     window.scrollTo({ top: 0, behavior: "smooth" });
// // // //   }, []);

// // // //   const handlePageSizeChange = useCallback((newSize: string) => {
// // // //     setFilters((prev) => ({
// // // //       ...prev,
// // // //       pageSize: parseInt(newSize),
// // // //       currentPage: 1,
// // // //     }));
// // // //   }, []);

// // // //   // Utility functions
// // // //   const convertToNumber = useCallback((value: any): number => {
// // // //     if (typeof value === 'number') return value;
// // // //     if (value?.$numberDecimal) return parseFloat(value.$numberDecimal);
// // // //     return 0;
// // // //   }, []);

// // // //   const formatCurrency = useCallback((amount: any) => {
// // // //     const num = convertToNumber(amount);
// // // //     return `₹${num.toFixed(2)}`;
// // // //   }, [convertToNumber]);

// // // //   const formatDate = useCallback((dateString: string): string => {
// // // //     return new Date(dateString).toLocaleDateString("en-IN", {
// // // //       day: "2-digit",
// // // //       month: "short",
// // // //       year: "numeric",
// // // //     });
// // // //   }, []);

// // // //   const getStockStatusBadge = useCallback((quantityLeft: number, initialQuantity: number) => {
// // // //     const percentage = (quantityLeft / initialQuantity) * 100;
    
// // // //     if (quantityLeft === 0) {
// // // //       return <Badge variant="destructive">Out of Stock</Badge>;
// // // //     } else if (percentage <= 20) {
// // // //       return <Badge className="bg-orange-500">Low Stock</Badge>;
// // // //     } else if (percentage <= 50) {
// // // //       return <Badge className="bg-yellow-500">Medium Stock</Badge>;
// // // //     } else {
// // // //       return <Badge className="bg-green-500">In Stock</Badge>;
// // // //     }
// // // //   }, []);

// // // //   // Export functionality
// // // //   const handleExport = useCallback(() => {
// // // //     try {
// // // //       setIsExporting(true);

// // // //       let headers: string[] = [];
// // // //       let rows: string[] = [];

// // // //       if (filters.viewMode === "batches") {
// // // //         headers = ["Product", "Category", "Purchase Date", "Initial Qty", "Qty Left", "Sold", "Buying Price", "Selling Price", "Status", "Created By"];
// // // //         rows = batches.map((batch) => [
// // // //           `"${batch.productId?.name || 'Unknown'}"`,
// // // //           `"${batch.categoryId?.name || 'N/A'}"`,
// // // //           formatDate(batch.purchaseDate),
// // // //           batch.initialQuantity.toString(),
// // // //           batch.quantityLeft.toString(),
// // // //           (batch.initialQuantity - batch.quantityLeft).toString(),
// // // //           batch.buyingPrice ? convertToNumber(batch.buyingPrice).toFixed(2) : "N/A",
// // // //           convertToNumber(batch.sellingPrice).toFixed(2),
// // // //           batch.quantityLeft === 0 ? "Out of Stock" : batch.quantityLeft < batch.initialQuantity * 0.2 ? "Low Stock" : "In Stock",
// // // //           `"${batch.createdBy?.username || 'N/A'}"`,
// // // //         ].join(","));
// // // //       } else if (filters.viewMode === "products") {
// // // //         headers = ["Product", "Category", "Total Stock", "Stock Left", "Sold", "Batches", "Total Value", "Status"];
// // // //         rows = productSummaries.map((summary) => [
// // // //           `"${summary.productName}"`,
// // // //           `"${summary.categoryName}"`,
// // // //           summary.totalInitialQuantity.toString(),
// // // //           summary.totalQuantityLeft.toString(),
// // // //           summary.totalQuantitySold.toString(),
// // // //           summary.batchCount.toString(),
// // // //           summary.totalValue.toFixed(2),
// // // //           summary.totalQuantityLeft === 0 ? "Out of Stock" : summary.totalQuantityLeft < summary.totalInitialQuantity * 0.2 ? "Low Stock" : "In Stock",
// // // //         ].join(","));
// // // //       } else {
// // // //         headers = ["Date", "Quantity Sold", "Revenue", "Transactions"];
// // // //         rows = dailySales.map((sale) => [
// // // //           formatDate(sale.date),
// // // //           sale.totalQuantitySold.toString(),
// // // //           sale.totalRevenue.toFixed(2),
// // // //           sale.transactionCount.toString(),
// // // //         ].join(","));
// // // //       }

// // // //       const csvContent = [headers.join(","), ...rows].join("\n");

// // // //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// // // //       const url = window.URL.createObjectURL(blob);
// // // //       const link = document.createElement("a");
// // // //       link.href = url;
// // // //       link.download = `stock-report-${filters.viewMode}-${new Date().toISOString().split("T")[0]}.csv`;
// // // //       document.body.appendChild(link);
// // // //       link.click();
// // // //       document.body.removeChild(link);
// // // //       window.URL.revokeObjectURL(url);

// // // //       toast.success("Report exported successfully!");
// // // //     } catch (error) {
// // // //       console.error("Export error:", error);
// // // //       toast.error("Failed to export report");
// // // //     } finally {
// // // //       setIsExporting(false);
// // // //     }
// // // //   }, [filters.viewMode, batches, productSummaries, dailySales, convertToNumber, formatDate]);

// // // //   // Pagination Controls
// // // //   const PaginationControls = useCallback(() => {
// // // //     if (!pagination) return null;

// // // //     const { currentPage, totalPages, totalCount, hasNextPage, hasPreviousPage } = pagination;
// // // //     const startIndex = (currentPage - 1) * filters.pageSize + 1;
// // // //     const endIndex = Math.min(currentPage * filters.pageSize, totalCount);

// // // //     const getPageNumbers = (): number[] => {
// // // //       const maxVisible = 5;
// // // //       const pages: number[] = [];

// // // //       if (totalPages <= maxVisible) {
// // // //         for (let i = 1; i <= totalPages; i++) pages.push(i);
// // // //       } else if (currentPage <= 3) {
// // // //         for (let i = 1; i <= maxVisible; i++) pages.push(i);
// // // //       } else if (currentPage >= totalPages - 2) {
// // // //         for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
// // // //       } else {
// // // //         for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
// // // //       }

// // // //       return pages;
// // // //     };

// // // //     return (
// // // //       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
// // // //         <div className="flex items-center space-x-2">
// // // //           <span className="text-sm text-gray-700">
// // // //             Showing {startIndex} to {endIndex} of {totalCount} results
// // // //           </span>
// // // //           <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
// // // //             <SelectTrigger className="w-20">
// // // //               <SelectValue />
// // // //             </SelectTrigger>
// // // //             <SelectContent>
// // // //               <SelectItem value="10">10</SelectItem>
// // // //               <SelectItem value="20">20</SelectItem>
// // // //               <SelectItem value="50">50</SelectItem>
// // // //               <SelectItem value="100">100</SelectItem>
// // // //             </SelectContent>
// // // //           </Select>
// // // //           <span className="text-sm text-gray-700">per page</span>
// // // //         </div>

// // // //         <div className="flex items-center space-x-2">
// // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={!hasPreviousPage}>
// // // //             <ChevronsLeft className="w-4 h-4" />
// // // //           </Button>
// // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={!hasPreviousPage}>
// // // //             <ChevronLeft className="w-4 h-4" />
// // // //           </Button>

// // // //           <div className="flex items-center space-x-1">
// // // //             {getPageNumbers().map((pageNumber) => (
// // // //               <Button
// // // //                 key={pageNumber}
// // // //                 variant={currentPage === pageNumber ? "default" : "outline"}
// // // //                 size="sm"
// // // //                 onClick={() => handlePageChange(pageNumber)}
// // // //                 className="w-8 h-8"
// // // //               >
// // // //                 {pageNumber}
// // // //               </Button>
// // // //             ))}
// // // //           </div>

// // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={!hasNextPage}>
// // // //             <ChevronRight className="w-4 h-4" />
// // // //           </Button>
// // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={!hasNextPage}>
// // // //             <ChevronsRight className="w-4 h-4" />
// // // //           </Button>
// // // //         </div>
// // // //       </div>
// // // //     );
// // // //   }, [pagination, filters.pageSize, handlePageChange, handlePageSizeChange]);

// // // //   const showSkeleton = isLoading || isFetching;

// // // //   return (
// // // //     <div className="space-y-6">
// // // //       {/* Header */}
// // // //       <div className="flex justify-between items-center">
// // // //         <div>
// // // //           <h2 className="text-2xl font-bold text-gray-900">Stock Report</h2>
// // // //           <p className="text-sm text-gray-500 mt-1">
// // // //             Track daily sales, remaining stock, and batch-wise inventory
// // // //           </p>
// // // //         </div>
// // // //         <Button onClick={handleExport} variant="outline" disabled={isExporting}>
// // // //           {isExporting ? (
// // // //             <>
// // // //               <Loader2 className="w-4 h-4 mr-2 animate-spin" />
// // // //               Exporting...
// // // //             </>
// // // //           ) : (
// // // //             <>
// // // //               <Download className="w-4 h-4 mr-2" />
// // // //               Export Report
// // // //             </>
// // // //           )}
// // // //         </Button>
// // // //       </div>

// // // //       {/* Summary Cards */}
// // // //       {totals && (
// // // //         <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
// // // //           <Card>
// // // //             <CardContent className="p-6">
// // // //               <div className="flex items-center justify-between">
// // // //                 <div>
// // // //                   <p className="text-sm text-gray-500">Total Batches</p>
// // // //                   <p className="text-2xl font-bold text-gray-900">{totals.totalBatches}</p>
// // // //                 </div>
// // // //                 <Package className="w-8 h-8 text-blue-500" />
// // // //               </div>
// // // //             </CardContent>
// // // //           </Card>

// // // //           <Card>
// // // //             <CardContent className="p-6">
// // // //               <div className="flex items-center justify-between">
// // // //                 <div>
// // // //                   <p className="text-sm text-gray-500">Total Products</p>
// // // //                   <p className="text-2xl font-bold text-gray-900">{totals.totalProducts}</p>
// // // //                 </div>
// // // //                 <Package className="w-8 h-8 text-purple-500" />
// // // //               </div>
// // // //             </CardContent>
// // // //           </Card>

// // // //           <Card>
// // // //             <CardContent className="p-6">
// // // //               <div className="flex items-center justify-between">
// // // //                 <div>
// // // //                   <p className="text-sm text-gray-500">Total Stock</p>
// // // //                   <p className="text-2xl font-bold text-gray-900">{totals.totalStock}</p>
// // // //                 </div>
// // // //                 <TrendingDown className="w-8 h-8 text-green-500" />
// // // //               </div>
// // // //             </CardContent>
// // // //           </Card>

// // // //           <Card>
// // // //             <CardContent className="p-6">
// // // //               <div className="flex items-center justify-between">
// // // //                 <div>
// // // //                   <p className="text-sm text-gray-500">Total Value</p>
// // // //                   <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalValue)}</p>
// // // //                 </div>
// // // //                 <Info className="w-8 h-8 text-indigo-500" />
// // // //               </div>
// // // //             </CardContent>
// // // //           </Card>

// // // //           <Card>
// // // //             <CardContent className="p-6">
// // // //               <div className="flex items-center justify-between">
// // // //                 <div>
// // // //                   <p className="text-sm text-gray-500">Low Stock Items</p>
// // // //                   <p className="text-2xl font-bold text-orange-600">{totals.lowStockCount}</p>
// // // //                 </div>
// // // //                 <AlertCircle className="w-8 h-8 text-orange-500" />
// // // //               </div>
// // // //             </CardContent>
// // // //           </Card>
// // // //         </div>
// // // //       )}

// // // //       {/* Filters */}
// // // //       <Card>
// // // //         <CardContent className="p-6">
// // // //           <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
// // // //             {/* View Mode */}
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">View Mode</Label>
// // // //               <Select value={filters.viewMode} onValueChange={(value: ViewMode) => updateFilter("viewMode", value)}>
// // // //                 <SelectTrigger>
// // // //                   <SelectValue />
// // // //                 </SelectTrigger>
// // // //                 <SelectContent>
// // // //                   <SelectItem value="batches">Batch-wise</SelectItem>
// // // //                   <SelectItem value="products">Product Summary</SelectItem>
// // // //                   <SelectItem value="daily">Daily Sales</SelectItem>
// // // //                 </SelectContent>
// // // //               </Select>
// // // //             </div>

// // // //             {/* Search */}
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
// // // //               <div className="flex gap-2">
// // // //                 <div className="relative flex-1">
// // // //                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // // //                   <Input
// // // //                     placeholder="Product name..."
// // // //                     value={searchInput}
// // // //                     onChange={(e) => setSearchInput(e.target.value)}
// // // //                     onKeyDown={handleSearchKeyDown}
// // // //                     className="pl-10 pr-8"
// // // //                   />
// // // //                   {searchInput && (
// // // //                     <button
// // // //                       onClick={handleClearSearch}
// // // //                       className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
// // // //                       type="button"
// // // //                     >
// // // //                       <X className="w-4 h-4" />
// // // //                     </button>
// // // //                   )}
// // // //                 </div>
// // // //                 <Button onClick={handleSearch} disabled={isFetching} size="icon" className="shrink-0">
// // // //                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// // // //                 </Button>
// // // //               </div>
// // // //             </div>

// // // //             {/* Category Filter */}
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Category</Label>
// // // //               <Select value={filters.categoryFilter} onValueChange={(value) => updateFilter("categoryFilter", value)}>
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

// // // //             {/* Stock Status */}
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</Label>
// // // //               <Select value={filters.stockStatus} onValueChange={(value: any) => updateFilter("stockStatus", value)}>
// // // //                 <SelectTrigger>
// // // //                   <SelectValue />
// // // //                 </SelectTrigger>
// // // //                 <SelectContent>
// // // //                   <SelectItem value="all">All Status</SelectItem>
// // // //                   <SelectItem value="in-stock">In Stock</SelectItem>
// // // //                   <SelectItem value="low-stock">Low Stock</SelectItem>
// // // //                   <SelectItem value="out-of-stock">Out of Stock</SelectItem>
// // // //                 </SelectContent>
// // // //               </Select>
// // // //             </div>

// // // //             {/* Date Range */}
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Date Range</Label>
// // // //               <Select value={filters.dateRange} onValueChange={(value: DateRangeType) => updateFilter("dateRange", value)}>
// // // //                 <SelectTrigger>
// // // //                   <SelectValue />
// // // //                 </SelectTrigger>
// // // //                 <SelectContent>
// // // //                   <SelectItem value="today">Today</SelectItem>
// // // //                   <SelectItem value="week">This Week</SelectItem>
// // // //                   <SelectItem value="month">This Month</SelectItem>
// // // //                   <SelectItem value="custom">Custom Range</SelectItem>
// // // //                   <SelectItem value="all">All Time</SelectItem>
// // // //                 </SelectContent>
// // // //               </Select>
// // // //             </div>

// // // //             {/* Custom Date Range */}
// // // //             {filters.dateRange === "custom" && (
// // // //               <div className="md:col-span-5">
// // // //                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
// // // //                   <div>
// // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // // //                       <Calendar className="w-4 h-4" />
// // // //                       Start Date
// // // //                     </Label>
// // // //                     <Input
// // // //                       type="date"
// // // //                       value={filters.startDate}
// // // //                       onChange={(e) => updateFilter("startDate", e.target.value)}
// // // //                       max={filters.endDate || undefined}
// // // //                     />
// // // //                   </div>
// // // //                   <div>
// // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // // //                       <Calendar className="w-4 h-4" />
// // // //                       End Date
// // // //                     </Label>
// // // //                     <Input
// // // //                       type="date"
// // // //                       value={filters.endDate}
// // // //                       onChange={(e) => updateFilter("endDate", e.target.value)}
// // // //                       min={filters.startDate || undefined}
// // // //                     />
// // // //                   </div>
// // // //                 </div>
// // // //               </div>
// // // //             )}
// // // //           </div>
// // // //         </CardContent>
// // // //       </Card>

// // // //       {/* Data Table */}
// // // //       <Card>
// // // //         <CardHeader>
// // // //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// // // //             {filters.viewMode === "batches" && "Stock Batches"}
// // // //             {filters.viewMode === "products" && "Product Summary"}
// // // //             {filters.viewMode === "daily" && "Daily Sales Report"}
// // // //             {pagination && (
// // // //               <span className="ml-2 text-sm font-normal text-gray-500">
// // // //                 ({pagination.totalCount} {filters.viewMode === "batches" ? "batches" : filters.viewMode === "products" ? "products" : "days"})
// // // //               </span>
// // // //             )}
// // // //             {isFetching && !isLoading && (
// // // //               <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />
// // // //             )}
// // // //           </CardTitle>
// // // //         </CardHeader>
// // // //         <CardContent className="p-0">
// // // //           <div className="overflow-x-auto">
// // // //             {/* Batch-wise View */}
// // // //             {filters.viewMode === "batches" && (
// // // //               <table className="w-full">
// // // //                 <thead className="bg-gray-50">
// // // //                   <tr>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Initial Qty</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty Left</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sold</th>
// // // //                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prices</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
// // // //                   </tr>
// // // //                 </thead>

// // // //                 {showSkeleton ? (
// // // //                   <TableSkeleton rows={filters.pageSize} />
// // // //                 ) : batches.length === 0 ? (
// // // //                   <tbody>
// // // //                     <tr>
// // // //                       <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
// // // //                         No stock batches found for the selected criteria.
// // // //                       </td>
// // // //                     </tr>
// // // //                   </tbody>
// // // //                 ) : (
// // // //                   <tbody className="bg-white divide-y divide-gray-200">
// // // //                     {batches.map((batch) => (
// // // //                       <tr key={batch._id} className="hover:bg-gray-50">
// // // //                         <td className="px-6 py-4">
// // // //                           <div className="flex items-center">
// // // //                             {batch.productId?.imageURL ? (
// // // //                               <img src={batch.productId.imageURL} alt={batch.productId.name} className="w-10 h-10 rounded object-cover" />
// // // //                             ) : (
// // // //                               <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
// // // //                                 <Package className="w-5 h-5 text-gray-400" />
// // // //                               </div>
// // // //                             )}
// // // //                             <div className="ml-3">
// // // //                               <p className="text-sm font-medium text-gray-900">{batch.productId?.name || "Unknown"}</p>
// // // //                               <p className="text-xs text-gray-500">{batch.categoryId?.name}</p>
// // // //                             </div>
// // // //                           </div>
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-sm text-gray-700">{formatDate(batch.purchaseDate)}</td>
// // // //                         <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{batch.initialQuantity}</td>
// // // //                         <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{batch.quantityLeft}</td>
// // // //                         <td className="px-6 py-4 text-center text-sm font-medium text-blue-600">
// // // //                           {batch.initialQuantity - batch.quantityLeft}
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-right">
// // // //                           <div className="text-sm">
// // // //                             <div className="font-medium text-green-600">Sell: {formatCurrency(batch.sellingPrice)}</div>
// // // //                             {batch.buyingPrice && (
// // // //                               <div className="text-xs text-gray-500">Buy: {formatCurrency(batch.buyingPrice)}</div>
// // // //                             )}
// // // //                           </div>
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-center">
// // // //                           {getStockStatusBadge(batch.quantityLeft, batch.initialQuantity)}
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-sm text-gray-700">{batch.createdBy?.username || "N/A"}</td>
// // // //                       </tr>
// // // //                     ))}
// // // //                   </tbody>
// // // //                 )}
// // // //               </table>
// // // //             )}

// // // //             {/* Product Summary View */}
// // // //             {filters.viewMode === "products" && (
// // // //               <table className="w-full">
// // // //                 <thead className="bg-gray-50">
// // // //                   <tr>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Stock</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Stock Left</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sold</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Batches</th>
// // // //                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
// // // //                   </tr>
// // // //                 </thead>

// // // //                 {showSkeleton ? (
// // // //                   <TableSkeleton rows={filters.pageSize} />
// // // //                 ) : productSummaries.length === 0 ? (
// // // //                   <tbody>
// // // //                     <tr>
// // // //                       <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
// // // //                         No products found for the selected criteria.
// // // //                       </td>
// // // //                     </tr>
// // // //                   </tbody>
// // // //                 ) : (
// // // //                   <tbody className="bg-white divide-y divide-gray-200">
// // // //                     {productSummaries.map((summary) => (
// // // //                       <tr key={summary.productId} className="hover:bg-gray-50">
// // // //                         <td className="px-6 py-4">
// // // //                           <div className="flex items-center">
// // // //                             {summary.productImage ? (
// // // //                               <img src={summary.productImage} alt={summary.productName} className="w-10 h-10 rounded object-cover" />
// // // //                             ) : (
// // // //                               <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
// // // //                                 <Package className="w-5 h-5 text-gray-400" />
// // // //                               </div>
// // // //                             )}
// // // //                             <div className="ml-3">
// // // //                               <p className="text-sm font-medium text-gray-900">{summary.productName}</p>
// // // //                               <p className="text-xs text-gray-500">{summary.categoryName}</p>
// // // //                             </div>
// // // //                           </div>
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{summary.totalInitialQuantity}</td>
// // // //                         <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">{summary.totalQuantityLeft}</td>
// // // //                         <td className="px-6 py-4 text-center text-sm font-medium text-blue-600">{summary.totalQuantitySold}</td>
// // // //                         <td className="px-6 py-4 text-center text-sm text-gray-700">{summary.batchCount}</td>
// // // //                         <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">
// // // //                           {formatCurrency(summary.totalValue)}
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-center">
// // // //                           {getStockStatusBadge(summary.totalQuantityLeft, summary.totalInitialQuantity)}
// // // //                         </td>
// // // //                       </tr>
// // // //                     ))}
// // // //                   </tbody>
// // // //                 )}
// // // //               </table>
// // // //             )}

// // // //             {/* Daily Sales View */}
// // // //             {filters.viewMode === "daily" && (
// // // //               <table className="w-full">
// // // //                 <thead className="bg-gray-50">
// // // //                   <tr>
// // // //                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity Sold</th>
// // // //                     <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
// // // //                     <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Transactions</th>
// // // //                   </tr>
// // // //                 </thead>

// // // //                 {showSkeleton ? (
// // // //                   <TableSkeleton rows={filters.pageSize} />
// // // //                 ) : dailySales.length === 0 ? (
// // // //                   <tbody>
// // // //                     <tr>
// // // //                       <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
// // // //                         No sales data found for the selected criteria.
// // // //                       </td>
// // // //                     </tr>
// // // //                   </tbody>
// // // //                 ) : (
// // // //                   <tbody className="bg-white divide-y divide-gray-200">
// // // //                     {dailySales.map((sale) => (
// // // //                       <tr key={sale.date} className="hover:bg-gray-50">
// // // //                         <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatDate(sale.date)}</td>
// // // //                         <td className="px-6 py-4 text-center text-sm font-medium text-blue-600">{sale.totalQuantitySold}</td>
// // // //                         <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">
// // // //                           {formatCurrency(sale.totalRevenue)}
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-center text-sm text-gray-700">{sale.transactionCount}</td>
// // // //                       </tr>
// // // //                     ))}
// // // //                   </tbody>
// // // //                 )}
// // // //               </table>
// // // //             )}
// // // //           </div>

// // // //           {/* Pagination */}
// // // //           <PaginationControls />
// // // //         </CardContent>
// // // //       </Card>
// // // //     </div>
// // // //   );
// // // // }