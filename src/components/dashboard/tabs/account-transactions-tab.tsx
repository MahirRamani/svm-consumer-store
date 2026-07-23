"use client";

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, Wallet, Calendar, ExternalLink, X, AlertCircle,
  Receipt, TrendingUp, TrendingDown, Ban, ArrowLeft,
  Download,
  FileText,
  Edit,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import AddAccountTransactionModal from '@/components/modals/add-account-transaction-modal';
import { useCancelAccountTransaction } from '@/hooks/use-account-transaction-mutations';
import type { Account } from '@/types/admin/account';
import type {
  AccountTransaction,
  AccountTransactionsPaginatedResponse,
  AccountTransactionSummary,
  PaginationMetadata,
} from "@/types/admin/accountTransaction";
import EditTransactionModal from '@/components/modals/edit-account-transaction-modal';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';

type DateRangeType = "today" | "week" | "month" | "custom" | "all";
type TransactionTypeFilter = "all" | "CREDIT" | "DEBIT";

interface FilterState {
  type: TransactionTypeFilter;
  dateRange: DateRangeType;
  startDate: string;
  endDate: string;
  currentPage: number;
  pageSize: number;
}
 
export interface AccountTransactionsTabProps {
  account: Account;
  onBack: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUTCBoundaries(dateRange: string, startDate: string, endDate: string) {
  const now = new Date();
  switch (dateRange) {
    case "today": {
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { startDate: s.toISOString(), endDate: e.toISOString() };
    }
    case "week": {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setHours(23, 59, 59, 999);
      return { startDate: s.toISOString(), endDate: e.toISOString() };
    }
    case "month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1); s.setHours(0, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0); e.setHours(23, 59, 59, 999);
      return { startDate: s.toISOString(), endDate: e.toISOString() };
    }
    case "custom": {
      if (!startDate || !endDate) return null;
      const s2 = new Date(startDate); s2.setHours(0, 0, 0, 0);
      const e2 = new Date(endDate); e2.setHours(23, 59, 59, 999);
      return { startDate: s2.toISOString(), endDate: e2.toISOString() };
    }
    default:
      return null;
  }
}

// ── Pagination ─────────────────────────────────────────────────────────────

// ✅ Outside component — with props
interface PaginationControlsProps {
  pagination: PaginationMetadata | undefined;
  currentPage: number;
  pageSize: number;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
}

function PaginationControls({
  pagination,
  currentPage,
  pageSize,
  updateFilter,
}: PaginationControlsProps) {
  if (!pagination) return null;

  const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;

  const pages: number[] = [];
  if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
  else if (currentPage <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
  else if (currentPage >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
  else for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
      <div className="flex items-center gap-2">
        <span>{startIndex}–{endIndex} of {totalCount}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => updateFilter("pageSize", Number(v) as FilterState["pageSize"])}
        >
          <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[5, 10, 20, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>per page</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7"
          onClick={() => updateFilter("currentPage", 1)} disabled={!hasPreviousPage}>
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7"
          onClick={() => updateFilter("currentPage", currentPage - 1)} disabled={!hasPreviousPage}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {pages.map((p) => (
          <Button key={p} variant={currentPage === p ? "default" : "outline"} size="icon"
            className="h-7 w-7 text-xs" onClick={() => updateFilter("currentPage", p)}>
            {p}
          </Button>
        ))}
        <Button variant="outline" size="icon" className="h-7 w-7"
          onClick={() => updateFilter("currentPage", currentPage + 1)} disabled={!hasNextPage}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7"
          onClick={() => updateFilter("currentPage", totalPages)} disabled={!hasNextPage}>
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// const PaginationControls = () => {
//   if (!pagination) return null;
//   const cp = filters.currentPage;
//   const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;

//   const pages: number[] = [];
//   if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
//   else if (cp <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
//   else if (cp >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
//   else for (let i = cp - 2; i <= cp + 2; i++) pages.push(i);

//   return (
//     <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
//       <div className="flex items-center gap-2">
//         <span>{startIndex}–{endIndex} of {totalCount}</span>
//         <Select
//           value={String(filters.pageSize)}
//           onValueChange={(v) => updateFilter("pageSize", Number(v) as FilterState["pageSize"])}
//         >
//           <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
//           <SelectContent>
//             {[5, 10, 20, 50].map((n) => (
//               <SelectItem key={n} value={String(n)}>{n}</SelectItem>
//             ))}
//           </SelectContent>
//         </Select>
//         <span>per page</span>
//       </div>
//       <div className="flex items-center gap-1">
//         <Button variant="outline" size="icon" className="h-7 w-7"
//           onClick={() => updateFilter("currentPage", 1)} disabled={!hasPreviousPage}>
//           <ChevronsLeft className="h-3.5 w-3.5" />
//         </Button>
//         <Button variant="outline" size="icon" className="h-7 w-7"
//           onClick={() => updateFilter("currentPage", cp - 1)} disabled={!hasPreviousPage}>
//           <ChevronLeft className="h-3.5 w-3.5" />
//         </Button>
//         {pages.map((p) => (
//           <Button key={p} variant={cp === p ? "default" : "outline"} size="icon"
//             className="h-7 w-7 text-xs" onClick={() => updateFilter("currentPage", p)}>
//             {p}
//           </Button>
//         ))}
//         <Button variant="outline" size="icon" className="h-7 w-7"
//           onClick={() => updateFilter("currentPage", cp + 1)} disabled={!hasNextPage}>
//           <ChevronRight className="h-3.5 w-3.5" />
//         </Button>
//         <Button variant="outline" size="icon" className="h-7 w-7"
//           onClick={() => updateFilter("currentPage", totalPages)} disabled={!hasNextPage}>
//           <ChevronsRight className="h-3.5 w-3.5" />
//         </Button>
//       </div>
//     </div>
//   );
// };

// ── Formatters ─────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

/** Cloudinary URLs ending in .pdf, or containing /raw/upload/, are PDFs. */
function isPdfUrl(url: string) {
  return url.endsWith(".pdf") || url.includes("/raw/upload/");
}
 
// ─── Sub-components ───────────────────────────────────────────────────────────
 
const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <tbody className="bg-white divide-y divide-gray-100">
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-4 py-3"><div className="space-y-1.5"><div className="h-3.5 bg-gray-100 rounded w-24" /><div className="h-3 bg-gray-100 rounded w-16" /></div></td>
        <td className="px-4 py-3 text-center"><div className="h-5 bg-gray-100 rounded-full w-14 mx-auto" /></td>
        <td className="px-4 py-3 text-right"><div className="h-4 bg-gray-100 rounded w-20 ml-auto" /></td>
        <td className="px-4 py-3 text-right"><div className="h-4 bg-gray-100 rounded w-24 ml-auto" /></td>
        <td className="px-4 py-3"><div className="h-3.5 bg-gray-100 rounded w-40" /></td>
        <td className="px-4 py-3 text-center"><div className="h-7 w-7 bg-gray-100 rounded mx-auto" /></td>
      </tr>
    ))}
  </tbody>
);
 
