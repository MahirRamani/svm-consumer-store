// ─────────────────────────────────────────────────────────────────────────────
// ADDITIONS TO BulkStudentUpdateModal.tsx
// Apply in the order listed below.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Add UserPlus to lucide-react import ────────────────────────────────────
//
//  import {
//    ..., ChevronDown, Search, ArrowLeftRight, UserPlus,   // ← add UserPlus
//  } from "lucide-react";


// ── 2. Add NAME_KEYS constant (alongside ID_KEYS / ROLL_KEYS / STD_KEYS) ──────
//
//  const NAME_KEYS = ["name", "studentname", "fullname", "student"];


// ── 3. Add these types at module level (alongside the other interfaces) ────────
//
//  type AddPhase = "edit" | "preview" | "done";
//
//  interface AddRow {
//    _key:       string;
//    id:         string;
//    rollNumber: string;
//    name:       string;
//    standard:   string;
//  }
//
//  interface AddRowErrors {
//    id?:         string;
//    rollNumber?: string;
//    name?:       string;
//    standard?:   string;
//  }


// ── 4. Add tab trigger inside <TabsList> ──────────────────────────────────────
//
//  <TabsTrigger value="add" className="gap-1.5 text-sm">
//    <UserPlus className="w-3.5 h-3.5" /> Add Students
//  </TabsTrigger>


// ── 5. Add tab content inside <Tabs> (after the "rolls" TabsContent) ──────────
//
//  <TabsContent value="add" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
//    <BulkAddTab
//      activeYear={activeYear}
//      onStudentsCreated={() => {
//        queryClient.invalidateQueries({ queryKey: ["students-bulk-update"] });
//        queryClient.invalidateQueries({ queryKey: ["students"] });
//      }}
//    />
//  </TabsContent>


// ── 6. BulkAddTab component — add at the bottom of the file ──────────────────

import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Check, AlertCircle, CalendarDays,
  Download, Upload, FileSpreadsheet, UserPlus, X,
} from "lucide-react";

// (These would already be in scope inside the same file — shown here for clarity)
// import type { YearConfigEntry, ExcelStatus } from "..." 
// import { parseExcelFile, findCol, ID_KEYS, ROLL_KEYS, STD_KEYS, NAME_KEYS } from "..."
// import { ErrorBlock } from "..."

type AddPhase = "edit" | "preview" | "done";
interface AddRow       { _key: string; id: string; rollNumber: string; name: string; standard: string; }
interface AddRowErrors { id?: string; rollNumber?: string; name?: string; standard?: string; }

// Paste these constants in the module-level constants section:
const NAME_KEYS = ["name", "studentname", "fullname", "student"];

