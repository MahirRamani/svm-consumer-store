"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, AlertCircle, GraduationCap, Download, Upload, FileSpreadsheet,
  ChevronDown, Search, ArrowLeftRight, X, CalendarDays,
} from "lucide-react";
import { EmptyState, ErrorBlock, ReportView } from "./shared-ui";
import { parseExcelFile, findCol, downloadExcelTemplate, ID_KEYS, ROLL_KEYS, STD_KEYS } from "@/lib/utils/excel-utils";
import type { StudentRow, YearConfigEntry, YearRow, YearRowErrors, ExcelStatus, RollsPhase, AssignReport } from "@/types/manage-student/manage-student-bulk";

interface Props {
  students?: StudentRow[];
  studentsLoading: boolean;
  activeYear: YearConfigEntry | null;
  yearLoading: boolean;
  onMutated: () => void;
  onClose: () => void;
}

export function AssignRollsTab({ students, studentsLoading, activeYear, yearLoading, onMutated, onClose }: Props) {
  const [yearRows, setYearRows] = useState<Record<string, YearRow>>({});
  const [yearRowErrors, setYearRowErrors] = useState<Record<string, YearRowErrors>>({});
  const [excelStatus, setExcelStatus] = useState<ExcelStatus | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rollsPhase, setRollsPhase] = useState<RollsPhase>("edit");
  const [previewReport, setPreviewReport] = useState<AssignReport | null>(null);
  const [assignReport, setAssignReport] = useState<AssignReport | null>(null);
  const [rollSearch, setRollSearch] = useState("");
  const [swapMode, setSwapMode] = useState(false);
  const [swapSelection, setSwapSelection] = useState<string[]>([]);
  const excelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!students) return;
    setYearRows((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        if (!next[s._id]) next[s._id] = { newRollNumber: "", newStandard: String(s.standard) };
      });
      return next;
    });
  }, [students]);

  const assignRollsMutation = useMutation({
    mutationFn: async (payload: {
      dryRun: boolean;
      students: Array<{ studentMongoId: string; rollNumber?: number; standard?: number }>;
    }) => {
      const res = await fetch("/api/students/assign-rolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = "Failed to assign rolls";
        try {
          const errData = await res.json();
          message = errData.message ?? errData.error?.message ?? message;
        } catch {
          /* keep default */
        }
        throw new Error(message);
      }
      return res.json() as Promise<{ data: { updated?: number; year: string; report: AssignReport } }>;
    },
    onSuccess: (res, variables) => {
      const report = res.data?.report ?? null;
      if (variables.dryRun) {
        setPreviewReport(report);
        setRollsPhase("preview");
      } else {
        setAssignReport(report);
        setRollsPhase("done");
        onMutated();
      }
    },
  });

  const handleRollChange = useCallback((mongoId: string, field: keyof YearRow, val: string) => {
    setYearRows((p) => ({
      ...p,
      [mongoId]: { ...p[mongoId], [field]: field === "newRollNumber" ? val.replace(/\D/g, "") : val },
    }));
    setYearRowErrors((p) => ({ ...p, [mongoId]: { ...p[mongoId], [field]: undefined } }));
  }, []);

  const handleSwapSelect = useCallback(
    (mongoId: string) => {
      setSwapSelection((prev) => {
        if (prev.includes(mongoId)) return prev.filter((id) => id !== mongoId);
        if (prev.length >= 2) return prev;
        const next = [...prev, mongoId];
        if (next.length === 2) {
          const [idA, idB] = next;
          const studentA = students!.find((s) => s._id === idA)!;
          const studentB = students!.find((s) => s._id === idB)!;
          const rollA = yearRows[idA]?.newRollNumber?.trim() || String(studentA.rollNumber);
          const rollB = yearRows[idB]?.newRollNumber?.trim() || String(studentB.rollNumber);
          setYearRows((p) => ({
            ...p,
            [idA]: { ...p[idA], newRollNumber: rollB },
            [idB]: { ...p[idB], newRollNumber: rollA },
          }));
          setYearRowErrors((p) => ({
            ...p,
            [idA]: { ...p[idA], newRollNumber: undefined },
            [idB]: { ...p[idB], newRollNumber: undefined },
          }));
          setSwapMode(false);
          return [];
        }
        return next;
      });
    },
    [students, yearRows]
  );

  const studentIdToMongoId = useMemo(() => {
    const map = new Map<string, string>();
    students?.forEach((s) => {
      if (s.id) map.set(String(s.id).trim(), s._id);
    });
    return map;
  }, [students]);

  const handleExcelUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsParsing(true);
      setExcelStatus(null);
      try {
        const rows = await parseExcelFile(file);
        let matched = 0;
        const unmatchedIds: string[] = [];
        setYearRows((prev) => {
          const next = { ...prev };
          rows.forEach((row) => {
            const studentId = findCol(row, ID_KEYS);
            const rollNumber = findCol(row, ROLL_KEYS);
            const standard = findCol(row, STD_KEYS);
            if (!studentId) return;
            const mongoId = studentIdToMongoId.get(studentId);
            if (!mongoId) {
              unmatchedIds.push(studentId);
              return;
            }
            matched++;
            next[mongoId] = {
              ...next[mongoId],
              ...(rollNumber ? { newRollNumber: rollNumber.replace(/\D/g, "") } : {}),
              ...(standard ? { newStandard: standard } : {}),
            };
          });
          return next;
        });
        setExcelStatus({ matched, unmatched: unmatchedIds.length, unmatchedIds });
      } catch (err: unknown) {
        setExcelStatus({
          matched: 0,
          unmatched: 0,
          unmatchedIds: [],
          error: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setIsParsing(false);
        if (excelRef.current) excelRef.current.value = "";
      }
    },
    [studentIdToMongoId]
  );

  const downloadTemplate = useCallback(async () => {
    await downloadExcelTemplate(
      "roll-number-template.xlsx",
      [
        { header: "ID", key: "id", width: 12 },
        { header: "Roll No", key: "rollNo", width: 14 },
        { header: "Standard", key: "standard", width: 14 },
      ],
      (students ?? []).map((s) => ({ id: s.id ?? "", rollNo: "", standard: s.standard }))
    );
  }, [students]);

  const handleAssignRolls = useCallback(
    (dryRun: boolean) => {
      if (!students) return;
      const errors: Record<string, YearRowErrors> = {};

      const filledRolls = students.map((s) => yearRows[s._id]?.newRollNumber?.trim()).filter(Boolean) as string[];
      const dups = filledRolls.filter((r, i) => filledRolls.indexOf(r) !== i);

      if (dups.length > 0) {
        students.forEach((s) => {
          if (dups.includes(yearRows[s._id]?.newRollNumber?.trim())) {
            errors[s._id] = { ...errors[s._id], newRollNumber: "Duplicate in batch" };
          }
        });
        setYearRowErrors(errors);
        return;
      }

      assignRollsMutation.mutate({
        dryRun,
        students: students.map((s) => {
          const row = yearRows[s._id];
          return {
            studentMongoId: s._id,
            ...(row?.newRollNumber?.trim() ? { rollNumber: Number(row.newRollNumber.trim()) } : {}),
            ...(row?.newStandard?.trim() ? { standard: Number(row.newStandard.trim()) } : {}),
          };
        }),
      });
    },
    [students, yearRows, assignRollsMutation]
  );

  const totalCount = students?.length ?? 0;
  const rollFilledCount = useMemo(
    () => Object.values(yearRows).filter((r) => r.newRollNumber?.trim()).length,
    [yearRows]
  );
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const q = rollSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.rollNumber).includes(q) ||
        String(s.standard).includes(q)
    );
  }, [students, rollSearch]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header toolbar */}
      <div className="px-3 py-3 border-b border-gray-100 bg-gray-50/50 flex-shrink-0 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {yearLoading ? (
              <p className="text-xs text-gray-400">Loading year…</p>
            ) : activeYear ? (
              <div className="flex items-center gap-2">
                <Badge className="text-xs gap-1 bg-indigo-500 text-white">
                  <CalendarDays className="w-3 h-3" />
                  {activeYear.currentYear}
                </Badge>
                <span className="text-xs text-gray-400">active year</span>
              </div>
            ) : (
              <p className="text-xs text-amber-600 font-medium">No active year — create one in Year Config tab first.</p>
            )}
            <p className="text-xs text-gray-500">
              Upload Excel with <code className="bg-gray-100 px-1 rounded">ID</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">Roll No</code>, optionally{" "}
              <code className="bg-gray-100 px-1 rounded">Standard</code>. Blank roll = keeps current.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={downloadTemplate} disabled={!students?.length}>
              <Download className="w-3.5 h-3.5" /> Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => excelRef.current?.click()}
              disabled={isParsing || !students?.length || !activeYear}
            >
              {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {isParsing ? "Parsing…" : "Upload Excel"}
            </Button>
            <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
          </div>
        </div>

        {rollsPhase === "edit" && !!students?.length && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <Input
                value={rollSearch}
                onChange={(e) => setRollSearch(e.target.value)}
                placeholder="Search by name, roll or class…"
                className="h-8 pl-8 text-xs"
              />
              {rollSearch && (
                <button
                  onClick={() => setRollSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!swapMode ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs flex-shrink-0"
                onClick={() => {
                  setSwapMode(true);
                  setSwapSelection([]);
                }}
                disabled={!activeYear}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Swap Rolls
              </Button>
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    swapSelection.length === 0 ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  {swapSelection.length === 0 ? "Click 1st student…" : "Click 2nd student…"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-gray-400"
                  onClick={() => {
                    setSwapMode(false);
                    setSwapSelection([]);
                  }}
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel swap
                </Button>
              </div>
            )}

            {rollSearch && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                {filteredStudents.length} / {students.length}
              </span>
            )}
          </div>
        )}

        {excelStatus && (
          <div>
            {excelStatus.error ? (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {excelStatus.error}
              </p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="gap-1 text-xs bg-emerald-500 text-white">
                  <FileSpreadsheet className="w-3 h-3" />
                  {excelStatus.matched} matched
                </Badge>
                {excelStatus.unmatched > 0 && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {excelStatus.unmatched} unmatched
                  </Badge>
                )}
                {excelStatus.unmatchedIds.length > 0 && (
                  <p className="text-xs text-gray-400">
                    IDs not found: {excelStatus.unmatchedIds.slice(0, 5).join(", ")}
                    {excelStatus.unmatchedIds.length > 5 && ` +${excelStatus.unmatchedIds.length - 5} more`}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {assignRollsMutation.isError && (
          <ErrorBlock message={assignRollsMutation.error instanceof Error ? assignRollsMutation.error.message : "Something went wrong"} />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {studentsLoading ? (
          <EmptyState icon={<Loader2 className="w-5 h-5 animate-spin" />} text="Loading…" />
        ) : rollsPhase === "preview" && previewReport ? (
          <ReportView
            mode="preview"
            report={previewReport}
            year={activeYear?.currentYear ?? ""}
            onBack={() => {
              setRollsPhase("edit");
              assignRollsMutation.reset();
            }}
            onConfirm={() => handleAssignRolls(false)}
            isConfirming={assignRollsMutation.isPending}
          />
        ) : rollsPhase === "done" && assignReport ? (
          <ReportView
            mode="done"
            report={assignReport}
            year={activeYear?.currentYear ?? ""}
            onReset={() => {
              setRollsPhase("edit");
              setAssignReport(null);
            }}
          />
        ) : !students?.length ? (
          <EmptyState icon={<GraduationCap className="w-10 h-10 text-gray-300" />} text="No students found." />
        ) : (
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[24%]" />
              <col className="w-[10%]" />
              <col className="w-[21%]" />
              <col className="w-[21%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Curr Roll</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Curr Std</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  New Roll <span className="text-gray-400 font-normal normal-case">(opt)</span>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  New Std <span className="text-gray-400 font-normal normal-case">(opt)</span>
                </th>
                <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {swapMode ? "Pick" : ""}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredStudents.map((student) => {
                const row = {
                  newRollNumber: yearRows[student._id]?.newRollNumber ?? "",
                  newStandard: yearRows[student._id]?.newStandard ?? student.standard,
                };
                const errors = yearRowErrors[student._id];
                const isPending = assignRollsMutation.isPending || !activeYear;
                const isFirst = swapSelection[0] === student._id;
                const isSecond = swapSelection[1] === student._id;
                const isSelected = isFirst || isSecond;

                return (
                  <tr
                    key={student._id}
                    className={`transition-colors
                      ${isFirst ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200" : ""}
                      ${isSecond ? "bg-amber-50  ring-1 ring-inset ring-amber-200" : ""}
                      ${!isSelected && errors?.newRollNumber ? "bg-red-50/30" : ""}
                      ${!isSelected && !errors?.newRollNumber ? "hover:bg-gray-50/50" : ""}
                    `}
                  >
                    <td className="px-3 py-2 font-mono text-sm text-gray-400">
                      {student.id ? (
                        <span className="font-semibold text-gray-600">{student.id}</span>
                      ) : (
                        <span className="text-gray-300 text-xs italic">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-sm font-semibold text-gray-400">{student.rollNumber}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 truncate">{student.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs">
                        {student.standard}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        <Input
                          value={row.newRollNumber}
                          onChange={(e) => handleRollChange(student._id, "newRollNumber", e.target.value)}
                          placeholder={`keep: ${student.rollNumber}`}
                          inputMode="numeric"
                          disabled={isPending || swapMode}
                          className={`h-8 text-sm font-mono
                            ${errors?.newRollNumber ? "border-red-400 focus-visible:ring-red-300" : ""}
                            ${isFirst ? "border-indigo-300" : ""}
                            ${isSecond ? "border-amber-300" : ""}
                          `}
                        />
                        {errors?.newRollNumber && <p className="text-xs text-red-500">{errors.newRollNumber}</p>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.newStandard}
                        onChange={(e) => handleRollChange(student._id, "newStandard", e.target.value)}
                        placeholder={`keep: ${student.standard}`}
                        disabled={isPending || swapMode}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {swapMode && !isPending && (
                        <button
                          onClick={() => handleSwapSelect(student._id)}
                          disabled={swapSelection.length === 2 && !isSelected}
                          title={isFirst ? "1st selected" : isSecond ? "2nd selected" : "Select for swap"}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mx-auto
                            ${
                              isFirst
                                ? "bg-indigo-500 border-indigo-500 text-white"
                                : isSecond
                                ? "bg-amber-500 border-amber-500 text-white"
                                : swapSelection.length < 2
                                ? "border-gray-300 hover:border-indigo-400 hover:bg-indigo-50"
                                : "border-gray-200 opacity-40 cursor-not-allowed"
                            }
                          `}
                        >
                          {isFirst && <span className="text-xs font-bold leading-none">1</span>}
                          {isSecond && <span className="text-xs font-bold leading-none">2</span>}
                        </button>
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
      {rollsPhase === "edit" && (
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-400">
            {rollFilledCount} / {totalCount} roll numbers filled
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={assignRollsMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleAssignRolls(true)}
              disabled={assignRollsMutation.isPending || !students?.length || !activeYear}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {assignRollsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Previewing…
                </>
              ) : (
                <>
                  <GraduationCap className="w-4 h-4" /> Preview Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}