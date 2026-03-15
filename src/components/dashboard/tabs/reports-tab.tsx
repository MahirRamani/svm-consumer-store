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