const StatTile = ({ label, value, icon: Icon, colorClass, loading }: {
  label: string; value: string; icon: React.ElementType; colorClass: string; loading?: boolean;
}) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colorClass}`}>
    <div className="p-1.5 rounded-lg bg-white/60">
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide leading-none">{label}</p>
      {loading
        ? <div className="h-4 bg-current opacity-10 rounded w-16 animate-pulse mt-1" />
        : <p className="text-base font-bold tabular-nums mt-0.5">{value}</p>}
    </div>
  </div>
);
 
/**
 * Bill cell — shows a tiny image thumbnail for images, a PDF icon for PDFs.
 * Both open the file in a new tab on click.
 */
const BillCell = ({ url }: { url: string }) => {
  const isPdf = isPdfUrl(url);
 
  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 transition-colors text-xs text-red-600 font-medium"
      >
        <FileText className="w-3 h-3 shrink-0" />
        View Bill
      </a>
    );
  }
 
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block mt-1 rounded overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
      title="View bill"
    >
      <img
        src={url}
        alt="Bill"
        className="w-10 h-10 object-cover"
        loading="lazy"
      />
    </a>
  );
};
 
// ─── Main Component ───────────────────────────────────────────────────────────
 
export default function AccountTransactionsTab({ account, onBack }: AccountTransactionsTabProps) {
  const cancelMutation = useCancelAccountTransaction();
 
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    type: "all", dateRange: "all", startDate: "", endDate: "",
    currentPage: 1, pageSize: 10,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AccountTransaction | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AccountTransaction | null>(null);
 
  // ── Summary ────────────────────────────────────────────────────────────────
 
  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ success: boolean; data: AccountTransactionSummary }>({
    queryKey: ["account-summary", account._id],
    queryFn: async () => {
      const res = await fetch(`/api/account-transactions/summary?accountId=${account._id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
  const summary = summaryData?.data;
 
  // ── Transactions ───────────────────────────────────────────────────────────
 
  const { data, isLoading, isFetching } = useQuery<AccountTransactionsPaginatedResponse>({
    queryKey: [
      "account-transactions", account._id, committedSearch,
      filters.type, filters.dateRange, filters.startDate, filters.endDate,
      filters.currentPage, filters.pageSize,
    ],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("accountId", account._id);
      if (committedSearch) p.set("search", committedSearch);
      if (filters.type !== "all") p.set("type", filters.type);
      if (filters.dateRange !== "all") {
        const b = getUTCBoundaries(filters.dateRange, filters.startDate, filters.endDate);
        if (b) { p.set("startDate", b.startDate); p.set("endDate", b.endDate); }
      }
      p.set("page", String(filters.currentPage));
      p.set("limit", String(filters.pageSize));
      const res = await fetch(`/api/account-transactions?${p}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
 
  const transactions: AccountTransaction[] = data?.data?.transactions ?? [];
  const pagination = data?.pagination;
 
  // ── Handlers ───────────────────────────────────────────────────────────────
 
  const handleSearch = useCallback(() => {
    setCommittedSearch(searchInput.trim());
    setFilters((p) => ({ ...p, currentPage: 1 }));
  }, [searchInput]);
 
  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setCommittedSearch("");
    setFilters((p) => ({ ...p, currentPage: 1 }));
  }, []);
 
  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => {
      if (key === "dateRange" && value === "custom") {
        const today = new Date().toISOString().split("T")[0];
        return { ...prev, dateRange: "custom", startDate: today, endDate: today, currentPage: 1 };
      }
      if (key === "dateRange" && value !== "custom") {
        return { ...prev, [key]: value, startDate: "", endDate: "", currentPage: 1 };
      }
      return { ...prev, [key]: value, ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}) };
    });
  }, []);
 
  // ✅ Fix — close on both success and error
const handleCancel = useCallback(() => {
  if (!cancelTarget) return;
  cancelMutation.mutate(cancelTarget._id, {
    onSuccess: () => setCancelTarget(null),
    onError: () => setCancelTarget(null),
  });
}, [cancelTarget, cancelMutation]);
 
 
 
  // ── Render ─────────────────────────────────────────────────────────────────
 
  return (
    <div className="space-y-5">
 
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900 truncate">{account.name}</h2>
            <Badge className={account.isActive
              ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs"
              : "bg-gray-100 text-gray-500 text-xs"}>
              {account.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          {account.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{account.description}</p>
          )}
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700"
          disabled={!account.isActive}
          title={!account.isActive ? "Account is inactive" : "Add a new transaction"}
        >
          <Plus className="w-4 h-4" /> Add Transaction
        </Button>
      </div>
 
      {/* Filters + Stats */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
 
        {/* Search + filters */}
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search in notes…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 pr-8"
              />
              {searchInput && (
                <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} size="icon" variant="outline" disabled={isFetching}>
              {isFetching && !isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />}
            </Button>
          </div>
 
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 whitespace-nowrap">Type</Label>
              <Select value={filters.type} onValueChange={(v) => updateFilter("type", v as TransactionTypeFilter)}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
 
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 whitespace-nowrap">Period</Label>
              <Select value={filters.dateRange} onValueChange={(v) => updateFilter("dateRange", v as DateRangeType)}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
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
              <>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />From
                  </Label>
                  <Input type="date" value={filters.startDate}
                    onChange={(e) => updateFilter("startDate", e.target.value)}
                    max={filters.endDate || undefined} className="w-32 h-8 text-xs" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />To
                  </Label>
                  <Input type="date" value={filters.endDate}
                    onChange={(e) => updateFilter("endDate", e.target.value)}
                    min={filters.startDate || undefined} className="w-32 h-8 text-xs" />
                </div>
              </>
            )}
          </div>
        </div>
 
        {/* Stat tiles */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <StatTile
            label="Balance" icon={Wallet}
            value={summary ? fmt(summary.currentBalance) : "-"}
            colorClass={summary?.currentBalance != null && summary.currentBalance >= 0
              ? "bg-blue-50 text-blue-700 border-blue-100"
              : "bg-red-50 text-red-700 border-red-100"}
            loading={summaryLoading}
          />
          <StatTile label="Credit" value={summary ? fmt(summary.totalCredit) : "—"} icon={TrendingUp}
            colorClass="bg-green-50 text-green-700 border-green-100" loading={summaryLoading} />
          <StatTile label="Debit" value={summary ? fmt(summary.totalDebit) : "—"} icon={TrendingDown}
            colorClass="bg-red-50 text-red-700 border-red-100" loading={summaryLoading} />
          <StatTile
            label="Net" icon={Receipt}
            value={summary ? fmt(summary.netFlow) : "—"}
            colorClass={!summary || summary.netFlow >= 0
              ? "bg-purple-50 text-purple-700 border-purple-100"
              : "bg-orange-50 text-orange-700 border-orange-100"}
            loading={summaryLoading}
          />
        </div>
      </div>
 
      {/* Transaction table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="px-4 py-3 border-b bg-white">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
            Transaction History
            {pagination && (
              <span className="text-xs font-normal text-gray-400">
                ({pagination.totalCount} entries)
              </span>
            )}
            {isFetching && !isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />}
          </CardTitle>
        </CardHeader>
 
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance After</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Note / Bill</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
 
            {isLoading ? (
              <TableSkeleton rows={filters.pageSize} />
            ) : (
              <tbody className="bg-white divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <Receipt className="w-10 h-10 opacity-25" />
                        <p className="text-sm font-medium">No transactions found</p>
                        {committedSearch
                          ? <button onClick={handleClearSearch} className="text-xs text-blue-500 hover:underline">Clear search</button>
                          : account.isActive && (
                            <button onClick={() => setShowAddModal(true)} className="text-xs text-blue-500 hover:underline">
                              Add the first transaction
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn._id} className="hover:bg-gray-50/60 transition-colors">
 
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-gray-900">{fmtDate(txn.enteredAt)}</p>
                        <p className="text-xs text-gray-400">{fmtTime(txn.enteredAt)}</p>
                      </td>
 
                      {/* Type badge */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          txn.type === "CREDIT"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {txn.type === "CREDIT"
                            ? <TrendingUp className="w-3 h-3" />
                            : <TrendingDown className="w-3 h-3" />}
                          {txn.type}
                        </span>
                      </td>
 
                      {/* Amount */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-bold tabular-nums ${
                          txn.type === "CREDIT" ? "text-green-600" : "text-red-600"
                        }`}>
                          {txn.type === "CREDIT" ? "+" : "−"}{fmt(txn.amount)}
                        </span>
                      </td>
 
                      {/* Balance after */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-semibold tabular-nums ${
                          txn.balanceAfter < 0 ? "text-red-500" : "text-gray-600"
                        }`}>
                          {fmt(txn.balanceAfter)}
                        </span>
                      </td>
 
                      {/* Note + bill */}
                      <td className="px-4 py-3 max-w-[220px]">
                        {txn.note
                          ? <p className="text-gray-700 truncate">{txn.note}</p>
                          : <p className="text-gray-300 italic text-xs">No note</p>}
                        {txn.billUrl && <BillCell url={txn.billUrl} />}
                      </td>
 
                      {/* Cancel */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {/* <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setCancelTarget(txn)}
                          title="Cancel Transaction"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button> */}
                        <div className="flex items-center justify-center gap-1">
    <Button
      variant="ghost" size="icon"
      className="h-7 w-7 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
      onClick={() => setEditTarget(txn)}
      title="Edit Transaction"
    >
      <Edit className="w-3.5 h-3.5" />
    </Button>
    <Button
      variant="ghost" size="icon"
      className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
      onClick={() => setCancelTarget(txn)}
      title="Cancel Transaction"
    >
      <Ban className="w-3.5 h-3.5" />
    </Button>
  </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            )}
          </table>
        </div>
 
        <PaginationControls
          pagination={pagination}
          currentPage={filters.currentPage}
          pageSize={filters.pageSize}
          updateFilter={updateFilter}
        />
      </Card>
 
      {/* Add Transaction Modal */}
      <AddAccountTransactionModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        account={account}
      />
 
      <EditTransactionModal
  open={!!editTarget}
  onOpenChange={(open) => !open && setEditTarget(null)}
  transaction={editTarget}
      />
      
      {/* Cancel Confirmation */}
      {/* <ConfirmDialog
  open={!!cancelTarget}
  onOpenChange={(open) => !open && setCancelTarget(null)}
  title="Cancel Transaction?"
  description={cancelTarget ? `Cancel this ${cancelTarget.type === "CREDIT" ? "credit" : "debit"} of ₹${Math.abs(cancelTarget.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} from ${fmtDate(cancelTarget.enteredAt)}? The balance will be recalculated automatically.` : ""}
  icon={Ban}
  confirmLabel="Cancel Transaction"
  loadingLabel="Cancelling..."
  variant="destructive"
  isLoading={cancelMutation.isPending}
  onConfirm={handleCancel}
/> */}
      <ConfirmDialog
  open={!!cancelTarget}
  onOpenChange={(open) => !open && setCancelTarget(null)}
  title="Cancel Transaction?"
  icon={Ban}
  description={
    cancelTarget ? (
      <div className="space-y-2">
        <p>
          Cancel this{" "}
          <span className="font-semibold text-gray-900">
            {cancelTarget.type === "CREDIT" ? "credit" : "debit"} of{" "}
            {fmt(cancelTarget.amount)}
          </span>{" "}
          from{" "}
          <span className="font-semibold text-gray-900">
            {fmtDate(cancelTarget.enteredAt)}
          </span>?
        </p>
        <p className="text-xs text-gray-400">
          The transaction will be soft-deleted and the account balance
          will be recalculated automatically.
        </p>
      </div>
    ) : undefined
  }
  confirmLabel="Cancel Transaction"
  cancelLabel="Keep It"
  loadingLabel="Cancelling..."
  variant="destructive"
  isLoading={cancelMutation.isPending}
  onConfirm={handleCancel}
/>
      {/* <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Cancel Transaction
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cancel this{" "}
              <span className="font-semibold text-gray-900">
                {cancelTarget?.type === "CREDIT" ? "credit" : "debit"} of{" "}
                {cancelTarget ? fmt(cancelTarget.amount) : ""}
              </span>{" "}
              from{" "}
              <span className="font-semibold text-gray-900">
                {fmtDate(cancelTarget?.enteredAt ?? "")}
              </span>?
              <br />
              <span className="text-xs mt-1 inline-block text-gray-400">
                The transaction will be soft-deleted and the account balance will be recalculated automatically.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep It</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              {cancelMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</>
                : "Cancel Transaction"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog> */}
    </div>
  );
}

// type DateRangeType = "today" | "week" | "month" | "custom" | "all";
// type TransactionTypeFilter = "all" | "CREDIT" | "DEBIT";

// interface FilterState {
//   type: TransactionTypeFilter;
//   dateRange: DateRangeType;
//   startDate: string;
//   endDate: string;
//   currentPage: number;
//   pageSize: number;
// }

// export interface AccountTransactionsTabProps {
//   account: Account;
//   onBack: () => void;
// }

// // ── Skeleton ──────────────────────────────────────────────────────────────────

// const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
//   <tbody className="bg-white divide-y divide-gray-100">
//     {Array.from({ length: rows }).map((_, i) => (
//       <tr key={i} className="animate-pulse">
//         <td className="px-4 py-3"><div className="space-y-1.5"><div className="h-3.5 bg-gray-100 rounded w-24" /><div className="h-3 bg-gray-100 rounded w-16" /></div></td>
//         <td className="px-4 py-3 text-center"><div className="h-5 bg-gray-100 rounded-full w-14 mx-auto" /></td>
//         <td className="px-4 py-3 text-right"><div className="h-4 bg-gray-100 rounded w-20 ml-auto" /></td>
//         <td className="px-4 py-3 text-right"><div className="h-4 bg-gray-100 rounded w-24 ml-auto" /></td>
//         <td className="px-4 py-3"><div className="h-3.5 bg-gray-100 rounded w-40" /></td>
//         <td className="px-4 py-3 text-center"><div className="h-7 w-7 bg-gray-100 rounded mx-auto" /></td>
//       </tr>
//     ))}
//   </tbody>
// );

// // ── Stat Tile ─────────────────────────────────────────────────────────────────

// const StatTile = ({ label, value, icon: Icon, colorClass, loading }: {
//   label: string; value: string; icon: React.ElementType; colorClass: string; loading?: boolean;
// }) => (
//   <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colorClass}`}>
//     <div className="p-1.5 rounded-lg bg-white/60">
//       <Icon className="w-4 h-4" />
//     </div>
//     <div>
//       <p className="text-xs font-medium opacity-70 uppercase tracking-wide leading-none">{label}</p>
//       {loading
//         ? <div className="h-4 bg-current opacity-10 rounded w-16 animate-pulse mt-1" />
//         : <p className="text-base font-bold tabular-nums mt-0.5">{value}</p>}
//     </div>
//   </div>
// );

// // ── UTC helper ────────────────────────────────────────────────────────────────

// function getUTCBoundaries(dateRange: string, startDate: string, endDate: string) {
//   const now = new Date();
//   switch (dateRange) {
//     case "today": {
//       const s = new Date(now); s.setHours(0, 0, 0, 0);
//       const e = new Date(now); e.setHours(23, 59, 59, 999);
//       return { startDate: s.toISOString(), endDate: e.toISOString() };
//     }
//     case "week": {
//       const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
//       const e = new Date(now); e.setHours(23, 59, 59, 999);
//       return { startDate: s.toISOString(), endDate: e.toISOString() };
//     }
//     case "month": {
//       const s = new Date(now.getFullYear(), now.getMonth(), 1); s.setHours(0, 0, 0, 0);
//       const e = new Date(now.getFullYear(), now.getMonth() + 1, 0); e.setHours(23, 59, 59, 999);
//       return { startDate: s.toISOString(), endDate: e.toISOString() };
//     }
//     case "custom":
//       if (!startDate || !endDate) return null;
//       const s2 = new Date(startDate); s2.setHours(0, 0, 0, 0);
//       const e2 = new Date(endDate); e2.setHours(23, 59, 59, 999);
//       return { startDate: s2.toISOString(), endDate: e2.toISOString() };
//     default:
//       return null;
//   }
// }

// // ── Main Component ────────────────────────────────────────────────────────────

// export default function AccountTransactionsTab({ account, onBack }: AccountTransactionsTabProps) {
//   const cancelMutation = useCancelAccountTransaction();

//   const [searchInput, setSearchInput] = useState("");
//   const [committedSearch, setCommittedSearch] = useState("");
//   const [filters, setFilters] = useState<FilterState>({
//     type: "all", dateRange: "all", startDate: "", endDate: "",
//     currentPage: 1, pageSize: 10,
//   });
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [cancelTarget, setCancelTarget] = useState<AccountTransaction | null>(null);

//   // Summary
//   const { data: summaryData, isLoading: summaryLoading } = useQuery<{ success: boolean; data: AccountTransactionSummary }>({
//     queryKey: ["account-summary", account._id],
//     queryFn: async () => {
//       const res = await fetch(`/api/account-transactions/summary?accountId=${account._id}`);
//       if (!res.ok) throw new Error("Failed");
//       return res.json();
//     },
//     staleTime: 30_000,
//   });
//   const summary = summaryData?.data;

//   // Transactions
//   const { data, isLoading, isFetching } = useQuery<AccountTransactionsPaginatedResponse>({
//     queryKey: ["account-transactions", account._id, committedSearch, filters.type, filters.dateRange, filters.startDate, filters.endDate, filters.currentPage, filters.pageSize],
//     queryFn: async () => {
//       const p = new URLSearchParams();
//       p.set("accountId", account._id);
//       if (committedSearch) p.set("search", committedSearch);
//       if (filters.type !== "all") p.set("type", filters.type);
//       if (filters.dateRange !== "all") {
//         const b = getUTCBoundaries(filters.dateRange, filters.startDate, filters.endDate);
//         if (b) { p.set("startDate", b.startDate); p.set("endDate", b.endDate); }
//       }
//       p.set("page", String(filters.currentPage));
//       p.set("limit", String(filters.pageSize));
//       const res = await fetch(`/api/account-transactions?${p}`);
//       if (!res.ok) throw new Error("Failed");
//       return res.json();
//     },
//     staleTime: 30_000,
//     placeholderData: (prev) => prev,
//   });

//   // const transactions: AccountTransaction[] = data?.data?.transactions ?? [];
//   // const pagination: PaginationMetadata | undefined = data?.pagination;

//   const transactions: AccountTransaction[] = data?.data?.transactions ?? [];
//   const pagination = data?.pagination;

//   // Handlers
//   const handleSearch = useCallback(() => {
//     setCommittedSearch(searchInput.trim());
//     setFilters((p) => ({ ...p, currentPage: 1 }));
//   }, [searchInput]);

//   const handleClearSearch = useCallback(() => {
//     setSearchInput(""); setCommittedSearch("");
//     setFilters((p) => ({ ...p, currentPage: 1 }));
//   }, []);

//   const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
//     setFilters((prev) => {
//       if (key === "dateRange" && value === "custom") {
//         const today = new Date().toISOString().split("T")[0];
//         return { ...prev, dateRange: "custom", startDate: today, endDate: today, currentPage: 1 };
//       }
//       if (key === "dateRange" && value !== "custom") {
//         return { ...prev, [key]: value, startDate: "", endDate: "", currentPage: 1 };
//       }
//       return { ...prev, [key]: value, ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}) };
//     });
//   }, []);

  

//   const handleCancel = useCallback(() => {
//     if (!cancelTarget) return;
//     cancelMutation.mutate(cancelTarget._id, {
//       onSuccess: () => setCancelTarget(null),
//     });
//   }, [cancelTarget, cancelMutation]);

//   const fmt = (n: number) =>
//     `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
//   const fmtDate = (d: string) =>
//     new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
//   const fmtTime = (d: string) =>
//     new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

//   // Pagination
//   const PaginationControls = () => {
//     if (!pagination) return null;

//     const cp = filters.currentPage;
//     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;

//     const pages: number[] = [];
//     if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
//     else if (cp <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
//     else if (cp >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
//     else for (let i = cp - 2; i <= cp + 2; i++) pages.push(i);

//     return (
//       <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
//         <div className="flex items-center gap-2">
//           <span>{startIndex}–{endIndex} of {totalCount}</span>
//           <Select
//             value={String(filters.pageSize)}
//             onValueChange={(v) => updateFilter("pageSize", Number(v) as FilterState["pageSize"])}
//           >
//             <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
//             <SelectContent>
//               {[5, 10, 20, 50].map((n) => (
//                 <SelectItem key={n} value={String(n)}>{n}</SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//           <span>per page</span>
//         </div>
//         <div className="flex items-center gap-1">
//           <Button variant="outline" size="icon" className="h-7 w-7"
//             onClick={() => updateFilter("currentPage", 1)} disabled={!hasPreviousPage}>
//             <ChevronsLeft className="h-3.5 w-3.5" />
//           </Button>
//           <Button variant="outline" size="icon" className="h-7 w-7"
//             onClick={() => updateFilter("currentPage", cp - 1)} disabled={!hasPreviousPage}>
//             <ChevronLeft className="h-3.5 w-3.5" />
//           </Button>
//           {pages.map((p) => (
//             <Button key={p} variant={cp === p ? "default" : "outline"} size="icon"
//               className="h-7 w-7 text-xs" onClick={() => updateFilter("currentPage", p)}>
//               {p}
//             </Button>
//           ))}
//           <Button variant="outline" size="icon" className="h-7 w-7"
//             onClick={() => updateFilter("currentPage", cp + 1)} disabled={!hasNextPage}>
//             <ChevronRight className="h-3.5 w-3.5" />
//           </Button>
//           <Button variant="outline" size="icon" className="h-7 w-7"
//             onClick={() => updateFilter("currentPage", totalPages)} disabled={!hasNextPage}>
//             <ChevronsRight className="h-3.5 w-3.5" />
//           </Button>
//         </div>
//       </div>
//     );
//   };
//   return (
//     <div className="space-y-5">

//       {/* ── Header: account info + Add button ─────────────────────────── */}
//       <div className="flex items-center gap-3">
//         {/* Mobile back button (desktop uses breadcrumb) */}
//         <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 md:hidden">
//           <ArrowLeft className="w-5 h-5" />
//         </Button>
//         <div className="flex-1 min-w-0">
//           <div className="flex items-center gap-2 flex-wrap">
//             <h2 className="text-xl font-bold text-gray-900 truncate">{account.name}</h2>
//             <Badge className={account.isActive
//               ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs"
//               : "bg-gray-100 text-gray-500 text-xs"}>
//               {account.isActive ? "Active" : "Inactive"}
//             </Badge>
//           </div>
//           {account.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{account.description}</p>}
//         </div>
//         <Button
//           onClick={() => setShowAddModal(true)}
//           className="gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700"
//           disabled={!account.isActive}
//           title={!account.isActive ? "Account is inactive" : "Add a new transaction"}
//         >
//           <Plus className="w-4 h-4" />Add Transaction
//         </Button>
//       </div>

//       {/* ── Layout: search left | tiles right ─────────────────────────── */}
//       <div className="flex flex-col lg:flex-row gap-4 items-start">

//         {/* Left — search + type + date filters */}
//         <div className="flex-1 space-y-3 min-w-0">
//           <div className="flex gap-2">
//             <div className="relative flex-1">
//               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
//               <Input placeholder="Search in notes…" value={searchInput}
//                 onChange={(e) => setSearchInput(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && handleSearch()}
//                 className="pl-9 pr-8" />
//               {searchInput && (
//                 <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
//                   <X className="w-3.5 h-3.5" />
//                 </button>
//               )}
//             </div>
//             <Button onClick={handleSearch} size="icon" variant="outline" disabled={isFetching}>
//               {isFetching && !isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
//             </Button>
//           </div>

//           <div className="flex flex-wrap items-center gap-3">
//             {/* Type */}
//             <div className="flex items-center gap-2">
//               <Label className="text-xs text-gray-500 whitespace-nowrap">Type</Label>
//               <Select value={filters.type} onValueChange={(v) => updateFilter("type", v as TransactionTypeFilter)}>
//                 <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All</SelectItem>
//                   <SelectItem value="CREDIT">Credit</SelectItem>
//                   <SelectItem value="DEBIT">Debit</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* Date range */}
//             <div className="flex items-center gap-2">
//               <Label className="text-xs text-gray-500 whitespace-nowrap">Period</Label>
//               <Select value={filters.dateRange} onValueChange={(v) => updateFilter("dateRange", v as DateRangeType)}>
//                 <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="today">Today</SelectItem>
//                   <SelectItem value="week">This Week</SelectItem>
//                   <SelectItem value="month">This Month</SelectItem>
//                   <SelectItem value="custom">Custom Range</SelectItem>
//                   <SelectItem value="all">All Time</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* Custom date pickers */}
//             {filters.dateRange === "custom" && (
//               <>
//                 <div className="flex items-center gap-1.5">
//                   <Label className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" />From</Label>
//                   <Input type="date" value={filters.startDate} onChange={(e) => updateFilter("startDate", e.target.value)}
//                     max={filters.endDate || undefined} className="w-32 h-8 text-xs" />
//                 </div>
//                 <div className="flex items-center gap-1.5">
//                   <Label className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" />To</Label>
//                   <Input type="date" value={filters.endDate} onChange={(e) => updateFilter("endDate", e.target.value)}
//                     min={filters.startDate || undefined} className="w-32 h-8 text-xs" />
//                 </div>
//               </>
//             )}
//           </div>
//         </div>

//         {/* Right — stat tiles */}
//         <div className="flex flex-wrap gap-2 shrink-0">
//           <StatTile label="Balance" value={summary ? fmt(summary.currentBalance) : "-"} icon={Wallet}
//             colorClass={summary?.currentBalance && summary?.currentBalance >= 0 ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-red-50 text-red-700 border-red-100"} loading={summaryLoading} />
//           <StatTile label="Credit" value={summary ? fmt(summary.totalCredit) : "—"} icon={TrendingUp}
//             colorClass="bg-green-50 text-green-700 border-green-100" loading={summaryLoading} />
//           <StatTile label="Debit" value={summary ? fmt(summary.totalDebit) : "—"} icon={TrendingDown}
//             colorClass="bg-red-50 text-red-700 border-red-100" loading={summaryLoading} />
//           <StatTile label="Net" value={summary ? fmt(summary.netFlow) : "—"} icon={Receipt}
//             colorClass={!summary || summary.netFlow >= 0 ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-orange-50 text-orange-700 border-orange-100"}
//             loading={summaryLoading} />
//         </div>
//       </div>

//       {/* ── Transaction table ──────────────────────────────────────────── */}
//       <Card className="border-0 shadow-sm overflow-hidden">
//         <CardHeader className="px-4 py-3 border-b bg-white">
//           <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
//             Transaction History
//             {pagination && <span className="text-xs font-normal text-gray-400">({pagination.totalCount} entries)</span>}
//             {isFetching && !isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />}
//           </CardTitle>
//         </CardHeader>
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead className="bg-gray-50 border-b">
//               <tr>
//                 <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
//                 <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
//                 <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
//                 <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance After</th>
//                 <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
//                 <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
//               </tr>
//             </thead>

//             {isLoading ? (
//               <TableSkeleton rows={filters.pageSize} />
//             ) : (
//               <tbody className="bg-white divide-y divide-gray-100">
//                 {transactions.length === 0 ? (
//                   <tr>
//                     <td colSpan={6} className="px-4 py-16 text-center">
//                       <div className="flex flex-col items-center gap-3 text-gray-400">
//                         <Receipt className="w-10 h-10 opacity-25" />
//                         <p className="text-sm font-medium">No transactions found</p>
//                         {committedSearch
//                           ? <button onClick={handleClearSearch} className="text-xs text-blue-500 hover:underline">Clear search</button>
//                           : account.isActive && (
//                             <button onClick={() => setShowAddModal(true)} className="text-xs text-blue-500 hover:underline">
//                               Add the first transaction
//                             </button>
//                           )}
//                       </div>
//                     </td>
//                   </tr>
//                 ) : (
//                   transactions.map((txn) => (
//                     <tr key={txn._id} className="hover:bg-gray-50/60 transition-colors">

//                       {/* Date */}
//                       <td className="px-4 py-3 whitespace-nowrap">
//                         <p className="font-medium text-gray-900">{fmtDate(txn.enteredAt)}</p>
//                         <p className="text-xs text-gray-400">{fmtTime(txn.enteredAt)}</p>
//                       </td>

//                       {/* Type */}
//                       <td className="px-4 py-3 text-center whitespace-nowrap">
//                         <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${txn.type === "CREDIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
//                           }`}>
//                           {txn.type === "CREDIT" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
//                           {txn.type}
//                         </span>
//                       </td>

//                       {/* Amount */}
//                       <td className="px-4 py-3 text-right whitespace-nowrap">
//                         <span className={`font-bold tabular-nums ${txn.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
//                           {txn.type === "CREDIT" ? "+" : "−"}{fmt(txn.amount)}
//                         </span>
//                       </td>

//                       {/* Balance After */}
//                       <td className="px-4 py-3 text-right whitespace-nowrap">
//                         <span className={`font-semibold tabular-nums ${txn.balanceAfter < 0 ? "text-red-500" : "text-gray-600"}`}>
//                           {fmt(txn.balanceAfter)}
//                         </span>
//                       </td>

//                       {/* Note */}
//                       <td className="px-4 py-3 max-w-[220px]">
//                         {txn.note
//                           ? <p className="text-gray-700 truncate">{txn.note}</p>
//                           : <p className="text-gray-300 italic text-xs">No note</p>}


//                         {txn.billUrl && (
//                           <a
//                             href={txn.billUrl}
//                             target="_blank"
//                             rel="noopener noreferrer"
//                             className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5"
//                           >
//                             <Download className="w-3 h-3" />
//                             Download Bill
//                           </a>
//                         )}
//                       </td>

//                       {/* Cancel action */}
//                       <td className="px-4 py-3 text-center whitespace-nowrap">
//                         <Button
//                           variant="ghost" size="icon"
//                           className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
//                           onClick={() => setCancelTarget(txn)}
//                           title="Cancel Transaction"
//                         >
//                           <Ban className="w-3.5 h-3.5" />
//                         </Button>
//                       </td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             )}
//           </table>
//         </div>
//         <PaginationControls />

//       </Card>

//       {/* Add Transaction Modal */}
//       <AddTransactionModal open={showAddModal} onOpenChange={setShowAddModal} account={account} />

//       {/* Cancel Confirmation */}
//       <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle className="flex items-center gap-2">
//               <AlertCircle className="w-5 h-5 text-red-500" />
//               Cancel Transaction
//             </AlertDialogTitle>
//             <AlertDialogDescription>
//               Cancel this{" "}
//               <span className="font-semibold text-gray-900">
//                 {cancelTarget?.type === "CREDIT" ? "credit" : "debit"} of {cancelTarget ? fmt(cancelTarget.amount) : ""}
//               </span>{" "}
//               from <span className="font-semibold text-gray-900">{fmtDate(cancelTarget?.enteredAt ?? "")}</span>?
//               <br />
//               <span className="text-xs mt-1 inline-block text-gray-400">
//                 The transaction will be soft-deleted and the account balance will be recalculated automatically.
//               </span>
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Keep It</AlertDialogCancel>
//             <AlertDialogAction
//               onClick={handleCancel}
//               disabled={cancelMutation.isPending}
//               className="bg-red-500 hover:bg-red-600"
//             >
//               {cancelMutation.isPending
//                 ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</>
//                 : "Cancel Transaction"}
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </div>
//   );
// }