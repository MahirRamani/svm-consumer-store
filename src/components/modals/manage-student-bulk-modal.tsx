"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hash, GraduationCap, UserPlus, CalendarDays } from "lucide-react";

import { AssignIdsTab } from "@/components/elements/student/AssignIdsTab";
import { AssignRollsTab } from "@/components/elements/student/AssignRollsTab";
import { BulkAddTab } from "@/components/elements/student/BulkAddTab";
import { YearConfigTab } from "@/components/elements/student/YearConfigTab";
import type { StudentRow, YearConfigResponse } from "@/types/manage-student/manage-student-bulk";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BulkStudentUpdateModal({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const { data: students, isLoading: studentsLoading } = useQuery<StudentRow[]>({
    queryKey: ["students-bulk-update"],
    queryFn: async () => {
      const res = await fetch("/api/students/bulk-id");
      if (!res.ok) throw new Error("Failed to fetch students");
      // id / rollNumber / standard come back as numbers — StudentRow's type
      // reflects that directly, no coercion needed here.
      return (await res.json()).data as StudentRow[];
    },
    enabled: open,
  });

  const { data: yearData, isLoading: yearLoading } = useQuery<YearConfigResponse>({
    queryKey: ["year-config"],
    queryFn: async () => {
      const res = await fetch("/api/year-config");
      if (!res.ok) throw new Error("Failed to fetch year config");
      return (await res.json()).data;
    },
    enabled: open,
  });

  const activeYear = yearData?.activeYear ?? null;
  const yearHistory = yearData?.history ?? [];

  const invalidateStudents = () => {
    queryClient.invalidateQueries({ queryKey: ["students-bulk-update"] });
    queryClient.invalidateQueries({ queryKey: ["students"] });
  };

  const invalidateYearConfig = () => {
    queryClient.invalidateQueries({ queryKey: ["year-config"] });
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-xl md:max-w-4xl lg:max-w-5xl h-[90vh] flex flex-col gap-0 p-0">
        <DialogDescription className="sr-only">
          Manage student IDs, roll numbers, new students, and academic year.
        </DialogDescription>

        {/*
          Keying on `open` remounts the whole Tabs subtree (and therefore every
          tab's local state) each time the modal is closed and reopened —
          equivalent to the old single "reset everything on close" effect,
          without each tab needing its own reset logic.
        */}
        <Tabs key={open ? "open" : "closed"} defaultValue="bulk-add" className="flex flex-col flex-1 min-h-0 gap-0">
          <div className="px-3 pt-2 pb-0 border-b border-gray-100 flex-shrink-0">
            <DialogTitle className="text-lg font-semibold mb-3">Student Management</DialogTitle>
            <TabsList>
              <TabsTrigger value="bulk-add" className="gap-1.5 text-sm">
                <UserPlus className="w-3.5 h-3.5" /> Add Students
              </TabsTrigger>
              <TabsTrigger value="assign-ids" className="gap-1.5 text-sm">
                <Hash className="w-3.5 h-3.5" /> Assign IDs
              </TabsTrigger>
              <TabsTrigger value="assign-rolls" className="gap-1.5 text-sm">
                <GraduationCap className="w-3.5 h-3.5" /> Assign Rolls
              </TabsTrigger>
              <TabsTrigger value="year-config" className="gap-1.5 text-sm">
                <CalendarDays className="w-3.5 h-3.5" /> Year Config
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="assign-ids" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <AssignIdsTab
              students={students}
              studentsLoading={studentsLoading}
              onMutated={invalidateStudents}
              onClose={handleClose}
            />
          </TabsContent>

          <TabsContent value="assign-rolls" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <AssignRollsTab
              students={students}
              studentsLoading={studentsLoading}
              activeYear={activeYear}
              yearLoading={yearLoading}
              onMutated={invalidateStudents}
              onClose={handleClose}
            />
          </TabsContent>

          <TabsContent value="bulk-add" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
            <BulkAddTab activeYear={activeYear} onStudentsCreated={invalidateStudents} />
          </TabsContent>

          <TabsContent
            value="year-config"
            className="flex-1 flex flex-col min-h-0 mt-0 overflow-y-auto data-[state=inactive]:hidden"
          >
            <YearConfigTab activeYear={activeYear} yearHistory={yearHistory} onMutated={invalidateYearConfig} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// "use client";

// import { useState, useCallback, useEffect, useMemo, useRef } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import {
//   Dialog, DialogContent, DialogTitle, DialogDescription,
// } from "@/components/ui/dialog";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Badge } from "@/components/ui/badge";
// import { Label } from "@/components/ui/label";
// import {
//   Loader2, Check, AlertCircle, Hash, Users, Pencil, X,
//   CalendarDays, GraduationCap, Download, Upload, FileSpreadsheet, Lock,
//   ChevronDown, Search, ArrowLeftRight,
// } from "lucide-react";

// // ─── Types ────────────────────────────────────────────────────────────────────

// type RollsPhase = "edit" | "preview" | "done";

// interface StudentRow {
//   _id: string;
//   rollNumber: string;
//   name: string;
//   standard: string;
//   year: string;
//   id?: string | null;
// }

// interface YearConfigEntry {
//   _id: string;
//   currentYear: string;
//   yearStartDate: string;
//   yearEndDate: string;
//   isActive: boolean;
// }

// interface YearConfigResponse {
//   activeYear: YearConfigEntry | null;
//   history: YearConfigEntry[];
// }

// type IdRowStatus = "idle" | "editing" | "saving" | "saved" | "error";
// interface IdRowState {
//   value: string;
//   status: IdRowStatus;
//   error?: string;
//   originalId?: string;
// }

// interface YearRow {
//   newRollNumber: string;
//   newStandard: string;
// }
// interface YearRowErrors {
//   newRollNumber?: string;
//   newStandard?: string;
// }

// interface YearConfigForm {
//   currentYear: string;
//   yearStartDate: string;
//   yearEndDate: string;
// }
// type YearConfigErrors = Partial<YearConfigForm>;

// interface ExcelStatus {
//   matched: number;
//   unmatched: number;
//   unmatchedIds: string[];
//   error?: string;
// }

// interface AssignReport {
//   rollChanged: { name: string; from: string; to: string }[];
//   stdChanged:  { name: string; rollNumber: string; from: string; to: string }[];
//   yearMoved:   { name: string; rollNumber: string; fromYear: string }[];
//   activated:   { name: string; rollNumber: string }[];
//   unchanged:   { name: string; rollNumber: string }[];
// }

// // ─── Excel helpers ────────────────────────────────────────────────────────────

// const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, "");

// const ID_KEYS   = ["id", "studentid", "accountid", "stuid"];
// const ROLL_KEYS = ["rollno", "rollnumber", "roll", "newroll", "newrollno", "newrollnumber"];
// const STD_KEYS  = ["standard", "std", "class", "newstandard", "newstd", "newclass"];

// const findCol = (row: Record<string, string>, keys: string[]): string | undefined => {
//   const norm = Object.fromEntries(
//     Object.entries(row).map(([k, v]) => [normalizeKey(k), String(v).trim()])
//   );
//   for (const key of keys) if (norm[key]) return norm[key];
//   return undefined;
// };

// const parseExcelFile = async (file: File): Promise<Record<string, string>[]> => {
//   const { default: ExcelJS } = await import("exceljs");
//   const workbook = new ExcelJS.Workbook();
//   try {
//     await workbook.xlsx.load(await file.arrayBuffer());
//   } catch {
//     throw new Error("Failed to parse file. Ensure it is a valid .xlsx file.");
//   }
//   const ws = workbook.worksheets[0];
//   if (!ws) throw new Error("No worksheets found in the file.");
//   const headers: string[] = [];
//   ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
//     headers[col] = String(cell.value ?? "").trim();
//   });
//   const rows: Record<string, string>[] = [];
//   ws.eachRow((row, rowNum) => {
//     if (rowNum === 1) return;
//     const obj: Record<string, string> = {};
//     let hasValue = false;
//     row.eachCell({ includeEmpty: true }, (cell, col) => {
//       const header = headers[col];
//       if (!header) return;
//       let val: unknown = cell.value;
//       if (val && typeof val === "object") {
//         if ("text"   in val) val = (val as { text: string }).text;
//         else if ("result" in val) val = (val as { result: unknown }).result;
//         else if (val instanceof Date) val = val.toISOString();
//         else val = "";
//       }
//       const str = val == null ? "" : String(val).trim();
//       if (str) hasValue = true;
//       obj[header] = str;
//     });
//     if (hasValue) rows.push(obj);
//   });
//   return rows;
// };

// // ─── Component ────────────────────────────────────────────────────────────────

// interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

// export default function BulkStudentUpdateModal({ open, onOpenChange }: Props) {
//   const queryClient = useQueryClient();

//   // ── Data fetches ───────────────────────────────────────────────────────────
//   const { data: students, isLoading: studentsLoading } = useQuery<StudentRow[]>({
//     queryKey: ["students-bulk-update"],
//     queryFn: async () => {
//       const res = await fetch("/api/students/bulk-id");
//       if (!res.ok) throw new Error("Failed to fetch students");
//       return (await res.json()).data;
//     },
//     enabled: open,
//   });

//   const { data: yearData, isLoading: yearLoading } = useQuery<YearConfigResponse>({
//     queryKey: ["year-config"],
//     queryFn: async () => {
//       const res = await fetch("/api/year-config");
//       if (!res.ok) throw new Error("Failed to fetch year config");
//       return (await res.json()).data;
//     },
//     enabled: open,
//   });

//   const activeYear   = yearData?.activeYear ?? null;
//   const yearHistory  = yearData?.history    ?? [];

//   // ─── ID Tab state ──────────────────────────────────────────────────────────
//   const [idRows, setIdRows] = useState<Record<string, IdRowState>>({});

//   useEffect(() => {
//     if (!students) return;
//     setIdRows((prev) => {
//       const next = { ...prev };
//       students.forEach((s) => {
//         if (!next[s._id])
//           next[s._id] = { value: s.id ?? "", status: s.id ? "saved" : "idle", originalId: s.id ?? "" };
//       });
//       return next;
//     });
//   }, [students]);

//   // ─── Rolls Tab state ───────────────────────────────────────────────────────
//   const [yearRows,      setYearRows]      = useState<Record<string, YearRow>>({});
//   const [yearRowErrors, setYearRowErrors] = useState<Record<string, YearRowErrors>>({});
//   const [excelStatus,   setExcelStatus]   = useState<ExcelStatus | null>(null);
//   const [isParsing,     setIsParsing]     = useState(false);
//   const [rollsPhase,    setRollsPhase]    = useState<RollsPhase>("edit");
//   const [previewReport, setPreviewReport] = useState<AssignReport | null>(null);
//   const [assignReport,  setAssignReport]  = useState<AssignReport | null>(null);
//   const [rollSearch,    setRollSearch]    = useState("");
//   const [swapMode,      setSwapMode]      = useState(false);
//   const [swapSelection, setSwapSelection] = useState<string[]>([]);
//   const excelRef = useRef<HTMLInputElement>(null);

//   useEffect(() => {
//     if (!students) return;
//     setYearRows((prev) => {
//       const next = { ...prev };
//       students.forEach((s) => {
//         if (!next[s._id]) next[s._id] = { newRollNumber: "", newStandard: s.standard };
//       });
//       return next;
//     });
//   }, [students]);

//   // ─── Year Config Tab state ─────────────────────────────────────────────────
//   const [yearForm,       setYearForm]       = useState<YearConfigForm>({ currentYear: "", yearStartDate: "", yearEndDate: "" });
//   const [yearFormErrors, setYearFormErrors] = useState<YearConfigErrors>({});
//   const [yearSaved,      setYearSaved]      = useState(false);
//   const [endConfirm,     setEndConfirm]     = useState(false);

//   // ─── Reset on close ────────────────────────────────────────────────────────
//   useEffect(() => {
//     if (!open) {
//       setIdRows({});
//       setYearRows({}); setYearRowErrors({});
//       setExcelStatus(null); setIsParsing(false);
//       setRollsPhase("edit"); setPreviewReport(null); setAssignReport(null);
//       setRollSearch(""); setSwapMode(false); setSwapSelection([]);
//       setYearForm({ currentYear: "", yearStartDate: "", yearEndDate: "" });
//       setYearFormErrors({}); setYearSaved(false); setEndConfirm(false);
//     }
//   }, [open]);

//   // ─── Mutations ─────────────────────────────────────────────────────────────

//   const saveIdMutation = useMutation({
//     mutationFn: async ({ studentMongoId, id }: { studentMongoId: string; id: string }) => {
//       const res = await fetch("/api/students/bulk-id", {
//         method: "POST", headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ assignments: [{ studentMongoId, id }] }),
//       });
//       if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Failed to save");
//       return res.json();
//     },
//     onSuccess: (_, { studentMongoId, id }) => {
//       setIdRows((p) => ({ ...p, [studentMongoId]: { value: id, status: "saved", originalId: id } }));
//       queryClient.invalidateQueries({ queryKey: ["students-bulk-update"] });
//       queryClient.invalidateQueries({ queryKey: ["students"] });
//     },
//     onError: (err: Error, { studentMongoId }) => {
//       setIdRows((p) => ({ ...p, [studentMongoId]: { ...p[studentMongoId], status: "error", error: err.message } }));
//     },
//   });

//   const assignRollsMutation = useMutation({
//     mutationFn: async (payload: {
//       dryRun: boolean;
//       students: Array<{ studentMongoId: string; rollNumber?: string; standard?: string }>;
//     }) => {
//       const res = await fetch("/api/students/assign-rolls", {
//         method: "POST", headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });
//       if (!res.ok) {
//         let message = "Failed to assign rolls";
//         try {
//           const errData = await res.json();
//           message = errData.message ?? errData.error?.message ?? message;
//         } catch { /* keep default */ }
//         throw new Error(message);
//       }
//       return res.json() as Promise<{
//         data: { updated?: number; year: string; report: AssignReport };
//       }>;
//     },
//     onSuccess: (res, variables) => {
//       const report = res.data?.report ?? null;
//       if (variables.dryRun) {
//         setPreviewReport(report);
//         setRollsPhase("preview");
//       } else {
//         setAssignReport(report);
//         setRollsPhase("done");
//         queryClient.invalidateQueries({ queryKey: ["students-bulk-update"] });
//         queryClient.invalidateQueries({ queryKey: ["students"] });
//       }
//     },
//   });

//   const yearConfigMutation = useMutation({
//     mutationFn: async (payload: YearConfigForm) => {
//       const res = await fetch("/api/year-config", {
//         method: "POST", headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           currentYear:   payload.currentYear,
//           yearStartDate: new Date(payload.yearStartDate).toISOString(),
//           yearEndDate:   new Date(payload.yearEndDate).toISOString(),
//         }),
//       });
//       if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Failed to save year");
//       return res.json();
//     },
//     onSuccess: () => {
//       setYearSaved(true);
//       queryClient.invalidateQueries({ queryKey: ["year-config"] });
//     },
//   });

//   const endYearMutation = useMutation({
//     mutationFn: async () => {
//       const res = await fetch("/api/year-config/end", { method: "POST" });
//       if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Failed to end year");
//       return res.json();
//     },
//     onSuccess: () => {
//       setEndConfirm(false);
//       queryClient.invalidateQueries({ queryKey: ["year-config"] });
//     },
//   });

//   // ─── ID Tab handlers ───────────────────────────────────────────────────────
//   const handleIdEdit = useCallback((id: string) =>
//     setIdRows((p) => ({ ...p, [id]: { ...p[id], status: "editing", error: undefined } })), []);

//   const handleIdCancel = useCallback((id: string) =>
//     setIdRows((p) => ({ ...p, [id]: { ...p[id], value: p[id].originalId ?? "", status: p[id].originalId ? "saved" : "idle", error: undefined } })), []);

//   const handleIdChange = useCallback((id: string, val: string) =>
//     setIdRows((p) => ({ ...p, [id]: { ...p[id], value: val.replace(/\D/g, ""), error: undefined } })), []);

//   const handleIdSave = useCallback((mongoId: string) => {
//     const row = idRows[mongoId];
//     if (!row?.value.trim() || row.status === "saving") return;
//     if (row.value.trim() === row.originalId) {
//       setIdRows((p) => ({ ...p, [mongoId]: { ...p[mongoId], status: "saved", error: undefined } }));
//       return;
//     }
//     setIdRows((p) => ({ ...p, [mongoId]: { ...p[mongoId], status: "saving" } }));
//     saveIdMutation.mutate({ studentMongoId: mongoId, id: row.value.trim() });
//   }, [idRows, saveIdMutation]);

//   const handleIdKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
//     if (e.key === "Enter")  handleIdSave(id);
//     if (e.key === "Escape") handleIdCancel(id);
//   }, [handleIdSave, handleIdCancel]);

//   // ─── Rolls Tab handlers ────────────────────────────────────────────────────
//   const handleRollChange = useCallback((mongoId: string, field: keyof YearRow, val: string) => {
//     setYearRows((p) => ({
//       ...p,
//       [mongoId]: { ...p[mongoId], [field]: field === "newRollNumber" ? val.replace(/\D/g, "") : val },
//     }));
//     setYearRowErrors((p) => ({ ...p, [mongoId]: { ...p[mongoId], [field]: undefined } }));
//   }, []);

//   const handleSwapSelect = useCallback((mongoId: string) => {
//     setSwapSelection((prev) => {
//       if (prev.includes(mongoId)) return prev.filter((id) => id !== mongoId);
//       if (prev.length >= 2) return prev;
//       const next = [...prev, mongoId];
//       if (next.length === 2) {
//         const [idA, idB] = next;
//         const studentA   = students!.find((s) => s._id === idA)!;
//         const studentB   = students!.find((s) => s._id === idB)!;
//         const rollA = yearRows[idA]?.newRollNumber?.trim() || studentA.rollNumber;
//         const rollB = yearRows[idB]?.newRollNumber?.trim() || studentB.rollNumber;
//         setYearRows((p) => ({
//           ...p,
//           [idA]: { ...p[idA], newRollNumber: rollB },
//           [idB]: { ...p[idB], newRollNumber: rollA },
//         }));
//         setYearRowErrors((p) => ({
//           ...p,
//           [idA]: { ...p[idA], newRollNumber: undefined },
//           [idB]: { ...p[idB], newRollNumber: undefined },
//         }));
//         setSwapMode(false);
//         return [];
//       }
//       return next;
//     });
//   }, [students, yearRows]);

//   const studentIdToMongoId = useMemo(() => {
//     const map = new Map<string, string>();
//     students?.forEach((s) => { if (s.id) map.set(String(s.id).trim(), s._id); });
//     return map;
//   }, [students]);

//   const handleExcelUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     setIsParsing(true);
//     setExcelStatus(null);
//     try {
//       const rows = await parseExcelFile(file);
//       let matched = 0;
//       const unmatchedIds: string[] = [];
//       setYearRows((prev) => {
//         const next = { ...prev };
//         rows.forEach((row) => {
//           const studentId  = findCol(row, ID_KEYS);
//           const rollNumber = findCol(row, ROLL_KEYS);
//           const standard   = findCol(row, STD_KEYS);
//           if (!studentId) return;
//           const mongoId = studentIdToMongoId.get(studentId);
//           if (!mongoId) { unmatchedIds.push(studentId); return; }
//           matched++;
//           next[mongoId] = {
//             ...next[mongoId],
//             ...(rollNumber ? { newRollNumber: rollNumber.replace(/\D/g, "") } : {}),
//             ...(standard   ? { newStandard: standard } : {}),
//           };
//         });
//         return next;
//       });
//       setExcelStatus({ matched, unmatched: unmatchedIds.length, unmatchedIds });
//     } catch (err: unknown) {
//       setExcelStatus({ matched: 0, unmatched: 0, unmatchedIds: [], error: err instanceof Error ? err.message : "Unknown error" });
//     } finally {
//       setIsParsing(false);
//       if (excelRef.current) excelRef.current.value = "";
//     }
//   }, [studentIdToMongoId]);

//   const downloadTemplate = useCallback(async () => {
//     const { default: ExcelJS } = await import("exceljs");
//     const wb = new ExcelJS.Workbook();
//     const ws = wb.addWorksheet("Students");
//     ws.columns = [
//       { header: "ID",       key: "id",       width: 12 },
//       { header: "Roll No",  key: "rollNo",   width: 14 },
//       { header: "Standard", key: "standard", width: 14 },
//     ];
//     students?.forEach((s) => ws.addRow({ id: s.id ?? "", rollNo: "", standard: s.standard }));
//     ws.getRow(1).font = { bold: true };
//     const buffer = await wb.xlsx.writeBuffer();
//     const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
//     const a = document.createElement("a");
//     a.href = url; a.download = "roll-number-template.xlsx"; a.click();
//     URL.revokeObjectURL(url);
//   }, [students]);

//   const handleAssignRolls = useCallback((dryRun: boolean) => {
//     if (!students) return;
//     const errors: Record<string, YearRowErrors> = {};

//     const filledRolls = students
//       .map((s) => yearRows[s._id]?.newRollNumber?.trim())
//       .filter(Boolean) as string[];
//     const dups = filledRolls.filter((r, i) => filledRolls.indexOf(r) !== i);

//     if (dups.length > 0) {
//       students.forEach((s) => {
//         if (dups.includes(yearRows[s._id]?.newRollNumber?.trim())) {
//           errors[s._id] = { ...errors[s._id], newRollNumber: "Duplicate in batch" };
//         }
//       });
//       setYearRowErrors(errors);
//       return;
//     }

//     assignRollsMutation.mutate({
//       dryRun,
//       students: students.map((s) => {
//         const row = yearRows[s._id];
//         return {
//           studentMongoId: s._id,
//           ...(row?.newRollNumber?.trim() ? { rollNumber: row.newRollNumber.trim() } : {}),
//           ...(row?.newStandard?.trim()   ? { standard:   row.newStandard.trim()   } : {}),
//         };
//       }),
//     });
//   }, [students, yearRows, assignRollsMutation]);

//   const handleYearFormChange = useCallback((field: keyof YearConfigForm, val: string) => {
//     setYearForm((p) => ({ ...p, [field]: val }));
//     setYearFormErrors((p) => ({ ...p, [field]: undefined }));
//     setYearSaved(false);
//   }, []);

//   const handleSaveYear = useCallback(() => {
//     const errors: YearConfigErrors = {};
//     if (!yearForm.currentYear.trim()) errors.currentYear   = "Required";
//     if (!yearForm.yearStartDate)      errors.yearStartDate = "Required";
//     if (!yearForm.yearEndDate)        errors.yearEndDate   = "Required";
//     if (Object.keys(errors).length)  { setYearFormErrors(errors); return; }
//     yearConfigMutation.mutate(yearForm);
//   }, [yearForm, yearConfigMutation]);

//   // ─── Derived counts ────────────────────────────────────────────────────────
//   const totalCount      = students?.length ?? 0;
//   const idAssignedCount = useMemo(
//     () => Object.values(idRows).filter((r) => r.status === "saved" && r.value).length,
//     [idRows]
//   );
//   const rollFilledCount = useMemo(
//     () => Object.values(yearRows).filter((r) => r.newRollNumber?.trim()).length,
//     [yearRows]
//   );
//   const filteredStudents = useMemo(() => {
//     if (!students) return [];
//     const q = rollSearch.trim().toLowerCase();
//     if (!q) return students;
//     return students.filter((s) =>
//       s.name.toLowerCase().includes(q)       ||
//       s.rollNumber.toLowerCase().includes(q) ||
//       s.standard.toLowerCase().includes(q)
//     );
//   }, [students, rollSearch]);

//   // ─── Render ────────────────────────────────────────────────────────────────
//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="w-full sm:max-w-xl md:max-w-4xl lg:max-w-5xl h-[90vh] flex flex-col gap-0 p-0">
//         <DialogDescription className="sr-only">Manage student IDs, roll numbers, and academic year.</DialogDescription>

//         <Tabs defaultValue="assign-ids" className="flex flex-col flex-1 min-h-0 gap-0">

//           {/* Tab Bar */}
//           <div className="px-3 pt-2 pb-0 border-b border-gray-100 flex-shrink-0">
//             <DialogTitle className="text-lg font-semibold mb-3">Student Management</DialogTitle>
//             <TabsList>
//               <TabsTrigger value="assign-ids"        className="gap-1.5 text-sm"><Hash className="w-3.5 h-3.5" /> Assign IDs</TabsTrigger>
//               <TabsTrigger value="rolls"      className="gap-1.5 text-sm"><GraduationCap className="w-3.5 h-3.5" /> Assign Rolls</TabsTrigger>
//               <TabsTrigger value="year-config" className="gap-1.5 text-sm"><CalendarDays className="w-3.5 h-3.5" /> Year Config</TabsTrigger>
//             </TabsList>
//           </div>

//           {/* ══ Tab 1: Assign IDs ══════════════════════════════════════════════ */}
//           <TabsContent value="assign-ids" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
//             <div className="px-3 py-3 border-b border-gray-50 flex-shrink-0">
//               <p className="text-sm text-gray-500">
//                 Enter a numeric ID for each student. Press{" "}
//                 <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Enter</kbd> or click away to save.
//               </p>
//               {!studentsLoading && totalCount > 0 && (
//                 <div className="flex items-center gap-2 mt-2">
//                   <Badge variant="outline" className="gap-1 text-xs"><Users className="w-3 h-3" /> {totalCount} total</Badge>
//                   <Badge className="gap-1 text-xs bg-emerald-500 text-white"><Check className="w-3 h-3" /> {idAssignedCount} assigned</Badge>
//                   {totalCount - idAssignedCount > 0 && (
//                     <Badge variant="secondary" className="text-xs">{totalCount - idAssignedCount} pending</Badge>
//                   )}
//                 </div>
//               )}
//             </div>

//             <div className="flex-1 overflow-y-auto">
//               {studentsLoading
//                 ? <EmptyState icon={<Loader2 className="w-5 h-5 animate-spin" />} text="Loading…" />
//                 : !students?.length
//                   ? <EmptyState icon={<Check className="w-10 h-10 text-emerald-400" />} text="No students found." />
//                   : (
//                     <table className="w-full text-sm table-fixed">
//                       <colgroup><col className="w-[14%]" /><col className="w-[36%]" /><col className="w-[12%]" /><col className="w-[30%]" /><col className="w-[8%]" /></colgroup>
//                       <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
//                         <tr>
//                           {["Roll No", "Name", "Std", "Student ID", ""].map((h) => (
//                             <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
//                           ))}
//                         </tr>
//                       </thead>
//                       <tbody className="bg-white divide-y divide-gray-100">
//                         {students.map((student) => {
//                           const row      = idRows[student._id] ?? { value: "", status: "idle" as IdRowStatus };
//                           const isSaved  = row.status === "saved";
//                           const isSaving = row.status === "saving";
//                           const isError  = row.status === "error";
//                           return (
//                             <tr key={student._id} className={`transition-colors ${isSaved ? "bg-emerald-50/40" : isError ? "bg-red-50/40" : "hover:bg-gray-50/60"}`}>
//                               <td className="px-4 py-2.5 font-mono text-sm font-semibold text-gray-600 truncate">{student.rollNumber}</td>
//                               <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-normal break-words">{student.name}</td>
//                               <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{student.standard}</Badge></td>
//                               <td className="px-4 py-2.5">
//                                 {isSaved ? (
//                                   <div className="flex items-center gap-2">
//                                     <span className="font-mono text-sm font-bold text-gray-800">{row.value}</span>
//                                     <button onClick={() => handleIdEdit(student._id)} className="text-gray-300 hover:text-indigo-500 transition-colors">
//                                       <Pencil className="w-3.5 h-3.5" />
//                                     </button>
//                                   </div>
//                                 ) : (
//                                   <div className="space-y-1">
//                                     <div className="flex items-center gap-1.5">
//                                       <Input
//                                         autoFocus={row.status === "editing"}
//                                         value={row.value ?? ""}
//                                         onChange={(e) => handleIdChange(student._id, e.target.value)}
//                                         onBlur={() => handleIdSave(student._id)}
//                                         onKeyDown={(e) => handleIdKeyDown(e, student._id)}
//                                         placeholder="Numeric ID" inputMode="numeric" disabled={isSaving}
//                                         className={`w-32 h-8 text-sm font-mono ${isError ? "border-red-400 focus-visible:ring-red-300" : ""}`}
//                                       />
//                                       {row.originalId && (
//                                         <button onClick={() => handleIdCancel(student._id)} className="text-gray-300 hover:text-gray-500">
//                                           <X className="w-4 h-4" />
//                                         </button>
//                                       )}
//                                     </div>
//                                     {isError && (
//                                       <p className="text-xs text-red-500 flex items-center gap-1">
//                                         <AlertCircle className="w-3 h-3" />{row.error}
//                                       </p>
//                                     )}
//                                   </div>
//                                 )}
//                               </td>
//                               <td className="px-4 py-2.5 text-center">
//                                 {isSaving && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 mx-auto" />}
//                                 {isSaved  && <Check className="w-4 h-4 text-emerald-500 mx-auto" />}
//                                 {isError  && <AlertCircle className="w-4 h-4 text-red-400 mx-auto" />}
//                               </td>
//                             </tr>
//                           );
//                         })}
//                       </tbody>
//                     </table>
//                   )
//               }
//             </div>

//             <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
//               <p className="text-xs text-gray-400">Numbers only · <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono text-xs">Esc</kbd> to cancel</p>
//               <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
//             </div>
//           </TabsContent>

//           {/* ══ Tab 2: Assign Rolls ════════════════════════════════════════════ */}
//           <TabsContent value="rolls" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">

//             {/* Header toolbar */}
//             <div className="px-3 py-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0 space-y-2">

//               {/* Row 1 — year badge + upload buttons */}
//               <div className="flex items-start justify-between gap-4">
//                 <div className="space-y-1">
//                   {yearLoading
//                     ? <p className="text-xs text-gray-400">Loading year…</p>
//                     : activeYear
//                       ? (
//                         <div className="flex items-center gap-2">
//                           <Badge className="text-xs gap-1 bg-indigo-500 text-white"><CalendarDays className="w-3 h-3" />{activeYear.currentYear}</Badge>
//                           <span className="text-xs text-gray-400">active year</span>
//                         </div>
//                       ) : (
//                         <p className="text-xs text-amber-600 font-medium">No active year — create one in Year Config tab first.</p>
//                       )
//                   }
//                   <p className="text-xs text-gray-500">
//                     Upload Excel with <code className="bg-gray-100 px-1 rounded">ID</code>,{" "}
//                     <code className="bg-gray-100 px-1 rounded">Roll No</code>, optionally{" "}
//                     <code className="bg-gray-100 px-1 rounded">Standard</code>. Blank roll = keeps current.
//                   </p>
//                 </div>
//                 <div className="flex items-center gap-2 flex-shrink-0">
//                   <Button variant="outline" size="sm" className="gap-1.5 text-xs"
//                     onClick={downloadTemplate} disabled={!students?.length}>
//                     <Download className="w-3.5 h-3.5" /> Template
//                   </Button>
//                   <Button variant="outline" size="sm" className="gap-1.5 text-xs"
//                     onClick={() => excelRef.current?.click()}
//                     disabled={isParsing || !students?.length || !activeYear}>
//                     {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
//                     {isParsing ? "Parsing…" : "Upload Excel"}
//                   </Button>
//                   <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
//                 </div>
//               </div>

//               {/* Row 2 — search + swap (edit phase only) */}
//               {rollsPhase === "edit" && !!students?.length && (
//                 <div className="flex items-center gap-2">
//                   <div className="relative flex-1 max-w-xs">
//                     <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
//                     <Input
//                       value={rollSearch}
//                       onChange={(e) => setRollSearch(e.target.value)}
//                       placeholder="Search by name, roll or class…"
//                       className="h-8 pl-8 text-xs"
//                     />
//                     {rollSearch && (
//                       <button onClick={() => setRollSearch("")}
//                         className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
//                         <X className="w-3.5 h-3.5" />
//                       </button>
//                     )}
//                   </div>

//                   {!swapMode ? (
//                     <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-shrink-0"
//                       onClick={() => { setSwapMode(true); setSwapSelection([]); }}
//                       disabled={!activeYear}>
//                       <ArrowLeftRight className="w-3.5 h-3.5" /> Swap Rolls
//                     </Button>
//                   ) : (
//                     <div className="flex items-center gap-2 flex-shrink-0">
//                       <span className={`text-xs font-medium px-2 py-1 rounded-full ${
//                         swapSelection.length === 0 ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
//                       }`}>
//                         {swapSelection.length === 0 ? "Click 1st student…" : "Click 2nd student…"}
//                       </span>
//                       <Button variant="ghost" size="sm" className="text-xs h-7 text-gray-400"
//                         onClick={() => { setSwapMode(false); setSwapSelection([]); }}>
//                         <X className="w-3.5 h-3.5 mr-1" /> Cancel swap
//                       </Button>
//                     </div>
//                   )}

//                   {rollSearch && (
//                     <span className="text-xs text-gray-400 flex-shrink-0">
//                       {filteredStudents.length} / {students.length}
//                     </span>
//                   )}
//                 </div>
//               )}

//               {/* Excel feedback */}
//               {excelStatus && (
//                 <div>
//                   {excelStatus.error
//                     ? <p className="text-xs text-red-500 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{excelStatus.error}</p>
//                     : (
//                       <div className="flex items-center gap-2 flex-wrap">
//                         <Badge className="gap-1 text-xs bg-emerald-500 text-white"><FileSpreadsheet className="w-3 h-3" />{excelStatus.matched} matched</Badge>
//                         {excelStatus.unmatched > 0 && (
//                           <Badge variant="destructive" className="text-xs gap-1"><AlertCircle className="w-3 h-3" />{excelStatus.unmatched} unmatched</Badge>
//                         )}
//                         {excelStatus.unmatchedIds.length > 0 && (
//                           <p className="text-xs text-gray-400">
//                             IDs not found: {excelStatus.unmatchedIds.slice(0, 5).join(", ")}
//                             {excelStatus.unmatchedIds.length > 5 && ` +${excelStatus.unmatchedIds.length - 5} more`}
//                           </p>
//                         )}
//                       </div>
//                     )
//                   }
//                 </div>
//               )}

//               {/* API error */}
//               {assignRollsMutation.isError && (
//                 <ErrorBlock
//                   message={assignRollsMutation.error instanceof Error ? assignRollsMutation.error.message : "Something went wrong"}
//                 />
//               )}
//             </div>

//             {/* Body */}
//             <div className="flex-1 overflow-y-auto">
//               {studentsLoading
//                 ? <EmptyState icon={<Loader2 className="w-5 h-5 animate-spin" />} text="Loading…" />
//                 : rollsPhase === "preview" && previewReport
//                   ? (
//                     <ReportView
//                       mode="preview"
//                       report={previewReport}
//                       year={activeYear?.currentYear ?? ""}
//                       onBack={() => { setRollsPhase("edit"); assignRollsMutation.reset(); }}
//                       onConfirm={() => handleAssignRolls(false)}
//                       isConfirming={assignRollsMutation.isPending}
//                     />
//                   )
//                   : rollsPhase === "done" && assignReport
//                     ? (
//                       <ReportView
//                         mode="done"
//                         report={assignReport}
//                         year={activeYear?.currentYear ?? ""}
//                         onReset={() => { setRollsPhase("edit"); setAssignReport(null); }}
//                       />
//                     )
//                     : !students?.length
//                       ? <EmptyState icon={<GraduationCap className="w-10 h-10 text-gray-300" />} text="No students found." />
//                       : (
//                         <table className="w-full text-sm table-fixed">
//                           <colgroup><col className="w-[8%]" /><col className="w-[10%]" /><col className="w-[24%]" /><col className="w-[10%]" /><col className="w-[21%]" /><col className="w-[21%]" /><col className="w-[6%]" /></colgroup>
//                           {/* <colgroup><col className="w-[11%]" /><col className="w-[27%]" /><col className="w-[11%]" /><col className="w-[22%]" /><col className="w-[22%]" /><col className="w-[7%]" /></colgroup> */}
//                           <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
//                             <tr>
//                                 <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
//                               <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Curr Roll</th>
//                               <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
//                               <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Curr Std</th>
//                               <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">New Roll <span className="text-gray-400 font-normal normal-case">(opt)</span></th>
//                               <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">New Std <span className="text-gray-400 font-normal normal-case">(opt)</span></th>
//                               <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">{swapMode ? "Pick" : ""}</th>
//                             </tr>
//                           </thead>
//                           <tbody className="bg-white divide-y divide-gray-100">
//                             {filteredStudents.map((student) => {
//                               const row = {
//                                 newRollNumber: yearRows[student._id]?.newRollNumber ?? "",
//                                 newStandard:   yearRows[student._id]?.newStandard   ?? student.standard,
//                               };
//                               const errors     = yearRowErrors[student._id];
//                               const isPending  = assignRollsMutation.isPending || !activeYear;
//                               const isFirst    = swapSelection[0] === student._id;
//                               const isSecond   = swapSelection[1] === student._id;
//                               const isSelected = isFirst || isSecond;

//                               return (
//                                 <tr
//                                   key={student._id}
//                                   className={`transition-colors
//                                     ${isFirst    ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200" : ""}
//                                     ${isSecond   ? "bg-amber-50  ring-1 ring-inset ring-amber-200"  : ""}
//                                     ${!isSelected && errors?.newRollNumber ? "bg-red-50/30"       : ""}
//                                     ${!isSelected && !errors?.newRollNumber ? "hover:bg-gray-50/50" : ""}
//                                   `}
//                                 >
//                                   <td className="px-3 py-2 font-mono text-sm text-gray-400">
//   {student.id
//     ? <span className="font-semibold text-gray-600">{student.id}</span>
//     : <span className="text-gray-300 text-xs italic">—</span>
//   }
// </td>
//                                   <td className="px-3 py-2 font-mono text-sm font-semibold text-gray-400">{student.rollNumber}</td>
//                                   <td className="px-3 py-2 font-medium text-gray-900 truncate">{student.name}</td>
//                                   <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{student.standard}</Badge></td>
//                                   <td className="px-3 py-2">
//                                     <div className="space-y-0.5">
//                                       <Input
//                                         value={row.newRollNumber}
//                                         onChange={(e) => handleRollChange(student._id, "newRollNumber", e.target.value)}
//                                         placeholder={`keep: ${student.rollNumber}`}
//                                         inputMode="numeric"
//                                         disabled={isPending || swapMode}
//                                         className={`h-8 text-sm font-mono
//                                           ${errors?.newRollNumber ? "border-red-400 focus-visible:ring-red-300" : ""}
//                                           ${isFirst  ? "border-indigo-300" : ""}
//                                           ${isSecond ? "border-amber-300"  : ""}
//                                         `}
//                                       />
//                                       {errors?.newRollNumber && (
//                                         <p className="text-xs text-red-500">{errors.newRollNumber}</p>
//                                       )}
//                                     </div>
//                                   </td>
//                                   <td className="px-3 py-2">
//                                     <Input
//                                       value={row.newStandard}
//                                       onChange={(e) => handleRollChange(student._id, "newStandard", e.target.value)}
//                                       placeholder={`keep: ${student.standard}`}
//                                       disabled={isPending || swapMode}
//                                       className="h-8 text-sm"
//                                     />
//                                   </td>
//                                   <td className="px-2 py-2 text-center">
//                                     {swapMode && !isPending && (
//                                       <button
//                                         onClick={() => handleSwapSelect(student._id)}
//                                         disabled={swapSelection.length === 2 && !isSelected}
//                                         title={isFirst ? "1st selected" : isSecond ? "2nd selected" : "Select for swap"}
//                                         className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mx-auto
//                                           ${isFirst
//                                             ? "bg-indigo-500 border-indigo-500 text-white"
//                                             : isSecond
//                                               ? "bg-amber-500 border-amber-500 text-white"
//                                               : swapSelection.length < 2
//                                                 ? "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50"
//                                                 : "border-gray-200 opacity-40 cursor-not-allowed"
//                                           }
//                                         `}
//                                       >
//                                         {isFirst  && <span className="text-xs font-bold leading-none">1</span>}
//                                         {isSecond && <span className="text-xs font-bold leading-none">2</span>}
//                                       </button>
//                                     )}
//                                   </td>
//                                 </tr>
//                               );
//                             })}
//                           </tbody>
//                         </table>
//                       )
//               }
//             </div>

//             {/* Footer */}
//             {rollsPhase === "edit" && (
//               <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
//                 <span className="text-xs text-gray-400">{rollFilledCount} / {totalCount} roll numbers filled</span>
//                 <div className="flex items-center gap-2">
//                   <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={assignRollsMutation.isPending}>Cancel</Button>
//                   <Button size="sm" onClick={() => handleAssignRolls(true)}
//                     disabled={assignRollsMutation.isPending || !students?.length || !activeYear}
//                     className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
//                     {assignRollsMutation.isPending
//                       ? <><Loader2 className="w-4 h-4 animate-spin" /> Previewing…</>
//                       : <><GraduationCap className="w-4 h-4" /> Preview Changes</>
//                     }
//                   </Button>
//                 </div>
//               </div>
//             )}
//           </TabsContent>

//           {/* ══ Tab 3: Year Config ════════════════════════════════════════════ */}
//           <TabsContent value="yearconfig" className="flex-1 flex flex-col min-h-0 mt-0 overflow-y-auto data-[state=inactive]:hidden">
//             <div className="px-3 py-3 max-w-xl space-y-8">

//               {/* Create new year */}
//               <div className="space-y-4">
//                 <div>
//                   <h3 className="text-sm font-semibold text-gray-800">Start New Academic Year</h3>
//                   <p className="text-xs text-gray-500 mt-0.5">Creates a new year and marks the previous one inactive.</p>
//                 </div>
//                 <div className="space-y-3">
//                   <Field label="Academic Year" required error={yearFormErrors.currentYear}>
//                     <Input value={yearForm.currentYear} onChange={(e) => handleYearFormChange("currentYear", e.target.value)}
//                       placeholder="e.g. 2026-27" disabled={yearConfigMutation.isPending}
//                       className={`h-9 w-40 text-sm ${yearFormErrors.currentYear ? "border-red-400" : ""}`} />
//                   </Field>
//                   <Field label="Start Date" required error={yearFormErrors.yearStartDate}>
//                     <Input type="date" value={yearForm.yearStartDate} onChange={(e) => handleYearFormChange("yearStartDate", e.target.value)}
//                       disabled={yearConfigMutation.isPending}
//                       className={`h-9 w-48 text-sm ${yearFormErrors.yearStartDate ? "border-red-400" : ""}`} />
//                   </Field>
//                   <Field label="End Date" required error={yearFormErrors.yearEndDate}>
//                     <Input type="date" value={yearForm.yearEndDate} onChange={(e) => handleYearFormChange("yearEndDate", e.target.value)}
//                       disabled={yearConfigMutation.isPending}
//                       className={`h-9 w-48 text-sm ${yearFormErrors.yearEndDate ? "border-red-400" : ""}`} />
//                   </Field>
//                 </div>
//                 {yearConfigMutation.isError && (
//                   <p className="text-sm text-red-600 flex items-center gap-1.5">
//                     <AlertCircle className="w-4 h-4" />
//                     {yearConfigMutation.error instanceof Error ? yearConfigMutation.error.message : "Error"}
//                   </p>
//                 )}
//                 <Button size="sm" onClick={handleSaveYear} disabled={yearConfigMutation.isPending} className="gap-1.5">
//                   {yearConfigMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
//                     : yearSaved ? <><Check className="w-4 h-4" /> Year Started</>
//                       : <><CalendarDays className="w-4 h-4" /> Start Year</>}
//                 </Button>
//               </div>

//               {/* End current year */}
//               {activeYear && (
//                 <div className="space-y-3 border-t border-gray-100 pt-6">
//                   <div>
//                     <h3 className="text-sm font-semibold text-gray-800">End Current Year</h3>
//                     <p className="text-xs text-gray-500 mt-0.5">
//                       Marks <strong>{activeYear.currentYear}</strong> as inactive. Students are not affected.
//                     </p>
//                   </div>
//                   {!endConfirm ? (
//                     <Button variant="outline" size="sm" className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
//                       onClick={() => setEndConfirm(true)}>
//                       <Lock className="w-4 h-4" /> End Year {activeYear.currentYear}
//                     </Button>
//                   ) : (
//                     <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
//                       <p className="text-sm font-medium text-red-700">
//                         Confirm ending <strong>{activeYear.currentYear}</strong>? Year will be marked inactive.
//                       </p>
//                       {endYearMutation.isError && (
//                         <p className="text-xs text-red-600">
//                           {endYearMutation.error instanceof Error ? endYearMutation.error.message : "Error"}
//                         </p>
//                       )}
//                       <div className="flex gap-2">
//                         <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
//                           onClick={() => endYearMutation.mutate()} disabled={endYearMutation.isPending}>
//                           {endYearMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Ending…</> : <><Lock className="w-4 h-4" /> Confirm</>}
//                         </Button>
//                         <Button variant="outline" size="sm" onClick={() => setEndConfirm(false)} disabled={endYearMutation.isPending}>Cancel</Button>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               )}

//               {/* Year History */}
//               {yearHistory.length > 0 && (
//                 <div className="space-y-3 border-t border-gray-100 pt-6">
//                   <h3 className="text-sm font-semibold text-gray-800">Year History</h3>
//                   <div className="space-y-2">
//                     {yearHistory.map((y) => (
//                       <div key={y._id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 bg-white">
//                         <div>
//                           <span className="text-sm font-medium text-gray-800">{y.currentYear}</span>
//                           <p className="text-xs text-gray-400">
//                             {new Date(y.yearStartDate).toLocaleDateString()} → {new Date(y.yearEndDate).toLocaleDateString()}
//                           </p>
//                         </div>
//                         <Badge className={`text-xs ${y.isActive ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"}`}>
//                           {y.isActive ? "Active" : "Inactive"}
//                         </Badge>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}
//             </div>
//           </TabsContent>

//         </Tabs>
//       </DialogContent>
//     </Dialog>
//   );
// }

// // ─── Helper components ────────────────────────────────────────────────────────

// function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
//   return (
//     <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
//       {icon}<p className="font-medium text-gray-500">{text}</p>
//     </div>
//   );
// }

// function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
//   return (
//     <div className="space-y-1">
//       <Label className="text-xs font-medium text-gray-600">
//         {label}{required && <span className="text-red-400 ml-0.5">*</span>}
//       </Label>
//       {children}
//       {error && <p className="text-xs text-red-500">{error}</p>}
//     </div>
//   );
// }

// function ErrorBlock({ message }: { message: string }) {
//   const errors = message.split(" | ").map((s) => s.trim()).filter(Boolean);
//   return (
//     <div className="mt-2 rounded-md border border-red-200 bg-red-50">
//       <div className="flex items-center gap-2 px-3 py-2 border-b border-red-200">
//         <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
//         <span className="text-sm font-medium text-red-700">
//           {errors.length} conflict{errors.length !== 1 ? "s" : ""} found
//         </span>
//       </div>
//       <ul className="max-h-36 overflow-y-auto divide-y divide-red-100 px-3 py-1">
//         {errors.map((err, i) => (
//           <li key={i} className="py-1.5 text-sm text-red-700">{err}</li>
//         ))}
//       </ul>
//       {errors.length > 3 && (
//         <p className="px-3 py-1.5 text-xs text-red-400 border-t border-red-100">Scroll to see all conflicts</p>
//       )}
//       <div className="px-3 py-2.5 border-t border-red-200 bg-amber-50 rounded-b-md space-y-1">
//         <p className="text-xs font-semibold text-amber-700">Need to swap roll numbers?</p>
//         <p className="text-xs text-amber-600">
//           Use the <strong>Swap Rolls</strong> button above — select both students and their rolls are exchanged in one submission, bypassing the conflict check.
//         </p>
//       </div>
//     </div>
//   );
// }

// function ReportView({
//   mode, report, year, onBack, onConfirm, onReset, isConfirming,
// }: {
//   mode:          "preview" | "done";
//   report:        AssignReport;
//   year:          string;
//   onBack?:       () => void;
//   onConfirm?:    () => void;
//   onReset?:      () => void;
//   isConfirming?: boolean;
// }) {
//   const [openSection, setOpenSection] = useState<string | null>(null);

//   const sections = [
//     {
//       key: "rollChanged", label: "Roll will change",   doneLabel: "Roll changed",
//       bg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700",
//       items: report.rollChanged.map((i) => `${i.name} — ${i.from} → ${i.to}`),
//     },
//     {
//       key: "stdChanged",  label: "Class will change",  doneLabel: "Class changed",
//       bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700",
//       items: report.stdChanged.map((i) => `${i.name} (Roll ${i.rollNumber}) — ${i.from} → ${i.to}`),
//     },
//     {
//       key: "yearMoved",   label: "Moving to new year", doneLabel: "Moved to new year",
//       bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",
//       items: report.yearMoved.map((i) => `${i.name} (Roll ${i.rollNumber}) from ${i.fromYear}`),
//     },
//     {
//       key: "activated",   label: "Will be re-activated", doneLabel: "Re-activated",
//       bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700",
//       items: report.activated.map((i) => `${i.name} (Roll ${i.rollNumber})`),
//     },
//     {
//       key: "unchanged",   label: "No change",           doneLabel: "No change",
//       bg: "bg-gray-50",   border: "border-gray-200",    text: "text-gray-500",
//       items: report.unchanged.map((i) => `${i.name} (Roll ${i.rollNumber})`),
//     },
//   ].filter((s) => s.items.length > 0);

//   const total = sections.reduce((sum, s) => sum + s.items.length, 0);

//   return (
//     <div className="flex flex-col h-full min-h-0">
//       <div className={`px-6 py-4 border-b flex-shrink-0 ${mode === "preview" ? "bg-amber-50 border-amber-100" : "border-gray-100"}`}>
//         <div className="flex items-center gap-2">
//           {mode === "preview"
//             ? <AlertCircle className="w-5 h-5 text-amber-500" />
//             : <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-emerald-600" /></div>
//           }
//           <p className="font-semibold text-gray-800">
//             {mode === "preview"
//               ? `Preview — ${total} students will be affected in ${year}`
//               : `Done — ${total} students updated in ${year}`
//             }
//           </p>
//         </div>
//         <div className="flex flex-wrap gap-1.5 mt-2.5">
//           {sections.map((s) => (
//             <span key={s.key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>
//               {s.items.length} {mode === "preview" ? s.label : s.doneLabel}
//             </span>
//           ))}
//         </div>
//         {mode === "preview" && (
//           <p className="mt-2 text-xs text-amber-600">Review carefully — no changes have been saved yet.</p>
//         )}
//       </div>

//       <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
//         {sections.map((s) => (
//           <div key={s.key} className={`rounded-lg border ${s.border} overflow-hidden`}>
//             <button
//               className={`w-full flex items-center justify-between px-3 py-2.5 ${s.bg} hover:brightness-95 transition-all`}
//               onClick={() => setOpenSection(openSection === s.key ? null : s.key)}
//             >
//               <span className={`text-sm font-medium ${s.text}`}>
//                 {mode === "preview" ? s.label : s.doneLabel}
//                 <span className="font-bold ml-1">{s.items.length}</span>
//               </span>
//               <ChevronDown className={`w-4 h-4 ${s.text} transition-transform duration-150 ${openSection === s.key ? "rotate-180" : ""}`} />
//             </button>
//             {openSection === s.key && (
//               <ul className="max-h-44 overflow-y-auto divide-y divide-gray-100 bg-white">
//                 {s.items.map((item, i) => (
//                   <li key={i} className="px-3 py-1.5 text-sm text-gray-700">{item}</li>
//                 ))}
//               </ul>
//             )}
//           </div>
//         ))}
//       </div>

//       <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0 flex justify-between items-center">
//         {mode === "preview" ? (
//           <>
//             <Button variant="outline" size="sm" onClick={onBack} disabled={isConfirming}>
//               ← Back &amp; Edit
//             </Button>
//             <Button size="sm" onClick={onConfirm} disabled={isConfirming}
//               className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
//               {isConfirming
//                 ? <><Loader2 className="w-4 h-4 animate-spin" /> Assigning…</>
//                 : <><Check className="w-4 h-4" /> Confirm &amp; Assign</>
//               }
//             </Button>
//           </>
//         ) : (
//           <div className="ml-auto">
//             <Button variant="outline" size="sm" onClick={onReset}>Assign Again</Button>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }