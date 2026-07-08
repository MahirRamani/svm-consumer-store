"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, Users, Pencil, X } from "lucide-react";
import { EmptyState } from "./shared-ui";
import type { StudentRow, IdRowState, IdRowStatus } from "@/types/manage-student/manage-student-bulk";

interface Props {
  students?: StudentRow[];
  studentsLoading: boolean;
  onMutated: () => void;
  onClose: () => void;
}

export function AssignIdsTab({ students, studentsLoading, onMutated, onClose }: Props) {
  const [idRows, setIdRows] = useState<Record<string, IdRowState>>({});

  useEffect(() => {
    if (!students) return;
    setIdRows((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        if (!next[s._id])
          next[s._id] = {
            value: s.id != null ? String(s.id) : "",
            status: s.id != null ? "saved" : "idle",
            originalId: s.id ?? undefined,
          };
      });
      return next;
    });
  }, [students]);

  const saveIdMutation = useMutation({
    mutationFn: async ({ studentMongoId, id }: { studentMongoId: string; id: number }) => {
      const res = await fetch("/api/students/bulk-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: [{ studentMongoId, id }] }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Failed to save");
      return res.json();
    },
    onSuccess: (_, { studentMongoId, id }) => {
      setIdRows((p) => ({ ...p, [studentMongoId]: { value: String(id), status: "saved", originalId: id } }));
      onMutated();
    },
    onError: (err: Error, { studentMongoId }) => {
      setIdRows((p) => ({ ...p, [studentMongoId]: { ...p[studentMongoId], status: "error", error: err.message } }));
    },
  });

  const handleIdEdit = useCallback(
    (id: string) => setIdRows((p) => ({ ...p, [id]: { ...p[id], status: "editing", error: undefined } })),
    []
  );

  const handleIdCancel = useCallback(
    (id: string) =>
      setIdRows((p) => ({
        ...p,
        [id]: {
          ...p[id],
          value: p[id].originalId != null ? String(p[id].originalId) : "",
          status: p[id].originalId != null ? "saved" : "idle",
          error: undefined,
        },
      })),
    []
  );

  const handleIdChange = useCallback(
    (id: string, val: string) =>
      setIdRows((p) => ({ ...p, [id]: { ...p[id], value: val.replace(/\D/g, ""), error: undefined } })),
    []
  );

  const handleIdSave = useCallback(
    (mongoId: string) => {
      const row = idRows[mongoId];
      if (!row?.value.trim() || row.status === "saving") return;
      const newId = Number(row.value.trim());
      if (newId === row.originalId) {
        setIdRows((p) => ({ ...p, [mongoId]: { ...p[mongoId], status: "saved", error: undefined } }));
        return;
      }
      setIdRows((p) => ({ ...p, [mongoId]: { ...p[mongoId], status: "saving" } }));
      saveIdMutation.mutate({ studentMongoId: mongoId, id: newId });
    },
    [idRows, saveIdMutation]
  );

  const handleIdKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === "Enter") handleIdSave(id);
      if (e.key === "Escape") handleIdCancel(id);
    },
    [handleIdSave, handleIdCancel]
  );

  const totalCount = students?.length ?? 0;
  const idAssignedCount = Object.values(idRows).filter((r) => r.status === "saved" && r.value).length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-3 border-b border-gray-50 flex-shrink-0">
        <p className="text-sm text-gray-500">
          Enter a numeric ID for each student. Press{" "}
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Enter</kbd> or click away to save.
        </p>
        {!studentsLoading && totalCount > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <Users className="w-3 h-3" /> {totalCount} total
            </Badge>
            <Badge className="gap-1 text-xs bg-emerald-500 text-white">
              <Check className="w-3 h-3" /> {idAssignedCount} assigned
            </Badge>
            {totalCount - idAssignedCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalCount - idAssignedCount} pending
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {studentsLoading ? (
          <EmptyState icon={<Loader2 className="w-5 h-5 animate-spin" />} text="Loading…" />
        ) : !students?.length ? (
          <EmptyState icon={<Check className="w-10 h-10 text-emerald-400" />} text="No students found." />
        ) : (
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[36%]" />
              <col className="w-[12%]" />
              <col className="w-[30%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr>
                {["Roll No", "Name", "Std", "Student ID", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {students.map((student) => {
                const row = idRows[student._id] ?? { value: "", status: "idle" as IdRowStatus };
                const isSaved = row.status === "saved";
                const isSaving = row.status === "saving";
                const isError = row.status === "error";
                return (
                  <tr
                    key={student._id}
                    className={`transition-colors ${
                      isSaved ? "bg-emerald-50/40" : isError ? "bg-red-50/40" : "hover:bg-gray-50/60"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-sm font-semibold text-gray-600 truncate">
                      {student.rollNumber}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-normal break-words">
                      {student.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-xs">
                        {student.standard}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {isSaved ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-gray-800">{row.value}</span>
                          <button
                            onClick={() => handleIdEdit(student._id)}
                            className="text-gray-300 hover:text-indigo-500 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Input
                              autoFocus={row.status === "editing"}
                              value={row.value ?? ""}
                              onChange={(e) => handleIdChange(student._id, e.target.value)}
                              onBlur={() => handleIdSave(student._id)}
                              onKeyDown={(e) => handleIdKeyDown(e, student._id)}
                              placeholder="Numeric ID"
                              inputMode="numeric"
                              disabled={isSaving}
                              className={`w-32 h-8 text-sm font-mono ${isError ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                            />
                            {row.originalId && (
                              <button
                                onClick={() => handleIdCancel(student._id)}
                                className="text-gray-300 hover:text-gray-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {isError && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {row.error}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isSaving && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 mx-auto" />}
                      {isSaved && <Check className="w-4 h-4 text-emerald-500 mx-auto" />}
                      {isError && <AlertCircle className="w-4 h-4 text-red-400 mx-auto" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-gray-400">
          Numbers only · <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-xs">Esc</kbd> to cancel
        </p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}