"use client";

// components/modals/BulkStudentIdModal.tsx

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Check,
  AlertCircle,
  Save,
  Users,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StudentWithoutId {
  _id:        string;
  rollNumber: string;
  name:       string;
  standard:   string;
  year:       number;
}

// Per-row state
type RowStatus = "idle" | "saving" | "saved" | "error";

interface RowState {
  value:  string;       // current input value
  status: RowStatus;
  error?: string;
}

interface BulkStudentIdModalProps {
  open:         boolean;
  onOpenChange: (open: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BulkStudentIdModal({
  open,
  onOpenChange,
}: BulkStudentIdModalProps) {
  const queryClient = useQueryClient();

  // per-row input + status state
  const [rows, setRows] = useState<Record<string, RowState>>({});

  // ── Fetch students without ID ─────────────────────────────────────────────
  const { data, isLoading } = useQuery<StudentWithoutId[]>({
    queryKey: ["students-without-id"],
    queryFn: async () => {
      const res = await fetch("/api/students/bulk-id");
      if (!res.ok) throw new Error("Failed to fetch students");
      const json = await res.json();
      return json.data;
    },
    enabled: open,
  });

  // Initialise row state when data loads
  useEffect(() => {
    if (!data) return;
    setRows((prev) => {
      const next = { ...prev };
      data.forEach((s) => {
        if (!next[s._id]) next[s._id] = { value: "", status: "idle" };
      });
      return next;
    });
  }, [data]);

  // ── Single-row save mutation ──────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ studentMongoId, id }: { studentMongoId: string; id: string }) => {
      const res = await fetch("/api/students/bulk-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: [{ studentMongoId, id }] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to save" }));
        throw new Error(err.message || "Failed to save");
      }
      return res.json();
    },
    onSuccess: (_, { studentMongoId }) => {
      setRows((prev) => ({
        ...prev,
        [studentMongoId]: { ...prev[studentMongoId], status: "saved" },
      }));
      // Refresh students list and main student queries
      queryClient.invalidateQueries({ queryKey: ["students-without-id"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (err: Error, { studentMongoId }) => {
      setRows((prev) => ({
        ...prev,
        [studentMongoId]: {
          ...prev[studentMongoId],
          status: "error",
          error: err.message,
        },
      }));
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleChange = useCallback((mongoId: string, value: string) => {
    // Numbers only — strip non-digits on input
    const numeric = value.replace(/\D/g, "");
    setRows((prev) => ({
      ...prev,
      [mongoId]: { value: numeric, status: "idle", error: undefined },
    }));
  }, []);

  const handleSave = useCallback(
    (mongoId: string) => {
      const row = rows[mongoId];
      if (!row?.value.trim()) return;                    // nothing to save
      if (row.status === "saving" || row.status === "saved") return;

      setRows((prev) => ({
        ...prev,
        [mongoId]: { ...prev[mongoId], status: "saving" },
      }));

      saveMutation.mutate({ studentMongoId: mongoId, id: row.value.trim() });
    },
    [rows, saveMutation]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, mongoId: string) => {
      if (e.key === "Enter") handleSave(mongoId);
    },
    [handleSave]
  );

  // Pending = has value but not yet saved
  const pendingCount = Object.values(rows).filter(
    (r) => r.value && r.status !== "saved"
  ).length;
  const savedCount = Object.values(rows).filter((r) => r.status === "saved").length;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-indigo-500" />
            Assign Student IDs
          </DialogTitle>
          <DialogDescription>
            Students below don't have an ID assigned yet. Enter a numeric ID for
            each and press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Enter</kbd> or
            click away to save — one row at a time.
          </DialogDescription>
        </DialogHeader>

        {/* Stats bar */}
        {data && data.length > 0 && (
          <div className="flex items-center gap-3 px-1">
            <Badge variant="outline" className="gap-1.5">
              <Users className="w-3 h-3" />
              {data.length} pending
            </Badge>
            {savedCount > 0 && (
              <Badge className="gap-1.5 bg-emerald-500 text-white">
                <Check className="w-3 h-3" />
                {savedCount} saved this session
              </Badge>
            )}
            {pendingCount > 0 && (
              <span className="text-xs text-amber-600 font-medium">
                {pendingCount} filled but not saved yet — press Enter or click away
              </span>
            )}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading students…
            </div>
          ) : !data || data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
              <Check className="w-10 h-10 text-emerald-400" />
              <p className="font-medium text-gray-600">All students have IDs assigned!</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Roll No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Std
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Assign ID
                  </th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data.map((student) => {
                  const row    = rows[student._id] ?? { value: "", status: "idle" };
                  const isSaved  = row.status === "saved";
                  const isSaving = row.status === "saving";
                  const isError  = row.status === "error";

                  return (
                    <tr
                      key={student._id}
                      className={`transition-colors ${
                        isSaved ? "bg-emerald-50/60" : isError ? "bg-red-50/60" : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Roll No */}
                      <td className="px-4 py-3 font-mono text-sm text-gray-600 font-semibold">
                        {student.rollNumber}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {student.name}
                      </td>

                      {/* Standard */}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {student.standard}
                        </Badge>
                      </td>

                      {/* Input */}
                      <td className="px-4 py-3">
                        {isSaved ? (
                          <span className="font-mono text-sm font-bold text-emerald-700">
                            {row.value}
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <Input
                              value={row.value}
                              onChange={(e) => handleChange(student._id, e.target.value)}
                              onBlur={() => handleSave(student._id)}
                              onKeyDown={(e) => handleKeyDown(e, student._id)}
                              placeholder="Enter numeric ID"
                              inputMode="numeric"
                              pattern="\d*"
                              disabled={isSaving}
                              className={`w-40 h-8 text-sm font-mono ${
                                isError
                                  ? "border-red-400 focus-visible:ring-red-300"
                                  : ""
                              }`}
                            />
                            {isError && (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {row.error}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status icon */}
                      <td className="px-4 py-3 text-center">
                        {isSaving && (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400 mx-auto" />
                        )}
                        {isSaved && (
                          <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                        )}
                        {isError && (
                          <AlertCircle className="w-4 h-4 text-red-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400">
            IDs must be unique numbers. Saves automatically on Enter or click away.
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}