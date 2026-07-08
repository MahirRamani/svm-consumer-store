"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, Wallet, Calendar, ExternalLink, X, AlertCircle,
  Receipt, TrendingUp, TrendingDown, Ban, ArrowLeft,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import AddTransactionModal from "@/components/modals/add-transaction-modal";
import { useCancelAccountTransaction } from "@/hooks/use-account-transaction-mutations";
import type { Account } from "@/types/admin/account";
import type {
  AccountTransaction,
  AccountTransactionsPaginatedResponse,
  AccountTransactionSummary,
  PaginationMetadata,
} from "@/types/admin/accountTransaction";

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

// ── Skeleton ──────────────────────────────────────────────────────────────────

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

// ── Stat Tile ─────────────────────────────────────────────────────────────────

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

// ── UTC helper ────────────────────────────────────────────────────────────────

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
    case "custom":
      if (!startDate || !endDate) return null;
      const s2 = new Date(startDate); s2.setHours(0, 0, 0, 0);
      const e2 = new Date(endDate); e2.setHours(23, 59, 59, 999);
      return { startDate: s2.toISOString(), endDate: e2.toISOString() };
    default:
      return null;
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AccountTransactionsTab({ account, onBack }: AccountTransactionsTabProps) {
  const { data: session } = useSession(); 

  const cancelMutation = useCancelAccountTransaction();

  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    type: "all", dateRange: "all", startDate: "", endDate: "",
    currentPage: 1, pageSize: 10,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AccountTransaction | null>(null);

  // Summary
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

  // Transactions
  const { data, isLoading, isFetching } = useQuery<AccountTransactionsPaginatedResponse>({
    queryKey: ["account-transactions", account._id, committedSearch, filters.type, filters.dateRange, filters.startDate, filters.endDate, filters.currentPage, filters.pageSize],
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

  // const transactions: AccountTransaction[] = data?.data?.transactions ?? [];
  // const pagination: PaginationMetadata | undefined = data?.pagination;

  const transactions: AccountTransaction[] = data?.data?.transactions ?? [];
const pagination = data?.pagination;

// DEBUG - remove after
console.log("RAW data:", JSON.stringify(data, null, 2));

  // Handlers
  const handleSearch = useCallback(() => {
    setCommittedSearch(searchInput.trim());
    setFilters((p) => ({ ...p, currentPage: 1 }));
  }, [searchInput]);

  const handleClearSearch = useCallback(() => {
    setSearchInput(""); setCommittedSearch("");
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

  const handleCancel = useCallback(() => {
    if (!cancelTarget) return;
    cancelMutation.mutate(cancelTarget._id, {
      onSuccess: () => setCancelTarget(null),
    });
  }, [cancelTarget, cancelMutation]);

  const fmt = (n: number) =>
    `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // Pagination
  const PaginationControls = () => {
    if (!pagination) return null;

    const cp = filters.currentPage;
    const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;

    const pages: number[] = [];
    if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
    else if (cp <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
    else if (cp >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    else for (let i = cp - 2; i <= cp + 2; i++) pages.push(i);

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span>{startIndex}–{endIndex} of {totalCount}</span>
          <Select
            value={String(filters.pageSize)}
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
            onClick={() => updateFilter("currentPage", cp - 1)} disabled={!hasPreviousPage}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          {pages.map((p) => (
            <Button key={p} variant={cp === p ? "default" : "outline"} size="icon"
              className="h-7 w-7 text-xs" onClick={() => updateFilter("currentPage", p)}>
              {p}
            </Button>
          ))}
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => updateFilter("currentPage", cp + 1)} disabled={!hasNextPage}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => updateFilter("currentPage", totalPages)} disabled={!hasNextPage}>
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-5">

      {/* ── Header: account info + Add button ─────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Mobile back button (desktop uses breadcrumb) */}
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
          {account.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{account.description}</p>}
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="gap-1.5 shrink-0 bg-blue-600 hover:bg-blue-700"
          disabled={!account.isActive}
          title={!account.isActive ? "Account is inactive" : "Add a new transaction"}
        >
          <Plus className="w-4 h-4" />Add Transaction
        </Button>
      </div>

      {/* ── Layout: search left | tiles right ─────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* Left — search + type + date filters */}
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search in notes…" value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 pr-8" />
              {searchInput && (
                <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button onClick={handleSearch} size="icon" variant="outline" disabled={isFetching}>
              {isFetching && !isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Type */}
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

            {/* Date range */}
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

            {/* Custom date pickers */}
            {filters.dateRange === "custom" && (
              <>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" />From</Label>
                  <Input type="date" value={filters.startDate} onChange={(e) => updateFilter("startDate", e.target.value)}
                    max={filters.endDate || undefined} className="w-32 h-8 text-xs" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" />To</Label>
                  <Input type="date" value={filters.endDate} onChange={(e) => updateFilter("endDate", e.target.value)}
                    min={filters.startDate || undefined} className="w-32 h-8 text-xs" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right — stat tiles */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <StatTile label="Balance" value={summary ? fmt(summary.currentBalance) : "-"} icon={Wallet}
            colorClass={summary?.currentBalance && summary?.currentBalance >= 0 ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-red-50 text-red-700 border-red-100"} loading={summaryLoading}/>
          <StatTile label="Credit" value={summary ? fmt(summary.totalCredit) : "—"} icon={TrendingUp}
            colorClass="bg-green-50 text-green-700 border-green-100" loading={summaryLoading} />
          <StatTile label="Debit" value={summary ? fmt(summary.totalDebit) : "—"} icon={TrendingDown}
            colorClass="bg-red-50 text-red-700 border-red-100" loading={summaryLoading} />
          <StatTile label="Net" value={summary ? fmt(summary.netFlow) : "—"} icon={Receipt}
            colorClass={!summary || summary.netFlow >= 0 ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-orange-50 text-orange-700 border-orange-100"}
            loading={summaryLoading} />
        </div>
      </div>

      {/* ── Transaction table ──────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="px-4 py-3 border-b bg-white">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-700">
            Transaction History
            {pagination && <span className="text-xs font-normal text-gray-400">({pagination.totalCount} entries)</span>}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
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

                      {/* Type */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          txn.type === "CREDIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {txn.type === "CREDIT" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {txn.type}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-bold tabular-nums ${txn.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                          {txn.type === "CREDIT" ? "+" : "−"}{fmt(txn.amount)}
                        </span>
                      </td>

                      {/* Balance After */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-semibold tabular-nums ${txn.balanceAfter < 0 ? "text-red-500" : "text-gray-600"}`}>
                          {fmt(txn.balanceAfter)}
                        </span>
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3 max-w-[220px]">
                        {txn.note
                          ? <p className="text-gray-700 truncate">{txn.note}</p>
                          : <p className="text-gray-300 italic text-xs">No note</p>}
                        {txn.billUrl && (
                          <a href={txn.billUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5">
                            <ExternalLink className="w-3 h-3" />View Bill
                          </a>
                        )}
                      </td>

                      {/* Cancel action */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setCancelTarget(txn)}
                          title="Cancel Transaction"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            )}
          </table>
        </div>
        <PaginationControls />
      
      </Card>

      {/* Add Transaction Modal */}
      <AddTransactionModal open={showAddModal} onOpenChange={setShowAddModal} account={account} />

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Cancel Transaction
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cancel this{" "}
              <span className="font-semibold text-gray-900">
                {cancelTarget?.type === "CREDIT" ? "credit" : "debit"} of {cancelTarget ? fmt(cancelTarget.amount) : ""}
              </span>{" "}
              from <span className="font-semibold text-gray-900">{fmtDate(cancelTarget?.enteredAt ?? "")}</span>?
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
      </AlertDialog>
    </div>
  );
}


// "use client";

// import { useState, useCallback } from "react";
// import { useQuery } from "@tanstack/react-query";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   ArrowLeft, Search, Plus, ChevronLeft, ChevronRight,
//   ChevronsLeft, ChevronsRight, Loader2, Trash2,
//   TrendingUp, TrendingDown, Wallet, Calendar,
//   ExternalLink, X, AlertCircle, Receipt, MoreVertical,
// } from "lucide-react";
// import {
//   DropdownMenu, DropdownMenuContent, DropdownMenuItem,
//   DropdownMenuSeparator, DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// import {
//   AlertDialog, AlertDialogAction, AlertDialogCancel,
//   AlertDialogContent, AlertDialogDescription,
//   AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
// } from "@/components/ui/alert-dialog";
// import { toast } from "sonner";
// import AddTransactionModal from "@/components/modals/add-transaction-modal";
// import { useDeleteAccountTransaction } from "@/hooks/use-account-transaction-mutations";
// import type { Account } from "@/types/account";
// import type {
//   AccountTransaction,
//   AccountTransactionsPaginatedResponse,
//   AccountTransactionSummary,
//   PaginationMetadata,
// } from "@/types/accountTransaction";

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

// // ── Skeleton ──────────────────────────────────────────────────────────────

// const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
//   <tbody className="bg-white divide-y divide-gray-100">
//     {Array.from({ length: rows }).map((_, i) => (
//       <tr key={i} className="animate-pulse">
//         <td className="px-6 py-4"><div className="space-y-1.5"><div className="h-4 bg-gray-100 rounded w-24" /><div className="h-3 bg-gray-100 rounded w-16" /></div></td>
//         <td className="px-6 py-4 text-center"><div className="h-6 bg-gray-100 rounded-full w-16 mx-auto" /></td>
//         <td className="px-6 py-4 text-right"><div className="h-5 bg-gray-100 rounded w-20 ml-auto" /></td>
//         <td className="px-6 py-4 text-right"><div className="h-5 bg-gray-100 rounded w-24 ml-auto" /></td>
//         <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-48" /></td>
//         <td className="px-6 py-4 text-center"><div className="h-8 w-8 bg-gray-100 rounded mx-auto" /></td>
//       </tr>
//     ))}
//   </tbody>
// );

// // ── Summary Card ──────────────────────────────────────────────────────────

// const SummaryCard = ({ label, value, icon: Icon, colorClass, sub, loading }: {
//   label: string; value: string; icon: React.ElementType;
//   colorClass: string; sub?: string; loading?: boolean;
// }) => (
//   <Card className="border-0 shadow-sm">
//     <CardContent className="p-5">
//       <div className="flex items-start justify-between">
//         <div className="flex-1 min-w-0">
//           <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
//           {loading
//             ? <div className="mt-2 h-6 bg-gray-100 rounded w-24 animate-pulse" />
//             : <p className="mt-1.5 text-xl font-bold text-gray-900 tabular-nums">{value}</p>}
//           {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
//         </div>
//         <div className={`p-2.5 rounded-xl flex-shrink-0 ml-3 ${colorClass}`}>
//           <Icon className="w-5 h-5" />
//         </div>
//       </div>
//     </CardContent>
//   </Card>
// );

// // ── UTC helpers ───────────────────────────────────────────────────────────

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
//       const s = new Date(startDate); s.setHours(0, 0, 0, 0);
//       const e = new Date(endDate); e.setHours(23, 59, 59, 999);
//       return { startDate: s.toISOString(), endDate: e.toISOString() };
//     default:
//       return null;
//   }
// }

// // ── Main Component ────────────────────────────────────────────────────────

// export default function AccountTransactionsTab({ account, onBack }: AccountTransactionsTabProps) {
//   const deleteMutation = useDeleteAccountTransaction();

//   const [searchInput, setSearchInput] = useState("");
//   const [committedSearch, setCommittedSearch] = useState("");
//   const [filters, setFilters] = useState<FilterState>({
//     type: "all", dateRange: "all", startDate: "", endDate: "",
//     currentPage: 1, pageSize: 10,
//   });
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [deleteTarget, setDeleteTarget] = useState<AccountTransaction | null>(null);

//   // Summary
//   const { data: summaryData, isLoading: summaryLoading } = useQuery<{ success: boolean; data: AccountTransactionSummary }>({
//     queryKey: ["account-summary", account._id],
//     queryFn: async () => {
//       const res = await fetch(`/api/account-transactions/summary?accountId=${account._id}`);
//       if (!res.ok) throw new Error("Failed to fetch summary");
//       return res.json();
//     },
//     staleTime: 30_000,
//   });
//   const summary = summaryData?.data;

//   // Transactions
//   const { data, isLoading, isFetching } = useQuery<AccountTransactionsPaginatedResponse>({
//     queryKey: ["account-transactions", account._id, committedSearch, filters.type, filters.dateRange, filters.startDate, filters.endDate, filters.currentPage, filters.pageSize],
//     queryFn: async () => {
//       const params = new URLSearchParams();
//       params.set("accountId", account._id);
//       if (committedSearch) params.set("search", committedSearch);
//       if (filters.type !== "all") params.set("type", filters.type);
//       if (filters.dateRange !== "all") {
//         const b = getUTCBoundaries(filters.dateRange, filters.startDate, filters.endDate);
//         if (b) { params.set("startDate", b.startDate); params.set("endDate", b.endDate); }
//       }
//       params.set("page", String(filters.currentPage));
//       params.set("limit", String(filters.pageSize));
//       const res = await fetch(`/api/account-transactions?${params}`);
//       if (!res.ok) throw new Error("Failed to fetch transactions");
//       return res.json();
//     },
//     staleTime: 30_000,
//     placeholderData: (prev) => prev,
//   });

//   const transactions: AccountTransaction[] = data?.data?.transactions ?? [];
//   const pagination: PaginationMetadata | undefined = data?.pagination;

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

//   const handleDelete = useCallback(() => {
//     if (!deleteTarget) return;
//     deleteMutation.mutate(deleteTarget._id, {
//       onSuccess: () => setDeleteTarget(null),
//       onError: () => toast.error("Failed to delete transaction"),
//     });
//   }, [deleteTarget, deleteMutation]);

//   const fmt = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
//   const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
//   const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

//   const PaginationControls = () => {
//     if (!pagination) return null;
//     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
//     const cp = filters.currentPage;
//     const pages: number[] = [];
//     if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
//     else if (cp <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
//     else if (cp >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
//     else for (let i = cp - 2; i <= cp + 2; i++) pages.push(i);

//     return (
//       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
//         <div className="flex items-center gap-2 text-sm text-gray-600">
//           <span>{startIndex}–{endIndex} of {totalCount}</span>
//           <Select value={String(filters.pageSize)} onValueChange={(v) => updateFilter("pageSize", Number(v) as FilterState["pageSize"])}>
//             <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
//             <SelectContent>{[5, 10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
//           </Select>
//           <span>per page</span>
//         </div>
//         <div className="flex items-center gap-1">
//           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", 1)} disabled={!hasPreviousPage}><ChevronsLeft className="h-4 w-4" /></Button>
//           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", cp - 1)} disabled={!hasPreviousPage}><ChevronLeft className="h-4 w-4" /></Button>
//           {pages.map((p) => <Button key={p} variant={cp === p ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", p)}>{p}</Button>)}
//           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", cp + 1)} disabled={!hasNextPage}><ChevronRight className="h-4 w-4" /></Button>
//           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", totalPages)} disabled={!hasNextPage}><ChevronsRight className="h-4 w-4" /></Button>
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex items-start gap-3">
//         {/* Back button visible on mobile only — breadcrumb handles it on desktop */}
//         <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0 md:hidden">
//           <ArrowLeft className="w-5 h-5" />
//         </Button>
//         <div className="flex-1 min-w-0">
//           <div className="flex items-center gap-2 flex-wrap">
//             <h2 className="text-2xl font-bold text-gray-900 truncate">{account.name}</h2>
//             <Badge className={account.isActive ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : "bg-gray-100 text-gray-500"}>
//               {account.isActive ? "Active" : "Inactive"}
//             </Badge>
//           </div>
//           {account.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{account.description}</p>}
//         </div>
//         {/* ✅ Add Transaction button */}
//         <Button
//           onClick={() => setShowAddModal(true)}
//           className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700"
//           disabled={!account.isActive}
//           title={!account.isActive ? "Cannot add transactions to inactive account" : "Add a new transaction"}
//         >
//           <Plus className="w-4 h-4" />
//           Add Transaction
//         </Button>
//       </div>

//       {/* Summary */}
//       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
//         <SummaryCard label="Current Balance" value={fmt(account.currentBalance)} icon={Wallet}
//           colorClass={account.currentBalance >= 0 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}
//           sub={account.currentBalance < 0 ? "Negative balance" : "Live balance"} />
//         <SummaryCard label="Total Credit" value={summary ? fmt(summary.totalCredit) : "—"} icon={TrendingUp}
//           colorClass="bg-green-50 text-green-600" sub={summary ? `${summary.totalEntries} total entries` : undefined} loading={summaryLoading} />
//         <SummaryCard label="Total Debit" value={summary ? fmt(summary.totalDebit) : "—"} icon={TrendingDown}
//           colorClass="bg-red-50 text-red-600" loading={summaryLoading} />
//         <SummaryCard label="Net Flow" value={summary ? fmt(summary.netFlow) : "—"} icon={Receipt}
//           colorClass={!summary || summary.netFlow >= 0 ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"}
//           sub={summary ? (summary.netFlow >= 0 ? "Net positive" : "Net negative") : undefined} loading={summaryLoading} />
//       </div>

//       {/* Filters */}
//       <Card className="border-0 shadow-sm">
//         <CardContent className="p-5">
//           <div className="flex flex-wrap items-end gap-4">
//             <div className="flex-1 min-w-[180px]">
//               <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Search Note</Label>
//               <div className="flex gap-2">
//                 <div className="relative flex-1">
//                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
//                   <Input placeholder="Search in notes..." value={searchInput}
//                     onChange={(e) => setSearchInput(e.target.value)}
//                     onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pl-9 pr-8" />
//                   {searchInput && (
//                     <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
//                       <X className="w-3.5 h-3.5" />
//                     </button>
//                   )}
//                 </div>
//                 <Button onClick={handleSearch} size="icon" disabled={isFetching}>
//                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
//                 </Button>
//               </div>
//             </div>
//             <div className="w-36">
//               <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Type</Label>
//               <Select value={filters.type} onValueChange={(v) => updateFilter("type", v as TransactionTypeFilter)}>
//                 <SelectTrigger><SelectValue /></SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All Types</SelectItem>
//                   <SelectItem value="CREDIT">Credit only</SelectItem>
//                   <SelectItem value="DEBIT">Debit only</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
//             <div className="w-40">
//               <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Date Range</Label>
//               <Select value={filters.dateRange} onValueChange={(v) => updateFilter("dateRange", v as DateRangeType)}>
//                 <SelectTrigger><SelectValue /></SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="today">Today</SelectItem>
//                   <SelectItem value="week">This Week</SelectItem>
//                   <SelectItem value="month">This Month</SelectItem>
//                   <SelectItem value="custom">Custom Range</SelectItem>
//                   <SelectItem value="all">All Time</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
//             {filters.dateRange === "custom" && (
//               <>
//                 <div>
//                   <Label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> From</Label>
//                   <Input type="date" value={filters.startDate} onChange={(e) => updateFilter("startDate", e.target.value)} max={filters.endDate || undefined} className="w-36" />
//                 </div>
//                 <div>
//                   <Label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> To</Label>
//                   <Input type="date" value={filters.endDate} onChange={(e) => updateFilter("endDate", e.target.value)} min={filters.startDate || undefined} className="w-36" />
//                 </div>
//               </>
//             )}
//           </div>
//         </CardContent>
//       </Card>

//       {/* Table */}
//       <Card className="border-0 shadow-sm overflow-hidden">
//         <CardHeader className="px-6 py-4 border-b bg-white">
//           <CardTitle className="text-base font-semibold flex items-center gap-2">
//             Transaction History
//             {pagination && <span className="text-sm font-normal text-gray-400">({pagination.totalCount} entries)</span>}
//             {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="p-0">
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-gray-50 border-b">
//                 <tr>
//                   {["Date", "Type", "Amount", "Balance After", "Note", "Actions"].map((h, i) => (
//                     <th key={h} className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
//                       i === 0 ? "text-left" : i === 2 || i === 3 ? "text-right" : i === 5 || i === 1 ? "text-center" : "text-left"
//                     }`}>{h}</th>
//                   ))}
//                 </tr>
//               </thead>
//               {isLoading ? (
//                 <TableSkeleton rows={filters.pageSize} />
//               ) : (
//                 <tbody className="bg-white divide-y divide-gray-100">
//                   {transactions.length === 0 ? (
//                     <tr>
//                       <td colSpan={6} className="px-6 py-16 text-center">
//                         <div className="flex flex-col items-center gap-3 text-gray-400">
//                           <Receipt className="w-10 h-10 opacity-30" />
//                           <p className="text-sm font-medium">No transactions found</p>
//                           <p className="text-xs">
//                             {committedSearch
//                               ? <button onClick={handleClearSearch} className="text-blue-500 hover:underline">Clear search</button>
//                               : account.isActive && <button onClick={() => setShowAddModal(true)} className="text-blue-500 hover:underline">Add the first transaction</button>
//                             }
//                           </p>
//                         </div>
//                       </td>
//                     </tr>
//                   ) : (
//                     transactions.map((txn) => (
//                       <tr key={txn._id} className="hover:bg-gray-50 transition-colors">
//                         <td className="px-6 py-4 whitespace-nowrap">
//                           <p className="text-sm font-medium text-gray-900">{fmtDate(txn.enteredAt)}</p>
//                           <p className="text-xs text-gray-400">{fmtTime(txn.enteredAt)}</p>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-center">
//                           <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
//                             txn.type === "CREDIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
//                           }`}>
//                             {txn.type === "CREDIT" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
//                             {txn.type}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-right">
//                           <span className={`text-sm font-bold tabular-nums ${txn.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
//                             {txn.type === "CREDIT" ? "+" : "−"}{fmt(txn.amount)}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-right">
//                           <span className={`text-sm font-semibold tabular-nums ${txn.balanceAfter < 0 ? "text-red-500" : "text-gray-700"}`}>
//                             {fmt(txn.balanceAfter)}
//                           </span>
//                         </td>
//                         <td className="px-6 py-4 max-w-[240px]">
//                           {txn.note
//                             ? <p className="text-sm text-gray-700 truncate">{txn.note}</p>
//                             : <p className="text-sm text-gray-300 italic">No note</p>}
//                           {txn.billUrl && (
//                             <a href={txn.billUrl} target="_blank" rel="noopener noreferrer"
//                               className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5">
//                               <ExternalLink className="w-3 h-3" /> View Bill
//                             </a>
//                           )}
//                         </td>
//                         <td className="px-6 py-4 whitespace-nowrap text-center">
//                           <DropdownMenu>
//                             <DropdownMenuTrigger asChild>
//                               <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700">
//                                 <MoreVertical className="w-4 h-4" />
//                               </Button>
//                             </DropdownMenuTrigger>
//                             <DropdownMenuContent align="end">
//                               <DropdownMenuSeparator />
//                               <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(txn)}>
//                                 <Trash2 className="w-4 h-4 mr-2" /> Delete
//                               </DropdownMenuItem>
//                             </DropdownMenuContent>
//                           </DropdownMenu>
//                         </td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               )}
//             </table>
//           </div>
//           <PaginationControls />
//         </CardContent>
//       </Card>

//       {/* ✅ Add Transaction Modal */}
//       <AddTransactionModal open={showAddModal} onOpenChange={setShowAddModal} account={account} />

//       {/* Delete Confirmation */}
//       <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle className="flex items-center gap-2">
//               <AlertCircle className="w-5 h-5 text-red-500" />
//               Delete Transaction
//             </AlertDialogTitle>
//             <AlertDialogDescription>
//               Delete this{" "}
//               <span className="font-semibold text-gray-900">
//                 {deleteTarget?.type === "CREDIT" ? "credit" : "debit"} of {deleteTarget ? fmt(deleteTarget.amount) : ""}
//               </span>? The account balance will be recalculated automatically. This cannot be undone.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-red-500 hover:bg-red-600">
//               {deleteMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : "Delete"}
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </div>
//   );
// }// "use client";

// // /**
// //  * account-transactions-standalone-tab.tsx
// //  *
// //  * A fully self-contained Transactions tab that includes its own account selector.
// //  * Register this independently in TABS_REGISTRY as 'transactions' (or 'account-transactions').
// //  * No props needed — account selection is handled internally.
// //  */

// // import { useState, useCallback } from "react";
// // import { useQuery } from "@tanstack/react-query";
// // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // import { Input } from "@/components/ui/input";
// // import { Button } from "@/components/ui/button";
// // import { Badge } from "@/components/ui/badge";
// // import { Label } from "@/components/ui/label";
// // import {
// //   Select,
// //   SelectContent,
// //   SelectItem,
// //   SelectTrigger,
// //   SelectValue,
// // } from "@/components/ui/select";
// // import {
// //   Search, Plus, ChevronLeft, ChevronRight,
// //   ChevronsLeft, ChevronsRight, Loader2, Trash2,
// //   TrendingUp, TrendingDown, Wallet, Calendar,
// //   ExternalLink, X, AlertCircle, Receipt,
// //   MoreVertical, ChevronDown, RefreshCw,
// // } from "lucide-react";
// // import {
// //   DropdownMenu, DropdownMenuContent, DropdownMenuItem,
// //   DropdownMenuSeparator, DropdownMenuTrigger,
// // } from "@/components/ui/dropdown-menu";
// // import {
// //   AlertDialog, AlertDialogAction, AlertDialogCancel,
// //   AlertDialogContent, AlertDialogDescription,
// //   AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
// // } from "@/components/ui/alert-dialog";
// // import {
// //   Popover, PopoverContent, PopoverTrigger,
// // } from "@/components/ui/popover";
// // import { toast } from "sonner";
// // import AddTransactionModal from "@/components/modals/add-transaction-modal";
// // import { useDeleteAccountTransaction } from "@/hooks/use-account-transaction-mutations";
// // import type { Account, AccountsPaginatedResponse } from "@/types/account";
// // import type {
// //   AccountTransaction,
// //   AccountTransactionsPaginatedResponse,
// //   AccountTransactionSummary,
// //   PaginationMetadata,
// // } from "@/types/accountTransaction";

// // type DateRangeType = "today" | "week" | "month" | "custom" | "all";
// // type TransactionTypeFilter = "all" | "CREDIT" | "DEBIT";

// // interface FilterState {
// //   type: TransactionTypeFilter;
// //   dateRange: DateRangeType;
// //   startDate: string;
// //   endDate: string;
// //   currentPage: number;
// //   pageSize: number;
// // }

// // // ── Skeleton ──────────────────────────────────────────────────────────────

// // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// //   <tbody className="bg-white divide-y divide-gray-100">
// //     {Array.from({ length: rows }).map((_, i) => (
// //       <tr key={i} className="animate-pulse">
// //         <td className="px-6 py-4"><div className="space-y-1.5"><div className="h-4 bg-gray-100 rounded w-24" /><div className="h-3 bg-gray-100 rounded w-16" /></div></td>
// //         <td className="px-6 py-4 text-center"><div className="h-6 bg-gray-100 rounded-full w-16 mx-auto" /></td>
// //         <td className="px-6 py-4 text-right"><div className="h-5 bg-gray-100 rounded w-20 ml-auto" /></td>
// //         <td className="px-6 py-4 text-right"><div className="h-5 bg-gray-100 rounded w-24 ml-auto" /></td>
// //         <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-48" /></td>
// //         <td className="px-6 py-4 text-center"><div className="h-8 w-8 bg-gray-100 rounded mx-auto" /></td>
// //       </tr>
// //     ))}
// //   </tbody>
// // );

// // // ── Stat Pill ─────────────────────────────────────────────────────────────

// // const StatPill = ({ label, value, colorClass, loading }: {
// //   label: string; value: string; colorClass: string; loading?: boolean;
// // }) => (
// //   <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${colorClass}`}>
// //     <div>
// //       <p className="text-xs font-medium opacity-70">{label}</p>
// //       {loading
// //         ? <div className="h-5 bg-current opacity-10 rounded w-16 animate-pulse mt-0.5" />
// //         : <p className="text-sm font-bold tabular-nums">{value}</p>}
// //     </div>
// //   </div>
// // );

// // // ── UTC helpers ───────────────────────────────────────────────────────────

// // function getUTCBoundaries(dateRange: string, startDate: string, endDate: string) {
// //   const now = new Date();
// //   switch (dateRange) {
// //     case "today": {
// //       const s = new Date(now); s.setHours(0, 0, 0, 0);
// //       const e = new Date(now); e.setHours(23, 59, 59, 999);
// //       return { startDate: s.toISOString(), endDate: e.toISOString() };
// //     }
// //     case "week": {
// //       const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
// //       const e = new Date(now); e.setHours(23, 59, 59, 999);
// //       return { startDate: s.toISOString(), endDate: e.toISOString() };
// //     }
// //     case "month": {
// //       const s = new Date(now.getFullYear(), now.getMonth(), 1); s.setHours(0, 0, 0, 0);
// //       const e = new Date(now.getFullYear(), now.getMonth() + 1, 0); e.setHours(23, 59, 59, 999);
// //       return { startDate: s.toISOString(), endDate: e.toISOString() };
// //     }
// //     case "custom":
// //       if (!startDate || !endDate) return null;
// //       const s = new Date(startDate); s.setHours(0, 0, 0, 0);
// //       const e = new Date(endDate); e.setHours(23, 59, 59, 999);
// //       return { startDate: s.toISOString(), endDate: e.toISOString() };
// //     default:
// //       return null;
// //   }
// // }

// // // ── Account Selector ──────────────────────────────────────────────────────

// // function AccountSelector({
// //   selectedAccount,
// //   onSelect,
// // }: {
// //   selectedAccount: Account | null;
// //   onSelect: (a: Account) => void;
// // }) {
// //   const [open, setOpen] = useState(false);
// //   const [search, setSearch] = useState("");

// //   const { data, isLoading } = useQuery<AccountsPaginatedResponse>({
// //     queryKey: ["accounts-for-selector", search],
// //     queryFn: async () => {
// //       const params = new URLSearchParams({ limit: "50", sortBy: "name", sortOrder: "asc" });
// //       if (search) params.set("search", search);
// //       const res = await fetch(`/api/accounts?${params}`);
// //       if (!res.ok) throw new Error("Failed");
// //       return res.json();
// //     },
// //     staleTime: 60_000,
// //   });

// //   const accounts = data?.data?.accounts ?? [];

// //   return (
// //     <Popover open={open} onOpenChange={setOpen}>
// //       <PopoverTrigger asChild>
// //         <Button
// //           variant="outline"
// //           className="min-w-[220px] justify-between gap-2 h-10 font-normal"
// //           role="combobox"
// //         >
// //           {selectedAccount ? (
// //             <span className="flex items-center gap-2 min-w-0">
// //               <span className="h-5 w-5 rounded bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
// //                 {selectedAccount.name.charAt(0).toUpperCase()}
// //               </span>
// //               <span className="truncate">{selectedAccount.name}</span>
// //             </span>
// //           ) : (
// //             <span className="text-gray-400">Select account…</span>
// //           )}
// //           <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
// //         </Button>
// //       </PopoverTrigger>
// //       <PopoverContent className="w-72 p-0" align="start">
// //         {/* Search inside popover */}
// //         <div className="p-2 border-b">
// //           <div className="relative">
// //             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
// //             <Input
// //               placeholder="Search accounts..."
// //               value={search}
// //               onChange={(e) => setSearch(e.target.value)}
// //               className="pl-8 h-8 text-sm"
// //               autoFocus
// //             />
// //           </div>
// //         </div>
// //         <div className="max-h-64 overflow-y-auto py-1">
// //           {isLoading ? (
// //             <div className="flex items-center justify-center py-6">
// //               <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
// //             </div>
// //           ) : accounts.length === 0 ? (
// //             <p className="text-center text-sm text-gray-400 py-6">No accounts found</p>
// //           ) : (
// //             accounts.map((account) => (
// //               <button
// //                 key={account._id}
// //                 onClick={() => { onSelect(account); setOpen(false); setSearch(""); }}
// //                 className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
// //                   selectedAccount?._id === account._id ? "bg-blue-50" : ""
// //                 }`}
// //               >
// //                 <span className={`h-7 w-7 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 ${
// //                   account.isActive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
// //                 }`}>
// //                   {account.name.charAt(0).toUpperCase()}
// //                 </span>
// //                 <div className="flex-1 min-w-0">
// //                   <p className="text-sm font-medium text-gray-900 truncate">{account.name}</p>
// //                   <p className={`text-xs tabular-nums ${account.currentBalance < 0 ? "text-red-500" : "text-gray-400"}`}>
// //                     ₹{account.currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
// //                   </p>
// //                 </div>
// //                 {!account.isActive && (
// //                   <Badge variant="secondary" className="text-xs px-1.5 py-0">Inactive</Badge>
// //                 )}
// //               </button>
// //             ))
// //           )}
// //         </div>
// //       </PopoverContent>
// //     </Popover>
// //   );
// // }

// // // ── Main Component ────────────────────────────────────────────────────────

// // export default function AccountTransactionsStandaloneTab() {
// //   const deleteMutation = useDeleteAccountTransaction();

// //   const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
// //   const [searchInput, setSearchInput] = useState("");
// //   const [committedSearch, setCommittedSearch] = useState("");
// //   const [filters, setFilters] = useState<FilterState>({
// //     type: "all", dateRange: "all", startDate: "", endDate: "",
// //     currentPage: 1, pageSize: 10,
// //   });
// //   const [showAddModal, setShowAddModal] = useState(false);
// //   const [deleteTarget, setDeleteTarget] = useState<AccountTransaction | null>(null);

// //   // Reset filters when account changes
// //   const handleSelectAccount = useCallback((account: Account) => {
// //     setSelectedAccount(account);
// //     setCommittedSearch("");
// //     setSearchInput("");
// //     setFilters({ type: "all", dateRange: "all", startDate: "", endDate: "", currentPage: 1, pageSize: 10 });
// //   }, []);

// //   // Summary
// //   const { data: summaryData, isLoading: summaryLoading } = useQuery<{ success: boolean; data: AccountTransactionSummary }>({
// //     queryKey: ["account-summary", selectedAccount?._id],
// //     queryFn: async () => {
// //       const res = await fetch(`/api/account-transactions/summary?accountId=${selectedAccount!._id}`);
// //       if (!res.ok) throw new Error("Failed");
// //       return res.json();
// //     },
// //     enabled: !!selectedAccount,
// //     staleTime: 30_000,
// //   });
// //   const summary = summaryData?.data;

// //   // Transactions
// //   const { data, isLoading, isFetching } = useQuery<AccountTransactionsPaginatedResponse>({
// //     queryKey: ["account-transactions", selectedAccount?._id, committedSearch, filters.type, filters.dateRange, filters.startDate, filters.endDate, filters.currentPage, filters.pageSize],
// //     queryFn: async () => {
// //       const params = new URLSearchParams();
// //       params.set("accountId", selectedAccount!._id);
// //       if (committedSearch) params.set("search", committedSearch);
// //       if (filters.type !== "all") params.set("type", filters.type);
// //       if (filters.dateRange !== "all") {
// //         const b = getUTCBoundaries(filters.dateRange, filters.startDate, filters.endDate);
// //         if (b) { params.set("startDate", b.startDate); params.set("endDate", b.endDate); }
// //       }
// //       params.set("page", String(filters.currentPage));
// //       params.set("limit", String(filters.pageSize));
// //       const res = await fetch(`/api/account-transactions?${params}`);
// //       if (!res.ok) throw new Error("Failed");
// //       return res.json();
// //     },
// //     enabled: !!selectedAccount,
// //     staleTime: 30_000,
// //     placeholderData: (prev) => prev,
// //   });

// //   const transactions: AccountTransaction[] = data?.data?.transactions ?? [];
// //   const pagination: PaginationMetadata | undefined = data?.pagination;

// //   const handleSearch = useCallback(() => {
// //     setCommittedSearch(searchInput.trim());
// //     setFilters((p) => ({ ...p, currentPage: 1 }));
// //   }, [searchInput]);

// //   const handleClearSearch = useCallback(() => {
// //     setSearchInput(""); setCommittedSearch("");
// //     setFilters((p) => ({ ...p, currentPage: 1 }));
// //   }, []);

// //   const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
// //     setFilters((prev) => {
// //       if (key === "dateRange" && value === "custom") {
// //         const today = new Date().toISOString().split("T")[0];
// //         return { ...prev, dateRange: "custom", startDate: today, endDate: today, currentPage: 1 };
// //       }
// //       if (key === "dateRange" && value !== "custom") {
// //         return { ...prev, [key]: value, startDate: "", endDate: "", currentPage: 1 };
// //       }
// //       return { ...prev, [key]: value, ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}) };
// //     });
// //   }, []);

// //   const handleDelete = useCallback(() => {
// //     if (!deleteTarget) return;
// //     deleteMutation.mutate(deleteTarget._id, {
// //       onSuccess: () => setDeleteTarget(null),
// //       onError: () => toast.error("Failed to delete transaction"),
// //     });
// //   }, [deleteTarget, deleteMutation]);

// //   const fmt = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// //   const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
// //   const fmtTime = (d: string) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// //   const PaginationControls = () => {
// //     if (!pagination) return null;
// //     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
// //     const cp = filters.currentPage;
// //     const pages: number[] = [];
// //     if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
// //     else if (cp <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
// //     else if (cp >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
// //     else for (let i = cp - 2; i <= cp + 2; i++) pages.push(i);

// //     return (
// //       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
// //         <div className="flex items-center gap-2 text-sm text-gray-600">
// //           <span>{startIndex}–{endIndex} of {totalCount}</span>
// //           <Select value={String(filters.pageSize)} onValueChange={(v) => updateFilter("pageSize", Number(v) as FilterState["pageSize"])}>
// //             <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
// //             <SelectContent>{[5, 10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
// //           </Select>
// //           <span>per page</span>
// //         </div>
// //         <div className="flex items-center gap-1">
// //           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", 1)} disabled={!hasPreviousPage}><ChevronsLeft className="h-4 w-4" /></Button>
// //           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", cp - 1)} disabled={!hasPreviousPage}><ChevronLeft className="h-4 w-4" /></Button>
// //           {pages.map((p) => <Button key={p} variant={cp === p ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", p)}>{p}</Button>)}
// //           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", cp + 1)} disabled={!hasNextPage}><ChevronRight className="h-4 w-4" /></Button>
// //           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", totalPages)} disabled={!hasNextPage}><ChevronsRight className="h-4 w-4" /></Button>
// //         </div>
// //       </div>
// //     );
// //   };

// //   return (
// //     <div className="space-y-6">
// //       {/* Header — account selector lives here */}
// //       <div className="flex items-start justify-between gap-4 flex-wrap">
// //         <div>
// //           <h2 className="text-2xl font-bold text-gray-900">Account Transactions</h2>
// //           <p className="text-sm text-gray-500 mt-0.5">Select an account to view and manage its transactions</p>
// //         </div>
// //         <div className="flex items-center gap-2">
// //           <AccountSelector selectedAccount={selectedAccount} onSelect={handleSelectAccount} />
// //           {selectedAccount && (
// //             <Button
// //               onClick={() => setShowAddModal(true)}
// //               className="gap-2 bg-blue-600 hover:bg-blue-700"
// //               disabled={!selectedAccount.isActive}
// //               title={!selectedAccount.isActive ? "Cannot add transactions to inactive account" : undefined}
// //             >
// //               <Plus className="w-4 h-4" />
// //               Add Transaction
// //             </Button>
// //           )}
// //         </div>
// //       </div>

// //       {/* No account selected — empty state */}
// //       {!selectedAccount ? (
// //         <Card className="border-0 shadow-sm">
// //           <CardContent className="py-20 text-center">
// //             <div className="flex flex-col items-center gap-4 text-gray-400">
// //               <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center">
// //                 <Wallet className="w-8 h-8 opacity-50" />
// //               </div>
// //               <div>
// //                 <p className="text-base font-medium text-gray-600">No account selected</p>
// //                 <p className="text-sm mt-1">Choose an account from the dropdown above to view its transactions</p>
// //               </div>
// //             </div>
// //           </CardContent>
// //         </Card>
// //       ) : (
// //         <>
// //           {/* Account info bar */}
// //           <div className="flex items-center gap-3 flex-wrap">
// //             <div className="flex items-center gap-2">
// //               <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">
// //                 {selectedAccount.name.charAt(0).toUpperCase()}
// //               </div>
// //               <div>
// //                 <div className="flex items-center gap-2">
// //                   <span className="text-sm font-semibold text-gray-900">{selectedAccount.name}</span>
// //                   <Badge className={selectedAccount.isActive ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs" : "bg-gray-100 text-gray-500 text-xs"}>
// //                     {selectedAccount.isActive ? "Active" : "Inactive"}
// //                   </Badge>
// //                 </div>
// //                 {selectedAccount.description && <p className="text-xs text-gray-400 truncate max-w-xs">{selectedAccount.description}</p>}
// //               </div>
// //             </div>

// //             {/* Stats pills inline */}
// //             <div className="flex items-center gap-2 flex-wrap ml-auto">
// //               <StatPill label="Balance" value={fmt(selectedAccount.currentBalance)}
// //                 colorClass={selectedAccount.currentBalance >= 0 ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-red-50 text-red-700 border-red-100"} />
// //               <StatPill label="Total Credit" value={summary ? fmt(summary.totalCredit) : "—"}
// //                 colorClass="bg-green-50 text-green-700 border-green-100" loading={summaryLoading} />
// //               <StatPill label="Total Debit" value={summary ? fmt(summary.totalDebit) : "—"}
// //                 colorClass="bg-red-50 text-red-700 border-red-100" loading={summaryLoading} />
// //               <StatPill label="Net Flow" value={summary ? fmt(summary.netFlow) : "—"}
// //                 colorClass={!summary || summary.netFlow >= 0 ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-orange-50 text-orange-700 border-orange-100"}
// //                 loading={summaryLoading} />
// //             </div>
// //           </div>

// //           {/* Filters */}
// //           <Card className="border-0 shadow-sm">
// //             <CardContent className="p-5">
// //               <div className="flex flex-wrap items-end gap-4">
// //                 <div className="flex-1 min-w-[180px]">
// //                   <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Search Note</Label>
// //                   <div className="flex gap-2">
// //                     <div className="relative flex-1">
// //                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
// //                       <Input placeholder="Search in notes..." value={searchInput}
// //                         onChange={(e) => setSearchInput(e.target.value)}
// //                         onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pl-9 pr-8" />
// //                       {searchInput && (
// //                         <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
// //                           <X className="w-3.5 h-3.5" />
// //                         </button>
// //                       )}
// //                     </div>
// //                     <Button onClick={handleSearch} size="icon" disabled={isFetching}>
// //                       {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// //                     </Button>
// //                   </div>
// //                 </div>
// //                 <div className="w-36">
// //                   <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Type</Label>
// //                   <Select value={filters.type} onValueChange={(v) => updateFilter("type", v as TransactionTypeFilter)}>
// //                     <SelectTrigger><SelectValue /></SelectTrigger>
// //                     <SelectContent>
// //                       <SelectItem value="all">All Types</SelectItem>
// //                       <SelectItem value="CREDIT">Credit only</SelectItem>
// //                       <SelectItem value="DEBIT">Debit only</SelectItem>
// //                     </SelectContent>
// //                   </Select>
// //                 </div>
// //                 <div className="w-40">
// //                   <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Date Range</Label>
// //                   <Select value={filters.dateRange} onValueChange={(v) => updateFilter("dateRange", v as DateRangeType)}>
// //                     <SelectTrigger><SelectValue /></SelectTrigger>
// //                     <SelectContent>
// //                       <SelectItem value="today">Today</SelectItem>
// //                       <SelectItem value="week">This Week</SelectItem>
// //                       <SelectItem value="month">This Month</SelectItem>
// //                       <SelectItem value="custom">Custom Range</SelectItem>
// //                       <SelectItem value="all">All Time</SelectItem>
// //                     </SelectContent>
// //                   </Select>
// //                 </div>
// //                 {filters.dateRange === "custom" && (
// //                   <>
// //                     <div>
// //                       <Label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> From</Label>
// //                       <Input type="date" value={filters.startDate} onChange={(e) => updateFilter("startDate", e.target.value)} max={filters.endDate || undefined} className="w-36" />
// //                     </div>
// //                     <div>
// //                       <Label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> To</Label>
// //                       <Input type="date" value={filters.endDate} onChange={(e) => updateFilter("endDate", e.target.value)} min={filters.startDate || undefined} className="w-36" />
// //                     </div>
// //                   </>
// //                 )}
// //               </div>
// //             </CardContent>
// //           </Card>

// //           {/* Table */}
// //           <Card className="border-0 shadow-sm overflow-hidden">
// //             <CardHeader className="px-6 py-4 border-b bg-white">
// //               <CardTitle className="text-base font-semibold flex items-center gap-2">
// //                 Transactions — {selectedAccount.name}
// //                 {pagination && <span className="text-sm font-normal text-gray-400">({pagination.totalCount} entries)</span>}
// //                 {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
// //               </CardTitle>
// //             </CardHeader>
// //             <CardContent className="p-0">
// //               <div className="overflow-x-auto">
// //                 <table className="w-full">
// //                   <thead className="bg-gray-50 border-b">
// //                     <tr>
// //                       {["Date", "Type", "Amount", "Balance After", "Note", "Actions"].map((h, i) => (
// //                         <th key={h} className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
// //                           i === 2 || i === 3 ? "text-right" : i === 1 || i === 5 ? "text-center" : "text-left"
// //                         }`}>{h}</th>
// //                       ))}
// //                     </tr>
// //                   </thead>
// //                   {isLoading ? (
// //                     <TableSkeleton rows={filters.pageSize} />
// //                   ) : (
// //                     <tbody className="bg-white divide-y divide-gray-100">
// //                       {transactions.length === 0 ? (
// //                         <tr>
// //                           <td colSpan={6} className="px-6 py-16 text-center">
// //                             <div className="flex flex-col items-center gap-3 text-gray-400">
// //                               <Receipt className="w-10 h-10 opacity-30" />
// //                               <p className="text-sm font-medium">No transactions found</p>
// //                               {committedSearch
// //                                 ? <button onClick={handleClearSearch} className="text-xs text-blue-500 hover:underline">Clear search</button>
// //                                 : selectedAccount.isActive && <button onClick={() => setShowAddModal(true)} className="text-xs text-blue-500 hover:underline">Add the first transaction</button>
// //                               }
// //                             </div>
// //                           </td>
// //                         </tr>
// //                       ) : (
// //                         transactions.map((txn) => (
// //                           <tr key={txn._id} className="hover:bg-gray-50 transition-colors">
// //                             <td className="px-6 py-4 whitespace-nowrap">
// //                               <p className="text-sm font-medium text-gray-900">{fmtDate(txn.enteredAt)}</p>
// //                               <p className="text-xs text-gray-400">{fmtTime(txn.enteredAt)}</p>
// //                             </td>
// //                             <td className="px-6 py-4 whitespace-nowrap text-center">
// //                               <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
// //                                 txn.type === "CREDIT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
// //                               }`}>
// //                                 {txn.type === "CREDIT" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
// //                                 {txn.type}
// //                               </span>
// //                             </td>
// //                             <td className="px-6 py-4 whitespace-nowrap text-right">
// //                               <span className={`text-sm font-bold tabular-nums ${txn.type === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
// //                                 {txn.type === "CREDIT" ? "+" : "−"}{fmt(txn.amount)}
// //                               </span>
// //                             </td>
// //                             <td className="px-6 py-4 whitespace-nowrap text-right">
// //                               <span className={`text-sm font-semibold tabular-nums ${txn.balanceAfter < 0 ? "text-red-500" : "text-gray-700"}`}>
// //                                 {fmt(txn.balanceAfter)}
// //                               </span>
// //                             </td>
// //                             <td className="px-6 py-4 max-w-[240px]">
// //                               {txn.note ? <p className="text-sm text-gray-700 truncate">{txn.note}</p> : <p className="text-sm text-gray-300 italic">No note</p>}
// //                               {txn.billUrl && (
// //                                 <a href={txn.billUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5">
// //                                   <ExternalLink className="w-3 h-3" /> View Bill
// //                                 </a>
// //                               )}
// //                             </td>
// //                             <td className="px-6 py-4 whitespace-nowrap text-center">
// //                               <DropdownMenu>
// //                                 <DropdownMenuTrigger asChild>
// //                                   <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700">
// //                                     <MoreVertical className="w-4 h-4" />
// //                                   </Button>
// //                                 </DropdownMenuTrigger>
// //                                 <DropdownMenuContent align="end">
// //                                   <DropdownMenuSeparator />
// //                                   <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(txn)}>
// //                                     <Trash2 className="w-4 h-4 mr-2" /> Delete
// //                                   </DropdownMenuItem>
// //                                 </DropdownMenuContent>
// //                               </DropdownMenu>
// //                             </td>
// //                           </tr>
// //                         ))
// //                       )}
// //                     </tbody>
// //                   )}
// //                 </table>
// //               </div>
// //               <PaginationControls />
// //             </CardContent>
// //           </Card>
// //         </>
// //       )}

// //       {/* Add Transaction Modal */}
// //       {selectedAccount && (
// //         <AddTransactionModal open={showAddModal} onOpenChange={setShowAddModal} account={selectedAccount} />
// //       )}

// //       {/* Delete Confirmation */}
// //       <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
// //         <AlertDialogContent>
// //           <AlertDialogHeader>
// //             <AlertDialogTitle className="flex items-center gap-2">
// //               <AlertCircle className="w-5 h-5 text-red-500" />
// //               Delete Transaction
// //             </AlertDialogTitle>
// //             <AlertDialogDescription>
// //               Delete this{" "}
// //               <span className="font-semibold text-gray-900">
// //                 {deleteTarget?.type === "CREDIT" ? "credit" : "debit"} of {deleteTarget ? fmt(deleteTarget.amount) : ""}
// //               </span>? The account balance will be recalculated automatically. This cannot be undone.
// //             </AlertDialogDescription>
// //           </AlertDialogHeader>
// //           <AlertDialogFooter>
// //             <AlertDialogCancel>Cancel</AlertDialogCancel>
// //             <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-red-500 hover:bg-red-600">
// //               {deleteMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : "Delete"}
// //             </AlertDialogAction>
// //           </AlertDialogFooter>
// //         </AlertDialogContent>
// //       </AlertDialog>
// //     </div>
// //   );
// // }// "use client";

// // // import { useState, useCallback } from "react";
// // // import { useQuery } from "@tanstack/react-query";
// // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // import { Input } from "@/components/ui/input";
// // // import { Button } from "@/components/ui/button";
// // // import { Badge } from "@/components/ui/badge";
// // // import { Label } from "@/components/ui/label";
// // // import {
// // //   Select,
// // //   SelectContent,
// // //   SelectItem,
// // //   SelectTrigger,
// // //   SelectValue,
// // // } from "@/components/ui/select";
// // // import {
// // //   ArrowLeft,
// // //   Search,
// // //   Plus,
// // //   ChevronLeft,
// // //   ChevronRight,
// // //   ChevronsLeft,
// // //   ChevronsRight,
// // //   Loader2,
// // //   Trash2,
// // //   TrendingUp,
// // //   TrendingDown,
// // //   Wallet,
// // //   Calendar,
// // //   ExternalLink,
// // //   X,
// // //   AlertCircle,
// // //   Receipt,
// // //   Pencil,
// // //   MoreVertical,
// // // } from "lucide-react";
// // // import {
// // //   DropdownMenu,
// // //   DropdownMenuContent,
// // //   DropdownMenuItem,
// // //   DropdownMenuSeparator,
// // //   DropdownMenuTrigger,
// // // } from "@/components/ui/dropdown-menu";
// // // import {
// // //   AlertDialog,
// // //   AlertDialogAction,
// // //   AlertDialogCancel,
// // //   AlertDialogContent,
// // //   AlertDialogDescription,
// // //   AlertDialogFooter,
// // //   AlertDialogHeader,
// // //   AlertDialogTitle,
// // // } from "@/components/ui/alert-dialog";
// // // import { toast } from "sonner";
// // // import AddTransactionModal from "@/components/modals/add-transaction-modal";
// // // import { useDeleteAccountTransaction } from "@/hooks/use-account-transaction-mutations";
// // // import type { Account } from "@/types/account";
// // // import type {
// // //   AccountTransaction,
// // //   AccountTransactionsPaginatedResponse,
// // //   AccountTransactionSummary,
// // //   PaginationMetadata,
// // // } from "@/types/accountTransaction";

// // // // ── Types ──────────────────────────────────────────────────────────────────

// // // type DateRangeType = "today" | "week" | "month" | "custom" | "all";
// // // type TransactionTypeFilter = "all" | "CREDIT" | "DEBIT";

// // // interface FilterState {
// // //   type: TransactionTypeFilter;
// // //   dateRange: DateRangeType;
// // //   startDate: string;
// // //   endDate: string;
// // //   currentPage: number;
// // //   pageSize: number;
// // // }

// // // interface AccountTransactionsTabProps {
// // //   account: Account;
// // //   onBack: () => void;
// // // }

// // // // ── Skeleton ──────────────────────────────────────────────────────────────

// // // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// // //   <tbody className="bg-white divide-y divide-gray-100">
// // //     {Array.from({ length: rows }).map((_, i) => (
// // //       <tr key={i} className="animate-pulse">
// // //         <td className="px-6 py-4">
// // //           <div className="space-y-1">
// // //             <div className="h-4 bg-gray-100 rounded w-24" />
// // //             <div className="h-3 bg-gray-100 rounded w-16" />
// // //           </div>
// // //         </td>
// // //         <td className="px-6 py-4 text-center">
// // //           <div className="h-5 bg-gray-100 rounded-full w-16 mx-auto" />
// // //         </td>
// // //         <td className="px-6 py-4 text-right">
// // //           <div className="h-5 bg-gray-100 rounded w-20 ml-auto" />
// // //         </td>
// // //         <td className="px-6 py-4 text-right">
// // //           <div className="h-5 bg-gray-100 rounded w-24 ml-auto" />
// // //         </td>
// // //         <td className="px-6 py-4">
// // //           <div className="h-4 bg-gray-100 rounded w-40" />
// // //         </td>
// // //         <td className="px-6 py-4 text-center">
// // //           <div className="flex justify-center gap-2">
// // //             <div className="h-8 w-8 bg-gray-100 rounded" />
// // //             <div className="h-8 w-8 bg-gray-100 rounded" />
// // //           </div>
// // //         </td>
// // //       </tr>
// // //     ))}
// // //   </tbody>
// // // );

// // // // ── Summary Card ──────────────────────────────────────────────────────────

// // // const SummaryCard = ({
// // //   label,
// // //   value,
// // //   icon: Icon,
// // //   colorClass,
// // //   sub,
// // // }: {
// // //   label: string;
// // //   value: string;
// // //   icon: React.ElementType;
// // //   colorClass: string;
// // //   sub?: string;
// // // }) => (
// // //   <Card className="border-0 shadow-sm">
// // //     <CardContent className="p-5">
// // //       <div className="flex items-start justify-between">
// // //         <div>
// // //           <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
// // //           <p className="mt-1.5 text-xl font-bold text-gray-900 tabular-nums">{value}</p>
// // //           {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
// // //         </div>
// // //         <div className={`p-2.5 rounded-xl ${colorClass}`}>
// // //           <Icon className="w-5 h-5" />
// // //         </div>
// // //       </div>
// // //     </CardContent>
// // //   </Card>
// // // );

// // // // ── UTC boundaries helper ─────────────────────────────────────────────────

// // // function getUTCBoundaries(
// // //   dateRange: string,
// // //   startDate: string,
// // //   endDate: string
// // // ): { startDate: string; endDate: string } | null {
// // //   const now = new Date();
// // //   switch (dateRange) {
// // //     case "today": {
// // //       const s = new Date(now); s.setHours(0, 0, 0, 0);
// // //       const e = new Date(now); e.setHours(23, 59, 59, 999);
// // //       return { startDate: s.toISOString(), endDate: e.toISOString() };
// // //     }
// // //     case "week": {
// // //       const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
// // //       const e = new Date(now); e.setHours(23, 59, 59, 999);
// // //       return { startDate: s.toISOString(), endDate: e.toISOString() };
// // //     }
// // //     case "month": {
// // //       const s = new Date(now.getFullYear(), now.getMonth(), 1); s.setHours(0, 0, 0, 0);
// // //       const e = new Date(now.getFullYear(), now.getMonth() + 1, 0); e.setHours(23, 59, 59, 999);
// // //       return { startDate: s.toISOString(), endDate: e.toISOString() };
// // //     }
// // //     case "custom": {
// // //       if (!startDate || !endDate) return null;
// // //       const s = new Date(startDate); s.setHours(0, 0, 0, 0);
// // //       const e = new Date(endDate); e.setHours(23, 59, 59, 999);
// // //       return { startDate: s.toISOString(), endDate: e.toISOString() };
// // //     }
// // //     default:
// // //       return null;
// // //   }
// // // }

// // // // ── Main Component ────────────────────────────────────────────────────────

// // // export default function AccountTransactionsTab({
// // //   account,
// // //   onBack,
// // // }: AccountTransactionsTabProps) {
// // //   const deleteMutation = useDeleteAccountTransaction();

// // //   const [searchInput, setSearchInput] = useState("");
// // //   const [committedSearch, setCommittedSearch] = useState("");

// // //   const [filters, setFilters] = useState<FilterState>({
// // //     type: "all",
// // //     dateRange: "all",
// // //     startDate: "",
// // //     endDate: "",
// // //     currentPage: 1,
// // //     pageSize: 10,
// // //   });

// // //   const [showAddModal, setShowAddModal] = useState(false);
// // //   const [deleteTarget, setDeleteTarget] = useState<AccountTransaction | null>(null);

// // //   // ── Fetch summary ────────────────────────────────────────────────────────

// // //   const { data: summaryData } = useQuery<{ success: boolean; data: AccountTransactionSummary }>({
// // //     queryKey: ["account-summary", account._id],
// // //     queryFn: async () => {
// // //       const res = await fetch(
// // //         `/api/account-transactions/summary?accountId=${account._id}`
// // //       );
// // //       if (!res.ok) throw new Error("Failed to fetch summary");
// // //       return res.json();
// // //     },
// // //     staleTime: 30_000,
// // //   });

// // //   const summary = summaryData?.data;

// // //   // ── Fetch transactions ───────────────────────────────────────────────────

// // //   const { data, isLoading, isFetching } = useQuery<AccountTransactionsPaginatedResponse>({
// // //     queryKey: [
// // //       "account-transactions",
// // //       account._id,
// // //       committedSearch,
// // //       filters.type,
// // //       filters.dateRange,
// // //       filters.startDate,
// // //       filters.endDate,
// // //       filters.currentPage,
// // //       filters.pageSize,
// // //     ],
// // //     queryFn: async () => {
// // //       const params = new URLSearchParams();
// // //       params.set("accountId", account._id);
// // //       if (committedSearch) params.set("search", committedSearch);
// // //       if (filters.type !== "all") params.set("type", filters.type);

// // //       if (filters.dateRange !== "all") {
// // //         const b = getUTCBoundaries(filters.dateRange, filters.startDate, filters.endDate);
// // //         if (b) {
// // //           params.set("startDate", b.startDate);
// // //           params.set("endDate", b.endDate);
// // //         }
// // //       }

// // //       params.set("page", String(filters.currentPage));
// // //       params.set("limit", String(filters.pageSize));

// // //       const res = await fetch(`/api/account-transactions?${params}`);
// // //       if (!res.ok) throw new Error("Failed to fetch transactions");
// // //       return res.json();
// // //     },
// // //     staleTime: 30_000,
// // //     placeholderData: (prev) => prev,
// // //   });

// // //   const transactions: AccountTransaction[] = data?.data?.transactions ?? [];
// // //   const pagination: PaginationMetadata | undefined = data?.pagination;

// // //   // ── Handlers ─────────────────────────────────────────────────────────────

// // //   const handleSearch = useCallback(() => {
// // //     setCommittedSearch(searchInput.trim());
// // //     setFilters((p) => ({ ...p, currentPage: 1 }));
// // //   }, [searchInput]);

// // //   const handleClearSearch = useCallback(() => {
// // //     setSearchInput("");
// // //     setCommittedSearch("");
// // //     setFilters((p) => ({ ...p, currentPage: 1 }));
// // //   }, []);

// // //   const updateFilter = useCallback(
// // //     <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
// // //       setFilters((prev) => {
// // //         if (key === "dateRange" && value === "custom") {
// // //           const today = new Date().toISOString().split("T")[0];
// // //           return { ...prev, dateRange: "custom", startDate: today, endDate: today, currentPage: 1 };
// // //         }
// // //         if (key === "dateRange" && value !== "custom") {
// // //           return { ...prev, [key]: value, startDate: "", endDate: "", currentPage: 1 };
// // //         }
// // //         return {
// // //           ...prev,
// // //           [key]: value,
// // //           ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
// // //         };
// // //       });
// // //     },
// // //     []
// // //   );

// // //   const handleDelete = useCallback(() => {
// // //     if (!deleteTarget) return;
// // //     deleteMutation.mutate(deleteTarget._id, {
// // //       onSuccess: () => setDeleteTarget(null),
// // //       onError: () => toast.error("Failed to delete transaction"),
// // //     });
// // //   }, [deleteTarget, deleteMutation]);

// // //   // ── Helpers ───────────────────────────────────────────────────────────────

// // //   const formatCurrency = (n: number) =>
// // //     `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// // //   const formatDate = (d: string) =>
// // //     new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// // //   const formatTime = (d: string) =>
// // //     new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// // //   const showSkeleton = isLoading || isFetching;

// // //   // ── Pagination ────────────────────────────────────────────────────────────

// // //   const PaginationControls = () => {
// // //     if (!pagination) return null;
// // //     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
// // //     const cp = filters.currentPage;
// // //     const pages: number[] = [];
// // //     if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
// // //     else if (cp <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
// // //     else if (cp >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
// // //     else for (let i = cp - 2; i <= cp + 2; i++) pages.push(i);

// // //     return (
// // //       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
// // //         <div className="flex items-center gap-2 text-sm text-gray-600">
// // //           <span>{startIndex}–{endIndex} of {totalCount}</span>
// // //           <Select
// // //             value={String(filters.pageSize)}
// // //             onValueChange={(v) => updateFilter("pageSize", Number(v) as FilterState["pageSize"])}
// // //           >
// // //             <SelectTrigger className="w-16 h-7 text-xs">
// // //               <SelectValue />
// // //             </SelectTrigger>
// // //             <SelectContent>
// // //               {[5, 10, 20, 50].map((n) => (
// // //                 <SelectItem key={n} value={String(n)}>{n}</SelectItem>
// // //               ))}
// // //             </SelectContent>
// // //           </Select>
// // //           <span>per page</span>
// // //         </div>
// // //         <div className="flex items-center gap-1">
// // //           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", 1)} disabled={!hasPreviousPage}>
// // //             <ChevronsLeft className="h-4 w-4" />
// // //           </Button>
// // //           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", cp - 1)} disabled={!hasPreviousPage}>
// // //             <ChevronLeft className="h-4 w-4" />
// // //           </Button>
// // //           {pages.map((p) => (
// // //             <Button key={p} variant={cp === p ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", p)}>
// // //               {p}
// // //             </Button>
// // //           ))}
// // //           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", cp + 1)} disabled={!hasNextPage}>
// // //             <ChevronRight className="h-4 w-4" />
// // //           </Button>
// // //           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", totalPages)} disabled={!hasNextPage}>
// // //             <ChevronsRight className="h-4 w-4" />
// // //           </Button>
// // //         </div>
// // //       </div>
// // //     );
// // //   };

// // //   // ── Render ────────────────────────────────────────────────────────────────

// // //   return (
// // //     <div className="space-y-6">
// // //       {/* Header */}
// // //       <div className="flex items-start gap-4">
// // //         <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
// // //           <ArrowLeft className="w-5 h-5" />
// // //         </Button>
// // //         <div className="flex-1 min-w-0">
// // //           <div className="flex items-center gap-2 flex-wrap">
// // //             <h2 className="text-2xl font-bold text-gray-900 truncate">{account.name}</h2>
// // //             <Badge
// // //               className={
// // //                 account.isActive
// // //                   ? "bg-green-100 text-green-700 border-green-200"
// // //                   : "bg-gray-100 text-gray-500"
// // //               }
// // //             >
// // //               {account.isActive ? "Active" : "Inactive"}
// // //             </Badge>
// // //           </div>
// // //           {account.description && (
// // //             <p className="text-sm text-gray-500 mt-0.5 truncate">{account.description}</p>
// // //           )}
// // //         </div>
// // //         <Button onClick={() => setShowAddModal(true)} className="gap-2 shrink-0">
// // //           <Plus className="w-4 h-4" />
// // //           Add Transaction
// // //         </Button>
// // //       </div>

// // //       {/* Summary Cards */}
// // //       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
// // //         <SummaryCard
// // //           label="Current Balance"
// // //           value={formatCurrency(account.currentBalance)}
// // //           icon={Wallet}
// // //           colorClass={account.currentBalance >= 0 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}
// // //           sub={account.currentBalance < 0 ? "Negative balance" : undefined}
// // //         />
// // //         <SummaryCard
// // //           label="Total Credit"
// // //           value={summary ? formatCurrency(summary.totalCredit) : "—"}
// // //           icon={TrendingUp}
// // //           colorClass="bg-green-50 text-green-600"
// // //           sub={summary ? `${summary.totalEntries} entries` : undefined}
// // //         />
// // //         <SummaryCard
// // //           label="Total Debit"
// // //           value={summary ? formatCurrency(summary.totalDebit) : "—"}
// // //           icon={TrendingDown}
// // //           colorClass="bg-red-50 text-red-600"
// // //         />
// // //         <SummaryCard
// // //           label="Net Flow"
// // //           value={summary ? formatCurrency(summary.netFlow) : "—"}
// // //           icon={Receipt}
// // //           colorClass={
// // //             !summary || summary.netFlow >= 0
// // //               ? "bg-purple-50 text-purple-600"
// // //               : "bg-orange-50 text-orange-600"
// // //           }
// // //         />
// // //       </div>

// // //       {/* Filters */}
// // //       <Card className="border-0 shadow-sm">
// // //         <CardContent className="p-5">
// // //           <div className="flex flex-wrap items-end gap-4">
// // //             {/* Search */}
// // //             <div className="flex-1 min-w-[180px]">
// // //               <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Search Note</Label>
// // //               <div className="flex gap-2">
// // //                 <div className="relative flex-1">
// // //                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
// // //                   <Input
// // //                     placeholder="Search note..."
// // //                     value={searchInput}
// // //                     onChange={(e) => setSearchInput(e.target.value)}
// // //                     onKeyDown={(e) => e.key === "Enter" && handleSearch()}
// // //                     className="pl-9 pr-8"
// // //                   />
// // //                   {searchInput && (
// // //                     <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
// // //                       <X className="w-3.5 h-3.5" />
// // //                     </button>
// // //                   )}
// // //                 </div>
// // //                 <Button onClick={handleSearch} size="icon" disabled={isFetching}>
// // //                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// // //                 </Button>
// // //               </div>
// // //             </div>

// // //             {/* Type */}
// // //             <div className="w-36">
// // //               <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Type</Label>
// // //               <Select
// // //                 value={filters.type}
// // //                 onValueChange={(v) => updateFilter("type", v as TransactionTypeFilter)}
// // //               >
// // //                 <SelectTrigger>
// // //                   <SelectValue />
// // //                 </SelectTrigger>
// // //                 <SelectContent>
// // //                   <SelectItem value="all">All Types</SelectItem>
// // //                   <SelectItem value="CREDIT">Credit</SelectItem>
// // //                   <SelectItem value="DEBIT">Debit</SelectItem>
// // //                 </SelectContent>
// // //               </Select>
// // //             </div>

// // //             {/* Date Range */}
// // //             <div className="w-40">
// // //               <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Date Range</Label>
// // //               <Select
// // //                 value={filters.dateRange}
// // //                 onValueChange={(v) => updateFilter("dateRange", v as DateRangeType)}
// // //               >
// // //                 <SelectTrigger>
// // //                   <SelectValue />
// // //                 </SelectTrigger>
// // //                 <SelectContent>
// // //                   <SelectItem value="today">Today</SelectItem>
// // //                   <SelectItem value="week">This Week</SelectItem>
// // //                   <SelectItem value="month">This Month</SelectItem>
// // //                   <SelectItem value="custom">Custom</SelectItem>
// // //                   <SelectItem value="all">All Time</SelectItem>
// // //                 </SelectContent>
// // //               </Select>
// // //             </div>

// // //             {/* Custom date range */}
// // //             {filters.dateRange === "custom" && (
// // //               <div className="flex gap-3 items-end">
// // //                 <div>
// // //                   <Label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
// // //                     <Calendar className="w-3.5 h-3.5" /> From
// // //                   </Label>
// // //                   <Input
// // //                     type="date"
// // //                     value={filters.startDate}
// // //                     onChange={(e) => updateFilter("startDate", e.target.value)}
// // //                     max={filters.endDate || undefined}
// // //                     className="w-36"
// // //                   />
// // //                 </div>
// // //                 <div>
// // //                   <Label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
// // //                     <Calendar className="w-3.5 h-3.5" /> To
// // //                   </Label>
// // //                   <Input
// // //                     type="date"
// // //                     value={filters.endDate}
// // //                     onChange={(e) => updateFilter("endDate", e.target.value)}
// // //                     min={filters.startDate || undefined}
// // //                     className="w-36"
// // //                   />
// // //                 </div>
// // //               </div>
// // //             )}
// // //           </div>
// // //         </CardContent>
// // //       </Card>

// // //       {/* Table */}
// // //       <Card className="border-0 shadow-sm overflow-hidden">
// // //         <CardHeader className="px-6 py-4 border-b bg-white">
// // //           <CardTitle className="text-base font-semibold flex items-center gap-2">
// // //             Transactions
// // //             {pagination && (
// // //               <span className="text-sm font-normal text-gray-400">({pagination.totalCount} total)</span>
// // //             )}
// // //             {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
// // //           </CardTitle>
// // //         </CardHeader>
// // //         <CardContent className="p-0">
// // //           <div className="overflow-x-auto">
// // //             <table className="w-full">
// // //               <thead className="bg-gray-50 border-b">
// // //                 <tr>
// // //                   <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
// // //                     Date
// // //                   </th>
// // //                   <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
// // //                     Type
// // //                   </th>
// // //                   <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
// // //                     Amount
// // //                   </th>
// // //                   <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
// // //                     Balance After
// // //                   </th>
// // //                   <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
// // //                     Note
// // //                   </th>
// // //                   <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
// // //                     Actions
// // //                   </th>
// // //                 </tr>
// // //               </thead>

// // //               {showSkeleton ? (
// // //                 <TableSkeleton rows={filters.pageSize} />
// // //               ) : (
// // //                 <tbody className="bg-white divide-y divide-gray-100">
// // //                   {transactions.length === 0 ? (
// // //                     <tr>
// // //                       <td colSpan={6} className="px-6 py-16 text-center">
// // //                         <div className="flex flex-col items-center gap-3 text-gray-400">
// // //                           <Receipt className="w-10 h-10 opacity-30" />
// // //                           <p className="text-sm">No transactions found</p>
// // //                           {committedSearch && (
// // //                             <button onClick={handleClearSearch} className="text-xs text-blue-500 hover:underline">
// // //                               Clear search
// // //                             </button>
// // //                           )}
// // //                         </div>
// // //                       </td>
// // //                     </tr>
// // //                   ) : (
// // //                     transactions.map((txn) => (
// // //                       <tr key={txn._id} className="hover:bg-gray-50 transition-colors">
// // //                         {/* Date */}
// // //                         <td className="px-6 py-4 whitespace-nowrap">
// // //                           <div>
// // //                             <p className="text-sm font-medium text-gray-900">{formatDate(txn.enteredAt)}</p>
// // //                             <p className="text-xs text-gray-400">{formatTime(txn.enteredAt)}</p>
// // //                           </div>
// // //                         </td>

// // //                         {/* Type */}
// // //                         <td className="px-6 py-4 whitespace-nowrap text-center">
// // //                           <span
// // //                             className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
// // //                               txn.type === "CREDIT"
// // //                                 ? "bg-green-100 text-green-700"
// // //                                 : "bg-red-100 text-red-700"
// // //                             }`}
// // //                           >
// // //                             {txn.type === "CREDIT" ? (
// // //                               <TrendingUp className="w-3 h-3" />
// // //                             ) : (
// // //                               <TrendingDown className="w-3 h-3" />
// // //                             )}
// // //                             {txn.type}
// // //                           </span>
// // //                         </td>

// // //                         {/* Amount */}
// // //                         <td className="px-6 py-4 whitespace-nowrap text-right">
// // //                           <span
// // //                             className={`text-sm font-bold tabular-nums ${
// // //                               txn.type === "CREDIT" ? "text-green-600" : "text-red-600"
// // //                             }`}
// // //                           >
// // //                             {txn.type === "CREDIT" ? "+" : "−"}
// // //                             {formatCurrency(txn.amount)}
// // //                           </span>
// // //                         </td>

// // //                         {/* Balance After */}
// // //                         <td className="px-6 py-4 whitespace-nowrap text-right">
// // //                           <span
// // //                             className={`text-sm font-semibold tabular-nums ${
// // //                               txn.balanceAfter < 0 ? "text-red-600" : "text-gray-700"
// // //                             }`}
// // //                           >
// // //                             {formatCurrency(txn.balanceAfter)}
// // //                           </span>
// // //                         </td>

// // //                         {/* Note */}
// // //                         <td className="px-6 py-4 max-w-[260px]">
// // //                           <p className="text-sm text-gray-600 truncate">{txn.note || <span className="text-gray-300 italic">No note</span>}</p>
// // //                           {txn.billUrl && (
// // //                             <a
// // //                               href={txn.billUrl}
// // //                               target="_blank"
// // //                               rel="noopener noreferrer"
// // //                               className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5"
// // //                             >
// // //                               <ExternalLink className="w-3 h-3" />
// // //                               View Bill
// // //                             </a>
// // //                           )}
// // //                         </td>

// // //                         {/* Actions */}
// // //                         <td className="px-6 py-4 whitespace-nowrap text-center">
// // //                           <DropdownMenu>
// // //                             <DropdownMenuTrigger asChild>
// // //                               <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
// // //                                 <MoreVertical className="w-4 h-4" />
// // //                               </Button>
// // //                             </DropdownMenuTrigger>
// // //                             <DropdownMenuContent align="end">
// // //                               <DropdownMenuSeparator />
// // //                               <DropdownMenuItem
// // //                                 className="text-red-600 focus:text-red-600"
// // //                                 onClick={() => setDeleteTarget(txn)}
// // //                               >
// // //                                 <Trash2 className="w-4 h-4 mr-2" />
// // //                                 Delete
// // //                               </DropdownMenuItem>
// // //                             </DropdownMenuContent>
// // //                           </DropdownMenu>
// // //                         </td>
// // //                       </tr>
// // //                     ))
// // //                   )}
// // //                 </tbody>
// // //               )}
// // //             </table>
// // //           </div>
// // //           <PaginationControls />
// // //         </CardContent>
// // //       </Card>

// // //       {/* Add Transaction Modal */}
// // //       <AddTransactionModal
// // //         open={showAddModal}
// // //         onOpenChange={setShowAddModal}
// // //         account={account}
// // //       />

// // //       {/* Delete Confirm */}
// // //       <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
// // //         <AlertDialogContent>
// // //           <AlertDialogHeader>
// // //             <AlertDialogTitle className="flex items-center gap-2">
// // //               <AlertCircle className="w-5 h-5 text-red-500" />
// // //               Delete Transaction
// // //             </AlertDialogTitle>
// // //             <AlertDialogDescription>
// // //               Are you sure you want to delete this{" "}
// // //               <span className="font-semibold text-gray-900">
// // //                 {deleteTarget?.type === "CREDIT" ? "credit" : "debit"} of{" "}
// // //                 {deleteTarget ? formatCurrency(deleteTarget.amount) : ""}
// // //               </span>
// // //               ? The account balance will be recalculated automatically.
// // //             </AlertDialogDescription>
// // //           </AlertDialogHeader>
// // //           <AlertDialogFooter>
// // //             <AlertDialogCancel>Cancel</AlertDialogCancel>
// // //             <AlertDialogAction
// // //               onClick={handleDelete}
// // //               disabled={deleteMutation.isPending}
// // //               className="bg-red-500 hover:bg-red-600"
// // //             >
// // //               {deleteMutation.isPending ? (
// // //                 <>
// // //                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
// // //                   Deleting...
// // //                 </>
// // //               ) : (
// // //                 "Delete"
// // //               )}
// // //             </AlertDialogAction>
// // //           </AlertDialogFooter>
// // //         </AlertDialogContent>
// // //       </AlertDialog>
// // //     </div>
// // //   );
// // // }





// // // //--------- // components/tabs/account-transactions-tab.tsx
// // // // "use client";

// // // // import { useState, useCallback, useEffect } from "react";
// // // // import { useQuery } from "@tanstack/react-query";
// // // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // // import { Input } from "@/components/ui/input";
// // // // import { Label } from "@/components/ui/label";
// // // // import { Button } from "@/components/ui/button";
// // // // import {
// // // //   Select,
// // // //   SelectContent,
// // // //   SelectItem,
// // // //   SelectTrigger,
// // // //   SelectValue,
// // // // } from "@/components/ui/select";
// // // // import {
// // // //   Search,
// // // //   Plus,
// // // //   Trash2,
// // // //   Loader2,
// // // //   X,
// // // //   ChevronLeft,
// // // //   ChevronRight,
// // // //   ChevronsLeft,
// // // //   ChevronsRight,
// // // //   Calendar,
// // // //   Download,
// // // //   ArrowLeft,
// // // //   TrendingUp,
// // // //   TrendingDown,
// // // //   ExternalLink,
// // // //   FileText,
// // // //   Users,
// // // //   Wallet,
// // // // } from "lucide-react";
// // // // import { toast } from "sonner";
// // // // import { useDeleteAccountTransaction } from "@/hooks/use-account-transaction-mutations";
// // // // import AddTransactionModal from "@/components/modals/add-transaction-modal";
// // // // import ConfirmDialog from "@/components/dialogs/ConfirmDialog";
// // // // import type { Account, AccountsPaginatedResponse } from "@/types/account";
// // // // import type {
// // // //   AccountTransaction,
// // // //   AccountTransactionsPaginatedResponse,
// // // // } from "@/types/accountTransaction";

// // // // type DateRangeType = "today" | "week" | "month" | "custom" | "all";
// // // // type TransactionTypeFilter = "all" | "CREDIT" | "DEBIT";

// // // // interface FilterState {
// // // //   type: TransactionTypeFilter;
// // // //   dateRange: DateRangeType;
// // // //   startDate: string;
// // // //   endDate: string;
// // // //   currentPage: number;
// // // //   pageSize: number;
// // // // }

// // // // // Skeleton
// // // // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// // // //   <tbody className="bg-white divide-y divide-gray-200">
// // // //     {Array.from({ length: rows }).map((_, index) => (
// // // //       <tr key={index} className="animate-pulse">
// // // //         <td className="px-6 py-4"><div className="space-y-1"><div className="h-4 bg-gray-200 rounded w-24"></div><div className="h-3 bg-gray-200 rounded w-16"></div></div></td>
// // // //         <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
// // // //         <td className="px-6 py-4 text-center"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
// // // //         <td className="px-6 py-4 text-center"><div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div></td>
// // // //         <td className="px-6 py-4 text-right"><div className="h-5 bg-gray-200 rounded w-20 ml-auto"></div></td>
// // // //         <td className="px-6 py-4 text-center"><div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div></td>
// // // //         <td className="px-6 py-4 text-center"><div className="h-8 w-8 bg-gray-200 rounded mx-auto"></div></td>
// // // //       </tr>
// // // //     ))}
// // // //   </tbody>
// // // // );

// // // // interface AccountTransactionsTabProps {
// // // //   account: Account;
// // // //   onBack: () => void;
// // // //   isMaster?: boolean;
// // // // }

// // // // export default function AccountTransactionsTab({
// // // //   account: initialAccount,
// // // //   onBack,
// // // //   isMaster = false,
// // // // }: AccountTransactionsTabProps) {
// // // //   const deleteMutation = useDeleteAccountTransaction();

// // // //   // For master: ability to switch accounts
// // // //   const [selectedUserId, setSelectedUserId] = useState<string>("all");
// // // //   const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccount?._id);
// // // //   const [currentAccount, setCurrentAccount] = useState<Account>(initialAccount);

// // // //   const [searchInput, setSearchInput] = useState("");
// // // //   const [committedSearch, setCommittedSearch] = useState("");

// // // //   const [filters, setFilters] = useState<FilterState>({
// // // //     type: "all",
// // // //     dateRange: "all",
// // // //     startDate: "",
// // // //     endDate: "",
// // // //     currentPage: 1,
// // // //     pageSize: 20,
// // // //   });

// // // //   const [showAddModal, setShowAddModal] = useState(false);
// // // //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// // // //   const [selectedTransaction, setSelectedTransaction] = useState<AccountTransaction | null>(null);
// // // //   const [isExporting, setIsExporting] = useState(false);

// // // //   // Fetch users (Master only)
// // // //   const { data: usersResponse } = useQuery<{
// // // //     success: boolean;
// // // //     data: { users: { _id: string; name: string; email: string; username?: string }[] };
// // // //   }>({
// // // //     queryKey: ["users-list"],
// // // //     queryFn: async () => {
// // // //       const res = await fetch("/api/users?limit=100");
// // // //       if (!res.ok) throw new Error("Failed to fetch users");
// // // //       return res.json();
// // // //     },
// // // //     enabled: isMaster,
// // // //   });

// // // //   const users = usersResponse?.data?.users || [];

// // // //   // Fetch accounts for selected user (Master only)
// // // //   const { data: accountsResponse } = useQuery<AccountsPaginatedResponse>({
// // // //     queryKey: ["accounts", "master", selectedUserId],
// // // //     queryFn: async () => {
// // // //       const params = new URLSearchParams();
// // // //       params.append("limit", "100");
// // // //       if (selectedUserId !== "all") {
// // // //         params.append("ownerId", selectedUserId);
// // // //       }
// // // //       const res = await fetch(`/api/accounts?${params}`);
// // // //       if (!res.ok) throw new Error("Failed to fetch accounts");
// // // //       return res.json();
// // // //     },
// // // //     enabled: isMaster,
// // // //   });

// // // //   const accountsList = accountsResponse?.data?.accounts || [];

// // // //   // Update current account when selection changes
// // // //   useEffect(() => {
// // // //     if (isMaster && selectedAccountId) {
// // // //       const found = accountsList.find((a) => a._id === selectedAccountId);
// // // //       if (found) {
// // // //         setCurrentAccount(found);
// // // //       }
// // // //     }
// // // //   }, [selectedAccountId, accountsList, isMaster]);

// // // //   // Date boundaries helper
// // // //   const getUTCBoundaries = useCallback((dateRange: string, startDate: string, endDate: string) => {
// // // //     const now = new Date();
// // // //     switch (dateRange) {
// // // //       case "today": {
// // // //         const start = new Date(now); start.setHours(0, 0, 0, 0);
// // // //         const end = new Date(now); end.setHours(23, 59, 59, 999);
// // // //         return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // //       }
// // // //       case "week": {
// // // //         const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0);
// // // //         const end = new Date(now); end.setHours(23, 59, 59, 999);
// // // //         return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // //       }
// // // //       case "month": {
// // // //         const start = new Date(now.getFullYear(), now.getMonth(), 1); start.setHours(0, 0, 0, 0);
// // // //         const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
// // // //         return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // //       }
// // // //       case "custom": {
// // // //         if (!startDate || !endDate) return null;
// // // //         const start = new Date(startDate); start.setHours(0, 0, 0, 0);
// // // //         const end = new Date(endDate); end.setHours(23, 59, 59, 999);
// // // //         return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // //       }
// // // //       default: return null;
// // // //     }
// // // //   }, []);

// // // //   // Fetch transactions
// // // //   const { data: response, isLoading, isFetching } = useQuery<AccountTransactionsPaginatedResponse>({
// // // //     queryKey: ["account-transactions", currentAccount?._id, committedSearch, filters.type, filters.dateRange, filters.startDate, filters.endDate, filters.currentPage, filters.pageSize],
// // // //     queryFn: async (): Promise<AccountTransactionsPaginatedResponse> => {
// // // //       const params = new URLSearchParams();
// // // //       params.append("accountId", currentAccount?._id);
// // // //       if (committedSearch) params.append("search", committedSearch);
// // // //       if (filters.type !== "all") params.append("type", filters.type);
// // // //       if (filters.dateRange !== "all") {
// // // //         const boundaries = getUTCBoundaries(filters.dateRange, filters.startDate, filters.endDate);
// // // //         if (boundaries) {
// // // //           params.append("startDate", boundaries.startDate);
// // // //           params.append("endDate", boundaries.endDate);
// // // //         }
// // // //       }
// // // //       params.append("page", filters.currentPage.toString());
// // // //       params.append("limit", filters.pageSize.toString());
// // // //       params.append("sortBy", "enteredAt");
// // // //       params.append("sortOrder", "desc");
// // // //       const res = await fetch(`/api/account-transactions?${params}`);
// // // //       if (!res.ok) throw new Error("Failed to fetch transactions");
// // // //       return res.json();
// // // //     },
// // // //     staleTime: 30 * 1000,
// // // //     placeholderData: (prev) => prev,
// // // //   });

// // // //   // Fetch summary
// // // //   const { data: summaryResponse } = useQuery<any>({
// // // //     queryKey: ["account-summary", currentAccount?._id],
// // // //     queryFn: async () => {
// // // //       const res = await fetch(`/api/account-transactions/summary?accountId=${currentAccount?._id}`);
// // // //       if (!res.ok) throw new Error("Failed to fetch summary");
// // // //       return res.json();
// // // //     },
// // // //     staleTime: 30 * 1000,
// // // //   });

// // // //   const transactions = response?.data?.transactions || [];
// // // //   const pagination = response?.pagination;
// // // //   const summary = summaryResponse?.data;

// // // //   // Handlers
// // // //   const handleSearch = useCallback(() => {
// // // //     setCommittedSearch(searchInput.trim());
// // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // //   }, [searchInput]);

// // // //   const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
// // // //     if (e.key === "Enter") handleSearch();
// // // //   }, [handleSearch]);

// // // //   const handleClearSearch = useCallback(() => {
// // // //     setSearchInput("");
// // // //     setCommittedSearch("");
// // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // //   }, []);

// // // //   const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
// // // //     setFilters((prev) => {
// // // //       if (key === "dateRange" && value === "custom") {
// // // //         const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
// // // //         const dateStr = yesterday.toISOString().split("T")[0];
// // // //         return { ...prev, dateRange: "custom" as FilterState["dateRange"], startDate: dateStr, endDate: dateStr, currentPage: 1 };
// // // //       }
// // // //       if (key === "dateRange" && value !== "custom") {
// // // //         return { ...prev, [key]: value, startDate: "", endDate: "", currentPage: 1 };
// // // //       }
// // // //       return { ...prev, [key]: value, ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}) };
// // // //     });
// // // //   }, []);

// // // //   const handleDeleteClick = useCallback((transaction: AccountTransaction) => {
// // // //     setSelectedTransaction(transaction);
// // // //     setShowDeleteModal(true);
// // // //   }, []);

// // // //   const handleDeleteConfirm = useCallback(() => {
// // // //     if (!selectedTransaction) return;
// // // //     deleteMutation.mutate({ id: selectedTransaction._id, accountId: currentAccount?._id }, {
// // // //       onSuccess: () => { setShowDeleteModal(false); setSelectedTransaction(null); },
// // // //     });
// // // //   }, [selectedTransaction, currentAccount?._id, deleteMutation]);

// // // //   const handlePageChange = useCallback((newPage: number) => {
// // // //     setFilters((prev) => ({ ...prev, currentPage: newPage }));
// // // //     window.scrollTo({ top: 0, behavior: "smooth" });
// // // //   }, []);

// // // //   const handlePageSizeChange = useCallback((newSize: string) => {
// // // //     setFilters((prev) => ({ ...prev, pageSize: parseInt(newSize), currentPage: 1 }));
// // // //   }, []);

// // // //   // Handle add transaction
// // // //   const handleAddTransaction = useCallback(() => {
// // // //     if (!currentAccount?._id) {
// // // //       toast.error("Please select an account first");
// // // //       return;
// // // //     }
// // // //     setShowAddModal(true);
// // // //   }, [currentAccount?._id]);

// // // //   const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
// // // //   const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
// // // //   const formatCurrency = (amount: number) => `₹${amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

// // // //   const getOwnerName = (): string => {
// // // //     if (typeof currentAccount?.ownerId === "string") return "";
// // // //     return (currentAccount?.ownerId as any)?.name || "";
// // // //   };

// // // //   const getOwnerUsername = (): string => {
// // // //     if (typeof currentAccount?.ownerId === "string") return "";
// // // //     const owner = currentAccount?.ownerId as any;
// // // //     return owner.username || owner.email?.split("@")[0] || "";
// // // //   };

// // // //   // Export
// // // //   const handleExport = useCallback(() => {
// // // //     try {
// // // //       setIsExporting(true);
// // // //       const headers = ["Date & Time", "Note", "Type", "Debit (−)", "Credit (+)", "Balance", "Bill URL"];
// // // //       const rows: string[] = [];
// // // //       transactions.forEach((txn) => {
// // // //         const dateStr = `${formatDate(txn.enteredAt)} ${formatTime(txn.enteredAt)}`;
// // // //         rows.push([dateStr, txn.note || "-", txn.type, txn.type === "DEBIT" ? txn.amount.toFixed(2) : "-", txn.type === "CREDIT" ? txn.amount.toFixed(2) : "-", txn.balanceAfter.toFixed(2), txn.billUrl || "-"].map((cell) => `"${cell}"`).join(","));
// // // //       });
// // // //       const csvContent = [headers.join(","), ...rows].join("\n");
// // // //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// // // //       const url = window.URL.createObjectURL(blob);
// // // //       const link = document.createElement("a");
// // // //       link.href = url;
// // // //       link.download = `${currentAccount?.name}-transactions-${new Date().toISOString().split("T")[0]}.csv`;
// // // //       document.body.appendChild(link);
// // // //       link.click();
// // // //       document.body.removeChild(link);
// // // //       window.URL.revokeObjectURL(url);
// // // //       toast.success("Transactions exported successfully!");
// // // //     } catch (error) {
// // // //       console.error("Export error:", error);
// // // //       toast.error("Failed to export transactions");
// // // //     } finally {
// // // //       setIsExporting(false);
// // // //     }
// // // //   }, [transactions, currentAccount?.name]);

// // // //   // Pagination
// // // //   const PaginationControls = useCallback(() => {
// // // //     if (!pagination) return null;
// // // //     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
// // // //     const currentPage = filters.currentPage;
// // // //     const getPageNumbers = (): number[] => {
// // // //       const maxVisible = 5; const pages: number[] = [];
// // // //       if (totalPages <= maxVisible) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
// // // //       else if (currentPage <= 3) { for (let i = 1; i <= maxVisible; i++) pages.push(i); }
// // // //       else if (currentPage >= totalPages - 2) { for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i); }
// // // //       else { for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i); }
// // // //       return pages;
// // // //     };
// // // //     return (
// // // //       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
// // // //         <div className="flex items-center space-x-2">
// // // //           <span className="text-sm text-gray-700">Showing {startIndex} to {endIndex} of {totalCount}</span>
// // // //           <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
// // // //             <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
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
// // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={!hasPreviousPage}><ChevronsLeft className="w-4 h-4" /></Button>
// // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={!hasPreviousPage}><ChevronLeft className="w-4 h-4" /></Button>
// // // //           <div className="flex items-center space-x-1">
// // // //             {getPageNumbers().map((pageNumber) => (<Button key={pageNumber} variant={currentPage === pageNumber ? "default" : "outline"} size="sm" onClick={() => handlePageChange(pageNumber)} className="w-8 h-8">{pageNumber}</Button>))}
// // // //           </div>
// // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={!hasNextPage}><ChevronRight className="w-4 h-4" /></Button>
// // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={!hasNextPage}><ChevronsRight className="w-4 h-4" /></Button>
// // // //         </div>
// // // //       </div>
// // // //     );
// // // //   }, [pagination, filters.currentPage, filters.pageSize, handlePageChange, handlePageSizeChange]);

// // // //   const showSkeleton = isLoading || isFetching;

// // // //   return (
// // // //     <div className="space-y-6">
// // // //       {/* Header */}
// // // //       <div className="flex justify-between items-center">
// // // //         <div className="flex items-center gap-4">
// // // //           <Button variant="ghost" onClick={onBack} className="p-2">
// // // //             <ArrowLeft className="w-5 h-5" />
// // // //           </Button>
// // // //           <div>
// // // //             <h2 className="text-2xl font-bold text-gray-900">{currentAccount?.name}</h2>
// // // //             {isMaster && getOwnerUsername() && (
// // // //               <p className="text-sm text-blue-600">@{getOwnerUsername()} - {getOwnerName()}</p>
// // // //             )}
// // // //             {currentAccount?.description && <p className="text-sm text-gray-500">{currentAccount?.description}</p>}
// // // //           </div>
// // // //         </div>
// // // //         <div className="flex gap-2">
// // // //           <Button onClick={handleExport} variant="outline" disabled={isExporting || transactions.length === 0}>
// // // //             {isExporting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting...</>) : (<><Download className="w-4 h-4 mr-2" />Export</>)}
// // // //           </Button>
// // // //           <Button onClick={handleAddTransaction} className="bg-blue-500 hover:bg-blue-600">
// // // //             <Plus className="w-4 h-4 mr-2" />
// // // //             Add Entry
// // // //           </Button>
// // // //         </div>
// // // //       </div>

// // // //       {/* Master: User & Account Selector */}
// // // //       {isMaster && (
// // // //         <Card>
// // // //           <CardContent className="p-4">
// // // //             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
// // // //               {/* Select User */}
// // // //               <div>
// // // //                 <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
// // // //                   <Users className="w-4 h-4" />
// // // //                   Select User
// // // //                 </Label>
// // // //                 <Select value={selectedUserId} onValueChange={(value) => {
// // // //                   setSelectedUserId(value);
// // // //                   setSelectedAccountId(""); // Reset account when user changes
// // // //                 }}>
// // // //                   <SelectTrigger><SelectValue placeholder="All Users" /></SelectTrigger>
// // // //                   <SelectContent>
// // // //                     <SelectItem value="all">All Users</SelectItem>
// // // //                     {users.map((user) => (
// // // //                       <SelectItem key={user._id} value={user._id}>
// // // //                         @{user.username || user.email?.split("@")[0]} - {user.name}
// // // //                       </SelectItem>
// // // //                     ))}
// // // //                   </SelectContent>
// // // //                 </Select>
// // // //               </div>

// // // //               {/* Select Account */}
// // // //               <div>
// // // //                 <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
// // // //                   <Wallet className="w-4 h-4" />
// // // //                   Select Account
// // // //                 </Label>
// // // //                 <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
// // // //                   <SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger>
// // // //                   <SelectContent>
// // // //                     {accountsList.map((acc) => (
// // // //                       <SelectItem key={acc._id} value={acc._id}>
// // // //                         {acc.name} ({formatCurrency(acc.currentBalance)})
// // // //                       </SelectItem>
// // // //                     ))}
// // // //                   </SelectContent>
// // // //                 </Select>
// // // //               </div>
// // // //             </div>
// // // //           </CardContent>
// // // //         </Card>
// // // //       )}

// // // //       {/* Summary Cards */}
// // // //       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // // //         <Card>
// // // //           <CardContent className="p-4">
// // // //             <div className="flex items-center justify-between">
// // // //               <div>
// // // //                 <p className="text-sm text-gray-500">Current Balance</p>
// // // //                 <p className={`text-2xl font-bold ${currentAccount?.currentBalance >= 0 ? "text-blue-600" : "text-red-600"}`}>
// // // //                   {formatCurrency(currentAccount?.currentBalance)}
// // // //                 </p>
// // // //               </div>
// // // //               <div className="p-3 bg-blue-100 rounded-full"><FileText className="w-6 h-6 text-blue-600" /></div>
// // // //             </div>
// // // //           </CardContent>
// // // //         </Card>
// // // //         <Card>
// // // //           <CardContent className="p-4">
// // // //             <div className="flex items-center justify-between">
// // // //               <div>
// // // //                 <p className="text-sm text-gray-500">Total Credit</p>
// // // //                 <p className="text-2xl font-bold text-green-600">{formatCurrency(summary?.totalCredit || 0)}</p>
// // // //               </div>
// // // //               <div className="p-3 bg-green-100 rounded-full"><TrendingUp className="w-6 h-6 text-green-600" /></div>
// // // //             </div>
// // // //           </CardContent>
// // // //         </Card>
// // // //         <Card>
// // // //           <CardContent className="p-4">
// // // //             <div className="flex items-center justify-between">
// // // //               <div>
// // // //                 <p className="text-sm text-gray-500">Total Debit</p>
// // // //                 <p className="text-2xl font-bold text-red-600">{formatCurrency(summary?.totalDebit || 0)}</p>
// // // //               </div>
// // // //               <div className="p-3 bg-red-100 rounded-full"><TrendingDown className="w-6 h-6 text-red-600" /></div>
// // // //             </div>
// // // //           </CardContent>
// // // //         </Card>
// // // //         <Card>
// // // //           <CardContent className="p-4">
// // // //             <div className="flex items-center justify-between">
// // // //               <div>
// // // //                 <p className="text-sm text-gray-500">Total Entries</p>
// // // //                 <p className="text-2xl font-bold text-gray-900">{summary?.totalEntries || 0}</p>
// // // //               </div>
// // // //               <div className="p-3 bg-gray-100 rounded-full"><FileText className="w-6 h-6 text-gray-600" /></div>
// // // //             </div>
// // // //           </CardContent>
// // // //         </Card>
// // // //       </div>

// // // //       {/* Filters */}
// // // //       <Card>
// // // //         <CardContent className="p-6">
// // // //           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
// // // //               <div className="flex gap-2">
// // // //                 <div className="relative flex-1">
// // // //                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // // //                   <Input placeholder="Search notes..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleSearchKeyDown} className="pl-10 pr-8" />
// // // //                   {searchInput && (<button onClick={handleClearSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600" type="button"><X className="w-4 h-4" /></button>)}
// // // //                 </div>
// // // //                 <Button onClick={handleSearch} disabled={isFetching} size="icon" className="shrink-0">
// // // //                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// // // //                 </Button>
// // // //               </div>
// // // //             </div>
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Type</Label>
// // // //               <Select value={filters.type} onValueChange={(value: TransactionTypeFilter) => updateFilter("type", value)}>
// // // //                 <SelectTrigger><SelectValue /></SelectTrigger>
// // // //                 <SelectContent>
// // // //                   <SelectItem value="all">All Types</SelectItem>
// // // //                   <SelectItem value="CREDIT">Credit Only</SelectItem>
// // // //                   <SelectItem value="DEBIT">Debit Only</SelectItem>
// // // //                 </SelectContent>
// // // //               </Select>
// // // //             </div>
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Date Range</Label>
// // // //               <Select value={filters.dateRange} onValueChange={(value: DateRangeType) => updateFilter("dateRange", value)}>
// // // //                 <SelectTrigger><SelectValue /></SelectTrigger>
// // // //                 <SelectContent>
// // // //                   <SelectItem value="today">Today</SelectItem>
// // // //                   <SelectItem value="week">This Week</SelectItem>
// // // //                   <SelectItem value="month">This Month</SelectItem>
// // // //                   <SelectItem value="custom">Custom Range</SelectItem>
// // // //                   <SelectItem value="all">All Time</SelectItem>
// // // //                 </SelectContent>
// // // //               </Select>
// // // //             </div>
// // // //             <div></div>
// // // //             {filters.dateRange === "custom" && (
// // // //               <div className="md:col-span-4">
// // // //                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
// // // //                   <div>
// // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Calendar className="w-4 h-4" />Start Date</Label>
// // // //                     <Input type="date" value={filters.startDate} onChange={(e) => updateFilter("startDate", e.target.value)} max={filters.endDate || undefined} />
// // // //                   </div>
// // // //                   <div>
// // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Calendar className="w-4 h-4" />End Date</Label>
// // // //                     <Input type="date" value={filters.endDate} onChange={(e) => updateFilter("endDate", e.target.value)} min={filters.startDate || undefined} />
// // // //                   </div>
// // // //                 </div>
// // // //               </div>
// // // //             )}
// // // //           </div>
// // // //         </CardContent>
// // // //       </Card>

// // // //       {/* Table */}
// // // //       <Card>
// // // //         <CardHeader>
// // // //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// // // //             Transaction Ledger
// // // //             {pagination && <span className="ml-2 text-sm font-normal text-gray-500">({pagination.totalCount} entries)</span>}
// // // //             {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />}
// // // //           </CardTitle>
// // // //         </CardHeader>
// // // //         <CardContent className="p-0">
// // // //           <div className="overflow-x-auto">
// // // //             <table className="w-full">
// // // //               <thead className="bg-gray-50">
// // // //                 <tr>
// // // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
// // // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
// // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Debit (−)</th>
// // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Credit (+)</th>
// // // //                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
// // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Bill</th>
// // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
// // // //                 </tr>
// // // //               </thead>
// // // //               {showSkeleton ? (
// // // //                 <TableSkeleton rows={filters.pageSize} />
// // // //               ) : (
// // // //                 <tbody className="bg-white divide-y divide-gray-200">
// // // //                   {transactions.length === 0 ? (
// // // //                     <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No transactions found. Add your first entry to start tracking.</td></tr>
// // // //                   ) : (
// // // //                     transactions.map((txn) => (
// // // //                       <tr key={txn._id} className="hover:bg-gray-50">
// // // //                         <td className="px-6 py-4 whitespace-nowrap">
// // // //                           <div>
// // // //                             <p className="text-sm font-medium text-gray-900">{formatDate(txn.enteredAt)}</p>
// // // //                             <p className="text-xs text-gray-500">{formatTime(txn.enteredAt)}</p>
// // // //                           </div>
// // // //                         </td>
// // // //                         <td className="px-6 py-4"><p className="text-sm text-gray-900 max-w-xs truncate">{txn.note || "—"}</p></td>
// // // //                         <td className="px-6 py-4 text-center">
// // // //                           {txn.type === "DEBIT" ? (<span className="text-sm font-medium text-red-600">{formatCurrency(txn.amount)}</span>) : (<span className="text-sm text-gray-400">—</span>)}
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-center">
// // // //                           {txn.type === "CREDIT" ? (<span className="text-sm font-medium text-green-600">{formatCurrency(txn.amount)}</span>) : (<span className="text-sm text-gray-400">—</span>)}
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-right">
// // // //                           <span className={`text-sm font-semibold ${txn.balanceAfter >= 0 ? "text-blue-600" : "text-red-600"}`}>{formatCurrency(txn.balanceAfter)}</span>
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-center">
// // // //                           {txn.billUrl ? (<a href={txn.billUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600" title="View Bill"><ExternalLink className="w-4 h-4" /></a>) : (<span className="text-sm text-gray-400">—</span>)}
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-center">
// // // //                           <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(txn)} className="text-red-500 hover:text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="w-4 h-4" /></Button>
// // // //                         </td>
// // // //                       </tr>
// // // //                     ))
// // // //                   )}
// // // //                 </tbody>
// // // //               )}
// // // //             </table>
// // // //           </div>
// // // //           <PaginationControls />
// // // //         </CardContent>
// // // //       </Card>

// // // //       {/* Modals */}
// // // //       <AddTransactionModal 
// // // //         open={showAddModal} 
// // // //         onOpenChange={setShowAddModal} 
// // // //         account={currentAccount} 
// // // //       />

// // // //       <ConfirmDialog
// // // //         open={showDeleteModal}
// // // //         onOpenChange={setShowDeleteModal}
// // // //         onConfirm={handleDeleteConfirm}
// // // //         title="Delete Transaction"
// // // //         description="This will affect the running balance. This action cannot be undone."
// // // //         confirmLabel="Delete"
// // // //         icon={Trash2}
// // // //         variant="destructive"
// // // //         isLoading={deleteMutation.isPending}
// // // //         loadingLabel="Deleting..."
// // // //       />
// // // //     </div>
// // // //   );
// // // // }




// // // // // // components/tabs/account-transactions-tab.tsx
// // // // // "use client";

// // // // // import { useState, useCallback } from "react";
// // // // // import { useQuery } from "@tanstack/react-query";
// // // // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // import { Input } from "@/components/ui/input";
// // // // // import { Label } from "@/components/ui/label";
// // // // // import { Button } from "@/components/ui/button";
// // // // // import {
// // // // //   Select,
// // // // //   SelectContent,
// // // // //   SelectItem,
// // // // //   SelectTrigger,
// // // // //   SelectValue,
// // // // // } from "@/components/ui/select";
// // // // // import {
// // // // //   Search,
// // // // //   Plus,
// // // // //   Trash2,
// // // // //   Loader2,
// // // // //   X,
// // // // //   ChevronLeft,
// // // // //   ChevronRight,
// // // // //   ChevronsLeft,
// // // // //   ChevronsRight,
// // // // //   Calendar,
// // // // //   Download,
// // // // //   ArrowLeft,
// // // // //   TrendingUp,
// // // // //   TrendingDown,
// // // // //   ExternalLink,
// // // // //   FileText,
// // // // // } from "lucide-react";
// // // // // import { toast } from "sonner";
// // // // // import { useDeleteAccountTransaction } from "@/hooks/use-account-transaction-mutations";
// // // // // import AddTransactionModal from "@/components/modals/add-transaction-modal";
// // // // // import ConfirmDialog from "@/components/dialogs/ConfirmDialog";
// // // // // import type { Account } from "@/types/account";
// // // // // import type {
// // // // //   AccountTransaction,
// // // // //   AccountTransactionsPaginatedResponse,
// // // // // //   any,
// // // // // } from "@/types/accountTransaction";

// // // // // type DateRangeType = "today" | "week" | "month" | "custom" | "all";
// // // // // type TransactionTypeFilter = "all" | "CREDIT" | "DEBIT";

// // // // // interface FilterState {
// // // // //   type: TransactionTypeFilter;
// // // // //   dateRange: DateRangeType;
// // // // //   startDate: string;
// // // // //   endDate: string;
// // // // //   currentPage: number;
// // // // //   pageSize: number;
// // // // // }

// // // // // // Skeleton
// // // // // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// // // // //   <tbody className="bg-white divide-y divide-gray-200">
// // // // //     {Array.from({ length: rows }).map((_, index) => (
// // // // //       <tr key={index} className="animate-pulse">
// // // // //         <td className="px-6 py-4">
// // // // //           <div className="space-y-1">
// // // // //             <div className="h-4 bg-gray-200 rounded w-24"></div>
// // // // //             <div className="h-3 bg-gray-200 rounded w-16"></div>
// // // // //           </div>
// // // // //         </td>
// // // // //         <td className="px-6 py-4">
// // // // //           <div className="h-4 bg-gray-200 rounded w-48"></div>
// // // // //         </td>
// // // // //         <td className="px-6 py-4 text-center">
// // // // //           <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
// // // // //         </td>
// // // // //         <td className="px-6 py-4 text-center">
// // // // //           <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
// // // // //         </td>
// // // // //         <td className="px-6 py-4 text-right">
// // // // //           <div className="h-5 bg-gray-200 rounded w-20 ml-auto"></div>
// // // // //         </td>
// // // // //         <td className="px-6 py-4 text-center">
// // // // //           <div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div>
// // // // //         </td>
// // // // //         <td className="px-6 py-4 text-center">
// // // // //           <div className="h-8 w-8 bg-gray-200 rounded mx-auto"></div>
// // // // //         </td>
// // // // //       </tr>
// // // // //     ))}
// // // // //   </tbody>
// // // // // );

// // // // // interface AccountTransactionsTabProps {
// // // // //   account: Account;
// // // // //   onBack: () => void;
// // // // //   isMaster?: boolean;
// // // // // }

// // // // // export default function AccountTransactionsTab({
// // // // //   account,
// // // // //   onBack,
// // // // //   isMaster = false,
// // // // // }: AccountTransactionsTabProps) {
// // // // //   const deleteMutation = useDeleteAccountTransaction();

// // // // //   const [searchInput, setSearchInput] = useState("");
// // // // //   const [committedSearch, setCommittedSearch] = useState("");

// // // // //   const [filters, setFilters] = useState<FilterState>({
// // // // //     type: "all",
// // // // //     dateRange: "all",
// // // // //     startDate: "",
// // // // //     endDate: "",
// // // // //     currentPage: 1,
// // // // //     pageSize: 20,
// // // // //   });

// // // // //   const [showAddModal, setShowAddModal] = useState(false);
// // // // //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// // // // //   const [selectedTransaction, setSelectedTransaction] = useState<AccountTransaction | null>(
// // // // //     null
// // // // //   );

// // // // //   const [isExporting, setIsExporting] = useState(false);

// // // // //   // Date boundaries helper
// // // // //   const getUTCBoundaries = useCallback(
// // // // //     (dateRange: string, startDate: string, endDate: string) => {
// // // // //       const now = new Date();

// // // // //       switch (dateRange) {
// // // // //         case "today": {
// // // // //           const start = new Date(now);
// // // // //           start.setHours(0, 0, 0, 0);
// // // // //           const end = new Date(now);
// // // // //           end.setHours(23, 59, 59, 999);
// // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // //         }
// // // // //         case "week": {
// // // // //           const start = new Date(now);
// // // // //           start.setDate(now.getDate() - now.getDay());
// // // // //           start.setHours(0, 0, 0, 0);
// // // // //           const end = new Date(now);
// // // // //           end.setHours(23, 59, 59, 999);
// // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // //         }
// // // // //         case "month": {
// // // // //           const start = new Date(now.getFullYear(), now.getMonth(), 1);
// // // // //           start.setHours(0, 0, 0, 0);
// // // // //           const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
// // // // //           end.setHours(23, 59, 59, 999);
// // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // //         }
// // // // //         case "custom": {
// // // // //           if (!startDate || !endDate) return null;
// // // // //           const start = new Date(startDate);
// // // // //           start.setHours(0, 0, 0, 0);
// // // // //           const end = new Date(endDate);
// // // // //           end.setHours(23, 59, 59, 999);
// // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // //         }
// // // // //         default:
// // // // //           return null;
// // // // //       }
// // // // //     },
// // // // //     []
// // // // //   );

// // // // //   // Fetch transactions
// // // // //   const {
// // // // //     data: response,
// // // // //     isLoading,
// // // // //     isFetching,
// // // // //   } = useQuery<AccountTransactionsPaginatedResponse>({
// // // // //     queryKey: [
// // // // //       "account-transactions",
// // // // //       account?._id,
// // // // //       committedSearch,
// // // // //       filters.type,
// // // // //       filters.dateRange,
// // // // //       filters.startDate,
// // // // //       filters.endDate,
// // // // //       filters.currentPage,
// // // // //       filters.pageSize,
// // // // //     ],
// // // // //     queryFn: async (): Promise<AccountTransactionsPaginatedResponse> => {
// // // // //       const params = new URLSearchParams();
// // // // //       params.append("accountId", account?._id);

// // // // //       if (committedSearch) params.append("search", committedSearch);
// // // // //       if (filters.type !== "all") params.append("type", filters.type);

// // // // //       if (filters.dateRange !== "all") {
// // // // //         const boundaries = getUTCBoundaries(
// // // // //           filters.dateRange,
// // // // //           filters.startDate,
// // // // //           filters.endDate
// // // // //         );
// // // // //         if (boundaries) {
// // // // //           params.append("startDate", boundaries.startDate);
// // // // //           params.append("endDate", boundaries.endDate);
// // // // //         }
// // // // //       }

// // // // //       params.append("page", filters.currentPage.toString());
// // // // //       params.append("limit", filters.pageSize.toString());
// // // // //       params.append("sortBy", "enteredAt");
// // // // //       params.append("sortOrder", "desc");

// // // // //       const res = await fetch(`/api/account-transactions?${params}`);
// // // // //       if (!res.ok) throw new Error("Failed to fetch transactions");
// // // // //       return res.json();
// // // // //     },
// // // // //     staleTime: 30 * 1000,
// // // // //     placeholderData: (prev) => prev,
// // // // //   });

// // // // //   // Fetch summary
// // // // //   const { data: summaryResponse } = useQuery<any>({
// // // // //     queryKey: ["account-summary", account?._id],
// // // // //     queryFn: async () => {
// // // // //       const res = await fetch(`/api/account-transactions/summary?accountId=${account?._id}`);
// // // // //       if (!res.ok) throw new Error("Failed to fetch summary");
// // // // //       return res.json();
// // // // //     },
// // // // //     staleTime: 30 * 1000,
// // // // //   });

// // // // //   const transactions = response?.data?.transactions || [];
// // // // //   const pagination = response?.pagination;
// // // // //   const summary = summaryResponse?.data;

// // // // //   // Handlers
// // // // //   const handleSearch = useCallback(() => {
// // // // //     setCommittedSearch(searchInput.trim());
// // // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // // //   }, [searchInput]);

// // // // //   const handleSearchKeyDown = useCallback(
// // // // //     (e: React.KeyboardEvent<HTMLInputElement>) => {
// // // // //       if (e.key === "Enter") handleSearch();
// // // // //     },
// // // // //     [handleSearch]
// // // // //   );

// // // // //   const handleClearSearch = useCallback(() => {
// // // // //     setSearchInput("");
// // // // //     setCommittedSearch("");
// // // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // // //   }, []);

// // // // //   const updateFilter = useCallback(
// // // // //     <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
// // // // //       setFilters((prev) => {
// // // // //         if (key === "dateRange" && value === "custom") {
// // // // //           const yesterday = new Date();
// // // // //           yesterday.setDate(yesterday.getDate() - 1);
// // // // //           const dateStr = yesterday.toISOString().split("T")[0];
// // // // //           return {
// // // // //             ...prev,
// // // // //             dateRange: "custom" as FilterState["dateRange"],
// // // // //             startDate: dateStr,
// // // // //             endDate: dateStr,
// // // // //             currentPage: 1,
// // // // //           };
// // // // //         }

// // // // //         if (key === "dateRange" && value !== "custom") {
// // // // //           return {
// // // // //             ...prev,
// // // // //             [key]: value,
// // // // //             startDate: "",
// // // // //             endDate: "",
// // // // //             currentPage: 1,
// // // // //           };
// // // // //         }

// // // // //         return {
// // // // //           ...prev,
// // // // //           [key]: value,
// // // // //           ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
// // // // //         };
// // // // //       });
// // // // //     },
// // // // //     []
// // // // //   );

// // // // //   const handleDeleteClick = useCallback((transaction: AccountTransaction) => {
// // // // //     setSelectedTransaction(transaction);
// // // // //     setShowDeleteModal(true);
// // // // //   }, []);

// // // // //   const handleDeleteConfirm = useCallback(() => {
// // // // //     if (!selectedTransaction) return;
// // // // //     deleteMutation.mutate(
// // // // //       { id: selectedTransaction._id, accountId: account?._id },
// // // // //       {
// // // // //         onSuccess: () => {
// // // // //           setShowDeleteModal(false);
// // // // //           setSelectedTransaction(null);
// // // // //         },
// // // // //       }
// // // // //     );
// // // // //   }, [selectedTransaction, account?._id, deleteMutation]);

// // // // //   const handlePageChange = useCallback((newPage: number) => {
// // // // //     setFilters((prev) => ({ ...prev, currentPage: newPage }));
// // // // //     window.scrollTo({ top: 0, behavior: "smooth" });
// // // // //   }, []);

// // // // //   const handlePageSizeChange = useCallback((newSize: string) => {
// // // // //     setFilters((prev) => ({ ...prev, pageSize: parseInt(newSize), currentPage: 1 }));
// // // // //   }, []);

// // // // //   const formatDate = (dateString: string) =>
// // // // //     new Date(dateString).toLocaleDateString("en-GB", {
// // // // //       day: "2-digit",
// // // // //       month: "short",
// // // // //       year: "numeric",
// // // // //     });

// // // // //   const formatTime = (dateString: string) =>
// // // // //     new Date(dateString).toLocaleTimeString("en-GB", {
// // // // //       hour: "2-digit",
// // // // //       minute: "2-digit",
// // // // //     });

// // // // //   const formatCurrency = (amount: number) =>
// // // // //     `₹${amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

// // // // //   const getOwnerName = (): string => {
// // // // //     if (typeof account.ownerId === "string") return "";
// // // // //     return (account.ownerId as any)?.name || "";
// // // // //   };

// // // // //   // Export
// // // // //   const handleExport = useCallback(() => {
// // // // //     try {
// // // // //       setIsExporting(true);

// // // // //       const headers = ["Date & Time", "Note", "Type", "Debit (−)", "Credit (+)", "Balance", "Bill URL"];
// // // // //       const rows: string[] = [];

// // // // //       transactions.forEach((txn) => {
// // // // //         const dateStr = `${formatDate(txn.enteredAt)} ${formatTime(txn.enteredAt)}`;

// // // // //         rows.push(
// // // // //           [
// // // // //             dateStr,
// // // // //             txn.note || "-",
// // // // //             txn.type,
// // // // //             txn.type === "DEBIT" ? txn.amount.toFixed(2) : "-",
// // // // //             txn.type === "CREDIT" ? txn.amount.toFixed(2) : "-",
// // // // //             txn.balanceAfter.toFixed(2),
// // // // //             txn.billUrl || "-",
// // // // //           ]
// // // // //             .map((cell) => `"${cell}"`)
// // // // //             .join(",")
// // // // //         );
// // // // //       });

// // // // //       const csvContent = [headers.join(","), ...rows].join("\n");
// // // // //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// // // // //       const url = window.URL.createObjectURL(blob);
// // // // //       const link = document.createElement("a");
// // // // //       link.href = url;
// // // // //       link.download = `${account?.name}-transactions-${new Date().toISOString().split("T")[0]}.csv`;
// // // // //       document.body.appendChild(link);
// // // // //       link.click();
// // // // //       document.body.removeChild(link);
// // // // //       window.URL.revokeObjectURL(url);

// // // // //       toast.success("Transactions exported successfully!");
// // // // //     } catch (error) {
// // // // //       console.error("Export error:", error);
// // // // //       toast.error("Failed to export transactions");
// // // // //     } finally {
// // // // //       setIsExporting(false);
// // // // //     }
// // // // //   }, [transactions, account?.name]);

// // // // //   // Pagination
// // // // //   const PaginationControls = useCallback(() => {
// // // // //     if (!pagination) return null;

// // // // //     const {
// // // // //       totalPages,
// // // // //       totalCount,
// // // // //       startIndex,
// // // // //       endIndex,
// // // // //       hasNextPage,
// // // // //       hasPreviousPage,
// // // // //     } = pagination;
// // // // //     const currentPage = filters.currentPage;

// // // // //     const getPageNumbers = (): number[] => {
// // // // //       const maxVisible = 5;
// // // // //       const pages: number[] = [];
// // // // //       if (totalPages <= maxVisible) {
// // // // //         for (let i = 1; i <= totalPages; i++) pages.push(i);
// // // // //       } else if (currentPage <= 3) {
// // // // //         for (let i = 1; i <= maxVisible; i++) pages.push(i);
// // // // //       } else if (currentPage >= totalPages - 2) {
// // // // //         for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
// // // // //       } else {
// // // // //         for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
// // // // //       }
// // // // //       return pages;
// // // // //     };

// // // // //     return (
// // // // //       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
// // // // //         <div className="flex items-center space-x-2">
// // // // //           <span className="text-sm text-gray-700">
// // // // //             Showing {startIndex} to {endIndex} of {totalCount} entries
// // // // //           </span>
// // // // //           <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
// // // // //             <SelectTrigger className="w-20">
// // // // //               <SelectValue />
// // // // //             </SelectTrigger>
// // // // //             <SelectContent>
// // // // //               <SelectItem value="10">10</SelectItem>
// // // // //               <SelectItem value="20">20</SelectItem>
// // // // //               <SelectItem value="50">50</SelectItem>
// // // // //               <SelectItem value="100">100</SelectItem>
// // // // //             </SelectContent>
// // // // //           </Select>
// // // // //           <span className="text-sm text-gray-700">per page</span>
// // // // //         </div>
// // // // //         <div className="flex items-center space-x-2">
// // // // //           <Button
// // // // //             variant="outline"
// // // // //             size="sm"
// // // // //             onClick={() => handlePageChange(1)}
// // // // //             disabled={!hasPreviousPage}
// // // // //           >
// // // // //             <ChevronsLeft className="w-4 h-4" />
// // // // //           </Button>
// // // // //           <Button
// // // // //             variant="outline"
// // // // //             size="sm"
// // // // //             onClick={() => handlePageChange(currentPage - 1)}
// // // // //             disabled={!hasPreviousPage}
// // // // //           >
// // // // //             <ChevronLeft className="w-4 h-4" />
// // // // //           </Button>
// // // // //           <div className="flex items-center space-x-1">
// // // // //             {getPageNumbers().map((pageNumber) => (
// // // // //               <Button
// // // // //                 key={pageNumber}
// // // // //                 variant={currentPage === pageNumber ? "default" : "outline"}
// // // // //                 size="sm"
// // // // //                 onClick={() => handlePageChange(pageNumber)}
// // // // //                 className="w-8 h-8"
// // // // //               >
// // // // //                 {pageNumber}
// // // // //               </Button>
// // // // //             ))}
// // // // //           </div>
// // // // //           <Button
// // // // //             variant="outline"
// // // // //             size="sm"
// // // // //             onClick={() => handlePageChange(currentPage + 1)}
// // // // //             disabled={!hasNextPage}
// // // // //           >
// // // // //             <ChevronRight className="w-4 h-4" />
// // // // //           </Button>
// // // // //           <Button
// // // // //             variant="outline"
// // // // //             size="sm"
// // // // //             onClick={() => handlePageChange(totalPages)}
// // // // //             disabled={!hasNextPage}
// // // // //           >
// // // // //             <ChevronsRight className="w-4 h-4" />
// // // // //           </Button>
// // // // //         </div>
// // // // //       </div>
// // // // //     );
// // // // //   }, [pagination, filters.currentPage, filters.pageSize, handlePageChange, handlePageSizeChange]);

// // // // //   const showSkeleton = isLoading || isFetching;

// // // // //   return (
// // // // //     <div className="space-y-6">
// // // // //       {/* Header */}
// // // // //       <div className="flex justify-between items-center">
// // // // //         <div className="flex items-center gap-4">
// // // // //           <Button variant="ghost" onClick={onBack} className="p-2">
// // // // //             <ArrowLeft className="w-5 h-5" />
// // // // //           </Button>
// // // // //           <div>
// // // // //             <h2 className="text-2xl font-bold text-gray-900">{account?.name}</h2>
// // // // //             {isMaster && getOwnerName() && (
// // // // //               <p className="text-sm text-blue-600">Owner: {getOwnerName()}</p>
// // // // //             )}
// // // // //             {account?.description && (
// // // // //               <p className="text-sm text-gray-500">{account.description}</p>
// // // // //             )}
// // // // //           </div>
// // // // //         </div>
// // // // //         <div className="flex gap-2">
// // // // //           <Button
// // // // //             onClick={handleExport}
// // // // //             variant="outline"
// // // // //             disabled={isExporting || transactions.length === 0}
// // // // //           >
// // // // //             {isExporting ? (
// // // // //               <>
// // // // //                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
// // // // //                 Exporting...
// // // // //               </>
// // // // //             ) : (
// // // // //               <>
// // // // //                 <Download className="w-4 h-4 mr-2" />
// // // // //                 Export
// // // // //               </>
// // // // //             )}
// // // // //           </Button>
// // // // //           <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600">
// // // // //             <Plus className="w-4 h-4 mr-2" />
// // // // //             Add Entry
// // // // //           </Button>
// // // // //         </div>
// // // // //       </div>

// // // // //       {/* Summary Cards */}
// // // // //       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // // // //         <Card>
// // // // //           <CardContent className="p-4">
// // // // //             <div className="flex items-center justify-between">
// // // // //               <div>
// // // // //                 <p className="text-sm text-gray-500">Current Balance</p>
// // // // //                 <p
// // // // //                   className={`text-2xl font-bold ${
// // // // //                     account?.currentBalance >= 0 ? "text-blue-600" : "text-red-600"
// // // // //                   }`}
// // // // //                 >
// // // // //                   {formatCurrency(account?.currentBalance)}
// // // // //                 </p>
// // // // //               </div>
// // // // //               <div className="p-3 bg-blue-100 rounded-full">
// // // // //                 <FileText className="w-6 h-6 text-blue-600" />
// // // // //               </div>
// // // // //             </div>
// // // // //           </CardContent>
// // // // //         </Card>

// // // // //         <Card>
// // // // //           <CardContent className="p-4">
// // // // //             <div className="flex items-center justify-between">
// // // // //               <div>
// // // // //                 <p className="text-sm text-gray-500">Total Credit</p>
// // // // //                 <p className="text-2xl font-bold text-green-600">
// // // // //                   {formatCurrency(summary?.totalCredit || 0)}
// // // // //                 </p>
// // // // //               </div>
// // // // //               <div className="p-3 bg-green-100 rounded-full">
// // // // //                 <TrendingUp className="w-6 h-6 text-green-600" />
// // // // //               </div>
// // // // //             </div>
// // // // //           </CardContent>
// // // // //         </Card>

// // // // //         <Card>
// // // // //           <CardContent className="p-4">
// // // // //             <div className="flex items-center justify-between">
// // // // //               <div>
// // // // //                 <p className="text-sm text-gray-500">Total Debit</p>
// // // // //                 <p className="text-2xl font-bold text-red-600">
// // // // //                   {formatCurrency(summary?.totalDebit || 0)}
// // // // //                 </p>
// // // // //               </div>
// // // // //               <div className="p-3 bg-red-100 rounded-full">
// // // // //                 <TrendingDown className="w-6 h-6 text-red-600" />
// // // // //               </div>
// // // // //             </div>
// // // // //           </CardContent>
// // // // //         </Card>

// // // // //         <Card>
// // // // //           <CardContent className="p-4">
// // // // //             <div className="flex items-center justify-between">
// // // // //               <div>
// // // // //                 <p className="text-sm text-gray-500">Total Entries</p>
// // // // //                 <p className="text-2xl font-bold text-gray-900">{summary?.totalEntries || 0}</p>
// // // // //               </div>
// // // // //               <div className="p-3 bg-gray-100 rounded-full">
// // // // //                 <FileText className="w-6 h-6 text-gray-600" />
// // // // //               </div>
// // // // //             </div>
// // // // //           </CardContent>
// // // // //         </Card>
// // // // //       </div>

// // // // //       {/* Filters */}
// // // // //       <Card>
// // // // //         <CardContent className="p-6">
// // // // //           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // // // //             {/* Search */}
// // // // //             <div>
// // // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
// // // // //               <div className="flex gap-2">
// // // // //                 <div className="relative flex-1">
// // // // //                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // // // //                   <Input
// // // // //                     placeholder="Search notes..."
// // // // //                     value={searchInput}
// // // // //                     onChange={(e) => setSearchInput(e.target.value)}
// // // // //                     onKeyDown={handleSearchKeyDown}
// // // // //                     className="pl-10 pr-8"
// // // // //                   />
// // // // //                   {searchInput && (
// // // // //                     <button
// // // // //                       onClick={handleClearSearch}
// // // // //                       className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
// // // // //                       type="button"
// // // // //                     >
// // // // //                       <X className="w-4 h-4" />
// // // // //                     </button>
// // // // //                   )}
// // // // //                 </div>
// // // // //                 <Button onClick={handleSearch} disabled={isFetching} size="icon" className="shrink-0">
// // // // //                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// // // // //                 </Button>
// // // // //               </div>
// // // // //             </div>

// // // // //             {/* Type Filter */}
// // // // //             <div>
// // // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Type</Label>
// // // // //               <Select
// // // // //                 value={filters.type}
// // // // //                 onValueChange={(value: TransactionTypeFilter) => updateFilter("type", value)}
// // // // //               >
// // // // //                 <SelectTrigger>
// // // // //                   <SelectValue />
// // // // //                 </SelectTrigger>
// // // // //                 <SelectContent>
// // // // //                   <SelectItem value="all">All Types</SelectItem>
// // // // //                   <SelectItem value="CREDIT">Credit Only</SelectItem>
// // // // //                   <SelectItem value="DEBIT">Debit Only</SelectItem>
// // // // //                 </SelectContent>
// // // // //               </Select>
// // // // //             </div>

// // // // //             {/* Date Range */}
// // // // //             <div>
// // // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Date Range</Label>
// // // // //               <Select
// // // // //                 value={filters.dateRange}
// // // // //                 onValueChange={(value: DateRangeType) => updateFilter("dateRange", value)}
// // // // //               >
// // // // //                 <SelectTrigger>
// // // // //                   <SelectValue />
// // // // //                 </SelectTrigger>
// // // // //                 <SelectContent>
// // // // //                   <SelectItem value="today">Today</SelectItem>
// // // // //                   <SelectItem value="week">This Week</SelectItem>
// // // // //                   <SelectItem value="month">This Month</SelectItem>
// // // // //                   <SelectItem value="custom">Custom Range</SelectItem>
// // // // //                   <SelectItem value="all">All Time</SelectItem>
// // // // //                 </SelectContent>
// // // // //               </Select>
// // // // //             </div>

// // // // //             <div></div>

// // // // //             {/* Custom Date */}
// // // // //             {filters.dateRange === "custom" && (
// // // // //               <div className="md:col-span-4">
// // // // //                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
// // // // //                   <div>
// // // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // // // //                       <Calendar className="w-4 h-4" />
// // // // //                       Start Date
// // // // //                     </Label>
// // // // //                     <Input
// // // // //                       type="date"
// // // // //                       value={filters.startDate}
// // // // //                       onChange={(e) => updateFilter("startDate", e.target.value)}
// // // // //                       max={filters.endDate || undefined}
// // // // //                     />
// // // // //                   </div>
// // // // //                   <div>
// // // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // // // //                       <Calendar className="w-4 h-4" />
// // // // //                       End Date
// // // // //                     </Label>
// // // // //                     <Input
// // // // //                       type="date"
// // // // //                       value={filters.endDate}
// // // // //                       onChange={(e) => updateFilter("endDate", e.target.value)}
// // // // //                       min={filters.startDate || undefined}
// // // // //                     />
// // // // //                   </div>
// // // // //                 </div>
// // // // //               </div>
// // // // //             )}
// // // // //           </div>
// // // // //         </CardContent>
// // // // //       </Card>

// // // // //       {/* Table */}
// // // // //       <Card>
// // // // //         <CardHeader>
// // // // //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// // // // //             Transaction Ledger
// // // // //             {pagination && (
// // // // //               <span className="ml-2 text-sm font-normal text-gray-500">
// // // // //                 ({pagination.totalCount} entries)
// // // // //               </span>
// // // // //             )}
// // // // //             {isFetching && !isLoading && (
// // // // //               <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />
// // // // //             )}
// // // // //           </CardTitle>
// // // // //         </CardHeader>
// // // // //         <CardContent className="p-0">
// // // // //           <div className="overflow-x-auto">
// // // // //             <table className="w-full">
// // // // //               <thead className="bg-gray-50">
// // // // //                 <tr>
// // // // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // //                     Date & Time
// // // // //                   </th>
// // // // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // //                     Note
// // // // //                   </th>
// // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // //                     Debit (−)
// // // // //                   </th>
// // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // //                     Credit (+)
// // // // //                   </th>
// // // // //                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // //                     Balance
// // // // //                   </th>
// // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // //                     Bill
// // // // //                   </th>
// // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // //                     Actions
// // // // //                   </th>
// // // // //                 </tr>
// // // // //               </thead>
// // // // //               {showSkeleton ? (
// // // // //                 <TableSkeleton rows={filters.pageSize} />
// // // // //               ) : (
// // // // //                 <tbody className="bg-white divide-y divide-gray-200">
// // // // //                   {transactions.length === 0 ? (
// // // // //                     <tr>
// // // // //                       <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
// // // // //                         No transactions found. Add your first entry to start tracking.
// // // // //                       </td>
// // // // //                     </tr>
// // // // //                   ) : (
// // // // //                     transactions.map((txn) => (
// // // // //                       <tr key={txn._id} className="hover:bg-gray-50">
// // // // //                         <td className="px-6 py-4 whitespace-nowrap">
// // // // //                           <div>
// // // // //                             <p className="text-sm font-medium text-gray-900">
// // // // //                               {formatDate(txn.enteredAt)}
// // // // //                             </p>
// // // // //                             <p className="text-xs text-gray-500">{formatTime(txn.enteredAt)}</p>
// // // // //                           </div>
// // // // //                         </td>
// // // // //                         <td className="px-6 py-4">
// // // // //                           <p className="text-sm text-gray-900 max-w-xs truncate">
// // // // //                             {txn.note || "—"}
// // // // //                           </p>
// // // // //                         </td>
// // // // //                         <td className="px-6 py-4 text-center">
// // // // //                           {txn.type === "DEBIT" ? (
// // // // //                             <span className="text-sm font-medium text-red-600">
// // // // //                               {formatCurrency(txn.amount)}
// // // // //                             </span>
// // // // //                           ) : (
// // // // //                             <span className="text-sm text-gray-400">—</span>
// // // // //                           )}
// // // // //                         </td>
// // // // //                         <td className="px-6 py-4 text-center">
// // // // //                           {txn.type === "CREDIT" ? (
// // // // //                             <span className="text-sm font-medium text-green-600">
// // // // //                               {formatCurrency(txn.amount)}
// // // // //                             </span>
// // // // //                           ) : (
// // // // //                             <span className="text-sm text-gray-400">—</span>
// // // // //                           )}
// // // // //                         </td>
// // // // //                         <td className="px-6 py-4 text-right">
// // // // //                           <span
// // // // //                             className={`text-sm font-semibold ${
// // // // //                               txn.balanceAfter >= 0 ? "text-blue-600" : "text-red-600"
// // // // //                             }`}
// // // // //                           >
// // // // //                             {formatCurrency(txn.balanceAfter)}
// // // // //                           </span>
// // // // //                         </td>
// // // // //                         <td className="px-6 py-4 text-center">
// // // // //                           {txn.billUrl ? (
// // // // //                             <a
// // // // //                               href={txn.billUrl}
// // // // //                               target="_blank"
// // // // //                               rel="noopener noreferrer"
// // // // //                               className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600"
// // // // //                               title="View Bill"
// // // // //                             >
// // // // //                               <ExternalLink className="w-4 h-4" />
// // // // //                             </a>
// // // // //                           ) : (
// // // // //                             <span className="text-sm text-gray-400">—</span>
// // // // //                           )}
// // // // //                         </td>
// // // // //                         <td className="px-6 py-4 text-center">
// // // // //                           <Button
// // // // //                             variant="ghost"
// // // // //                             size="sm"
// // // // //                             onClick={() => handleDeleteClick(txn)}
// // // // //                             className="text-red-500 hover:text-red-600 hover:bg-red-50"
// // // // //                             title="Delete Transaction"
// // // // //                           >
// // // // //                             <Trash2 className="w-4 h-4" />
// // // // //                           </Button>
// // // // //                         </td>
// // // // //                       </tr>
// // // // //                     ))
// // // // //                   )}
// // // // //                 </tbody>
// // // // //               )}
// // // // //             </table>
// // // // //           </div>
// // // // //           <PaginationControls />
// // // // //         </CardContent>
// // // // //       </Card>

// // // // //       {/* Modals */}
// // // // //       <AddTransactionModal open={showAddModal} onOpenChange={setShowAddModal} account={account} />

// // // // //       <ConfirmDialog
// // // // //         open={showDeleteModal}
// // // // //         onOpenChange={setShowDeleteModal}
// // // // //         onConfirm={handleDeleteConfirm}
// // // // //         title="Delete Transaction"
// // // // //         description="This will affect the running balance. This action cannot be undone."
// // // // //         confirmLabel="Delete"
// // // // //         icon={Trash2}
// // // // //         variant="destructive"
// // // // //         isLoading={deleteMutation.isPending}
// // // // //         loadingLabel="Deleting..."
// // // // //       />
// // // // //     </div>
// // // // //   );
// // // // // }



// // // // // // // components/tabs/account-transactions-tab.tsx
// // // // // // "use client";

// // // // // // import { useState, useCallback } from "react";
// // // // // // import { useQuery } from "@tanstack/react-query";
// // // // // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // // import { Input } from "@/components/ui/input";
// // // // // // import { Label } from "@/components/ui/label";
// // // // // // import { Button } from "@/components/ui/button";
// // // // // // import {
// // // // // //   Select,
// // // // // //   SelectContent,
// // // // // //   SelectItem,
// // // // // //   SelectTrigger,
// // // // // //   SelectValue,
// // // // // // } from "@/components/ui/select";
// // // // // // import {
// // // // // //   Search,
// // // // // //   Plus,
// // // // // //   Trash2,
// // // // // //   Loader2,
// // // // // //   X,
// // // // // //   ChevronLeft,
// // // // // //   ChevronRight,
// // // // // //   ChevronsLeft,
// // // // // //   ChevronsRight,
// // // // // //   Calendar,
// // // // // //   Download,
// // // // // //   ArrowLeft,
// // // // // //   TrendingUp,
// // // // // //   TrendingDown,
// // // // // //   ExternalLink,
// // // // // //   FileText,
// // // // // // } from "lucide-react";
// // // // // // import { toast } from "sonner";
// // // // // // import { useDeleteAccountTransaction } from "@/hooks/use-account-transaction-mutations";
// // // // // // import AddTransactionModal from "@/components/modals/add-transaction-modal";
// // // // // // import type { Account } from "@/types/account";
// // // // // // import type {
// // // // // //   AccountTransaction,
// // // // // //   AccountTransactionsPaginatedResponse,
// // // // // //   AccountTransactionSummary,
// // // // // // } from "@/types/accountTransaction";
// // // // // // import ConfirmDialog from "@/components/dialogs/ConfirmDialog";

// // // // // // type DateRangeType = "today" | "week" | "month" | "custom" | "all";
// // // // // // type TransactionTypeFilter = "all" | "CREDIT" | "DEBIT";

// // // // // // interface FilterState {
// // // // // //   type: TransactionTypeFilter;
// // // // // //   dateRange: DateRangeType;
// // // // // //   startDate: string;
// // // // // //   endDate: string;
// // // // // //   currentPage: number;
// // // // // //   pageSize: number;
// // // // // // }

// // // // // // // Table Skeleton
// // // // // // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// // // // // //   <tbody className="bg-white divide-y divide-gray-200">
// // // // // //     {Array.from({ length: rows }).map((_, index) => (
// // // // // //       <tr key={index} className="animate-pulse">
// // // // // //         <td className="px-6 py-4">
// // // // // //           <div className="space-y-1">
// // // // // //             <div className="h-4 bg-gray-200 rounded w-24"></div>
// // // // // //             <div className="h-3 bg-gray-200 rounded w-16"></div>
// // // // // //           </div>
// // // // // //         </td>
// // // // // //         <td className="px-6 py-4">
// // // // // //           <div className="h-4 bg-gray-200 rounded w-48"></div>
// // // // // //         </td>
// // // // // //         <td className="px-6 py-4 text-center">
// // // // // //           <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
// // // // // //         </td>
// // // // // //         <td className="px-6 py-4 text-center">
// // // // // //           <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
// // // // // //         </td>
// // // // // //         <td className="px-6 py-4 text-right">
// // // // // //           <div className="h-5 bg-gray-200 rounded w-20 ml-auto"></div>
// // // // // //         </td>
// // // // // //         <td className="px-6 py-4 text-center">
// // // // // //           <div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div>
// // // // // //         </td>
// // // // // //         <td className="px-6 py-4 text-center">
// // // // // //           <div className="h-8 w-8 bg-gray-200 rounded mx-auto"></div>
// // // // // //         </td>
// // // // // //       </tr>
// // // // // //     ))}
// // // // // //   </tbody>
// // // // // // );

// // // // // // interface AccountTransactionsTabProps {
// // // // // //   account: Account;
// // // // // //   onBack: () => void;
// // // // // //   isMaster?: boolean;
// // // // // // }

// // // // // // export default function AccountTransactionsTab({
// // // // // //   account,
// // // // // //   onBack,
// // // // // //   isMaster = false,
// // // // // // }: AccountTransactionsTabProps) {
// // // // // //     // In the header section, show owner info if Master
// // // // // //   const getOwnerName = (acc: Account): string => {
// // // // // //     if (typeof acc.ownerId === "string") return "";
// // // // // //     return (acc.ownerId as any)?.name || "";
// // // // // //   };
  
// // // // // //   const deleteMutation = useDeleteAccountTransaction();

// // // // // //   // Search state
// // // // // //   const [searchInput, setSearchInput] = useState("");
// // // // // //   const [committedSearch, setCommittedSearch] = useState("");

// // // // // //   // Filter state
// // // // // //   const [filters, setFilters] = useState<FilterState>({
// // // // // //     type: "all",
// // // // // //     dateRange: "all",
// // // // // //     startDate: "",
// // // // // //     endDate: "",
// // // // // //     currentPage: 1,
// // // // // //     pageSize: 20,
// // // // // //   });

// // // // // //   // Modal states
// // // // // //   const [showAddModal, setShowAddModal] = useState(false);
// // // // // //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// // // // // //   const [selectedTransaction, setSelectedTransaction] = useState<AccountTransaction | null>(null);

// // // // // //   const [isExporting, setIsExporting] = useState(false);

// // // // // //   // Helper for date boundaries
// // // // // //   const getUTCBoundaries = useCallback(
// // // // // //     (dateRange: string, startDate: string, endDate: string) => {
// // // // // //       const now = new Date();

// // // // // //       switch (dateRange) {
// // // // // //         case "today": {
// // // // // //           const start = new Date(now);
// // // // // //           start.setHours(0, 0, 0, 0);
// // // // // //           const end = new Date(now);
// // // // // //           end.setHours(23, 59, 59, 999);
// // // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // // //         }
// // // // // //         case "week": {
// // // // // //           const start = new Date(now);
// // // // // //           start.setDate(now.getDate() - now.getDay());
// // // // // //           start.setHours(0, 0, 0, 0);
// // // // // //           const end = new Date(now);
// // // // // //           end.setHours(23, 59, 59, 999);
// // // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // // //         }
// // // // // //         case "month": {
// // // // // //           const start = new Date(now.getFullYear(), now.getMonth(), 1);
// // // // // //           start.setHours(0, 0, 0, 0);
// // // // // //           const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
// // // // // //           end.setHours(23, 59, 59, 999);
// // // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // // //         }
// // // // // //         case "custom": {
// // // // // //           if (!startDate || !endDate) return null;
// // // // // //           const start = new Date(startDate);
// // // // // //           start.setHours(0, 0, 0, 0);
// // // // // //           const end = new Date(endDate);
// // // // // //           end.setHours(23, 59, 59, 999);
// // // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // // //         }
// // // // // //         default:
// // // // // //           return null;
// // // // // //       }
// // // // // //     },
// // // // // //     []
// // // // // //   );

// // // // // //   // Fetch transactions
// // // // // //   const { data: response, isLoading, isFetching } = useQuery<AccountTransactionsPaginatedResponse>({
// // // // // //     queryKey: [
// // // // // //       "account-transactions",
// // // // // //       account?._id,
// // // // // //       committedSearch,
// // // // // //       filters.type,
// // // // // //       filters.dateRange,
// // // // // //       filters.startDate,
// // // // // //       filters.endDate,
// // // // // //       filters.currentPage,
// // // // // //       filters.pageSize,
// // // // // //     ],
// // // // // //     queryFn: async (): Promise<AccountTransactionsPaginatedResponse> => {
// // // // // //       const params = new URLSearchParams();
// // // // // //       params.append("accountId", account?._id);

// // // // // //       if (committedSearch) params.append("search", committedSearch);
// // // // // //       if (filters.type !== "all") params.append("type", filters.type);

// // // // // //       if (filters.dateRange !== "all") {
// // // // // //         const boundaries = getUTCBoundaries(filters.dateRange, filters.startDate, filters.endDate);
// // // // // //         if (boundaries) {
// // // // // //           params.append("startDate", boundaries.startDate);
// // // // // //           params.append("endDate", boundaries.endDate);
// // // // // //         }
// // // // // //       }

// // // // // //       params.append("page", filters.currentPage.toString());
// // // // // //       params.append("limit", filters.pageSize.toString());
// // // // // //       params.append("sortBy", "enteredAt");
// // // // // //       params.append("sortOrder", "desc");

// // // // // //       const res = await fetch(`/api/account-transactions?${params}`);
// // // // // //       if (!res.ok) throw new Error("Failed to fetch transactions");
// // // // // //       return res.json();
// // // // // //     },
// // // // // //     staleTime: 30 * 1000,
// // // // // //     placeholderData: (prev) => prev,
// // // // // //   });

// // // // // //   // Fetch summary
// // // // // //   const { data: summaryResponse } = useQuery<{ success: boolean; data: AccountTransactionSummary }>({
// // // // // //     queryKey: ["account-summary", account?._id],
// // // // // //     queryFn: async () => {
// // // // // //       const res = await fetch(`/api/account-transactions/summary?accountId=${account?._id}`);
// // // // // //       if (!res.ok) throw new Error("Failed to fetch summary");
// // // // // //       return res.json();
// // // // // //     },
// // // // // //     staleTime: 30 * 1000,
// // // // // //   });

// // // // // //   const transactions = response?.data?.transactions || [];
// // // // // //   const pagination = response?.pagination;
// // // // // //   const summary = summaryResponse?.data;

// // // // // //   // Handlers
// // // // // //   const handleSearch = useCallback(() => {
// // // // // //     setCommittedSearch(searchInput.trim());
// // // // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // // // //   }, [searchInput]);

// // // // // //   const handleSearchKeyDown = useCallback(
// // // // // //     (e: React.KeyboardEvent<HTMLInputElement>) => {
// // // // // //       if (e.key === "Enter") handleSearch();
// // // // // //     },
// // // // // //     [handleSearch]
// // // // // //   );

// // // // // //   const handleClearSearch = useCallback(() => {
// // // // // //     setSearchInput("");
// // // // // //     setCommittedSearch("");
// // // // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // // // //   }, []);

// // // // // //   const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
// // // // // //     setFilters((prev) => {
// // // // // //       if (key === "dateRange" && value === "custom") {
// // // // // //         const yesterday = new Date();
// // // // // //         yesterday.setDate(yesterday.getDate() - 1);
// // // // // //         const dateStr = yesterday.toISOString().split("T")[0];
// // // // // //         return {
// // // // // //           ...prev,
// // // // // //           dateRange: "custom" as FilterState["dateRange"],
// // // // // //           startDate: dateStr,
// // // // // //           endDate: dateStr,
// // // // // //           currentPage: 1,
// // // // // //         };
// // // // // //       }

// // // // // //       if (key === "dateRange" && value !== "custom") {
// // // // // //         return {
// // // // // //           ...prev,
// // // // // //           [key]: value,
// // // // // //           startDate: "",
// // // // // //           endDate: "",
// // // // // //           currentPage: 1,
// // // // // //         };
// // // // // //       }

// // // // // //       return {
// // // // // //         ...prev,
// // // // // //         [key]: value,
// // // // // //         ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
// // // // // //       };
// // // // // //     });
// // // // // //   }, []);

// // // // // //   const handleDeleteClick = useCallback((transaction: AccountTransaction) => {
// // // // // //     setSelectedTransaction(transaction);
// // // // // //     setShowDeleteModal(true);
// // // // // //   }, []);

// // // // // //   const handleDeleteConfirm = useCallback(() => {
// // // // // //     if (!selectedTransaction) return;
// // // // // //     deleteMutation.mutate(
// // // // // //        selectedTransaction._id ,
// // // // // //       {
// // // // // //         onSuccess: () => {
// // // // // //           setShowDeleteModal(false);
// // // // // //           setSelectedTransaction(null);
// // // // // //         },
// // // // // //       }
// // // // // //     );
// // // // // //   }, [selectedTransaction, account?._id, deleteMutation]);

// // // // // //   const handlePageChange = useCallback((newPage: number) => {
// // // // // //     setFilters((prev) => ({ ...prev, currentPage: newPage }));
// // // // // //     window.scrollTo({ top: 0, behavior: "smooth" });
// // // // // //   }, []);

// // // // // //   const handlePageSizeChange = useCallback((newSize: string) => {
// // // // // //     setFilters((prev) => ({
// // // // // //       ...prev,
// // // // // //       pageSize: parseInt(newSize),
// // // // // //       currentPage: 1,
// // // // // //     }));
// // // // // //   }, []);

// // // // // //   const formatDate = useCallback((dateString: string): string => {
// // // // // //     return new Date(dateString).toLocaleDateString("en-GB", {
// // // // // //       day: "2-digit",
// // // // // //       month: "short",
// // // // // //       year: "numeric",
// // // // // //     });
// // // // // //   }, []);

// // // // // //   const formatTime = useCallback((dateString: string): string => {
// // // // // //     return new Date(dateString).toLocaleTimeString("en-GB", {
// // // // // //       hour: "2-digit",
// // // // // //       minute: "2-digit",
// // // // // //     });
// // // // // //   }, []);

// // // // // //   const formatCurrency = useCallback((amount: number): string => {
// // // // // //     return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
// // // // // //   }, []);

// // // // // //   // Export handler
// // // // // //   const handleExport = useCallback(() => {
// // // // // //     try {
// // // // // //       setIsExporting(true);

// // // // // //       const headers = ["Date & Time", "Note", "Type", "Debit (−)", "Credit (+)", "Balance", "Bill URL"];
// // // // // //       const rows: string[] = [];

// // // // // //       transactions.forEach((txn) => {
// // // // // //         const dateStr = `${formatDate(txn.enteredAt)} ${formatTime(txn.enteredAt)}`;

// // // // // //         rows.push(
// // // // // //           [
// // // // // //             dateStr,
// // // // // //             txn.note || "-",
// // // // // //             txn.type,
// // // // // //             txn.type === "DEBIT" ? txn.amount.toFixed(2) : "-",
// // // // // //             txn.type === "CREDIT" ? txn.amount.toFixed(2) : "-",
// // // // // //             txn.balanceAfter.toFixed(2),
// // // // // //             txn.billUrl || "-",
// // // // // //           ]
// // // // // //             .map((cell) => `"${cell}"`)
// // // // // //             .join(",")
// // // // // //         );
// // // // // //       });

// // // // // //       const csvContent = [headers.join(","), ...rows].join("\n");
// // // // // //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// // // // // //       const url = window.URL.createObjectURL(blob);
// // // // // //       const link = document.createElement("a");
// // // // // //       link.href = url;
// // // // // //       link.download = `${account.name}-transactions-${new Date().toISOString().split("T")[0]}.csv`;
// // // // // //       document.body.appendChild(link);
// // // // // //       link.click();
// // // // // //       document.body.removeChild(link);
// // // // // //       window.URL.revokeObjectURL(url);

// // // // // //       toast.success("Transactions exported successfully!");
// // // // // //     } catch (error) {
// // // // // //       console.error("Export error:", error);
// // // // // //       toast.error("Failed to export transactions");
// // // // // //     } finally {
// // // // // //       setIsExporting(false);
// // // // // //     }
// // // // // //   }, [transactions, account.name, formatDate, formatTime]);

// // // // // //   // Pagination Controls
// // // // // //   const PaginationControls = useCallback(() => {
// // // // // //     if (!pagination) return null;

// // // // // //     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
// // // // // //     const currentPage = filters.currentPage;

// // // // // //     const getPageNumbers = (): number[] => {
// // // // // //       const maxVisible = 5;
// // // // // //       const pages: number[] = [];

// // // // // //       if (totalPages <= maxVisible) {
// // // // // //         for (let i = 1; i <= totalPages; i++) pages.push(i);
// // // // // //       } else if (currentPage <= 3) {
// // // // // //         for (let i = 1; i <= maxVisible; i++) pages.push(i);
// // // // // //       } else if (currentPage >= totalPages - 2) {
// // // // // //         for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
// // // // // //       } else {
// // // // // //         for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
// // // // // //       }

// // // // // //       return pages;
// // // // // //     };

// // // // // //     return (
// // // // // //       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
// // // // // //         <div className="flex items-center space-x-2">
// // // // // //           <span className="text-sm text-gray-700">
// // // // // //             Showing {startIndex} to {endIndex} of {totalCount} entries
// // // // // //           </span>
// // // // // //           <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
// // // // // //             <SelectTrigger className="w-20">
// // // // // //               <SelectValue />
// // // // // //             </SelectTrigger>
// // // // // //             <SelectContent>
// // // // // //               <SelectItem value="10">10</SelectItem>
// // // // // //               <SelectItem value="20">20</SelectItem>
// // // // // //               <SelectItem value="50">50</SelectItem>
// // // // // //               <SelectItem value="100">100</SelectItem>
// // // // // //             </SelectContent>
// // // // // //           </Select>
// // // // // //           <span className="text-sm text-gray-700">per page</span>
// // // // // //         </div>

// // // // // //         <div className="flex items-center space-x-2">
// // // // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={!hasPreviousPage}>
// // // // // //             <ChevronsLeft className="w-4 h-4" />
// // // // // //           </Button>
// // // // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={!hasPreviousPage}>
// // // // // //             <ChevronLeft className="w-4 h-4" />
// // // // // //           </Button>

// // // // // //           <div className="flex items-center space-x-1">
// // // // // //             {getPageNumbers().map((pageNumber) => (
// // // // // //               <Button
// // // // // //                 key={pageNumber}
// // // // // //                 variant={currentPage === pageNumber ? "default" : "outline"}
// // // // // //                 size="sm"
// // // // // //                 onClick={() => handlePageChange(pageNumber)}
// // // // // //                 className="w-8 h-8"
// // // // // //               >
// // // // // //                 {pageNumber}
// // // // // //               </Button>
// // // // // //             ))}
// // // // // //           </div>

// // // // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={!hasNextPage}>
// // // // // //             <ChevronRight className="w-4 h-4" />
// // // // // //           </Button>
// // // // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={!hasNextPage}>
// // // // // //             <ChevronsRight className="w-4 h-4" />
// // // // // //           </Button>
// // // // // //         </div>
// // // // // //       </div>
// // // // // //     );
// // // // // //   }, [pagination, filters.currentPage, filters.pageSize, handlePageChange, handlePageSizeChange]);

// // // // // //   const showSkeleton = isLoading || isFetching;

// // // // // //   return (
// // // // // //     <div className="space-y-6">
// // // // // //       {/* Header */}
// // // // // //       <div className="flex justify-between items-center">
// // // // // //         <div className="flex items-center gap-4">
// // // // // //           <Button variant="ghost" onClick={onBack} className="p-2">
// // // // // //             <ArrowLeft className="w-5 h-5" />
// // // // // //           </Button>
// // // // // //           <div>
// // // // // //             <h2 className="text-2xl font-bold text-gray-900">{account.name}</h2>
// // // // // //             {account.description && <p className="text-sm text-gray-500">{account.description}</p>}
// // // // // //           </div>
// // // // // //         </div>
// // // // // //         <div className="flex gap-2">
// // // // // //           <Button onClick={handleExport} variant="outline" disabled={isExporting || transactions.length === 0}>
// // // // // //             {isExporting ? (
// // // // // //               <>
// // // // // //                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
// // // // // //                 Exporting...
// // // // // //               </>
// // // // // //             ) : (
// // // // // //               <>
// // // // // //                 <Download className="w-4 h-4 mr-2" />
// // // // // //                 Export
// // // // // //               </>
// // // // // //             )}
// // // // // //           </Button>
// // // // // //           <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600">
// // // // // //             <Plus className="w-4 h-4 mr-2" />
// // // // // //             Add Entry
// // // // // //           </Button>
// // // // // //         </div>
// // // // // //       </div>

// // // // // //       {/* Summary Cards */}
// // // // // //       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // // // // //         <Card>
// // // // // //           <CardContent className="p-4">
// // // // // //             <div className="flex items-center justify-between">
// // // // // //               <div>
// // // // // //                 <p className="text-sm text-gray-500">Current Balance</p>
// // // // // //                 <p
// // // // // //                   className={`text-2xl font-bold ${
// // // // // //                     account.currentBalance >= 0 ? "text-blue-600" : "text-red-600"
// // // // // //                   }`}
// // // // // //                 >
// // // // // //                   {formatCurrency(account.currentBalance)}
// // // // // //                 </p>
// // // // // //               </div>
// // // // // //               <div className="p-3 bg-blue-100 rounded-full">
// // // // // //                 <FileText className="w-6 h-6 text-blue-600" />
// // // // // //               </div>
// // // // // //             </div>
// // // // // //           </CardContent>
// // // // // //         </Card>

// // // // // //         <Card>
// // // // // //           <CardContent className="p-4">
// // // // // //             <div className="flex items-center justify-between">
// // // // // //               <div>
// // // // // //                 <p className="text-sm text-gray-500">Total Credit</p>
// // // // // //                 <p className="text-2xl font-bold text-green-600">
// // // // // //                   {formatCurrency(summary?.totalCredit || 0)}
// // // // // //                 </p>
// // // // // //               </div>
// // // // // //               <div className="p-3 bg-green-100 rounded-full">
// // // // // //                 <TrendingUp className="w-6 h-6 text-green-600" />
// // // // // //               </div>
// // // // // //             </div>
// // // // // //           </CardContent>
// // // // // //         </Card>

// // // // // //         <Card>
// // // // // //           <CardContent className="p-4">
// // // // // //             <div className="flex items-center justify-between">
// // // // // //               <div>
// // // // // //                 <p className="text-sm text-gray-500">Total Debit</p>
// // // // // //                 <p className="text-2xl font-bold text-red-600">
// // // // // //                   {formatCurrency(summary?.totalDebit || 0)}
// // // // // //                 </p>
// // // // // //               </div>
// // // // // //               <div className="p-3 bg-red-100 rounded-full">
// // // // // //                 <TrendingDown className="w-6 h-6 text-red-600" />
// // // // // //               </div>
// // // // // //             </div>
// // // // // //           </CardContent>
// // // // // //         </Card>

// // // // // //         <Card>
// // // // // //           <CardContent className="p-4">
// // // // // //             <div className="flex items-center justify-between">
// // // // // //               <div>
// // // // // //                 <p className="text-sm text-gray-500">Total Entries</p>
// // // // // //                 <p className="text-2xl font-bold text-gray-900">{summary?.totalEntries || 0}</p>
// // // // // //               </div>
// // // // // //               <div className="p-3 bg-gray-100 rounded-full">
// // // // // //                 <FileText className="w-6 h-6 text-gray-600" />
// // // // // //               </div>
// // // // // //             </div>
// // // // // //           </CardContent>
// // // // // //         </Card>
// // // // // //       </div>

// // // // // //       {/* Filters */}
// // // // // //       <Card>
// // // // // //         <CardContent className="p-6">
// // // // // //           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // // // // //             {/* Search */}
// // // // // //             <div>
// // // // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
// // // // // //               <div className="flex gap-2">
// // // // // //                 <div className="relative flex-1">
// // // // // //                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // // // // //                   <Input
// // // // // //                     placeholder="Search notes..."
// // // // // //                     value={searchInput}
// // // // // //                     onChange={(e) => setSearchInput(e.target.value)}
// // // // // //                     onKeyDown={handleSearchKeyDown}
// // // // // //                     className="pl-10 pr-8"
// // // // // //                   />
// // // // // //                   {searchInput && (
// // // // // //                     <button
// // // // // //                       onClick={handleClearSearch}
// // // // // //                       className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
// // // // // //                       type="button"
// // // // // //                     >
// // // // // //                       <X className="w-4 h-4" />
// // // // // //                     </button>
// // // // // //                   )}
// // // // // //                 </div>
// // // // // //                 <Button onClick={handleSearch} disabled={isFetching} size="icon" className="shrink-0">
// // // // // //                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// // // // // //                 </Button>
// // // // // //               </div>
// // // // // //             </div>

// // // // // //             {/* Type Filter */}
// // // // // //             <div>
// // // // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Type</Label>
// // // // // //               <Select
// // // // // //                 value={filters.type}
// // // // // //                 onValueChange={(value: TransactionTypeFilter) => updateFilter("type", value)}
// // // // // //               >
// // // // // //                 <SelectTrigger>
// // // // // //                   <SelectValue />
// // // // // //                 </SelectTrigger>
// // // // // //                 <SelectContent>
// // // // // //                   <SelectItem value="all">All Types</SelectItem>
// // // // // //                   <SelectItem value="CREDIT">Credit Only</SelectItem>
// // // // // //                   <SelectItem value="DEBIT">Debit Only</SelectItem>
// // // // // //                 </SelectContent>
// // // // // //               </Select>
// // // // // //             </div>

// // // // // //             {/* Date Range */}
// // // // // //             <div>
// // // // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Date Range</Label>
// // // // // //               <Select
// // // // // //                 value={filters.dateRange}
// // // // // //                 onValueChange={(value: DateRangeType) => updateFilter("dateRange", value)}
// // // // // //               >
// // // // // //                 <SelectTrigger>
// // // // // //                   <SelectValue />
// // // // // //                 </SelectTrigger>
// // // // // //                 <SelectContent>
// // // // // //                   <SelectItem value="today">Today</SelectItem>
// // // // // //                   <SelectItem value="week">This Week</SelectItem>
// // // // // //                   <SelectItem value="month">This Month</SelectItem>
// // // // // //                   <SelectItem value="custom">Custom Range</SelectItem>
// // // // // //                   <SelectItem value="all">All Time</SelectItem>
// // // // // //                 </SelectContent>
// // // // // //               </Select>
// // // // // //             </div>

// // // // // //             {/* Placeholder */}
// // // // // //             <div></div>

// // // // // //             {/* Custom Date */}
// // // // // //             {filters.dateRange === "custom" && (
// // // // // //               <div className="md:col-span-4">
// // // // // //                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
// // // // // //                   <div>
// // // // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // // // // //                       <Calendar className="w-4 h-4" />
// // // // // //                       Start Date
// // // // // //                     </Label>
// // // // // //                     <Input
// // // // // //                       type="date"
// // // // // //                       value={filters.startDate}
// // // // // //                       onChange={(e) => updateFilter("startDate", e.target.value)}
// // // // // //                       max={filters.endDate || undefined}
// // // // // //                     />
// // // // // //                   </div>
// // // // // //                   <div>
// // // // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // // // // //                       <Calendar className="w-4 h-4" />
// // // // // //                       End Date
// // // // // //                     </Label>
// // // // // //                     <Input
// // // // // //                       type="date"
// // // // // //                       value={filters.endDate}
// // // // // //                       onChange={(e) => updateFilter("endDate", e.target.value)}
// // // // // //                       min={filters.startDate || undefined}
// // // // // //                     />
// // // // // //                   </div>
// // // // // //                 </div>
// // // // // //               </div>
// // // // // //             )}
// // // // // //           </div>
// // // // // //         </CardContent>
// // // // // //       </Card>

// // // // // //       {/* Table */}
// // // // // //       <Card>
// // // // // //         <CardHeader>
// // // // // //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// // // // // //             Transaction Ledger
// // // // // //             {pagination && (
// // // // // //               <span className="ml-2 text-sm font-normal text-gray-500">({pagination.totalCount} entries)</span>
// // // // // //             )}
// // // // // //             {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />}
// // // // // //           </CardTitle>
// // // // // //         </CardHeader>
// // // // // //         <CardContent className="p-0">
// // // // // //           <div className="overflow-x-auto">
// // // // // //             <table className="w-full">
// // // // // //               <thead className="bg-gray-50">
// // // // // //                 <tr>
// // // // // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // //                     Date & Time
// // // // // //                   </th>
// // // // // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // //                     Note
// // // // // //                   </th>
// // // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // //                     Debit (−)
// // // // // //                   </th>
// // // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // //                     Credit (+)
// // // // // //                   </th>
// // // // // //                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // //                     Balance
// // // // // //                   </th>
// // // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // //                     Bill
// // // // // //                   </th>
// // // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // //                     Actions
// // // // // //                   </th>
// // // // // //                 </tr>
// // // // // //               </thead>

// // // // // //               {showSkeleton ? (
// // // // // //                 <TableSkeleton rows={filters.pageSize} />
// // // // // //               ) : (
// // // // // //                 <tbody className="bg-white divide-y divide-gray-200">
// // // // // //                   {transactions.length === 0 ? (
// // // // // //                     <tr>
// // // // // //                       <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
// // // // // //                         No transactions found. Add your first entry to start tracking.
// // // // // //                       </td>
// // // // // //                     </tr>
// // // // // //                   ) : (
// // // // // //                     transactions.map((txn) => (
// // // // // //                       <tr key={txn._id} className="hover:bg-gray-50">
// // // // // //                         <td className="px-6 py-4 whitespace-nowrap">
// // // // // //                           <div>
// // // // // //                             <p className="text-sm font-medium text-gray-900">{formatDate(txn.enteredAt)}</p>
// // // // // //                             <p className="text-xs text-gray-500">{formatTime(txn.enteredAt)}</p>
// // // // // //                           </div>
// // // // // //                         </td>
// // // // // //                         <td className="px-6 py-4">
// // // // // //                           <p className="text-sm text-gray-900 max-w-xs truncate">{txn.note || "—"}</p>
// // // // // //                         </td>
// // // // // //                         <td className="px-6 py-4 text-center">
// // // // // //                           {txn.type === "DEBIT" ? (
// // // // // //                             <span className="text-sm font-medium text-red-600">
// // // // // //                               {formatCurrency(txn.amount)}
// // // // // //                             </span>
// // // // // //                           ) : (
// // // // // //                             <span className="text-sm text-gray-400">—</span>
// // // // // //                           )}
// // // // // //                         </td>
// // // // // //                         <td className="px-6 py-4 text-center">
// // // // // //                           {txn.type === "CREDIT" ? (
// // // // // //                             <span className="text-sm font-medium text-green-600">
// // // // // //                               {formatCurrency(txn.amount)}
// // // // // //                             </span>
// // // // // //                           ) : (
// // // // // //                             <span className="text-sm text-gray-400">—</span>
// // // // // //                           )}
// // // // // //                         </td>
// // // // // //                         <td className="px-6 py-4 text-right">
// // // // // //                           <span
// // // // // //                             className={`text-sm font-semibold ${
// // // // // //                               txn.balanceAfter >= 0 ? "text-blue-600" : "text-red-600"
// // // // // //                             }`}
// // // // // //                           >
// // // // // //                             {formatCurrency(txn.balanceAfter)}
// // // // // //                           </span>
// // // // // //                         </td>
// // // // // //                         <td className="px-6 py-4 text-center">
// // // // // //                           {txn.billUrl ? (
// // // // // //                             <a
// // // // // //                               href={txn.billUrl}
// // // // // //                               target="_blank"
// // // // // //                               rel="noopener noreferrer"
// // // // // //                               className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600"
// // // // // //                               title="View Bill"
// // // // // //                             >
// // // // // //                               <ExternalLink className="w-4 h-4" />
// // // // // //                             </a>
// // // // // //                           ) : (
// // // // // //                             <span className="text-sm text-gray-400">—</span>
// // // // // //                           )}
// // // // // //                         </td>
// // // // // //                         <td className="px-6 py-4 text-center">
// // // // // //                           <Button
// // // // // //                             variant="ghost"
// // // // // //                             size="sm"
// // // // // //                             onClick={() => handleDeleteClick(txn)}
// // // // // //                             className="text-red-500 hover:text-red-600 hover:bg-red-50"
// // // // // //                             title="Delete Transaction"
// // // // // //                           >
// // // // // //                             <Trash2 className="w-4 h-4" />
// // // // // //                           </Button>
// // // // // //                         </td>
// // // // // //                       </tr>
// // // // // //                     ))
// // // // // //                   )}
// // // // // //                 </tbody>
// // // // // //               )}
// // // // // //             </table>
// // // // // //           </div>

// // // // // //           <PaginationControls />
// // // // // //         </CardContent>
// // // // // //       </Card>

// // // // // //       {/* Modals */}
// // // // // //       <AddTransactionModal open={showAddModal} onOpenChange={setShowAddModal} account={account} />

// // // // // //       {/* Using Universal Confirmation Modal */}
// // // // // //       <ConfirmDialog
// // // // // //         open={showDeleteModal}
// // // // // //         onOpenChange={setShowDeleteModal}
// // // // // //         onConfirm={handleDeleteConfirm}
// // // // // //         title="Delete Transaction"
// // // // // //         description="This will affect the running balance. This action cannot be undone."
// // // // // //         confirmLabel="Delete"
// // // // // //         icon={Trash2}
// // // // // //         variant="destructive"
// // // // // //         isLoading={deleteMutation.isPending}
// // // // // //         loadingLabel="Deleting..."
// // // // // //       />

// // // // // //     </div>
// // // // // //   );
// // // // // // }




// // // // // // // // components/tabs/account-transactions-tab.tsx
// // // // // // // "use client";

// // // // // // // import { useState, useCallback } from "react";
// // // // // // // import { useQuery } from "@tanstack/react-query";
// // // // // // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // // // // // import { Input } from "@/components/ui/input";
// // // // // // // import { Label } from "@/components/ui/label";
// // // // // // // import { Button } from "@/components/ui/button";
// // // // // // // import {
// // // // // // //   Select,
// // // // // // //   SelectContent,
// // // // // // //   SelectItem,
// // // // // // //   SelectTrigger,
// // // // // // //   SelectValue,
// // // // // // // } from "@/components/ui/select";
// // // // // // // import {
// // // // // // //   Search,
// // // // // // //   Plus,
// // // // // // //   Trash2,
// // // // // // //   Loader2,
// // // // // // //   X,
// // // // // // //   ChevronLeft,
// // // // // // //   ChevronRight,
// // // // // // //   ChevronsLeft,
// // // // // // //   ChevronsRight,
// // // // // // //   Calendar,
// // // // // // //   Download,
// // // // // // //   ArrowLeft,
// // // // // // //   TrendingUp,
// // // // // // //   TrendingDown,
// // // // // // //   ExternalLink,
// // // // // // //   FileText,
// // // // // // // } from "lucide-react";
// // // // // // // import { toast } from "sonner";
// // // // // // // import { useDeleteAccountTransaction } from "@/hooks/use-account-transaction-mutations";
// // // // // // // import AddTransactionModal from "@/components/modals/add-transaction-modal";
// // // // // // // import type { Account } from "@/types/account";
// // // // // // // import type {
// // // // // // //   AccountTransaction,
// // // // // // //   AccountTransactionsPaginatedResponse,
// // // // // // //   AccountTransactionSummary,
// // // // // // // } from "@/types/accountTransaction";
// // // // // // // import ConfirmDialog from "@/components/dialogs/ConfirmDialog";

// // // // // // // type DateRangeType = "today" | "week" | "month" | "custom" | "all";
// // // // // // // type TransactionTypeFilter = "all" | "CREDIT" | "DEBIT";

// // // // // // // interface FilterState {
// // // // // // //   type: TransactionTypeFilter;
// // // // // // //   dateRange: DateRangeType;
// // // // // // //   startDate: string;
// // // // // // //   endDate: string;
// // // // // // //   currentPage: number;
// // // // // // //   pageSize: number;
// // // // // // // }

// // // // // // // // Table Skeleton
// // // // // // // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// // // // // // //   <tbody className="bg-white divide-y divide-gray-200">
// // // // // // //     {Array.from({ length: rows }).map((_, index) => (
// // // // // // //       <tr key={index} className="animate-pulse">
// // // // // // //         <td className="px-6 py-4">
// // // // // // //           <div className="space-y-1">
// // // // // // //             <div className="h-4 bg-gray-200 rounded w-24"></div>
// // // // // // //             <div className="h-3 bg-gray-200 rounded w-16"></div>
// // // // // // //           </div>
// // // // // // //         </td>
// // // // // // //         <td className="px-6 py-4">
// // // // // // //           <div className="h-4 bg-gray-200 rounded w-48"></div>
// // // // // // //         </td>
// // // // // // //         <td className="px-6 py-4 text-center">
// // // // // // //           <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
// // // // // // //         </td>
// // // // // // //         <td className="px-6 py-4 text-center">
// // // // // // //           <div className="h-4 bg-gray-200 rounded w-16 mx-auto"></div>
// // // // // // //         </td>
// // // // // // //         <td className="px-6 py-4 text-right">
// // // // // // //           <div className="h-5 bg-gray-200 rounded w-20 ml-auto"></div>
// // // // // // //         </td>
// // // // // // //         <td className="px-6 py-4 text-center">
// // // // // // //           <div className="h-4 bg-gray-200 rounded w-8 mx-auto"></div>
// // // // // // //         </td>
// // // // // // //         <td className="px-6 py-4 text-center">
// // // // // // //           <div className="h-8 w-8 bg-gray-200 rounded mx-auto"></div>
// // // // // // //         </td>
// // // // // // //       </tr>
// // // // // // //     ))}
// // // // // // //   </tbody>
// // // // // // // );

// // // // // // // interface AccountTransactionsTabProps {
// // // // // // //   account: Account;
// // // // // // //   onBack: () => void;
// // // // // // //   isMaster?: boolean;
// // // // // // // }

// // // // // // // export default function AccountTransactionsTab({
// // // // // // //   account,
// // // // // // //   onBack,
// // // // // // //   isMaster = false,
// // // // // // // }: AccountTransactionsTabProps) {
// // // // // // //     // In the header section, show owner info if Master
// // // // // // //   const getOwnerName = (acc: Account): string => {
// // // // // // //     if (typeof acc.ownerId === "string") return "";
// // // // // // //     return (acc.ownerId as any)?.name || "";
// // // // // // //   };
  
// // // // // // //   const deleteMutation = useDeleteAccountTransaction();

// // // // // // //   // Search state
// // // // // // //   const [searchInput, setSearchInput] = useState("");
// // // // // // //   const [committedSearch, setCommittedSearch] = useState("");

// // // // // // //   // Filter state
// // // // // // //   const [filters, setFilters] = useState<FilterState>({
// // // // // // //     type: "all",
// // // // // // //     dateRange: "all",
// // // // // // //     startDate: "",
// // // // // // //     endDate: "",
// // // // // // //     currentPage: 1,
// // // // // // //     pageSize: 20,
// // // // // // //   });

// // // // // // //   // Modal states
// // // // // // //   const [showAddModal, setShowAddModal] = useState(false);
// // // // // // //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// // // // // // //   const [selectedTransaction, setSelectedTransaction] = useState<AccountTransaction | null>(null);

// // // // // // //   const [isExporting, setIsExporting] = useState(false);

// // // // // // //   // Helper for date boundaries
// // // // // // //   const getUTCBoundaries = useCallback(
// // // // // // //     (dateRange: string, startDate: string, endDate: string) => {
// // // // // // //       const now = new Date();

// // // // // // //       switch (dateRange) {
// // // // // // //         case "today": {
// // // // // // //           const start = new Date(now);
// // // // // // //           start.setHours(0, 0, 0, 0);
// // // // // // //           const end = new Date(now);
// // // // // // //           end.setHours(23, 59, 59, 999);
// // // // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // // // //         }
// // // // // // //         case "week": {
// // // // // // //           const start = new Date(now);
// // // // // // //           start.setDate(now.getDate() - now.getDay());
// // // // // // //           start.setHours(0, 0, 0, 0);
// // // // // // //           const end = new Date(now);
// // // // // // //           end.setHours(23, 59, 59, 999);
// // // // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // // // //         }
// // // // // // //         case "month": {
// // // // // // //           const start = new Date(now.getFullYear(), now.getMonth(), 1);
// // // // // // //           start.setHours(0, 0, 0, 0);
// // // // // // //           const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
// // // // // // //           end.setHours(23, 59, 59, 999);
// // // // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // // // //         }
// // // // // // //         case "custom": {
// // // // // // //           if (!startDate || !endDate) return null;
// // // // // // //           const start = new Date(startDate);
// // // // // // //           start.setHours(0, 0, 0, 0);
// // // // // // //           const end = new Date(endDate);
// // // // // // //           end.setHours(23, 59, 59, 999);
// // // // // // //           return { startDate: start.toISOString(), endDate: end.toISOString() };
// // // // // // //         }
// // // // // // //         default:
// // // // // // //           return null;
// // // // // // //       }
// // // // // // //     },
// // // // // // //     []
// // // // // // //   );

// // // // // // //   // Fetch transactions
// // // // // // //   const { data: response, isLoading, isFetching } = useQuery<AccountTransactionsPaginatedResponse>({
// // // // // // //     queryKey: [
// // // // // // //       "account-transactions",
// // // // // // //       account?._id,
// // // // // // //       committedSearch,
// // // // // // //       filters.type,
// // // // // // //       filters.dateRange,
// // // // // // //       filters.startDate,
// // // // // // //       filters.endDate,
// // // // // // //       filters.currentPage,
// // // // // // //       filters.pageSize,
// // // // // // //     ],
// // // // // // //     queryFn: async (): Promise<AccountTransactionsPaginatedResponse> => {
// // // // // // //       const params = new URLSearchParams();
// // // // // // //       params.append("accountId", account?._id);

// // // // // // //       if (committedSearch) params.append("search", committedSearch);
// // // // // // //       if (filters.type !== "all") params.append("type", filters.type);

// // // // // // //       if (filters.dateRange !== "all") {
// // // // // // //         const boundaries = getUTCBoundaries(filters.dateRange, filters.startDate, filters.endDate);
// // // // // // //         if (boundaries) {
// // // // // // //           params.append("startDate", boundaries.startDate);
// // // // // // //           params.append("endDate", boundaries.endDate);
// // // // // // //         }
// // // // // // //       }

// // // // // // //       params.append("page", filters.currentPage.toString());
// // // // // // //       params.append("limit", filters.pageSize.toString());
// // // // // // //       params.append("sortBy", "enteredAt");
// // // // // // //       params.append("sortOrder", "desc");

// // // // // // //       const res = await fetch(`/api/account-transactions?${params}`);
// // // // // // //       if (!res.ok) throw new Error("Failed to fetch transactions");
// // // // // // //       return res.json();
// // // // // // //     },
// // // // // // //     staleTime: 30 * 1000,
// // // // // // //     placeholderData: (prev) => prev,
// // // // // // //   });

// // // // // // //   // Fetch summary
// // // // // // //   const { data: summaryResponse } = useQuery<{ success: boolean; data: AccountTransactionSummary }>({
// // // // // // //     queryKey: ["account-summary", account?._id],
// // // // // // //     queryFn: async () => {
// // // // // // //       const res = await fetch(`/api/account-transactions/summary?accountId=${account?._id}`);
// // // // // // //       if (!res.ok) throw new Error("Failed to fetch summary");
// // // // // // //       return res.json();
// // // // // // //     },
// // // // // // //     staleTime: 30 * 1000,
// // // // // // //   });

// // // // // // //   const transactions = response?.data?.transactions || [];
// // // // // // //   const pagination = response?.pagination;
// // // // // // //   const summary = summaryResponse?.data;

// // // // // // //   // Handlers
// // // // // // //   const handleSearch = useCallback(() => {
// // // // // // //     setCommittedSearch(searchInput.trim());
// // // // // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // // // // //   }, [searchInput]);

// // // // // // //   const handleSearchKeyDown = useCallback(
// // // // // // //     (e: React.KeyboardEvent<HTMLInputElement>) => {
// // // // // // //       if (e.key === "Enter") handleSearch();
// // // // // // //     },
// // // // // // //     [handleSearch]
// // // // // // //   );

// // // // // // //   const handleClearSearch = useCallback(() => {
// // // // // // //     setSearchInput("");
// // // // // // //     setCommittedSearch("");
// // // // // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // // // // //   }, []);

// // // // // // //   const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
// // // // // // //     setFilters((prev) => {
// // // // // // //       if (key === "dateRange" && value === "custom") {
// // // // // // //         const yesterday = new Date();
// // // // // // //         yesterday.setDate(yesterday.getDate() - 1);
// // // // // // //         const dateStr = yesterday.toISOString().split("T")[0];
// // // // // // //         return {
// // // // // // //           ...prev,
// // // // // // //           dateRange: "custom" as FilterState["dateRange"],
// // // // // // //           startDate: dateStr,
// // // // // // //           endDate: dateStr,
// // // // // // //           currentPage: 1,
// // // // // // //         };
// // // // // // //       }

// // // // // // //       if (key === "dateRange" && value !== "custom") {
// // // // // // //         return {
// // // // // // //           ...prev,
// // // // // // //           [key]: value,
// // // // // // //           startDate: "",
// // // // // // //           endDate: "",
// // // // // // //           currentPage: 1,
// // // // // // //         };
// // // // // // //       }

// // // // // // //       return {
// // // // // // //         ...prev,
// // // // // // //         [key]: value,
// // // // // // //         ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
// // // // // // //       };
// // // // // // //     });
// // // // // // //   }, []);

// // // // // // //   const handleDeleteClick = useCallback((transaction: AccountTransaction) => {
// // // // // // //     setSelectedTransaction(transaction);
// // // // // // //     setShowDeleteModal(true);
// // // // // // //   }, []);

// // // // // // //   const handleDeleteConfirm = useCallback(() => {
// // // // // // //     if (!selectedTransaction) return;
// // // // // // //     deleteMutation.mutate(
// // // // // // //        selectedTransaction._id ,
// // // // // // //       {
// // // // // // //         onSuccess: () => {
// // // // // // //           setShowDeleteModal(false);
// // // // // // //           setSelectedTransaction(null);
// // // // // // //         },
// // // // // // //       }
// // // // // // //     );
// // // // // // //   }, [selectedTransaction, account?._id, deleteMutation]);

// // // // // // //   const handlePageChange = useCallback((newPage: number) => {
// // // // // // //     setFilters((prev) => ({ ...prev, currentPage: newPage }));
// // // // // // //     window.scrollTo({ top: 0, behavior: "smooth" });
// // // // // // //   }, []);

// // // // // // //   const handlePageSizeChange = useCallback((newSize: string) => {
// // // // // // //     setFilters((prev) => ({
// // // // // // //       ...prev,
// // // // // // //       pageSize: parseInt(newSize),
// // // // // // //       currentPage: 1,
// // // // // // //     }));
// // // // // // //   }, []);

// // // // // // //   const formatDate = useCallback((dateString: string): string => {
// // // // // // //     return new Date(dateString).toLocaleDateString("en-GB", {
// // // // // // //       day: "2-digit",
// // // // // // //       month: "short",
// // // // // // //       year: "numeric",
// // // // // // //     });
// // // // // // //   }, []);

// // // // // // //   const formatTime = useCallback((dateString: string): string => {
// // // // // // //     return new Date(dateString).toLocaleTimeString("en-GB", {
// // // // // // //       hour: "2-digit",
// // // // // // //       minute: "2-digit",
// // // // // // //     });
// // // // // // //   }, []);

// // // // // // //   const formatCurrency = useCallback((amount: number): string => {
// // // // // // //     return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
// // // // // // //   }, []);

// // // // // // //   // Export handler
// // // // // // //   const handleExport = useCallback(() => {
// // // // // // //     try {
// // // // // // //       setIsExporting(true);

// // // // // // //       const headers = ["Date & Time", "Note", "Type", "Debit (−)", "Credit (+)", "Balance", "Bill URL"];
// // // // // // //       const rows: string[] = [];

// // // // // // //       transactions.forEach((txn) => {
// // // // // // //         const dateStr = `${formatDate(txn.enteredAt)} ${formatTime(txn.enteredAt)}`;

// // // // // // //         rows.push(
// // // // // // //           [
// // // // // // //             dateStr,
// // // // // // //             txn.note || "-",
// // // // // // //             txn.type,
// // // // // // //             txn.type === "DEBIT" ? txn.amount.toFixed(2) : "-",
// // // // // // //             txn.type === "CREDIT" ? txn.amount.toFixed(2) : "-",
// // // // // // //             txn.balanceAfter.toFixed(2),
// // // // // // //             txn.billUrl || "-",
// // // // // // //           ]
// // // // // // //             .map((cell) => `"${cell}"`)
// // // // // // //             .join(",")
// // // // // // //         );
// // // // // // //       });

// // // // // // //       const csvContent = [headers.join(","), ...rows].join("\n");
// // // // // // //       const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
// // // // // // //       const url = window.URL.createObjectURL(blob);
// // // // // // //       const link = document.createElement("a");
// // // // // // //       link.href = url;
// // // // // // //       link.download = `${account.name}-transactions-${new Date().toISOString().split("T")[0]}.csv`;
// // // // // // //       document.body.appendChild(link);
// // // // // // //       link.click();
// // // // // // //       document.body.removeChild(link);
// // // // // // //       window.URL.revokeObjectURL(url);

// // // // // // //       toast.success("Transactions exported successfully!");
// // // // // // //     } catch (error) {
// // // // // // //       console.error("Export error:", error);
// // // // // // //       toast.error("Failed to export transactions");
// // // // // // //     } finally {
// // // // // // //       setIsExporting(false);
// // // // // // //     }
// // // // // // //   }, [transactions, account.name, formatDate, formatTime]);

// // // // // // //   // Pagination Controls
// // // // // // //   const PaginationControls = useCallback(() => {
// // // // // // //     if (!pagination) return null;

// // // // // // //     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
// // // // // // //     const currentPage = filters.currentPage;

// // // // // // //     const getPageNumbers = (): number[] => {
// // // // // // //       const maxVisible = 5;
// // // // // // //       const pages: number[] = [];

// // // // // // //       if (totalPages <= maxVisible) {
// // // // // // //         for (let i = 1; i <= totalPages; i++) pages.push(i);
// // // // // // //       } else if (currentPage <= 3) {
// // // // // // //         for (let i = 1; i <= maxVisible; i++) pages.push(i);
// // // // // // //       } else if (currentPage >= totalPages - 2) {
// // // // // // //         for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
// // // // // // //       } else {
// // // // // // //         for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
// // // // // // //       }

// // // // // // //       return pages;
// // // // // // //     };

// // // // // // //     return (
// // // // // // //       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
// // // // // // //         <div className="flex items-center space-x-2">
// // // // // // //           <span className="text-sm text-gray-700">
// // // // // // //             Showing {startIndex} to {endIndex} of {totalCount} entries
// // // // // // //           </span>
// // // // // // //           <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
// // // // // // //             <SelectTrigger className="w-20">
// // // // // // //               <SelectValue />
// // // // // // //             </SelectTrigger>
// // // // // // //             <SelectContent>
// // // // // // //               <SelectItem value="10">10</SelectItem>
// // // // // // //               <SelectItem value="20">20</SelectItem>
// // // // // // //               <SelectItem value="50">50</SelectItem>
// // // // // // //               <SelectItem value="100">100</SelectItem>
// // // // // // //             </SelectContent>
// // // // // // //           </Select>
// // // // // // //           <span className="text-sm text-gray-700">per page</span>
// // // // // // //         </div>

// // // // // // //         <div className="flex items-center space-x-2">
// // // // // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={!hasPreviousPage}>
// // // // // // //             <ChevronsLeft className="w-4 h-4" />
// // // // // // //           </Button>
// // // // // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={!hasPreviousPage}>
// // // // // // //             <ChevronLeft className="w-4 h-4" />
// // // // // // //           </Button>

// // // // // // //           <div className="flex items-center space-x-1">
// // // // // // //             {getPageNumbers().map((pageNumber) => (
// // // // // // //               <Button
// // // // // // //                 key={pageNumber}
// // // // // // //                 variant={currentPage === pageNumber ? "default" : "outline"}
// // // // // // //                 size="sm"
// // // // // // //                 onClick={() => handlePageChange(pageNumber)}
// // // // // // //                 className="w-8 h-8"
// // // // // // //               >
// // // // // // //                 {pageNumber}
// // // // // // //               </Button>
// // // // // // //             ))}
// // // // // // //           </div>

// // // // // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={!hasNextPage}>
// // // // // // //             <ChevronRight className="w-4 h-4" />
// // // // // // //           </Button>
// // // // // // //           <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={!hasNextPage}>
// // // // // // //             <ChevronsRight className="w-4 h-4" />
// // // // // // //           </Button>
// // // // // // //         </div>
// // // // // // //       </div>
// // // // // // //     );
// // // // // // //   }, [pagination, filters.currentPage, filters.pageSize, handlePageChange, handlePageSizeChange]);

// // // // // // //   const showSkeleton = isLoading || isFetching;

// // // // // // //   return (
// // // // // // //     <div className="space-y-6">
// // // // // // //       {/* Header */}
// // // // // // //       <div className="flex justify-between items-center">
// // // // // // //         <div className="flex items-center gap-4">
// // // // // // //           <Button variant="ghost" onClick={onBack} className="p-2">
// // // // // // //             <ArrowLeft className="w-5 h-5" />
// // // // // // //           </Button>
// // // // // // //           <div>
// // // // // // //             <h2 className="text-2xl font-bold text-gray-900">{account.name}</h2>
// // // // // // //             {account.description && <p className="text-sm text-gray-500">{account.description}</p>}
// // // // // // //           </div>
// // // // // // //         </div>
// // // // // // //         <div className="flex gap-2">
// // // // // // //           <Button onClick={handleExport} variant="outline" disabled={isExporting || transactions.length === 0}>
// // // // // // //             {isExporting ? (
// // // // // // //               <>
// // // // // // //                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
// // // // // // //                 Exporting...
// // // // // // //               </>
// // // // // // //             ) : (
// // // // // // //               <>
// // // // // // //                 <Download className="w-4 h-4 mr-2" />
// // // // // // //                 Export
// // // // // // //               </>
// // // // // // //             )}
// // // // // // //           </Button>
// // // // // // //           <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600">
// // // // // // //             <Plus className="w-4 h-4 mr-2" />
// // // // // // //             Add Entry
// // // // // // //           </Button>
// // // // // // //         </div>
// // // // // // //       </div>

// // // // // // //       {/* Summary Cards */}
// // // // // // //       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // // // // // //         <Card>
// // // // // // //           <CardContent className="p-4">
// // // // // // //             <div className="flex items-center justify-between">
// // // // // // //               <div>
// // // // // // //                 <p className="text-sm text-gray-500">Current Balance</p>
// // // // // // //                 <p
// // // // // // //                   className={`text-2xl font-bold ${
// // // // // // //                     account.currentBalance >= 0 ? "text-blue-600" : "text-red-600"
// // // // // // //                   }`}
// // // // // // //                 >
// // // // // // //                   {formatCurrency(account.currentBalance)}
// // // // // // //                 </p>
// // // // // // //               </div>
// // // // // // //               <div className="p-3 bg-blue-100 rounded-full">
// // // // // // //                 <FileText className="w-6 h-6 text-blue-600" />
// // // // // // //               </div>
// // // // // // //             </div>
// // // // // // //           </CardContent>
// // // // // // //         </Card>

// // // // // // //         <Card>
// // // // // // //           <CardContent className="p-4">
// // // // // // //             <div className="flex items-center justify-between">
// // // // // // //               <div>
// // // // // // //                 <p className="text-sm text-gray-500">Total Credit</p>
// // // // // // //                 <p className="text-2xl font-bold text-green-600">
// // // // // // //                   {formatCurrency(summary?.totalCredit || 0)}
// // // // // // //                 </p>
// // // // // // //               </div>
// // // // // // //               <div className="p-3 bg-green-100 rounded-full">
// // // // // // //                 <TrendingUp className="w-6 h-6 text-green-600" />
// // // // // // //               </div>
// // // // // // //             </div>
// // // // // // //           </CardContent>
// // // // // // //         </Card>

// // // // // // //         <Card>
// // // // // // //           <CardContent className="p-4">
// // // // // // //             <div className="flex items-center justify-between">
// // // // // // //               <div>
// // // // // // //                 <p className="text-sm text-gray-500">Total Debit</p>
// // // // // // //                 <p className="text-2xl font-bold text-red-600">
// // // // // // //                   {formatCurrency(summary?.totalDebit || 0)}
// // // // // // //                 </p>
// // // // // // //               </div>
// // // // // // //               <div className="p-3 bg-red-100 rounded-full">
// // // // // // //                 <TrendingDown className="w-6 h-6 text-red-600" />
// // // // // // //               </div>
// // // // // // //             </div>
// // // // // // //           </CardContent>
// // // // // // //         </Card>

// // // // // // //         <Card>
// // // // // // //           <CardContent className="p-4">
// // // // // // //             <div className="flex items-center justify-between">
// // // // // // //               <div>
// // // // // // //                 <p className="text-sm text-gray-500">Total Entries</p>
// // // // // // //                 <p className="text-2xl font-bold text-gray-900">{summary?.totalEntries || 0}</p>
// // // // // // //               </div>
// // // // // // //               <div className="p-3 bg-gray-100 rounded-full">
// // // // // // //                 <FileText className="w-6 h-6 text-gray-600" />
// // // // // // //               </div>
// // // // // // //             </div>
// // // // // // //           </CardContent>
// // // // // // //         </Card>
// // // // // // //       </div>

// // // // // // //       {/* Filters */}
// // // // // // //       <Card>
// // // // // // //         <CardContent className="p-6">
// // // // // // //           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // // // // // //             {/* Search */}
// // // // // // //             <div>
// // // // // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
// // // // // // //               <div className="flex gap-2">
// // // // // // //                 <div className="relative flex-1">
// // // // // // //                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // // // // // //                   <Input
// // // // // // //                     placeholder="Search notes..."
// // // // // // //                     value={searchInput}
// // // // // // //                     onChange={(e) => setSearchInput(e.target.value)}
// // // // // // //                     onKeyDown={handleSearchKeyDown}
// // // // // // //                     className="pl-10 pr-8"
// // // // // // //                   />
// // // // // // //                   {searchInput && (
// // // // // // //                     <button
// // // // // // //                       onClick={handleClearSearch}
// // // // // // //                       className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
// // // // // // //                       type="button"
// // // // // // //                     >
// // // // // // //                       <X className="w-4 h-4" />
// // // // // // //                     </button>
// // // // // // //                   )}
// // // // // // //                 </div>
// // // // // // //                 <Button onClick={handleSearch} disabled={isFetching} size="icon" className="shrink-0">
// // // // // // //                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// // // // // // //                 </Button>
// // // // // // //               </div>
// // // // // // //             </div>

// // // // // // //             {/* Type Filter */}
// // // // // // //             <div>
// // // // // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Type</Label>
// // // // // // //               <Select
// // // // // // //                 value={filters.type}
// // // // // // //                 onValueChange={(value: TransactionTypeFilter) => updateFilter("type", value)}
// // // // // // //               >
// // // // // // //                 <SelectTrigger>
// // // // // // //                   <SelectValue />
// // // // // // //                 </SelectTrigger>
// // // // // // //                 <SelectContent>
// // // // // // //                   <SelectItem value="all">All Types</SelectItem>
// // // // // // //                   <SelectItem value="CREDIT">Credit Only</SelectItem>
// // // // // // //                   <SelectItem value="DEBIT">Debit Only</SelectItem>
// // // // // // //                 </SelectContent>
// // // // // // //               </Select>
// // // // // // //             </div>

// // // // // // //             {/* Date Range */}
// // // // // // //             <div>
// // // // // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Date Range</Label>
// // // // // // //               <Select
// // // // // // //                 value={filters.dateRange}
// // // // // // //                 onValueChange={(value: DateRangeType) => updateFilter("dateRange", value)}
// // // // // // //               >
// // // // // // //                 <SelectTrigger>
// // // // // // //                   <SelectValue />
// // // // // // //                 </SelectTrigger>
// // // // // // //                 <SelectContent>
// // // // // // //                   <SelectItem value="today">Today</SelectItem>
// // // // // // //                   <SelectItem value="week">This Week</SelectItem>
// // // // // // //                   <SelectItem value="month">This Month</SelectItem>
// // // // // // //                   <SelectItem value="custom">Custom Range</SelectItem>
// // // // // // //                   <SelectItem value="all">All Time</SelectItem>
// // // // // // //                 </SelectContent>
// // // // // // //               </Select>
// // // // // // //             </div>

// // // // // // //             {/* Placeholder */}
// // // // // // //             <div></div>

// // // // // // //             {/* Custom Date */}
// // // // // // //             {filters.dateRange === "custom" && (
// // // // // // //               <div className="md:col-span-4">
// // // // // // //                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
// // // // // // //                   <div>
// // // // // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // // // // // //                       <Calendar className="w-4 h-4" />
// // // // // // //                       Start Date
// // // // // // //                     </Label>
// // // // // // //                     <Input
// // // // // // //                       type="date"
// // // // // // //                       value={filters.startDate}
// // // // // // //                       onChange={(e) => updateFilter("startDate", e.target.value)}
// // // // // // //                       max={filters.endDate || undefined}
// // // // // // //                     />
// // // // // // //                   </div>
// // // // // // //                   <div>
// // // // // // //                     <Label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
// // // // // // //                       <Calendar className="w-4 h-4" />
// // // // // // //                       End Date
// // // // // // //                     </Label>
// // // // // // //                     <Input
// // // // // // //                       type="date"
// // // // // // //                       value={filters.endDate}
// // // // // // //                       onChange={(e) => updateFilter("endDate", e.target.value)}
// // // // // // //                       min={filters.startDate || undefined}
// // // // // // //                     />
// // // // // // //                   </div>
// // // // // // //                 </div>
// // // // // // //               </div>
// // // // // // //             )}
// // // // // // //           </div>
// // // // // // //         </CardContent>
// // // // // // //       </Card>

// // // // // // //       {/* Table */}
// // // // // // //       <Card>
// // // // // // //         <CardHeader>
// // // // // // //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// // // // // // //             Transaction Ledger
// // // // // // //             {pagination && (
// // // // // // //               <span className="ml-2 text-sm font-normal text-gray-500">({pagination.totalCount} entries)</span>
// // // // // // //             )}
// // // // // // //             {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />}
// // // // // // //           </CardTitle>
// // // // // // //         </CardHeader>
// // // // // // //         <CardContent className="p-0">
// // // // // // //           <div className="overflow-x-auto">
// // // // // // //             <table className="w-full">
// // // // // // //               <thead className="bg-gray-50">
// // // // // // //                 <tr>
// // // // // // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // // //                     Date & Time
// // // // // // //                   </th>
// // // // // // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // // //                     Note
// // // // // // //                   </th>
// // // // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // // //                     Debit (−)
// // // // // // //                   </th>
// // // // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // // //                     Credit (+)
// // // // // // //                   </th>
// // // // // // //                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // // //                     Balance
// // // // // // //                   </th>
// // // // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // // //                     Bill
// // // // // // //                   </th>
// // // // // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // // // // //                     Actions
// // // // // // //                   </th>
// // // // // // //                 </tr>
// // // // // // //               </thead>

// // // // // // //               {showSkeleton ? (
// // // // // // //                 <TableSkeleton rows={filters.pageSize} />
// // // // // // //               ) : (
// // // // // // //                 <tbody className="bg-white divide-y divide-gray-200">
// // // // // // //                   {transactions.length === 0 ? (
// // // // // // //                     <tr>
// // // // // // //                       <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
// // // // // // //                         No transactions found. Add your first entry to start tracking.
// // // // // // //                       </td>
// // // // // // //                     </tr>
// // // // // // //                   ) : (
// // // // // // //                     transactions.map((txn) => (
// // // // // // //                       <tr key={txn._id} className="hover:bg-gray-50">
// // // // // // //                         <td className="px-6 py-4 whitespace-nowrap">
// // // // // // //                           <div>
// // // // // // //                             <p className="text-sm font-medium text-gray-900">{formatDate(txn.enteredAt)}</p>
// // // // // // //                             <p className="text-xs text-gray-500">{formatTime(txn.enteredAt)}</p>
// // // // // // //                           </div>
// // // // // // //                         </td>
// // // // // // //                         <td className="px-6 py-4">
// // // // // // //                           <p className="text-sm text-gray-900 max-w-xs truncate">{txn.note || "—"}</p>
// // // // // // //                         </td>
// // // // // // //                         <td className="px-6 py-4 text-center">
// // // // // // //                           {txn.type === "DEBIT" ? (
// // // // // // //                             <span className="text-sm font-medium text-red-600">
// // // // // // //                               {formatCurrency(txn.amount)}
// // // // // // //                             </span>
// // // // // // //                           ) : (
// // // // // // //                             <span className="text-sm text-gray-400">—</span>
// // // // // // //                           )}
// // // // // // //                         </td>
// // // // // // //                         <td className="px-6 py-4 text-center">
// // // // // // //                           {txn.type === "CREDIT" ? (
// // // // // // //                             <span className="text-sm font-medium text-green-600">
// // // // // // //                               {formatCurrency(txn.amount)}
// // // // // // //                             </span>
// // // // // // //                           ) : (
// // // // // // //                             <span className="text-sm text-gray-400">—</span>
// // // // // // //                           )}
// // // // // // //                         </td>
// // // // // // //                         <td className="px-6 py-4 text-right">
// // // // // // //                           <span
// // // // // // //                             className={`text-sm font-semibold ${
// // // // // // //                               txn.balanceAfter >= 0 ? "text-blue-600" : "text-red-600"
// // // // // // //                             }`}
// // // // // // //                           >
// // // // // // //                             {formatCurrency(txn.balanceAfter)}
// // // // // // //                           </span>
// // // // // // //                         </td>
// // // // // // //                         <td className="px-6 py-4 text-center">
// // // // // // //                           {txn.billUrl ? (
// // // // // // //                             <a
// // // // // // //                               href={txn.billUrl}
// // // // // // //                               target="_blank"
// // // // // // //                               rel="noopener noreferrer"
// // // // // // //                               className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-600"
// // // // // // //                               title="View Bill"
// // // // // // //                             >
// // // // // // //                               <ExternalLink className="w-4 h-4" />
// // // // // // //                             </a>
// // // // // // //                           ) : (
// // // // // // //                             <span className="text-sm text-gray-400">—</span>
// // // // // // //                           )}
// // // // // // //                         </td>
// // // // // // //                         <td className="px-6 py-4 text-center">
// // // // // // //                           <Button
// // // // // // //                             variant="ghost"
// // // // // // //                             size="sm"
// // // // // // //                             onClick={() => handleDeleteClick(txn)}
// // // // // // //                             className="text-red-500 hover:text-red-600 hover:bg-red-50"
// // // // // // //                             title="Delete Transaction"
// // // // // // //                           >
// // // // // // //                             <Trash2 className="w-4 h-4" />
// // // // // // //                           </Button>
// // // // // // //                         </td>
// // // // // // //                       </tr>
// // // // // // //                     ))
// // // // // // //                   )}
// // // // // // //                 </tbody>
// // // // // // //               )}
// // // // // // //             </table>
// // // // // // //           </div>

// // // // // // //           <PaginationControls />
// // // // // // //         </CardContent>
// // // // // // //       </Card>

// // // // // // //       {/* Modals */}
// // // // // // //       <AddTransactionModal open={showAddModal} onOpenChange={setShowAddModal} account={account} />

// // // // // // //       {/* Using Universal Confirmation Modal */}
// // // // // // //       <ConfirmDialog
// // // // // // //         open={showDeleteModal}
// // // // // // //         onOpenChange={setShowDeleteModal}
// // // // // // //         onConfirm={handleDeleteConfirm}
// // // // // // //         title="Delete Transaction"
// // // // // // //         description="This will affect the running balance. This action cannot be undone."
// // // // // // //         confirmLabel="Delete"
// // // // // // //         icon={Trash2}
// // // // // // //         variant="destructive"
// // // // // // //         isLoading={deleteMutation.isPending}
// // // // // // //         loadingLabel="Deleting..."
// // // // // // //       />

// // // // // // //     </div>
// // // // // // //   );
// // // // // // // }