"use client";

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { toast } from 'sonner';
import EditAccountModal from '@/components/modals/edit-account-modal';
import AddTransactionModal from '@/components/modals/add-transaction-modal';
import { useDeleteAccount, useUpdateAccount } from '@/hooks/use-account-mutations';
import type { Account, AccountsPaginatedResponse, PaginationMetadata } from '@/types/admin/account';

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
    includeInactive: false, currentPage: 1, pageSize: 100,
    sortBy: "name", sortOrder: "asc",
  });

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
          <Select value={String(filters.pageSize)} onValueChange={(v) => updateFilter("pageSize", Number(v))}>
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
        <div className="flex-1 min-w-0">
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
          </div>
        </div>

        <div className="flex flex-col gap-3 shrink-0">
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

        {/* Right half — stat tiles */}
        <div className="flex flex-wrap gap-3 shrink-0">
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
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${account.isActive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
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
                                <p className="font-medium text-gray-700 truncate max-w-[140px]">@{ownerObj.username}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300 italic">—</span>
                            )}
                          </td>
                        )}

                        {/* Balance */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`font-bold tabular-nums ${account.currentBalance < 0 ? "text-red-600"
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