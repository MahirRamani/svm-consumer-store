"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, CalendarDays, Download, Upload, FileSpreadsheet, UserPlus, X } from "lucide-react";
import { parseExcelFile, findCol, downloadExcelTemplate, ID_KEYS, ROLL_KEYS, STD_KEYS, NAME_KEYS } from "@/lib/utils/excel-utils";
import type { YearConfigEntry, AddPhase, AddRow, AddRowErrors } from "@/types/manage-student/manage-student-bulk";

interface Props {
    activeYear: YearConfigEntry | null;
    onStudentsCreated: () => void;
}

const blankRow = (): AddRow => ({ _key: `r${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, id: "", rollNumber: "", name: "", standard: "" });

export function BulkAddTab({ activeYear, onStudentsCreated }: Props) {
    const [addPhase, setAddPhase] = useState<AddPhase>("edit");
    const [addRows, setAddRows] = useState<AddRow[]>([blankRow()]);
    const [addRowErrors, setAddRowErrors] = useState<Record<string, AddRowErrors>>({});
    const [excelStatus, setExcelStatus] = useState<{ matched: number; error?: string } | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [createdCount, setCreatedCount] = useState(0);
    const excelRef = useRef<HTMLInputElement>(null);

    const addMutation = useMutation({
        mutationFn: async (payload: {
            dryRun: boolean;
            students: Array<{ id?: number; rollNumber: number; name: string; standard: number }>;
        }) => {
            const res = await fetch("/api/students/bulk-add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                let message = "Failed to add students";
                try {
                    const errData = await res.json();
                    message = errData.message ?? errData.error?.message ?? message;
                } catch {
                    /* keep default */
                }
                throw new Error(message);
            }
            return res.json() as Promise<{ data: { created?: number } }>;
        },
        onSuccess: (res, variables) => {
            if (variables.dryRun) {
                setAddPhase("preview");
            } else {
                setCreatedCount(res.data?.created ?? addRows.length);
                setAddPhase("done");
                onStudentsCreated();
            }
        },
    });

    const handleRowChange = useCallback((key: string, field: keyof Omit<AddRow, "_key">, val: string) => {
        setAddRows((prev) =>
            prev.map((r) =>
                r._key !== key ? r : { ...r, [field]: field === "id" || field === "rollNumber" ? val.replace(/\D/g, "") : val }
            )
        );
        setAddRowErrors((prev) => ({ ...prev, [key]: { ...prev[key], [field]: undefined } }));
    }, []);

    const handleAddRow = useCallback(() => {
        setAddRows((prev) => [...prev, blankRow()]);
    }, []);

    const handleDeleteRow = useCallback((key: string) => {
        setAddRows((prev) => (prev.length === 1 ? [blankRow()] : prev.filter((r) => r._key !== key)));
        setAddRowErrors((prev) => {
            const n = { ...prev };
            delete n[key];
            return n;
        });
    }, []);

    const handleExcelUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsParsing(true);
        setExcelStatus(null);
        try {
            const rawRows = await parseExcelFile(file);

            const newRows: AddRow[] = rawRows
                .map((row) => ({
                    _key: blankRow()._key,
                    id: findCol(row, ID_KEYS) ?? "",
                    rollNumber: (findCol(row, ROLL_KEYS) ?? "").replace(/\D/g, ""),
                    name: findCol(row, NAME_KEYS) ?? "",
                    standard: findCol(row, STD_KEYS) ?? "",
                }))
                .filter((r) => r.name || r.rollNumber);

            setAddRows((prev) => {
                const onlyBlank = prev.length === 1 && !prev[0].name && !prev[0].rollNumber;
                return onlyBlank ? newRows : [...prev, ...newRows];
            });
            setExcelStatus({ matched: newRows.length });
        } catch (err) {
            setExcelStatus({ matched: 0, error: err instanceof Error ? err.message : "Unknown error" });
        } finally {
            setIsParsing(false);
            if (excelRef.current) excelRef.current.value = "";
        }
    }, []);

    const downloadTemplate = useCallback(async () => {
        await downloadExcelTemplate("new-students-template.xlsx", [
            { header: "ID", key: "id", width: 12 },
            { header: "Roll No", key: "rollNo", width: 14 },
            { header: "Name", key: "name", width: 28 },
            { header: "Standard", key: "standard", width: 14 },
        ], []);
    }, []);

    //TODO: Error should be shown and in detail
    const handleSubmit = useCallback(

        (dryRun: boolean) => {
            console.log("1");
            const errors: Record<string, AddRowErrors> = {};
            let hasErrors = false;

            addRows.forEach((r) => {
                const rowErrors: AddRowErrors = {};
                if (!r.rollNumber.trim()) {
                    rowErrors.rollNumber = "Required";
                    hasErrors = true;
                }
                if (!r.name.trim()) {
                    rowErrors.name = "Required";
                    hasErrors = true;
                }
                if (!r.standard.trim()) {
                    rowErrors.standard = "Required";
                    hasErrors = true;
                }
                console.log("2");
                if (Object.keys(rowErrors).length) errors[r._key] = rowErrors;
            });

            console.log("3");
            const rolls = addRows.map((r) => r.rollNumber.trim()).filter(Boolean);
            const dupRolls = rolls.filter((r, i) => rolls.indexOf(r) !== i);
            addRows.forEach((r) => {
                if (dupRolls.includes(r.rollNumber.trim())) {
                    errors[r._key] = { ...errors[r._key], rollNumber: "Duplicate in batch" };
                    hasErrors = true;
                }
            });

            console.log("4");
            const ids = addRows.map((r) => r.id.trim()).filter(Boolean);
            const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
            addRows.forEach((r) => {
                if (r.id.trim() && dupIds.includes(r.id.trim())) {
                    errors[r._key] = { ...errors[r._key], id: "Duplicate in batch" };
                    hasErrors = true;
                }
            });
            console.log("5");

            console.log("🚀 ~ BulkAddTab ~ hasErrors:", hasErrors)
            if (hasErrors) {
                setAddRowErrors(errors);
                console.log("🚀 ~ BulkAddTab ~ errors:", errors)
                return;
            }

            console.log("6");
            addMutation.mutate({
                dryRun,
                students: addRows.map((r) => ({
                    rollNumber: Number(r.rollNumber.trim()),
                    name: r.name.trim(),
                    standard: Number(r.standard.trim()),
                    ...(r.id.trim() ? { id: Number(r.id.trim()) } : {}),
                })),
            });
            console.log("7");
        },
        [addRows, addMutation]
    );

    const readyCount = addRows.filter((r) => r.rollNumber.trim() && r.name.trim() && r.standard.trim()).length;
    const isPending = addMutation.isPending;

    // ── Preview phase ─────────────────────────────────────────────────────────
    if (addPhase === "preview") {
        return (
            <div className="flex flex-col h-full min-h-0">
                <div className="px-6 py-4 border-b border-amber-100 bg-amber-50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        <p className="font-semibold text-gray-800">
                            Preview — {addRows.length} student{addRows.length !== 1 ? "s" : ""} will be created in {activeYear?.currentYear}
                        </p>
                    </div>
                    <p className="mt-1 text-xs text-amber-600">Review carefully — no students have been created yet.</p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-sm table-fixed">
                        <colgroup>
                            <col className="w-[5%]" />
                            <col className="w-[12%]" />
                            <col className="w-[15%]" />
                            <col className="w-[38%]" />
                            <col className="w-[30%]" />
                        </colgroup>
                        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Roll No</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Standard</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {addRows.map((r, i) => (
                                <tr key={r._key} className="hover:bg-gray-50/50">
                                    <td className="px-3 py-2 text-xs text-gray-400 font-mono">{i + 1}</td>
                                    <td className="px-3 py-2 font-mono text-sm text-gray-600">{r.id || <span className="text-gray-300 text-xs">—</span>}</td>
                                    <td className="px-3 py-2 font-mono text-sm font-semibold text-gray-700">{r.rollNumber}</td>
                                    <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                                    <td className="px-3 py-2">
                                        <Badge variant="outline" className="text-xs">
                                            {r.standard}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setAddPhase("edit");
                            addMutation.reset();
                        }}
                        disabled={isPending}
                    >
                        ← Back &amp; Edit
                    </Button>
                    <Button size="sm" onClick={() => handleSubmit(false)} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Creating…
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" /> Confirm &amp; Create Students
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    // ── Done phase ────────────────────────────────────────────────────────────
    if (addPhase === "done") {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="font-semibold text-gray-800">
                    {createdCount} student{createdCount !== 1 ? "s" : ""} created in {activeYear?.currentYear}!
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setAddPhase("edit");
                        setAddRows([blankRow()]);
                        setAddRowErrors({});
                        setExcelStatus(null);
                        addMutation.reset();
                    }}
                >
                    Add More Students
                </Button>
            </div>
        );
    }

    // ── Edit phase ────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0 space-y-2">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        {activeYear ? (
                            <div className="flex items-center gap-2">
                                <Badge className="text-xs gap-1 bg-indigo-500 text-white">
                                    <CalendarDays className="w-3 h-3" />
                                    {activeYear.currentYear}
                                </Badge>
                                <span className="text-xs text-gray-400">students will be added to this year</span>
                            </div>
                        ) : (
                            <p className="text-xs text-amber-600 font-medium">No active year — create one in Year Config tab first.</p>
                        )}
                        <p className="text-xs text-gray-500">
                            Fill rows below, or upload Excel with <code className="bg-gray-100 px-1 rounded">ID</code>,{" "}
                            <code className="bg-gray-100 px-1 rounded">Roll No</code>, <code className="bg-gray-100 px-1 rounded">Name</code>,{" "}
                            <code className="bg-gray-100 px-1 rounded">Standard</code>. ID is optional. Year is set automatically.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadTemplate}>
                            <Download className="w-3.5 h-3.5" /> Template
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => excelRef.current?.click()}
                            disabled={isParsing || !activeYear}
                        >
                            {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            {isParsing ? "Parsing…" : "Upload Excel"}
                        </Button>
                        <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
                        <Button size="sm" className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleAddRow} disabled={!activeYear}>
                            <UserPlus className="w-3.5 h-3.5" /> Add Row
                        </Button>
                    </div>
                </div>

                {excelStatus &&
                    (excelStatus.error ? (
                        <p className="text-xs text-red-500 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {excelStatus.error}
                        </p>
                    ) : (
                        <Badge className="gap-1 text-xs bg-emerald-500 text-white">
                            <FileSpreadsheet className="w-3 h-3" />
                            {excelStatus.matched} rows imported
                        </Badge>
                    ))}

                {addMutation.isError && (
                    <div className="rounded-md border border-red-200 bg-red-50">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-red-200">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            {/* <span className="text-sm font-medium text-red-700">
                                {addMutation.error instanceof Error ? addMutation.error.message : "Something went wrong"}
                            </span> */}
                            <div className="text-sm font-medium text-red-700 flex flex-col max-h-24 overflow-y-auto min-h-0 w-full pr-1">
    {(addMutation.error instanceof Error ? addMutation.error.message : "Something went wrong")
        .split('|')
        .map((errPiece, index) => {
            const trimmedErr = errPiece.trim();
            return trimmedErr ? (
                <span key={index} className="block break-words whitespace-pre-wrap">
                    {trimmedErr}
                </span>
            ) : null;
        })
    }
</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm table-fixed">
                    <colgroup>
                        <col className="w-[4%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[34%]" />
                        <col className="w-[16%]" />
                        <col className="w-[20%]" />
                        <col className="w-[4%]" />
                    </colgroup>
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-400">#</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                ID <span className="font-normal normal-case text-gray-400">(opt)</span>
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Roll No</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Standard</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Year</th>
                            <th className="px-2 py-2.5"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {addRows.map((row, i) => {
                            const errs = addRowErrors[row._key];
                            const hasErr = errs && Object.keys(errs).length > 0;
                            return (
                                <tr key={row._key} className={hasErr ? "bg-red-50/30" : "hover:bg-gray-50/40"}>
                                    <td className="px-2 py-2 text-xs text-gray-400 font-mono text-center">{i + 1}</td>

                                    <td className="px-3 py-2">
                                        <Input
                                            value={row.id}
                                            onChange={(e) => handleRowChange(row._key, "id", e.target.value)}
                                            placeholder="e.g. 1001"
                                            inputMode="numeric"
                                            disabled={isPending}
                                            className={`h-8 text-sm font-mono ${errs?.id ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                                        />
                                        {errs?.id && <p className="text-xs text-red-500 mt-0.5">{errs.id}</p>}
                                    </td>

                                    <td className="px-3 py-2">
                                        <Input
                                            value={row.rollNumber}
                                            onChange={(e) => handleRowChange(row._key, "rollNumber", e.target.value)}
                                            placeholder="e.g. 42"
                                            inputMode="numeric"
                                            disabled={isPending}
                                            className={`h-8 text-sm font-mono ${errs?.rollNumber ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                                        />
                                        {errs?.rollNumber && <p className="text-xs text-red-500 mt-0.5">{errs.rollNumber}</p>}
                                    </td>

                                    <td className="px-3 py-2">
                                        <Input
                                            value={row.name}
                                            onChange={(e) => handleRowChange(row._key, "name", e.target.value)}
                                            placeholder="Full name"
                                            disabled={isPending}
                                            className={`h-8 text-sm ${errs?.name ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                                        />
                                        {errs?.name && <p className="text-xs text-red-500 mt-0.5">{errs.name}</p>}
                                    </td>

                                    <td className="px-3 py-2">
                                        <Input
                                            value={row.standard}
                                            onChange={(e) => handleRowChange(row._key, "standard", e.target.value)}
                                            placeholder="e.g. 10A"
                                            disabled={isPending}
                                            className={`h-8 text-sm ${errs?.standard ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                                        />
                                        {errs?.standard && <p className="text-xs text-red-500 mt-0.5">{errs.standard}</p>}
                                    </td>

                                    <td className="px-3 py-2">
                                        <span className="text-xs text-gray-400 font-mono">
                                            {activeYear?.currentYear ?? <span className="italic text-gray-300">no year</span>}
                                        </span>
                                    </td>

                                    <td className="px-2 py-2 text-center">
                                        <button
                                            onClick={() => handleDeleteRow(row._key)}
                                            disabled={isPending}
                                            className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-gray-400">
                    {readyCount} / {addRows.length} row{addRows.length !== 1 ? "s" : ""} ready
                    {addRows.length !== readyCount && <span className="ml-1 text-amber-500">— fill all required fields</span>}
                </span>
                <Button
                    size="sm"
                    onClick={() => handleSubmit(true)}
                    disabled={isPending || !activeYear || readyCount === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Previewing…
                        </>
                    ) : (
                        <>
                            <UserPlus className="w-4 h-4" /> Preview &amp; Add
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}