"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Loader2, Pencil, Trash2, Wallet, TrendingUp, Eye, X, AlertCircle,
  PowerOff, Receipt,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import AddAccountModal from "@/components/modals/add-account-modal";
import EditAccountModal from "@/components/modals/edit-account-modal";
import AddTransactionModal from "@/components/modals/add-transaction-modal";
import { useDeleteAccount, useUpdateAccount } from "@/hooks/use-account-mutations";
import type { Account, AccountsPaginatedResponse, PaginationMetadata } from "@/types/account";

export interface AccountsTabProps {
  onSelectAccount?: (account: Account) => void;
}

interface FilterState {
  includeInactive: boolean;
  currentPage: number;
  pageSize: number;
  sortBy: "name" | "createdAt" | "currentBalance";
  sortOrder: "asc" | "desc";
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

const TableSkeleton = ({ rows = 5, isMaster = false }: { rows?: number; isMaster?: boolean }) => (
  <tbody className="bg-white divide-y divide-gray-100">
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-gray-100 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5">
              <div className="h-3.5 bg-gray-100 rounded w-28" />
              <div className="h-3 bg-gray-100 rounded w-20" />
            </div>
          </div>
        </td>
        {isMaster && <td className="px-4 py-3"><div className="h-3.5 bg-gray-100 rounded w-24" /></td>}
        <td className="px-4 py-3 text-right"><div className="h-4 bg-gray-100 rounded w-24 ml-auto" /></td>
        <td className="px-4 py-3 text-center"><div className="h-5 bg-gray-100 rounded-full w-14 mx-auto" /></td>
        <td className="px-4 py-3 text-center"><div className="h-3.5 bg-gray-100 rounded w-20 mx-auto" /></td>
        <td className="px-4 py-3">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4].map((k) => <div key={k} className="h-7 w-7 bg-gray-100 rounded" />)}
          </div>
        </td>
      </tr>
    ))}
  </tbody>
);

// ── Stat Tile ─────────────────────────────────────────────────────────────────

