"use client";

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
    Hash,
    Users,
    Pencil,
    X,
} from "lucide-react";

interface StudentRow {
    _id: string;
    rollNumber: string;
    name: string;
    standard: string;
    year: number;
    id?: string | null;
}

type RowStatus = "idle" | "editing" | "saving" | "saved" | "error";

interface RowState {
    value: string;
    status: RowStatus;
    error?: string;
    originalId?: string;
}

interface BulkStudentIdModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function BulkStudentIdModal({
    open,
    onOpenChange,
}: BulkStudentIdModalProps) {
    const queryClient = useQueryClient();
    const [rows, setRows] = useState<Record<string, RowState>>({});

    const { data, isLoading } = useQuery<StudentRow[]>({
        queryKey: ["students-bulk-id"],
        queryFn: async () => {
            const res = await fetch("/api/students/bulk-id");
            if (!res.ok) throw new Error("Failed to fetch students");
            const json = await res.json();
            return json.data;
        },
        enabled: open,
    });

    useEffect(() => {
        if (!data) return;
        setRows((prev) => {
            const next = { ...prev };
            data.forEach((s) => {
                if (!next[s._id]) {
                    next[s._id] = {
                        value: s.id ?? "",
                        status: s.id ? "saved" : "idle",
                        originalId: s.id ?? "",
                    };
                }
            });
            return next;
        });
    }, [data]);

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
        onSuccess: (_, { studentMongoId, id }) => {
            setRows((prev) => ({
                ...prev,
                [studentMongoId]: { value: id, status: "saved", originalId: id },
            }));
            queryClient.invalidateQueries({ queryKey: ["students-bulk-id"] });
            queryClient.invalidateQueries({ queryKey: ["students"] });
        },
        onError: (err: Error, { studentMongoId }) => {
            setRows((prev) => ({
                ...prev,
                [studentMongoId]: { ...prev[studentMongoId], status: "error", error: err.message },
            }));
        },
    });

    const handleEdit = useCallback((mongoId: string) => {
        setRows((prev) => ({
            ...prev,
            [mongoId]: { ...prev[mongoId], status: "editing", error: undefined },
        }));
    }, []);

    const handleCancel = useCallback((mongoId: string) => {
        setRows((prev) => ({
            ...prev,
            [mongoId]: {
                ...prev[mongoId],
                value: prev[mongoId].originalId ?? "",
                status: prev[mongoId].originalId ? "saved" : "idle",
                error: undefined,
            },
        }));
    }, []);

    const handleChange = useCallback((mongoId: string, value: string) => {
        setRows((prev) => ({
            ...prev,
            [mongoId]: { ...prev[mongoId], value: value.replace(/\D/g, ""), error: undefined },
        }));
    }, []);

    const handleSave = useCallback((mongoId: string) => {
        const row = rows[mongoId];
        if (!row?.value.trim()) return;
        if (row.status === "saving") return;
        if (row.value.trim() === row.originalId) {
            setRows((prev) => ({ ...prev, [mongoId]: { ...prev[mongoId], status: "saved", error: undefined } }));
            return;
        }
        setRows((prev) => ({ ...prev, [mongoId]: { ...prev[mongoId], status: "saving" } }));
        saveMutation.mutate({ studentMongoId: mongoId, id: row.value.trim() });
    }, [rows, saveMutation]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent, mongoId: string) => {
        if (e.key === "Enter") handleSave(mongoId);
        if (e.key === "Escape") handleCancel(mongoId);
    }, [handleSave, handleCancel]);

    const totalCount = data?.length ?? 0;
    const assignedCount = Object.values(rows).filter((r) => r.status === "saved" && r.value).length;
    const pendingCount = totalCount - assignedCount;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl h-[80vh] flex flex-col gap-0 p-0">

                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                        <Hash className="w-5 h-5 text-indigo-500" />
                        Assign Student IDs
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-gray-500">
                        Enter a numeric ID for each student. Press{" "}
                        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Enter</kbd>{" "}
                        or click away to save. Click <Pencil className="w-3 h-3 inline mx-0.5" /> to edit.
                    </DialogDescription>
                    {!isLoading && totalCount > 0 && (
                        <div className="flex items-center gap-2 mt-3">
                            <Badge variant="outline" className="gap-1 text-xs">
                                <Users className="w-3 h-3" />{totalCount} total
                            </Badge>
                            <Badge className="gap-1 text-xs bg-emerald-500 text-white">
                                <Check className="w-3 h-3" />{assignedCount} assigned
                            </Badge>
                            {pendingCount > 0 && (
                                <Badge variant="secondary" className="text-xs">{pendingCount} pending</Badge>
                            )}
                        </div>
                    )}
                </div>

                {/* Scrollable table */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full gap-2 text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin" /> Loading students…
                        </div>
                    ) : !data || data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                            <Check className="w-10 h-10 text-emerald-400" />
                            <p className="font-medium text-gray-600">No students found.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm table-fixed">
                            <colgroup>
                                <col className="w-[15%]" />
                                <col className="w-[35%]" />
                                <col className="w-[12%]" />
                                <col className="w-[30%]" />
                                <col className="w-[8%]" />
                            </colgroup>
                            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Roll No</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Std</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student ID</th>
                                    <th className="px-4 py-2.5 w-8" />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {data.map((student) => {
                                    const row = rows[student._id] ?? { value: "", status: "idle" };
                                    const isSaved = row.status === "saved";
                                    const isSaving = row.status === "saving";
                                    const isError = row.status === "error";

                                    return (
                                        <tr
                                            key={student._id}
                                            className={`transition-colors ${isSaved ? "bg-emerald-50/40" : isError ? "bg-red-50/40" : "hover:bg-gray-50/60"
                                                }`}
                                        >
                                            <td className="px-4 py-2.5 font-mono text-sm font-semibold text-gray-600 truncate">
                                                {student.rollNumber}
                                            </td>
                                            <td className="px-4 py-2.5 font-medium text-gray-900 truncate">
                                                {student.name}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <Badge variant="outline" className="text-xs">{student.standard}</Badge>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {isSaved ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm font-bold text-gray-800">{row.value}</span>
                                                        <button
                                                            onClick={() => handleEdit(student._id)}
                                                            className="text-gray-300 hover:text-indigo-500 transition-colors flex-shrink-0"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <Input
                                                                autoFocus={row.status === "editing"}
                                                                value={row.value}
                                                                onChange={(e) => handleChange(student._id, e.target.value)}
                                                                onBlur={() => handleSave(student._id)}
                                                                onKeyDown={(e) => handleKeyDown(e, student._id)}
                                                                placeholder="Numeric ID"
                                                                inputMode="numeric"
                                                                disabled={isSaving}
                                                                className={`w-32 h-8 text-sm font-mono ${isError ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                                                            />
                                                            {row.originalId && (
                                                                <button
                                                                    onClick={() => handleCancel(student._id)}
                                                                    className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {isError && (
                                                            <p className="text-xs text-red-500 flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" />{row.error}
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

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                    <p className="text-xs text-gray-400">
                        Numbers only · <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-xs">Esc</kbd> to cancel edit
                    </p>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
                </div>

            </DialogContent>
        </Dialog>
    );
}