export function BulkStudentAddModal({
  activeYear,
  onStudentsCreated,
}: {
  activeYear: { currentYear: string } | null;
  onStudentsCreated: () => void;
}) {
  const [addPhase,    setAddPhase]    = useState<AddPhase>("edit");
  const [addRows,     setAddRows]     = useState<AddRow[]>([
    { _key: "init", id: "", rollNumber: "", name: "", standard: "" },
  ]);
  const [addRowErrors, setAddRowErrors] = useState<Record<string, AddRowErrors>>({});
  const [excelStatus,  setExcelStatus]  = useState<{ matched: number; error?: string } | null>(null);
  const [isParsing,    setIsParsing]    = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const excelRef = useRef<HTMLInputElement>(null);

  // ── Mutation ──────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async (payload: {
      dryRun: boolean;
      students: Array<{ id?: string; rollNumber: string; name: string; standard: string }>;
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
        } catch { /* keep default */ }
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRowChange = useCallback((key: string, field: keyof Omit<AddRow, "_key">, val: string) => {
    setAddRows((prev) => prev.map((r) => r._key !== key ? r : {
      ...r,
      [field]: (field === "id" || field === "rollNumber") ? val.replace(/\D/g, "") : val,
    }));
    setAddRowErrors((prev) => ({ ...prev, [key]: { ...prev[key], [field]: undefined } }));
  }, []);

  const handleAddRow = useCallback(() => {
    setAddRows((prev) => [
      ...prev,
      { _key: `r${Date.now()}`, id: "", rollNumber: "", name: "", standard: "" },
    ]);
  }, []);

  const handleDeleteRow = useCallback((key: string) => {
    setAddRows((prev) => {
      if (prev.length === 1) return [{ _key: `r${Date.now()}`, id: "", rollNumber: "", name: "", standard: "" }];
      return prev.filter((r) => r._key !== key);
    });
    setAddRowErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  const handleExcelUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    setExcelStatus(null);
    try {
      // parseExcelFile is already defined in the parent file
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const ws = workbook.worksheets[0];
      if (!ws) throw new Error("No worksheets found.");
      const headers: string[] = [];
      ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
        headers[col] = String(cell.value ?? "").trim();
      });
      const rawRows: Record<string, string>[] = [];
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const obj: Record<string, string> = {};
        let hasValue = false;
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          const header = headers[col];
          if (!header) return;
          let val: unknown = cell.value;
          if (val && typeof val === "object") {
            if ("text"   in val) val = (val as { text: string }).text;
            else if ("result" in val) val = (val as { result: unknown }).result;
            else val = "";
          }
          const str = val == null ? "" : String(val).trim();
          if (str) hasValue = true;
          obj[header] = str;
        });
        if (hasValue) rawRows.push(obj);
      });

      const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, "");
      const findCol = (row: Record<string, string>, keys: string[]) => {
        const norm = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeKey(k), v]));
        for (const key of keys) if (norm[key]) return norm[key];
        return undefined;
      };
      const ID_KEYS_   = ["id", "studentid", "accountid", "stuid"];
      const ROLL_KEYS_ = ["rollno", "rollnumber", "roll", "newroll", "newrollno"];
      const NAME_KEYS_ = ["name", "studentname", "fullname", "student"];
      const STD_KEYS_  = ["standard", "std", "class", "newstandard", "newstd"];

      const newRows: AddRow[] = rawRows
        .map((row, i) => ({
          _key:       `excel_${Date.now()}_${i}`,
          id:         findCol(row, ID_KEYS_)   ?? "",
          rollNumber: (findCol(row, ROLL_KEYS_) ?? "").replace(/\D/g, ""),
          name:       findCol(row, NAME_KEYS_)  ?? "",
          standard:   findCol(row, STD_KEYS_)   ?? "",
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
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("New Students");
    ws.columns = [
      { header: "ID",       key: "id",       width: 12 },
      { header: "Roll No",  key: "rollNo",   width: 14 },
      { header: "Name",     key: "name",     width: 28 },
      { header: "Standard", key: "standard", width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url; a.download = "new-students-template.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleSubmit = useCallback((dryRun: boolean) => {
    const errors: Record<string, AddRowErrors> = {};
    let hasErrors = false;

    // Per-row required fields
    addRows.forEach((r) => {
      const rowErrors: AddRowErrors = {};
      if (!r.rollNumber.trim()) { rowErrors.rollNumber = "Required"; hasErrors = true; }
      if (!r.name.trim())       { rowErrors.name       = "Required"; hasErrors = true; }
      if (!r.standard.trim())   { rowErrors.standard   = "Required"; hasErrors = true; }
      if (Object.keys(rowErrors).length) errors[r._key] = rowErrors;
    });

    // Duplicate roll numbers
    const rolls    = addRows.map((r) => r.rollNumber.trim()).filter(Boolean);
    const dupRolls = rolls.filter((r, i) => rolls.indexOf(r) !== i);
    addRows.forEach((r) => {
      if (dupRolls.includes(r.rollNumber.trim())) {
        errors[r._key] = { ...errors[r._key], rollNumber: "Duplicate in batch" };
        hasErrors = true;
      }
    });

    // Duplicate IDs
    const ids    = addRows.map((r) => r.id.trim()).filter(Boolean);
    const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    addRows.forEach((r) => {
      if (r.id.trim() && dupIds.includes(r.id.trim())) {
        errors[r._key] = { ...errors[r._key], id: "Duplicate in batch" };
        hasErrors = true;
      }
    });

    if (hasErrors) { setAddRowErrors(errors); return; }

    addMutation.mutate({
      dryRun,
      students: addRows.map((r) => ({
        rollNumber: r.rollNumber.trim(),
        name:       r.name.trim(),
        standard:   r.standard.trim(),
        ...(r.id.trim() ? { id: r.id.trim() } : {}),
      })),
    });
  }, [addRows, addMutation]);

  const readyCount = addRows.filter(
    (r) => r.rollNumber.trim() && r.name.trim() && r.standard.trim()
  ).length;
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
            <colgroup><col className="w-[5%]" /><col className="w-[12%]" /><col className="w-[15%]" /><col className="w-[38%]" /><col className="w-[30%]" /></colgroup>
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
                  <td className="px-3 py-2 font-mono text-sm text-gray-600">
                    {r.id || <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-sm font-semibold text-gray-700">{r.rollNumber}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{r.standard}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center flex-shrink-0">
          <Button variant="outline" size="sm"
            onClick={() => { setAddPhase("edit"); addMutation.reset(); }}
            disabled={isPending}>
            ← Back &amp; Edit
          </Button>
          <Button size="sm" onClick={() => handleSubmit(false)} disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
            {isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
              : <><Check className="w-4 h-4" /> Confirm &amp; Create Students</>
            }
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
        <Button variant="outline" size="sm" onClick={() => {
          setAddPhase("edit");
          setAddRows([{ _key: `r${Date.now()}`, id: "", rollNumber: "", name: "", standard: "" }]);
          setAddRowErrors({});
          setExcelStatus(null);
          addMutation.reset();
        }}>
          Add More Students
        </Button>
      </div>
    );
  }

  // ── Edit phase ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {activeYear ? (
              <div className="flex items-center gap-2">
                <Badge className="text-xs gap-1 bg-indigo-500 text-white">
                  <CalendarDays className="w-3 h-3" />{activeYear.currentYear}
                </Badge>
                <span className="text-xs text-gray-400">students will be added to this year</span>
              </div>
            ) : (
              <p className="text-xs text-amber-600 font-medium">No active year — create one in Year Config tab first.</p>
            )}
            <p className="text-xs text-gray-500">
              Fill rows below, or upload Excel with{" "}
              <code className="bg-gray-100 px-1 rounded">ID</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">Roll No</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">Name</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">Standard</code>.{" "}
              ID is optional. Year is set automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadTemplate}>
              <Download className="w-3.5 h-3.5" /> Template
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs"
              onClick={() => excelRef.current?.click()}
              disabled={isParsing || !activeYear}>
              {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {isParsing ? "Parsing…" : "Upload Excel"}
            </Button>
            <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
            <Button size="sm" className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleAddRow} disabled={!activeYear}>
              <UserPlus className="w-3.5 h-3.5" /> Add Row
            </Button>
          </div>
        </div>

        {/* Excel feedback */}
        {excelStatus && (
          excelStatus.error
            ? <p className="text-xs text-red-500 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{excelStatus.error}</p>
            : <Badge className="gap-1 text-xs bg-emerald-500 text-white"><FileSpreadsheet className="w-3 h-3" />{excelStatus.matched} rows imported</Badge>
        )}

        {/* API error */}
        {addMutation.isError && (
          <div className="rounded-md border border-red-200 bg-red-50">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm font-medium text-red-700">
                {addMutation.error instanceof Error ? addMutation.error.message : "Something went wrong"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup><col className="w-[4%]" /><col className="w-[10%]" /><col className="w-[12%]" /><col className="w-[34%]" /><col className="w-[16%]" /><col className="w-[20%]" /><col className="w-[4%]" /></colgroup>
          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-400">#</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID <span className="font-normal normal-case text-gray-400">(opt)</span></th>
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

                  {/* ID */}
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

                  {/* Roll No */}
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

                  {/* Name */}
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

                  {/* Standard */}
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

                  {/* Year (read-only) */}
                  <td className="px-3 py-2">
                    <span className="text-xs text-gray-400 font-mono">
                      {activeYear?.currentYear ?? <span className="italic text-gray-300">no year</span>}
                    </span>
                  </td>

                  {/* Delete */}
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => handleDeleteRow(row._key)} disabled={isPending}
                      className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40">
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
        <span className="text-xs text-gray-400">
          {readyCount} / {addRows.length} row{addRows.length !== 1 ? "s" : ""} ready
          {addRows.length !== readyCount && (
            <span className="ml-1 text-amber-500">— fill all required fields</span>
          )}
        </span>
        <Button size="sm" onClick={() => handleSubmit(true)}
          disabled={isPending || !activeYear || readyCount === 0}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
          {isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Previewing…</>
            : <><UserPlus className="w-4 h-4" /> Preview &amp; Add</>
          }
        </Button>
      </div>
    </div>
  );
}