const StatTile = ({ label, value, sub, icon: Icon, colorClass }: {
  label: string; value: string; sub?: string; icon: React.ElementType; colorClass: string;
}) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colorClass}`}>
    <div className="p-1.5 rounded-lg bg-white/60">
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide leading-none">{label}</p>
      <p className="text-base font-bold tabular-nums leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-xs opacity-55 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function AccountsTab({ onSelectAccount }: AccountsTabProps) {
  const { data: session } = useSession();
  const isMaster = session?.user?.role?.toUpperCase() === "SUPERUSER";

  const deleteMutation = useDeleteAccount();
  const updateMutation = useUpdateAccount();

  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    includeInactive: false, currentPage: 1, pageSize: 10,
    sortBy: "name", sortOrder: "asc",
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddTxnModal, setShowAddTxnModal] = useState(false);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Account | null>(null);

  // Fetch
  const { data, isLoading, isFetching } = useQuery<AccountsPaginatedResponse>({
    queryKey: ["accounts", committedSearch, filters.includeInactive, filters.currentPage, filters.pageSize, filters.sortBy, filters.sortOrder],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (committedSearch) p.set("search", committedSearch);
      p.set("includeInactive", String(filters.includeInactive));
      p.set("page", String(filters.currentPage));
      p.set("limit", String(filters.pageSize));
      p.set("sortBy", filters.sortBy);
      p.set("sortOrder", filters.sortOrder);
      const res = await fetch(`/api/accounts?${p}`);
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json();
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const accounts: Account[] = data?.data?.accounts ?? [];
  const pagination: PaginationMetadata | undefined = data?.pagination;

  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);
  const activeCount = accounts.filter((a) => a.isActive).length;
  const creditCount = accounts.filter((a) => a.currentBalance > 0).length;

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
    setFilters((prev) => ({
      ...prev, [key]: value,
      ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
    }));
  }, []);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null),
      onError: () => toast.error("Failed to delete account"),
    });
  }, [deleteTarget, deleteMutation]);

  const handleToggleActive = useCallback(() => {
    if (!toggleTarget) return;
    updateMutation.mutate(
      { _id: toggleTarget._id, isActive: !toggleTarget.isActive },
      { onSuccess: () => setToggleTarget(null) }
    );
  }, [toggleTarget, updateMutation]);

  const fmt = (n: number) =>
    `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  // Pagination
  const PaginationControls = () => {
    if (!pagination) return null;
    const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
    const cp = filters.currentPage;
    const pages: number[] = [];
    if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i);
    else if (cp <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
    else if (cp >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    else for (let i = cp - 2; i <= cp + 2; i++) pages.push(i);

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span>{startIndex}–{endIndex} of {totalCount}</span>
          <Select value={String(filters.pageSize)} onValueChange={(v) => updateFilter("pageSize", Number(v) as FilterState["pageSize"])}>
            <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[5, 10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
          <span>per page</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateFilter("currentPage", 1)} disabled={!hasPreviousPage}><ChevronsLeft className="h-3.5 w-3.5" /></Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateFilter("currentPage", cp - 1)} disabled={!hasPreviousPage}><ChevronLeft className="h-3.5 w-3.5" /></Button>
          {pages.map((p) => <Button key={p} variant={cp === p ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => updateFilter("currentPage", p)}>{p}</Button>)}
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateFilter("currentPage", cp + 1)} disabled={!hasNextPage}><ChevronRight className="h-3.5 w-3.5" /></Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateFilter("currentPage", totalPages)} disabled={!hasNextPage}><ChevronsRight className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">

      {/* ── Layout: search left | tiles right ──────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* Left half — search + sort controls */}
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search accounts…"
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
              {isFetching && !isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
            {/* New Account — MASTER only */}
            {isMaster && (
              <Button onClick={() => setShowAddModal(true)} className="gap-1.5 whitespace-nowrap">
                <Plus className="w-4 h-4" />New Account
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 whitespace-nowrap">Sort</Label>
              <Select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onValueChange={(v) => {
                  const [by, order] = v.split("-") as [FilterState["sortBy"], FilterState["sortOrder"]];
                  setFilters((p) => ({ ...p, sortBy: by, sortOrder: order, currentPage: 1 }));
                }}
              >
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name (A → Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z → A)</SelectItem>
                  <SelectItem value="currentBalance-desc">Balance (High → Low)</SelectItem>
                  <SelectItem value="currentBalance-asc">Balance (Low → High)</SelectItem>
                  <SelectItem value="createdAt-desc">Newest First</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="checkbox" checked={filters.includeInactive}
                onChange={(e) => updateFilter("includeInactive", e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600" />
              <span className="text-xs text-gray-500">Show inactive</span>
            </label>
          </div>
        </div>

        {/* Right half — stat tiles */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <StatTile label="Balance" value={fmt(totalBalance)} sub="visible accounts"
            icon={Wallet} colorClass="bg-blue-50 text-blue-700 border-blue-100" />
          <StatTile label="Active" value={String(activeCount)} sub={`of ${accounts.length}`}
            icon={TrendingUp} colorClass="bg-green-50 text-green-700 border-green-100" />
          <StatTile label="In Credit" value={String(creditCount)} sub="positive balance"
            icon={Receipt} colorClass="bg-purple-50 text-purple-700 border-purple-100" />
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                {isMaster && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>

            {isLoading ? (
              <TableSkeleton rows={filters.pageSize} isMaster={isMaster} />
            ) : (
              <tbody className="bg-white divide-y divide-gray-100">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={isMaster ? 6 : 5} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <Wallet className="w-10 h-10 opacity-25" />
                        <p className="text-sm font-medium">No accounts found</p>
                        {committedSearch && (
                          <button onClick={handleClearSearch} className="text-xs text-blue-500 hover:underline">Clear search</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  accounts.map((account) => {
                    const ownerObj = typeof account.ownerId === "object"
                      ? (account.ownerId as { name?: string; username?: string; email?: string })
                      : null;
                    return (
                      <tr key={account._id} className="hover:bg-gray-50/60 transition-colors">

                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              account.isActive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
                            }`}>
                              {account.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate">{account.name}</p>
                              {account.description && (
                                <p className="text-xs text-gray-400 truncate max-w-[200px]">{account.description}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Owner (master only) */}
                        {isMaster && (
                          <td className="px-4 py-3">
                            {ownerObj ? (
                              <div>
                                <p className="font-medium text-gray-700 truncate max-w-[140px]">{ownerObj.name ?? "—"}</p>
                                <p className="text-xs text-gray-400 truncate max-w-[140px]">
                                  @{ownerObj.username ?? ownerObj.email?.split("@")[0]}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300 italic">—</span>
                            )}
                          </td>
                        )}

                        {/* Balance */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`font-bold tabular-nums ${
                            account.currentBalance < 0 ? "text-red-600"
                              : account.currentBalance === 0 ? "text-gray-400"
                              : "text-green-600"
                          }`}>
                            {fmt(account.currentBalance)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <Badge className={account.isActive
                            ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs"
                            : "bg-gray-100 text-gray-500 text-xs"}>
                            {account.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>

                        {/* Created */}
                        <td className="px-4 py-3 text-center text-xs text-gray-400 whitespace-nowrap">
                          {fmtDate(account.createdAt)}
                        </td>

                        {/* ── Inline actions ── */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-0.5">

                            {/* Add transaction (all users, active accounts only) */}
                            <Button variant="ghost" size="icon"
                              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => { setActiveAccount(account); setShowAddTxnModal(true); }}
                              title={account.isActive ? "Add Transaction" : "Account is inactive"}
                              disabled={!account.isActive}>
                              <Plus className="w-3.5 h-3.5" />
                            </Button>

                            {/* View transactions (all users) */}
                            {onSelectAccount && (
                              <Button variant="ghost" size="icon"
                                className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => onSelectAccount(account)}
                                title="View Transactions">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Edit — MASTER only */}
                            {isMaster && (
                              <Button variant="ghost" size="icon"
                                className="h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                onClick={() => { setActiveAccount(account); setShowEditModal(true); }}
                                title="Edit Account">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Toggle active — MASTER only */}
                            {isMaster && (
                              <Button variant="ghost" size="icon"
                                className={`h-7 w-7 ${account.isActive
                                  ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                                  : "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"}`}
                                onClick={() => setToggleTarget(account)}
                                title={account.isActive ? "Deactivate" : "Activate"}>
                                <PowerOff className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Delete — MASTER only */}
                            {isMaster && (
                              <Button variant="ghost" size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteTarget(account)}
                                title="Delete Account">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            )}
          </table>
        </div>
        <PaginationControls />
      </Card>

      {/* ── Modals ── */}
      {isMaster && <AddAccountModal open={showAddModal} onOpenChange={setShowAddModal} />}
      <EditAccountModal open={showEditModal} onOpenChange={(o) => { setShowEditModal(o); if (!o) setActiveAccount(null); }} account={activeAccount} />
      {activeAccount && (
        <AddTransactionModal open={showAddTxnModal} onOpenChange={(o) => { setShowAddTxnModal(o); if (!o) setActiveAccount(null); }} account={activeAccount} />
      )}

      {/* Toggle active confirm */}
      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PowerOff className="w-5 h-5 text-amber-500" />
              {toggleTarget?.isActive ? "Deactivate" : "Activate"} Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.isActive
                ? `Deactivating "${toggleTarget.name}" will prevent new transactions.`
                : `Activating "${toggleTarget?.name}" will allow new transactions again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive} disabled={updateMutation.isPending}
              className={toggleTarget?.isActive ? "bg-amber-500 hover:bg-amber-600" : "bg-green-500 hover:bg-green-600"}>
              {updateMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</>
                : toggleTarget?.isActive ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete{" "}
              <span className="font-semibold text-gray-900">"{deleteTarget?.name}"</span>?
              All transaction history will be lost. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-red-500 hover:bg-red-600">
              {deleteMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : "Delete"}
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
//   Search,
//   Plus,
//   ChevronLeft,
//   ChevronRight,
//   ChevronsLeft,
//   ChevronsRight,
//   Loader2,
//   Pencil,
//   Trash2,
//   Wallet,
//   TrendingUp,
//   TrendingDown,
//   Eye,
//   MoreVertical,
//   X,
//   AlertCircle,
// } from "lucide-react";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from "@/components/ui/alert-dialog";
// import { toast } from "sonner";
// import AddAccountModal from "@/components/modals/add-account-modal";
// import EditAccountModal from "@/components/modals/edit-account-modal";
// import { useDeleteAccount } from "@/hooks/use-account-mutations";
// import type { Account, AccountsPaginatedResponse, PaginationMetadata } from "@/types/account";

// interface AccountsTabProps {
//   onSelectAccount?: (account: Account) => void;
// }

// interface FilterState {
//   includeInactive: boolean;
//   currentPage: number;
//   pageSize: number;
//   sortBy: "name" | "createdAt" | "currentBalance";
//   sortOrder: "asc" | "desc";
// }

// // ── Skeleton ──────────────────────────────────────────────────────────────────

// const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
//   <tbody className="bg-white divide-y divide-gray-100">
//     {Array.from({ length: rows }).map((_, i) => (
//       <tr key={i} className="animate-pulse">
//         <td className="px-6 py-4">
//           <div className="flex items-center gap-3">
//             <div className="h-9 w-9 bg-gray-100 rounded-lg" />
//             <div className="space-y-1.5">
//               <div className="h-4 bg-gray-100 rounded w-32" />
//               <div className="h-3 bg-gray-100 rounded w-48" />
//             </div>
//           </div>
//         </td>
//         <td className="px-6 py-4">
//           <div className="h-5 bg-gray-100 rounded w-28 ml-auto" />
//         </td>
//         <td className="px-6 py-4 text-center">
//           <div className="h-5 bg-gray-100 rounded-full w-16 mx-auto" />
//         </td>
//         <td className="px-6 py-4 text-center">
//           <div className="h-4 bg-gray-100 rounded w-20 mx-auto" />
//         </td>
//         <td className="px-6 py-4 text-center">
//           <div className="flex justify-center gap-2">
//             <div className="h-8 w-8 bg-gray-100 rounded" />
//             <div className="h-8 w-8 bg-gray-100 rounded" />
//           </div>
//         </td>
//       </tr>
//     ))}
//   </tbody>
// );

// // ── Stats Card ────────────────────────────────────────────────────────────────

// const StatCard = ({
//   label,
//   value,
//   sub,
//   icon: Icon,
//   color,
// }: {
//   label: string;
//   value: string;
//   sub?: string;
//   icon: React.ElementType;
//   color: string;
// }) => (
//   <Card className="border-0 shadow-sm">
//     <CardContent className="p-5">
//       <div className="flex items-start justify-between">
//         <div>
//           <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
//           <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
//           {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
//         </div>
//         <div className={`p-2.5 rounded-xl ${color}`}>
//           <Icon className="w-5 h-5" />
//         </div>
//       </div>
//     </CardContent>
//   </Card>
// );

// // ── Main Component ────────────────────────────────────────────────────────────

// export default function AccountsTab({ onSelectAccount }: AccountsTabProps) {
//   const deleteMutation = useDeleteAccount();

//   // Search state
//   const [searchInput, setSearchInput] = useState("");
//   const [committedSearch, setCommittedSearch] = useState("");

//   const [filters, setFilters] = useState<FilterState>({
//     includeInactive: false,
//     currentPage: 1,
//     pageSize: 10,
//     sortBy: "name",
//     sortOrder: "asc",
//   });

//   // Modal state
//   const [showAddModal, setShowAddModal] = useState(false);
//   const [showEditModal, setShowEditModal] = useState(false);
//   const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
//   const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

//   // ── Fetch ──────────────────────────────────────────────────────────────────

//   const { data, isLoading, isFetching } = useQuery<AccountsPaginatedResponse>({
//     queryKey: [
//       "accounts",
//       committedSearch,
//       filters.includeInactive,
//       filters.currentPage,
//       filters.pageSize,
//       filters.sortBy,
//       filters.sortOrder,
//     ],
//     queryFn: async () => {
//       const params = new URLSearchParams();
//       if (committedSearch) params.set("search", committedSearch);
//       params.set("includeInactive", String(filters.includeInactive));
//       params.set("page", String(filters.currentPage));
//       params.set("limit", String(filters.pageSize));
//       params.set("sortBy", filters.sortBy);
//       params.set("sortOrder", filters.sortOrder);

//       const res = await fetch(`/api/accounts?${params}`);
//       if (!res.ok) throw new Error("Failed to fetch accounts");
//       return res.json();
//     },
//     staleTime: 30_000,
//     placeholderData: (prev) => prev,
//   });

//   const accounts: Account[] = data?.data?.accounts ?? [];
//   const pagination: PaginationMetadata | undefined = data?.pagination;

//   // Aggregate stats from current page (ideally from a summary endpoint)
//   const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);
//   const activeCount = accounts.filter((a) => a.isActive).length;
//   const creditAccounts = accounts.filter((a) => a.currentBalance > 0).length;

//   // ── Handlers ───────────────────────────────────────────────────────────────

//   const handleSearch = useCallback(() => {
//     setCommittedSearch(searchInput.trim());
//     setFilters((prev) => ({ ...prev, currentPage: 1 }));
//   }, [searchInput]);

//   const handleClearSearch = useCallback(() => {
//     setSearchInput("");
//     setCommittedSearch("");
//     setFilters((prev) => ({ ...prev, currentPage: 1 }));
//   }, []);

//   const handleDelete = useCallback(() => {
//     if (!deleteTarget) return;
//     deleteMutation.mutate(deleteTarget._id, {
//       onSuccess: () => setDeleteTarget(null),
//       onError: () => toast.error("Failed to delete account"),
//     });
//   }, [deleteTarget, deleteMutation]);

//   const updateFilter = useCallback(
//     <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
//       setFilters((prev) => ({
//         ...prev,
//         [key]: value,
//         ...(key !== "currentPage" && key !== "pageSize" ? { currentPage: 1 } : {}),
//       }));
//     },
//     []
//   );

//   // ── Helpers ────────────────────────────────────────────────────────────────

//   const formatCurrency = (n: number) =>
//     `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

//   const formatDate = (d: string) =>
//     new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

//   const showSkeleton = isLoading || isFetching;

//   // ── Pagination ─────────────────────────────────────────────────────────────

//   const PaginationControls = () => {
//     if (!pagination) return null;
//     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
//     const cp = filters.currentPage;

//     const pages: number[] = [];
//     if (totalPages <= 5) {
//       for (let i = 1; i <= totalPages; i++) pages.push(i);
//     } else if (cp <= 3) {
//       for (let i = 1; i <= 5; i++) pages.push(i);
//     } else if (cp >= totalPages - 2) {
//       for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
//     } else {
//       for (let i = cp - 2; i <= cp + 2; i++) pages.push(i);
//     }

//     return (
//       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
//         <div className="flex items-center gap-2 text-sm text-gray-600">
//           <span>
//             {startIndex}–{endIndex} of {totalCount}
//           </span>
//           <Select
//             value={String(filters.pageSize)}
//             onValueChange={(v) => updateFilter("pageSize", Number(v) as FilterState["pageSize"])}
//           >
//             <SelectTrigger className="w-16 h-7 text-xs">
//               <SelectValue />
//             </SelectTrigger>
//             <SelectContent>
//               {[5, 10, 20, 50].map((n) => (
//                 <SelectItem key={n} value={String(n)}>
//                   {n}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//           <span>per page</span>
//         </div>
//         <div className="flex items-center gap-1">
//           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", 1)} disabled={!hasPreviousPage}>
//             <ChevronsLeft className="h-4 w-4" />
//           </Button>
//           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", cp - 1)} disabled={!hasPreviousPage}>
//             <ChevronLeft className="h-4 w-4" />
//           </Button>
//           {pages.map((p) => (
//             <Button
//               key={p}
//               variant={cp === p ? "default" : "outline"}
//               size="icon"
//               className="h-8 w-8"
//               onClick={() => updateFilter("currentPage", p)}
//             >
//               {p}
//             </Button>
//           ))}
//           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", cp + 1)} disabled={!hasNextPage}>
//             <ChevronRight className="h-4 w-4" />
//           </Button>
//           <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateFilter("currentPage", totalPages)} disabled={!hasNextPage}>
//             <ChevronsRight className="h-4 w-4" />
//           </Button>
//         </div>
//       </div>
//     );
//   };

//   // ── Render ─────────────────────────────────────────────────────────────────

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div>
//           <h2 className="text-2xl font-bold text-gray-900">Accounts</h2>
//           <p className="text-sm text-gray-500 mt-0.5">Manage user financial accounts</p>
//         </div>
//         <Button onClick={() => setShowAddModal(true)} className="gap-2">
//           <Plus className="w-4 h-4" />
//           New Account
//         </Button>
//       </div>

//       {/* Stats */}
//       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//         <StatCard
//           label="Combined Balance"
//           value={formatCurrency(totalBalance)}
//           sub="across visible accounts"
//           icon={Wallet}
//           color="bg-blue-50 text-blue-600"
//         />
//         <StatCard
//           label="Active Accounts"
//           value={String(activeCount)}
//           sub={`of ${accounts.length} on this page`}
//           icon={TrendingUp}
//           color="bg-green-50 text-green-600"
//         />
//         <StatCard
//           label="In Credit"
//           value={String(creditAccounts)}
//           sub="positive balance accounts"
//           icon={TrendingDown}
//           color="bg-purple-50 text-purple-600"
//         />
//       </div>

//       {/* Filters */}
//       <Card className="border-0 shadow-sm">
//         <CardContent className="p-5">
//           <div className="flex flex-wrap items-end gap-4">
//             {/* Search */}
//             <div className="flex-1 min-w-[200px]">
//               <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Search</Label>
//               <div className="flex gap-2">
//                 <div className="relative flex-1">
//                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
//                   <Input
//                     placeholder="Account name..."
//                     value={searchInput}
//                     onChange={(e) => setSearchInput(e.target.value)}
//                     onKeyDown={(e) => e.key === "Enter" && handleSearch()}
//                     className="pl-9 pr-8"
//                   />
//                   {searchInput && (
//                     <button
//                       onClick={handleClearSearch}
//                       className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
//                     >
//                       <X className="w-3.5 h-3.5" />
//                     </button>
//                   )}
//                 </div>
//                 <Button onClick={handleSearch} size="icon" disabled={isFetching}>
//                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
//                 </Button>
//               </div>
//             </div>

//             {/* Sort */}
//             <div className="w-44">
//               <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Sort By</Label>
//               <Select
//                 value={`${filters.sortBy}-${filters.sortOrder}`}
//                 onValueChange={(v) => {
//                   const [by, order] = v.split("-") as [FilterState["sortBy"], FilterState["sortOrder"]];
//                   setFilters((p) => ({ ...p, sortBy: by, sortOrder: order, currentPage: 1 }));
//                 }}
//               >
//                 <SelectTrigger>
//                   <SelectValue />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="name-asc">Name (A→Z)</SelectItem>
//                   <SelectItem value="name-desc">Name (Z→A)</SelectItem>
//                   <SelectItem value="currentBalance-desc">Balance (High→Low)</SelectItem>
//                   <SelectItem value="currentBalance-asc">Balance (Low→High)</SelectItem>
//                   <SelectItem value="createdAt-desc">Newest First</SelectItem>
//                   <SelectItem value="createdAt-asc">Oldest First</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* Include Inactive */}
//             <div className="flex items-center gap-2 pb-0.5">
//               <input
//                 id="includeInactive"
//                 type="checkbox"
//                 checked={filters.includeInactive}
//                 onChange={(e) => updateFilter("includeInactive", e.target.checked)}
//                 className="h-4 w-4 rounded border-gray-300 text-blue-600"
//               />
//               <Label htmlFor="includeInactive" className="text-sm text-gray-600 cursor-pointer">
//                 Show inactive
//               </Label>
//             </div>
//           </div>
//         </CardContent>
//       </Card>

//       {/* Table */}
//       <Card className="border-0 shadow-sm overflow-hidden">
//         <CardHeader className="px-6 py-4 border-b bg-white">
//           <CardTitle className="text-base font-semibold flex items-center gap-2">
//             All Accounts
//             {pagination && (
//               <span className="text-sm font-normal text-gray-400">({pagination.totalCount} total)</span>
//             )}
//             {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="p-0">
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-gray-50 border-b">
//                 <tr>
//                   <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
//                     Account
//                   </th>
//                   <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
//                     Balance
//                   </th>
//                   <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
//                     Status
//                   </th>
//                   <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
//                     Created
//                   </th>
//                   <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
//                     Actions
//                   </th>
//                 </tr>
//               </thead>

//               {showSkeleton ? (
//                 <TableSkeleton rows={filters.pageSize} />
//               ) : (
//                 <tbody className="bg-white divide-y divide-gray-100">
//                   {accounts.length === 0 ? (
//                     <tr>
//                       <td colSpan={5} className="px-6 py-16 text-center">
//                         <div className="flex flex-col items-center gap-3 text-gray-400">
//                           <Wallet className="w-10 h-10 opacity-30" />
//                           <p className="text-sm">No accounts found</p>
//                           {committedSearch && (
//                             <button
//                               onClick={handleClearSearch}
//                               className="text-xs text-blue-500 hover:underline"
//                             >
//                               Clear search
//                             </button>
//                           )}
//                         </div>
//                       </td>
//                     </tr>
//                   ) : (
//                     accounts.map((account) => (
//                       <tr
//                         key={account._id}
//                         className="hover:bg-gray-50 transition-colors group"
//                       >
//                         {/* Account */}
//                         <td className="px-6 py-4">
//                           <div className="flex items-center gap-3">
//                             <div
//                               className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
//                                 account.isActive
//                                   ? "bg-blue-100 text-blue-700"
//                                   : "bg-gray-100 text-gray-400"
//                               }`}
//                             >
//                               {account.name.charAt(0).toUpperCase()}
//                             </div>
//                             <div>
//                               <p className="text-sm font-semibold text-gray-900">{account.name}</p>
//                               {account.description && (
//                                 <p className="text-xs text-gray-500 truncate max-w-[260px]">
//                                   {account.description}
//                                 </p>
//                               )}
//                             </div>
//                           </div>
//                         </td>

//                         {/* Balance */}
//                         <td className="px-6 py-4 text-right">
//                           <span
//                             className={`text-sm font-bold tabular-nums ${
//                               account.currentBalance < 0
//                                 ? "text-red-600"
//                                 : account.currentBalance === 0
//                                 ? "text-gray-400"
//                                 : "text-green-600"
//                             }`}
//                           >
//                             {formatCurrency(account.currentBalance)}
//                           </span>
//                         </td>

//                         {/* Status */}
//                         <td className="px-6 py-4 text-center">
//                           <Badge
//                             variant={account.isActive ? "default" : "secondary"}
//                             className={
//                               account.isActive
//                                 ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
//                                 : "bg-gray-100 text-gray-500"
//                             }
//                           >
//                             {account.isActive ? "Active" : "Inactive"}
//                           </Badge>
//                         </td>

//                         {/* Created */}
//                         <td className="px-6 py-4 text-center text-xs text-gray-500">
//                           {formatDate(account.createdAt)}
//                         </td>

//                         {/* Actions */}
//                         <td className="px-6 py-4 text-center">
//                           <div className="flex items-center justify-center gap-1">
//                             {onSelectAccount && (
//                               <Button
//                                 variant="ghost"
//                                 size="icon"
//                                 className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
//                                 onClick={() => onSelectAccount(account)}
//                                 title="View Transactions"
//                               >
//                                 <Eye className="w-4 h-4" />
//                               </Button>
//                             )}
//                             <DropdownMenu>
//                               <DropdownMenuTrigger asChild>
//                                 <Button
//                                   variant="ghost"
//                                   size="icon"
//                                   className="h-8 w-8 text-gray-500 hover:text-gray-700"
//                                 >
//                                   <MoreVertical className="w-4 h-4" />
//                                 </Button>
//                               </DropdownMenuTrigger>
//                               <DropdownMenuContent align="end">
//                                 {onSelectAccount && (
//                                   <DropdownMenuItem onClick={() => onSelectAccount(account)}>
//                                     <Eye className="w-4 h-4 mr-2" />
//                                     View Transactions
//                                   </DropdownMenuItem>
//                                 )}
//                                 <DropdownMenuItem
//                                   onClick={() => {
//                                     setSelectedAccount(account);
//                                     setShowEditModal(true);
//                                   }}
//                                 >
//                                   <Pencil className="w-4 h-4 mr-2" />
//                                   Edit
//                                 </DropdownMenuItem>
//                                 <DropdownMenuSeparator />
//                                 <DropdownMenuItem
//                                   className="text-red-600 focus:text-red-600"
//                                   onClick={() => setDeleteTarget(account)}
//                                 >
//                                   <Trash2 className="w-4 h-4 mr-2" />
//                                   Delete
//                                 </DropdownMenuItem>
//                               </DropdownMenuContent>
//                             </DropdownMenu>
//                           </div>
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

//       {/* Modals */}
//       <AddAccountModal open={showAddModal} onOpenChange={setShowAddModal} />
//       <EditAccountModal
//         open={showEditModal}
//         onOpenChange={setShowEditModal}
//         account={selectedAccount}
//       />

//       {/* Delete Confirm */}
//       <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle className="flex items-center gap-2">
//               <AlertCircle className="w-5 h-5 text-red-500" />
//               Delete Account
//             </AlertDialogTitle>
//             <AlertDialogDescription>
//               Are you sure you want to delete{" "}
//               <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? This action
//               cannot be undone and all associated transaction history will be lost.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction
//               onClick={handleDelete}
//               disabled={deleteMutation.isPending}
//               className="bg-red-500 hover:bg-red-600"
//             >
//               {deleteMutation.isPending ? (
//                 <>
//                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                   Deleting...
//                 </>
//               ) : (
//                 "Delete"
//               )}
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </div>
//   );
// }




// //----------- // components/tabs/accounts-tab.tsx
// // "use client";

// // import { useState, useCallback } from "react";
// // import { useQuery } from "@tanstack/react-query";
// // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // import { Input } from "@/components/ui/input";
// // import { Label } from "@/components/ui/label";
// // import { Button } from "@/components/ui/button";
// // import { Badge } from "@/components/ui/badge";
// // import {
// //   Select,
// //   SelectContent,
// //   SelectItem,
// //   SelectTrigger,
// //   SelectValue,
// // } from "@/components/ui/select";
// // import {
// //   Search,
// //   Wallet,
// //   Loader2,
// //   X,
// //   ChevronLeft,
// //   ChevronRight,
// //   ChevronsLeft,
// //   ChevronsRight,
// //   ArrowRight,
// // } from "lucide-react";
// // import type { Account, AccountsPaginatedResponse } from "@/types/account";

// // interface FilterState {
// //   includeInactive: boolean;
// //   currentPage: number;
// //   pageSize: number;
// //   sortBy: "name" | "createdAt" | "currentBalance";
// //   sortOrder: "asc" | "desc";
// // }

// // // Table Skeleton
// // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// //   <tbody className="bg-white divide-y divide-gray-200">
// //     {Array.from({ length: rows }).map((_, index) => (
// //       <tr key={index} className="animate-pulse">
// //         <td className="px-6 py-4">
// //           <div className="space-y-2">
// //             <div className="h-4 bg-gray-200 rounded w-32"></div>
// //             <div className="h-3 bg-gray-200 rounded w-48"></div>
// //           </div>
// //         </td>
// //         <td className="px-6 py-4 text-right">
// //           <div className="h-5 bg-gray-200 rounded w-24 ml-auto"></div>
// //         </td>
// //         <td className="px-6 py-4 text-center">
// //           <div className="h-6 bg-gray-200 rounded-full w-16 mx-auto"></div>
// //         </td>
// //         <td className="px-6 py-4 text-center">
// //           <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
// //         </td>
// //         <td className="px-6 py-4 text-center">
// //           <div className="h-8 w-8 bg-gray-200 rounded mx-auto"></div>
// //         </td>
// //       </tr>
// //     ))}
// //   </tbody>
// // );

// // interface AccountsTabProps {
// //   onSelectAccount?: (account: Account) => void;
// // }

// // export default function AccountsTab({ onSelectAccount }: AccountsTabProps) {
// //   const [searchInput, setSearchInput] = useState("");
// //   const [committedSearch, setCommittedSearch] = useState("");

// //   const [filters, setFilters] = useState<FilterState>({
// //     includeInactive: false,
// //     currentPage: 1,
// //     pageSize: 10,
// //     sortBy: "name",
// //     sortOrder: "asc",
// //   });

// //   // Fetch accounts
// //   const {
// //     data: response,
// //     isLoading,
// //     isFetching,
// //   } = useQuery<AccountsPaginatedResponse>({
// //     queryKey: [
// //       "accounts",
// //       committedSearch,
// //       filters.includeInactive,
// //       filters.currentPage,
// //       filters.pageSize,
// //       filters.sortBy,
// //       filters.sortOrder,
// //     ],
// //     queryFn: async (): Promise<AccountsPaginatedResponse> => {
// //       const params = new URLSearchParams();
// //       if (committedSearch) params.append("search", committedSearch);
// //       params.append("includeInactive", filters.includeInactive.toString());
// //       params.append("page", filters.currentPage.toString());
// //       params.append("limit", filters.pageSize.toString());
// //       params.append("sortBy", filters.sortBy);
// //       params.append("sortOrder", filters.sortOrder);

// //       const res = await fetch(`/api/accounts?${params}`);
// //       if (!res.ok) throw new Error("Failed to fetch accounts");
// //       return res.json();
// //     },
// //     staleTime: 30 * 1000,
// //     placeholderData: (prev) => prev,
// //   });

// //   const accounts = response?.data?.accounts || [];
// //   const pagination = response?.pagination;

// //   // Handlers
// //   const handleSearch = useCallback(() => {
// //     setCommittedSearch(searchInput.trim());
// //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// //   }, [searchInput]);

// //   const handleSearchKeyDown = useCallback(
// //     (e: React.KeyboardEvent<HTMLInputElement>) => {
// //       if (e.key === "Enter") handleSearch();
// //     },
// //     [handleSearch]
// //   );

// //   const handleClearSearch = useCallback(() => {
// //     setSearchInput("");
// //     setCommittedSearch("");
// //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// //   }, []);

// //   const handleViewTransactions = useCallback(
// //     (account: Account) => {
// //       if (onSelectAccount) onSelectAccount(account);
// //     },
// //     [onSelectAccount]
// //   );

// //   const handlePageChange = useCallback((newPage: number) => {
// //     setFilters((prev) => ({ ...prev, currentPage: newPage }));
// //   }, []);

// //   const handlePageSizeChange = useCallback((newSize: string) => {
// //     setFilters((prev) => ({ ...prev, pageSize: parseInt(newSize), currentPage: 1 }));
// //   }, []);

// //   const formatDate = (dateString: string) =>
// //     new Date(dateString).toLocaleDateString("en-GB", {
// //       day: "2-digit",
// //       month: "short",
// //       year: "numeric",
// //     });

// //   const formatCurrency = (amount: number) =>
// //     `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

// //   // Pagination
// //   const PaginationControls = useCallback(() => {
// //     if (!pagination) return null;

// //     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
// //     const currentPage = filters.currentPage;

// //     const getPageNumbers = (): number[] => {
// //       const maxVisible = 5;
// //       const pages: number[] = [];
// //       if (totalPages <= maxVisible) {
// //         for (let i = 1; i <= totalPages; i++) pages.push(i);
// //       } else if (currentPage <= 3) {
// //         for (let i = 1; i <= maxVisible; i++) pages.push(i);
// //       } else if (currentPage >= totalPages - 2) {
// //         for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) pages.push(i);
// //       } else {
// //         for (let i = currentPage - 2; i <= currentPage + 2; i++) pages.push(i);
// //       }
// //       return pages;
// //     };

// //     return (
// //       <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t">
// //         <div className="flex items-center space-x-2">
// //           <span className="text-sm text-gray-700">
// //             Showing {startIndex} to {endIndex} of {totalCount} accounts
// //           </span>
// //           <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
// //             <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
// //             <SelectContent>
// //               <SelectItem value="5">5</SelectItem>
// //               <SelectItem value="10">10</SelectItem>
// //               <SelectItem value="20">20</SelectItem>
// //             </SelectContent>
// //           </Select>
// //           <span className="text-sm text-gray-700">per page</span>
// //         </div>
// //         <div className="flex items-center space-x-2">
// //           <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={!hasPreviousPage}>
// //             <ChevronsLeft className="w-4 h-4" />
// //           </Button>
// //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={!hasPreviousPage}>
// //             <ChevronLeft className="w-4 h-4" />
// //           </Button>
// //           <div className="flex items-center space-x-1">
// //             {getPageNumbers().map((pageNumber) => (
// //               <Button
// //                 key={pageNumber}
// //                 variant={currentPage === pageNumber ? "default" : "outline"}
// //                 size="sm"
// //                 onClick={() => handlePageChange(pageNumber)}
// //                 className="w-8 h-8"
// //               >
// //                 {pageNumber}
// //               </Button>
// //             ))}
// //           </div>
// //           <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={!hasNextPage}>
// //             <ChevronRight className="w-4 h-4" />
// //           </Button>
// //           <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={!hasNextPage}>
// //             <ChevronsRight className="w-4 h-4" />
// //           </Button>
// //         </div>
// //       </div>
// //     );
// //   }, [pagination, filters.currentPage, filters.pageSize, handlePageChange, handlePageSizeChange]);

// //   const showSkeleton = isLoading || isFetching;

// //   return (
// //     <div className="space-y-6">
// //       {/* Header - NO ADD BUTTON FOR USERS */}
// //       <div className="flex justify-between items-center">
// //         <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
// //           <Wallet className="w-6 h-6 text-blue-500" />
// //           My Accounts
// //         </h2>
// //         {/* No Add Account button - only Master can create accounts */}
// //       </div>

// //       {/* Info Box */}
// //       <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
// //         <p className="text-sm text-blue-700">
// //           💡 Accounts are created by the administrator. Select an account below to view and manage transactions.
// //         </p>
// //       </div>

// //       {/* Filters */}
// //       <Card>
// //         <CardContent className="p-6">
// //           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
// //             {/* Search */}
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
// //               <div className="flex gap-2">
// //                 <div className="relative flex-1">
// //                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// //                   <Input
// //                     placeholder="Search by account name..."
// //                     value={searchInput}
// //                     onChange={(e) => setSearchInput(e.target.value)}
// //                     onKeyDown={handleSearchKeyDown}
// //                     className="pl-10 pr-8"
// //                   />
// //                   {searchInput && (
// //                     <button onClick={handleClearSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600" type="button">
// //                       <X className="w-4 h-4" />
// //                     </button>
// //                   )}
// //                 </div>
// //                 <Button onClick={handleSearch} disabled={isFetching} size="icon" className="shrink-0">
// //                   {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
// //                 </Button>
// //               </div>
// //             </div>

// //             {/* Sort By */}
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">Sort By</Label>
// //               <Select
// //                 value={filters.sortBy}
// //                 onValueChange={(value: "name" | "createdAt" | "currentBalance") =>
// //                   setFilters((prev) => ({ ...prev, sortBy: value, currentPage: 1 }))
// //                 }
// //               >
// //                 <SelectTrigger><SelectValue /></SelectTrigger>
// //                 <SelectContent>
// //                   <SelectItem value="name">Name</SelectItem>
// //                   <SelectItem value="currentBalance">Balance</SelectItem>
// //                   <SelectItem value="createdAt">Created Date</SelectItem>
// //                 </SelectContent>
// //               </Select>
// //             </div>

// //             {/* Status */}
// //             <div>
// //               <Label className="block text-sm font-medium text-gray-700 mb-2">Status</Label>
// //               <Select
// //                 value={filters.includeInactive ? "all" : "active"}
// //                 onValueChange={(value) =>
// //                   setFilters((prev) => ({ ...prev, includeInactive: value === "all", currentPage: 1 }))
// //                 }
// //               >
// //                 <SelectTrigger><SelectValue /></SelectTrigger>
// //                 <SelectContent>
// //                   <SelectItem value="active">Active Only</SelectItem>
// //                   <SelectItem value="all">All Accounts</SelectItem>
// //                 </SelectContent>
// //               </Select>
// //             </div>
// //           </div>
// //         </CardContent>
// //       </Card>

// //       {/* Table */}
// //       <Card>
// //         <CardHeader>
// //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// //             Your Accounts
// //             {pagination && <span className="ml-2 text-sm font-normal text-gray-500">({pagination.totalCount} total)</span>}
// //             {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />}
// //           </CardTitle>
// //         </CardHeader>
// //         <CardContent className="p-0">
// //           <div className="overflow-x-auto">
// //             <table className="w-full">
// //               <thead className="bg-gray-50">
// //                 <tr>
// //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
// //                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
// //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
// //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
// //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
// //                 </tr>
// //               </thead>
// //               {showSkeleton ? (
// //                 <TableSkeleton rows={filters.pageSize} />
// //               ) : (
// //                 <tbody className="bg-white divide-y divide-gray-200">
// //                   {accounts.length === 0 ? (
// //                     <tr>
// //                       <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
// //                         No accounts found. Please contact administrator to create an account for you.
// //                       </td>
// //                     </tr>
// //                   ) : (
// //                     accounts.map((account) => (
// //                       <tr key={account._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleViewTransactions(account)}>
// //                         <td className="px-6 py-4">
// //                           <div>
// //                             <p className="text-sm font-medium text-gray-900">{account.name}</p>
// //                             {account.description && <p className="text-sm text-gray-500 truncate max-w-xs">{account.description}</p>}
// //                           </div>
// //                         </td>
// //                         <td className="px-6 py-4 text-right">
// //                           <span className={`text-lg font-semibold ${account.currentBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
// //                             {formatCurrency(account.currentBalance)}
// //                           </span>
// //                         </td>
// //                         <td className="px-6 py-4 text-center">
// //                           <Badge variant={account.isActive ? "default" : "secondary"}>
// //                             {account.isActive ? "Active" : "Inactive"}
// //                           </Badge>
// //                         </td>
// //                         <td className="px-6 py-4 text-center text-sm text-gray-500">
// //                           {formatDate(account.createdAt)}
// //                         </td>
// //                         <td className="px-6 py-4">
// //                           <div className="flex justify-center">
// //                             <Button
// //                               variant="ghost"
// //                               size="sm"
// //                               onClick={(e) => {
// //                                 e.stopPropagation();
// //                                 handleViewTransactions(account);
// //                               }}
// //                               className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
// //                               title="View Transactions"
// //                             >
// //                               <ArrowRight className="w-4 h-4" />
// //                               <span className="ml-1">Open</span>
// //                             </Button>
// //                           </div>
// //                         </td>
// //                       </tr>
// //                     ))
// //                   )}
// //                 </tbody>
// //               )}
// //             </table>
// //           </div>
// //           <PaginationControls />
// //         </CardContent>
// //       </Card>
// //     </div>
// //   );
// // }





// // // // components/tabs/accounts-tab.tsx
// // // "use client";

// // // import { useState, useCallback } from "react";
// // // import { useQuery } from "@tanstack/react-query";
// // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // import { Input } from "@/components/ui/input";
// // // import { Label } from "@/components/ui/label";
// // // import { Button } from "@/components/ui/button";
// // // import { Badge } from "@/components/ui/badge";
// // // import {
// // //   Select,
// // //   SelectContent,
// // //   SelectItem,
// // //   SelectTrigger,
// // //   SelectValue,
// // // } from "@/components/ui/select";
// // // import {
// // //   Search,
// // //   Plus,
// // //   Pencil,
// // //   Trash2,
// // //   Wallet,
// // //   Loader2,
// // //   X,
// // //   ChevronLeft,
// // //   ChevronRight,
// // //   ChevronsLeft,
// // //   ChevronsRight,
// // //   ArrowRight,
// // // } from "lucide-react";
// // // import { useDeleteAccount } from "@/hooks/use-account-mutations";
// // // import AddAccountModal from "@/components/modals/add-account-modal";
// // // import EditAccountModal from "@/components/modals/edit-account-modal";
// // // import ConfirmDialog from "@/components/dialogs/ConfirmDialog";
// // // import type { Account, AccountsPaginatedResponse } from "@/types/account";

// // // interface FilterState {
// // //   includeInactive: boolean;
// // //   currentPage: number;
// // //   pageSize: number;
// // //   sortBy: "name" | "createdAt" | "currentBalance";
// // //   sortOrder: "asc" | "desc";
// // // }

// // // // Table Skeleton
// // // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// // //   <tbody className="bg-white divide-y divide-gray-200">
// // //     {Array.from({ length: rows }).map((_, index) => (
// // //       <tr key={index} className="animate-pulse">
// // //         <td className="px-6 py-4">
// // //           <div className="space-y-2">
// // //             <div className="h-4 bg-gray-200 rounded w-32"></div>
// // //             <div className="h-3 bg-gray-200 rounded w-48"></div>
// // //           </div>
// // //         </td>
// // //         <td className="px-6 py-4 text-right">
// // //           <div className="h-5 bg-gray-200 rounded w-24 ml-auto"></div>
// // //         </td>
// // //         <td className="px-6 py-4 text-center">
// // //           <div className="h-6 bg-gray-200 rounded-full w-16 mx-auto"></div>
// // //         </td>
// // //         <td className="px-6 py-4 text-center">
// // //           <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
// // //         </td>
// // //         <td className="px-6 py-4 text-center">
// // //           <div className="flex justify-center gap-2">
// // //             <div className="h-8 w-8 bg-gray-200 rounded"></div>
// // //             <div className="h-8 w-8 bg-gray-200 rounded"></div>
// // //             <div className="h-8 w-8 bg-gray-200 rounded"></div>
// // //           </div>
// // //         </td>
// // //       </tr>
// // //     ))}
// // //   </tbody>
// // // );

// // // interface AccountsTabProps {
// // //   onSelectAccount?: (account: Account) => void;
// // // }

// // // export default function AccountsTab({ onSelectAccount }: AccountsTabProps) {
// // //   const deleteMutation = useDeleteAccount();

// // //   const [searchInput, setSearchInput] = useState("");
// // //   const [committedSearch, setCommittedSearch] = useState("");

// // //   const [filters, setFilters] = useState<FilterState>({
// // //     includeInactive: false,
// // //     currentPage: 1,
// // //     pageSize: 10,
// // //     sortBy: "name",
// // //     sortOrder: "asc",
// // //   });

// // //   const [showAddModal, setShowAddModal] = useState(false);
// // //   const [showEditModal, setShowEditModal] = useState(false);
// // //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// // //   const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

// // //   // Fetch accounts
// // //   const {
// // //     data: response,
// // //     isLoading,
// // //     isFetching,
// // //   } = useQuery<AccountsPaginatedResponse>({
// // //     queryKey: [
// // //       "accounts",
// // //       committedSearch,
// // //       filters.includeInactive,
// // //       filters.currentPage,
// // //       filters.pageSize,
// // //       filters.sortBy,
// // //       filters.sortOrder,
// // //     ],
// // //     queryFn: async (): Promise<AccountsPaginatedResponse> => {
// // //       const params = new URLSearchParams();
// // //       if (committedSearch) params.append("search", committedSearch);
// // //       params.append("includeInactive", filters.includeInactive.toString());
// // //       params.append("page", filters.currentPage.toString());
// // //       params.append("limit", filters.pageSize.toString());
// // //       params.append("sortBy", filters.sortBy);
// // //       params.append("sortOrder", filters.sortOrder);

// // //       const res = await fetch(`/api/accounts?${params}`);
// // //       if (!res.ok) throw new Error("Failed to fetch accounts");
// // //       return res.json();
// // //     },
// // //     staleTime: 30 * 1000,
// // //     placeholderData: (prev) => prev,
// // //   });

// // //   const accounts = response?.data?.accounts || [];
// // //   const pagination = response?.pagination;

// // //   // Handlers
// // //   const handleSearch = useCallback(() => {
// // //     setCommittedSearch(searchInput.trim());
// // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // //   }, [searchInput]);

// // //   const handleSearchKeyDown = useCallback(
// // //     (e: React.KeyboardEvent<HTMLInputElement>) => {
// // //       if (e.key === "Enter") handleSearch();
// // //     },
// // //     [handleSearch]
// // //   );

// // //   const handleClearSearch = useCallback(() => {
// // //     setSearchInput("");
// // //     setCommittedSearch("");
// // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // //   }, []);

// // //   const handleEdit = useCallback((account: Account) => {
// // //     setSelectedAccount(account);
// // //     setShowEditModal(true);
// // //   }, []);

// // //   const handleDeleteClick = useCallback((account: Account) => {
// // //     setSelectedAccount(account);
// // //     setShowDeleteModal(true);
// // //   }, []);

// // //   const handleDeleteConfirm = useCallback(() => {
// // //     if (!selectedAccount) return;
// // //     deleteMutation.mutate(selectedAccount._id, {
// // //       onSuccess: () => {
// // //         setShowDeleteModal(false);
// // //         setSelectedAccount(null);
// // //       },
// // //     });
// // //   }, [selectedAccount, deleteMutation]);

// // //   const handleViewTransactions = useCallback(
// // //     (account: Account) => {
// // //       if (onSelectAccount) onSelectAccount(account);
// // //     },
// // //     [onSelectAccount]
// // //   );

// // //   const handlePageChange = useCallback((newPage: number) => {
// // //     setFilters((prev) => ({ ...prev, currentPage: newPage }));
// // //   }, []);

// // //   const handlePageSizeChange = useCallback((newSize: string) => {
// // //     setFilters((prev) => ({ ...prev, pageSize: parseInt(newSize), currentPage: 1 }));
// // //   }, []);

// // //   const formatDate = (dateString: string) =>
// // //     new Date(dateString).toLocaleDateString("en-GB", {
// // //       day: "2-digit",
// // //       month: "short",
// // //       year: "numeric",
// // //     });

// // //   const formatCurrency = (amount: number) =>
// // //     `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

// // //   // Pagination
// // //   const PaginationControls = useCallback(() => {
// // //     if (!pagination) return null;

// // //     const {
// // //       totalPages,
// // //       totalCount,
// // //       startIndex,
// // //       endIndex,
// // //       hasNextPage,
// // //       hasPreviousPage,
// // //     } = pagination;
// // //     const currentPage = filters.currentPage;

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
// // //             Showing {startIndex} to {endIndex} of {totalCount} accounts
// // //           </span>
// // //           <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
// // //             <SelectTrigger className="w-20">
// // //               <SelectValue />
// // //             </SelectTrigger>
// // //             <SelectContent>
// // //               <SelectItem value="5">5</SelectItem>
// // //               <SelectItem value="10">10</SelectItem>
// // //               <SelectItem value="20">20</SelectItem>
// // //               <SelectItem value="50">50</SelectItem>
// // //             </SelectContent>
// // //           </Select>
// // //           <span className="text-sm text-gray-700">per page</span>
// // //         </div>
// // //         <div className="flex items-center space-x-2">
// // //           <Button
// // //             variant="outline"
// // //             size="sm"
// // //             onClick={() => handlePageChange(1)}
// // //             disabled={!hasPreviousPage}
// // //           >
// // //             <ChevronsLeft className="w-4 h-4" />
// // //           </Button>
// // //           <Button
// // //             variant="outline"
// // //             size="sm"
// // //             onClick={() => handlePageChange(currentPage - 1)}
// // //             disabled={!hasPreviousPage}
// // //           >
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
// // //           <Button
// // //             variant="outline"
// // //             size="sm"
// // //             onClick={() => handlePageChange(currentPage + 1)}
// // //             disabled={!hasNextPage}
// // //           >
// // //             <ChevronRight className="w-4 h-4" />
// // //           </Button>
// // //           <Button
// // //             variant="outline"
// // //             size="sm"
// // //             onClick={() => handlePageChange(totalPages)}
// // //             disabled={!hasNextPage}
// // //           >
// // //             <ChevronsRight className="w-4 h-4" />
// // //           </Button>
// // //         </div>
// // //       </div>
// // //     );
// // //   }, [pagination, filters.currentPage, filters.pageSize, handlePageChange, handlePageSizeChange]);

// // //   const showSkeleton = isLoading || isFetching;

// // //   return (
// // //     <div className="space-y-6">
// // //       {/* Header */}
// // //       <div className="flex justify-between items-center">
// // //         <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
// // //           <Wallet className="w-6 h-6 text-blue-500" />
// // //           My Accounts
// // //         </h2>
// // //         <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600">
// // //           <Plus className="w-4 h-4 mr-2" />
// // //           Add Account
// // //         </Button>
// // //       </div>

// // //       {/* Filters */}
// // //       <Card>
// // //         <CardContent className="p-6">
// // //           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // //             {/* Search */}
// // //             <div className="md:col-span-2">
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
// // //               <div className="flex gap-2">
// // //                 <div className="relative flex-1">
// // //                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // //                   <Input
// // //                     placeholder="Search by account name..."
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

// // //             {/* Sort By */}
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Sort By</Label>
// // //               <Select
// // //                 value={filters.sortBy}
// // //                 onValueChange={(value: "name" | "createdAt" | "currentBalance") =>
// // //                   setFilters((prev) => ({ ...prev, sortBy: value, currentPage: 1 }))
// // //                 }
// // //               >
// // //                 <SelectTrigger>
// // //                   <SelectValue />
// // //                 </SelectTrigger>
// // //                 <SelectContent>
// // //                   <SelectItem value="name">Name</SelectItem>
// // //                   <SelectItem value="currentBalance">Balance</SelectItem>
// // //                   <SelectItem value="createdAt">Created Date</SelectItem>
// // //                 </SelectContent>
// // //               </Select>
// // //             </div>

// // //             {/* Status */}
// // //             <div>
// // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Status</Label>
// // //               <Select
// // //                 value={filters.includeInactive ? "all" : "active"}
// // //                 onValueChange={(value) =>
// // //                   setFilters((prev) => ({
// // //                     ...prev,
// // //                     includeInactive: value === "all",
// // //                     currentPage: 1,
// // //                   }))
// // //                 }
// // //               >
// // //                 <SelectTrigger>
// // //                   <SelectValue />
// // //                 </SelectTrigger>
// // //                 <SelectContent>
// // //                   <SelectItem value="active">Active Only</SelectItem>
// // //                   <SelectItem value="all">All Accounts</SelectItem>
// // //                 </SelectContent>
// // //               </Select>
// // //             </div>
// // //           </div>
// // //         </CardContent>
// // //       </Card>

// // //       {/* Table */}
// // //       <Card>
// // //         <CardHeader>
// // //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// // //             Your Accounts
// // //             {pagination && (
// // //               <span className="ml-2 text-sm font-normal text-gray-500">
// // //                 ({pagination.totalCount} total)
// // //               </span>
// // //             )}
// // //             {isFetching && !isLoading && (
// // //               <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />
// // //             )}
// // //           </CardTitle>
// // //         </CardHeader>
// // //         <CardContent className="p-0">
// // //           <div className="overflow-x-auto">
// // //             <table className="w-full">
// // //               <thead className="bg-gray-50">
// // //                 <tr>
// // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                     Account
// // //                   </th>
// // //                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                     Balance
// // //                   </th>
// // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                     Status
// // //                   </th>
// // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                     Created
// // //                   </th>
// // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // //                     Actions
// // //                   </th>
// // //                 </tr>
// // //               </thead>
// // //               {showSkeleton ? (
// // //                 <TableSkeleton rows={filters.pageSize} />
// // //               ) : (
// // //                 <tbody className="bg-white divide-y divide-gray-200">
// // //                   {accounts.length === 0 ? (
// // //                     <tr>
// // //                       <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
// // //                         No accounts found. Create your first account to get started.
// // //                       </td>
// // //                     </tr>
// // //                   ) : (
// // //                     accounts.map((account) => (
// // //                       <tr key={account._id} className="hover:bg-gray-50">
// // //                         <td className="px-6 py-4">
// // //                           <div>
// // //                             <p className="text-sm font-medium text-gray-900">{account.name}</p>
// // //                             {account.description && (
// // //                               <p className="text-sm text-gray-500 truncate max-w-xs">
// // //                                 {account.description}
// // //                               </p>
// // //                             )}
// // //                           </div>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-right">
// // //                           <span
// // //                             className={`text-lg font-semibold ${
// // //                               account.currentBalance >= 0 ? "text-green-600" : "text-red-600"
// // //                             }`}
// // //                           >
// // //                             {formatCurrency(account.currentBalance)}
// // //                           </span>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center">
// // //                           <Badge variant={account.isActive ? "default" : "secondary"}>
// // //                             {account.isActive ? "Active" : "Inactive"}
// // //                           </Badge>
// // //                         </td>
// // //                         <td className="px-6 py-4 text-center text-sm text-gray-500">
// // //                           {formatDate(account.createdAt)}
// // //                         </td>
// // //                         <td className="px-6 py-4">
// // //                           <div className="flex justify-center gap-2">
// // //                             {onSelectAccount && (
// // //                               <Button
// // //                                 variant="ghost"
// // //                                 size="sm"
// // //                                 onClick={() => handleViewTransactions(account)}
// // //                                 className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
// // //                                 title="View Transactions"
// // //                               >
// // //                                 <ArrowRight className="w-4 h-4" />
// // //                               </Button>
// // //                             )}
// // //                             <Button
// // //                               variant="ghost"
// // //                               size="sm"
// // //                               onClick={() => handleEdit(account)}
// // //                               className="text-gray-500 hover:text-gray-600 hover:bg-gray-50"
// // //                               title="Edit"
// // //                             >
// // //                               <Pencil className="w-4 h-4" />
// // //                             </Button>
// // //                             <Button
// // //                               variant="ghost"
// // //                               size="sm"
// // //                               onClick={() => handleDeleteClick(account)}
// // //                               className="text-red-500 hover:text-red-600 hover:bg-red-50"
// // //                               title="Delete"
// // //                             >
// // //                               <Trash2 className="w-4 h-4" />
// // //                             </Button>
// // //                           </div>
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

// // //       {/* Modals */}
// // //       <AddAccountModal open={showAddModal} onOpenChange={setShowAddModal} />
// // //       <EditAccountModal
// // //         open={showEditModal}
// // //         onOpenChange={setShowEditModal}
// // //         account={selectedAccount}
// // //       />
// // //       <ConfirmDialog
// // //         open={showDeleteModal}
// // //         onOpenChange={setShowDeleteModal}
// // //         onConfirm={handleDeleteConfirm}
// // //         title="Delete Account"
// // //         description={`Delete "${selectedAccount?.name}"? All transactions will be deleted. This cannot be undone.`}
// // //         confirmLabel="Delete"
// // //         icon={Trash2}
// // //         variant="destructive"
// // //         isLoading={deleteMutation.isPending}
// // //         loadingLabel="Deleting..."
// // //       />
// // //     </div>
// // //   );
// // // }




// // // // // components/tabs/accounts-tab.tsx
// // // // "use client";

// // // // import { useState, useCallback } from "react";
// // // // import { useQuery } from "@tanstack/react-query";
// // // // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// // // // import { Input } from "@/components/ui/input";
// // // // import { Label } from "@/components/ui/label";
// // // // import { Button } from "@/components/ui/button";
// // // // import { Badge } from "@/components/ui/badge";
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
// // // //   Pencil,
// // // //   Trash2,
// // // //   Wallet,
// // // //   Loader2,
// // // //   X,
// // // //   ChevronLeft,
// // // //   ChevronRight,
// // // //   ChevronsLeft,
// // // //   ChevronsRight,
// // // //   ArrowRight,
// // // // } from "lucide-react";
// // // // import { useDeleteAccount } from "@/hooks/use-account-mutations";
// // // // import AddAccountModal from "@/components/modals/add-account-modal";
// // // // import EditAccountModal from "@/components/modals/edit-account-modal";
// // // // import type { Account, AccountsPaginatedResponse } from "@/types/account";
// // // // import ConfirmDialog from "@/components/dialogs/ConfirmDialog";

// // // // interface FilterState {
// // // //   includeInactive: boolean;
// // // //   currentPage: number;
// // // //   pageSize: number;
// // // //   sortBy: "name" | "createdAt" | "currentBalance";
// // // //   sortOrder: "asc" | "desc";
// // // // }

// // // // // Table Skeleton
// // // // const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
// // // //   <tbody className="bg-white divide-y divide-gray-200">
// // // //     {Array.from({ length: rows }).map((_, index) => (
// // // //       <tr key={index} className="animate-pulse">
// // // //         <td className="px-6 py-4">
// // // //           <div className="space-y-2">
// // // //             <div className="h-4 bg-gray-200 rounded w-32"></div>
// // // //             <div className="h-3 bg-gray-200 rounded w-48"></div>
// // // //           </div>
// // // //         </td>
// // // //         <td className="px-6 py-4 text-right">
// // // //           <div className="h-5 bg-gray-200 rounded w-24 ml-auto"></div>
// // // //         </td>
// // // //         <td className="px-6 py-4 text-center">
// // // //           <div className="h-6 bg-gray-200 rounded-full w-16 mx-auto"></div>
// // // //         </td>
// // // //         <td className="px-6 py-4 text-center">
// // // //           <div className="h-4 bg-gray-200 rounded w-24 mx-auto"></div>
// // // //         </td>
// // // //         <td className="px-6 py-4 text-center">
// // // //           <div className="flex justify-center gap-2">
// // // //             <div className="h-8 w-8 bg-gray-200 rounded"></div>
// // // //             <div className="h-8 w-8 bg-gray-200 rounded"></div>
// // // //             <div className="h-8 w-8 bg-gray-200 rounded"></div>
// // // //           </div>
// // // //         </td>
// // // //       </tr>
// // // //     ))}
// // // //   </tbody>
// // // // );

// // // // interface AccountsTabProps {
// // // //   onSelectAccount?: (account: Account) => void;
// // // // }

// // // // export default function AccountsTab({ onSelectAccount }: AccountsTabProps) {
// // // //   const deleteMutation = useDeleteAccount();

// // // //   // Search state
// // // //   const [searchInput, setSearchInput] = useState("");
// // // //   const [committedSearch, setCommittedSearch] = useState("");

// // // //   // Filter state
// // // //   const [filters, setFilters] = useState<FilterState>({
// // // //     includeInactive: false,
// // // //     currentPage: 1,
// // // //     pageSize: 10,
// // // //     sortBy: "name",
// // // //     sortOrder: "asc",
// // // //   });

// // // //   // Modal states
// // // //   const [showAddModal, setShowAddModal] = useState(false);
// // // //   const [showEditModal, setShowEditModal] = useState(false);
// // // //   const [showDeleteModal, setShowDeleteModal] = useState(false);
// // // //   const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

// // // //   // Fetch accounts
// // // //   const { data: response, isLoading, isFetching } = useQuery<AccountsPaginatedResponse>({
// // // //     queryKey: [
// // // //       "accounts",
// // // //       committedSearch,
// // // //       filters.includeInactive,
// // // //       filters.currentPage,
// // // //       filters.pageSize,
// // // //       filters.sortBy,
// // // //       filters.sortOrder,
// // // //     ],
// // // //     queryFn: async (): Promise<AccountsPaginatedResponse> => {
// // // //       const params = new URLSearchParams();
// // // //       if (committedSearch) params.append("search", committedSearch);
// // // //       params.append("includeInactive", filters.includeInactive.toString());
// // // //       params.append("page", filters.currentPage.toString());
// // // //       params.append("limit", filters.pageSize.toString());
// // // //       params.append("sortBy", filters.sortBy);
// // // //       params.append("sortOrder", filters.sortOrder);

// // // //       const res = await fetch(`/api/accounts?${params}`);
// // // //       if (!res.ok) throw new Error("Failed to fetch accounts");
// // // //       return res.json();
// // // //     },
// // // //     staleTime: 30 * 1000,
// // // //     placeholderData: (prev) => prev,
// // // //   });

// // // //   const accounts = response?.data?.accounts || [];
// // // //   const pagination = response?.pagination;

// // // //   // Handlers
// // // //   const handleSearch = useCallback(() => {
// // // //     setCommittedSearch(searchInput.trim());
// // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // //   }, [searchInput]);

// // // //   const handleSearchKeyDown = useCallback(
// // // //     (e: React.KeyboardEvent<HTMLInputElement>) => {
// // // //       if (e.key === "Enter") handleSearch();
// // // //     },
// // // //     [handleSearch]
// // // //   );

// // // //   const handleClearSearch = useCallback(() => {
// // // //     setSearchInput("");
// // // //     setCommittedSearch("");
// // // //     setFilters((prev) => ({ ...prev, currentPage: 1 }));
// // // //   }, []);

// // // //   const handleEdit = useCallback((account: Account) => {
// // // //     setSelectedAccount(account);
// // // //     setShowEditModal(true);
// // // //   }, []);

// // // //   const handleDeleteClick = useCallback((account: Account) => {
// // // //     setSelectedAccount(account);
// // // //     setShowDeleteModal(true);
// // // //   }, []);

// // // //   const handleDeleteConfirm = useCallback(() => {
// // // //     if (!selectedAccount) return;
// // // //     deleteMutation.mutate(selectedAccount._id, {
// // // //       onSuccess: () => {
// // // //         setShowDeleteModal(false);
// // // //         setSelectedAccount(null);
// // // //       },
// // // //     });
// // // //   }, [selectedAccount, deleteMutation]);

// // // //   const handleViewTransactions = useCallback(
// // // //     (account: Account) => {
// // // //       if (onSelectAccount) {
// // // //         onSelectAccount(account);
// // // //       }
// // // //     },
// // // //     [onSelectAccount]
// // // //   );

// // // //   const handlePageChange = useCallback((newPage: number) => {
// // // //     setFilters((prev) => ({ ...prev, currentPage: newPage }));
// // // //   }, []);

// // // //   const handlePageSizeChange = useCallback((newSize: string) => {
// // // //     setFilters((prev) => ({
// // // //       ...prev,
// // // //       pageSize: parseInt(newSize),
// // // //       currentPage: 1,
// // // //     }));
// // // //   }, []);

// // // //   const formatDate = useCallback((dateString: string): string => {
// // // //     return new Date(dateString).toLocaleDateString("en-GB", {
// // // //       day: "2-digit",
// // // //       month: "short",
// // // //       year: "numeric",
// // // //     });
// // // //   }, []);

// // // //   const formatCurrency = useCallback((amount: number): string => {
// // // //     return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
// // // //   }, []);

// // // //   // Pagination Controls
// // // //   const PaginationControls = useCallback(() => {
// // // //     if (!pagination) return null;

// // // //     const { totalPages, totalCount, startIndex, endIndex, hasNextPage, hasPreviousPage } = pagination;
// // // //     const currentPage = filters.currentPage;

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
// // // //             Showing {startIndex} to {endIndex} of {totalCount} accounts
// // // //           </span>
// // // //           <Select value={filters.pageSize.toString()} onValueChange={handlePageSizeChange}>
// // // //             <SelectTrigger className="w-20">
// // // //               <SelectValue />
// // // //             </SelectTrigger>
// // // //             <SelectContent>
// // // //               <SelectItem value="5">5</SelectItem>
// // // //               <SelectItem value="10">10</SelectItem>
// // // //               <SelectItem value="20">20</SelectItem>
// // // //               <SelectItem value="50">50</SelectItem>
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
// // // //   }, [pagination, filters.currentPage, filters.pageSize, handlePageChange, handlePageSizeChange]);

// // // //   const showSkeleton = isLoading || isFetching;

// // // //   return (
// // // //     <div className="space-y-6">
// // // //       {/* Header */}
// // // //       <div className="flex justify-between items-center">
// // // //         <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
// // // //           <Wallet className="w-6 h-6 text-blue-500" />
// // // //           Manage Accounts
// // // //         </h2>
// // // //         <Button onClick={() => setShowAddModal(true)} className="bg-blue-500 hover:bg-blue-600">
// // // //           <Plus className="w-4 h-4 mr-2" />
// // // //           Add Account
// // // //         </Button>
// // // //       </div>

// // // //       {/* Filters */}
// // // //       <Card>
// // // //         <CardContent className="p-6">
// // // //           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
// // // //             {/* Search */}
// // // //             <div className="md:col-span-2">
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Search</Label>
// // // //               <div className="flex gap-2">
// // // //                 <div className="relative flex-1">
// // // //                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
// // // //                   <Input
// // // //                     placeholder="Search by account name..."
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

// // // //             {/* Sort By */}
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Sort By</Label>
// // // //               <Select
// // // //                 value={filters.sortBy}
// // // //                 onValueChange={(value: "name" | "createdAt" | "currentBalance") =>
// // // //                   setFilters((prev) => ({ ...prev, sortBy: value, currentPage: 1 }))
// // // //                 }
// // // //               >
// // // //                 <SelectTrigger>
// // // //                   <SelectValue />
// // // //                 </SelectTrigger>
// // // //                 <SelectContent>
// // // //                   <SelectItem value="name">Name</SelectItem>
// // // //                   <SelectItem value="currentBalance">Balance</SelectItem>
// // // //                   <SelectItem value="createdAt">Created Date</SelectItem>
// // // //                 </SelectContent>
// // // //               </Select>
// // // //             </div>

// // // //             {/* Include Inactive */}
// // // //             <div>
// // // //               <Label className="block text-sm font-medium text-gray-700 mb-2">Status</Label>
// // // //               <Select
// // // //                 value={filters.includeInactive ? "all" : "active"}
// // // //                 onValueChange={(value) =>
// // // //                   setFilters((prev) => ({
// // // //                     ...prev,
// // // //                     includeInactive: value === "all",
// // // //                     currentPage: 1,
// // // //                   }))
// // // //                 }
// // // //               >
// // // //                 <SelectTrigger>
// // // //                   <SelectValue />
// // // //                 </SelectTrigger>
// // // //                 <SelectContent>
// // // //                   <SelectItem value="active">Active Only</SelectItem>
// // // //                   <SelectItem value="all">All Accounts</SelectItem>
// // // //                 </SelectContent>
// // // //               </Select>
// // // //             </div>
// // // //           </div>
// // // //         </CardContent>
// // // //       </Card>

// // // //       {/* Accounts Table */}
// // // //       <Card>
// // // //         <CardHeader>
// // // //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// // // //             Your Accounts
// // // //             {pagination && (
// // // //               <span className="ml-2 text-sm font-normal text-gray-500">({pagination.totalCount} total)</span>
// // // //             )}
// // // //             {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2 text-blue-500" />}
// // // //           </CardTitle>
// // // //         </CardHeader>
// // // //         <CardContent className="p-0">
// // // //           <div className="overflow-x-auto">
// // // //             <table className="w-full">
// // // //               <thead className="bg-gray-50">
// // // //                 <tr>
// // // //                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                     Account
// // // //                   </th>
// // // //                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                     Balance
// // // //                   </th>
// // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                     Status
// // // //                   </th>
// // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                     Created
// // // //                   </th>
// // // //                   <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
// // // //                     Actions
// // // //                   </th>
// // // //                 </tr>
// // // //               </thead>

// // // //               {showSkeleton ? (
// // // //                 <TableSkeleton rows={filters.pageSize} />
// // // //               ) : (
// // // //                 <tbody className="bg-white divide-y divide-gray-200">
// // // //                   {accounts.length === 0 ? (
// // // //                     <tr>
// // // //                       <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
// // // //                         No accounts found. Create your first account to get started.
// // // //                       </td>
// // // //                     </tr>
// // // //                   ) : (
// // // //                     accounts.map((account) => (
// // // //                       <tr key={account._id} className="hover:bg-gray-50">
// // // //                         <td className="px-6 py-4">
// // // //                           <div>
// // // //                             <p className="text-sm font-medium text-gray-900">{account.name}</p>
// // // //                             {account.description && (
// // // //                               <p className="text-sm text-gray-500 truncate max-w-xs">{account.description}</p>
// // // //                             )}
// // // //                           </div>
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-right">
// // // //                           <span
// // // //                             className={`text-lg font-semibold ${
// // // //                               account.currentBalance >= 0 ? "text-green-600" : "text-red-600"
// // // //                             }`}
// // // //                           >
// // // //                             {formatCurrency(account.currentBalance)}
// // // //                           </span>
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-center">
// // // //                           <Badge variant={account.isActive ? "default" : "secondary"}>
// // // //                             {account.isActive ? "Active" : "Inactive"}
// // // //                           </Badge>
// // // //                         </td>
// // // //                         <td className="px-6 py-4 text-center text-sm text-gray-500">
// // // //                           {formatDate(account.createdAt)}
// // // //                         </td>
// // // //                         <td className="px-6 py-4">
// // // //                           <div className="flex justify-center gap-2">
// // // //                             {onSelectAccount && (
// // // //                               <Button
// // // //                                 variant="ghost"
// // // //                                 size="sm"
// // // //                                 onClick={() => handleViewTransactions(account)}
// // // //                                 className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
// // // //                                 title="View Transactions"
// // // //                               >
// // // //                                 <ArrowRight className="w-4 h-4" />
// // // //                               </Button>
// // // //                             )}
// // // //                             <Button
// // // //                               variant="ghost"
// // // //                               size="sm"
// // // //                               onClick={() => handleEdit(account)}
// // // //                               className="text-gray-500 hover:text-gray-600 hover:bg-gray-50"
// // // //                               title="Edit Account"
// // // //                             >
// // // //                               <Pencil className="w-4 h-4" />
// // // //                             </Button>
// // // //                             <Button
// // // //                               variant="ghost"
// // // //                               size="sm"
// // // //                               onClick={() => handleDeleteClick(account)}
// // // //                               className="text-red-500 hover:text-red-600 hover:bg-red-50"
// // // //                               title="Delete Account"
// // // //                             >
// // // //                               <Trash2 className="w-4 h-4" />
// // // //                             </Button>
// // // //                           </div>
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
// // // //       <AddAccountModal open={showAddModal} onOpenChange={setShowAddModal} />

// // // //       <EditAccountModal open={showEditModal} onOpenChange={setShowEditModal} account={selectedAccount} />

// // // //       {/* Using Universal Confirmation Modal */}
// // // //       <ConfirmDialog
// // // //         open={showDeleteModal}
// // // //         onOpenChange={setShowDeleteModal}
// // // //         onConfirm={handleDeleteConfirm}
// // // //         title="Delete Account"
// // // //         description={`Are you sure you want to delete "${selectedAccount?.name}"? All transactions will also be deleted. This cannot be undone.`}
// // // //         confirmLabel="Delete"
// // // //         icon={Trash2}
// // // //         variant="destructive"
// // // //         isLoading={deleteMutation.isPending}
// // // //         loadingLabel="Deleting..."
// // // //       />
// // // //     </div>
// // // //   );
// // // // }