"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle, CalendarDays, Lock } from "lucide-react";
import { Field } from "./shared-ui";
import type { YearConfigEntry, YearConfigForm, YearConfigErrors } from "@/types/manage-student/manage-student-bulk";

interface Props {
  activeYear: YearConfigEntry | null;
  yearHistory: YearConfigEntry[];
  onMutated: () => void;
}

export function YearConfigTab({ activeYear, yearHistory, onMutated }: Props) {
  const [yearForm, setYearForm] = useState<YearConfigForm>({ currentYear: "", yearStartDate: "", yearEndDate: "" });
  const [yearFormErrors, setYearFormErrors] = useState<YearConfigErrors>({});
  const [yearSaved, setYearSaved] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);

  const yearConfigMutation = useMutation({
    mutationFn: async (payload: YearConfigForm) => {
      const res = await fetch("/api/year-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentYear: payload.currentYear,
          yearStartDate: new Date(payload.yearStartDate).toISOString(),
          yearEndDate: new Date(payload.yearEndDate).toISOString(),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Failed to save year");
      return res.json();
    },
    onSuccess: () => {
      setYearSaved(true);
      onMutated();
    },
  });

  const endYearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/year-config/end", { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Failed to end year");
      return res.json();
    },
    onSuccess: () => {
      setEndConfirm(false);
      onMutated();
    },
  });

  const handleYearFormChange = useCallback((field: keyof YearConfigForm, val: string) => {
    setYearForm((p) => ({ ...p, [field]: val }));
    setYearFormErrors((p) => ({ ...p, [field]: undefined }));
    setYearSaved(false);
  }, []);

  const handleSaveYear = useCallback(() => {
    const errors: YearConfigErrors = {};
    if (!yearForm.currentYear.trim()) errors.currentYear = "Required";
    if (!yearForm.yearStartDate) errors.yearStartDate = "Required";
    if (!yearForm.yearEndDate) errors.yearEndDate = "Required";
    if (Object.keys(errors).length) {
      setYearFormErrors(errors);
      return;
    }
    yearConfigMutation.mutate(yearForm);
  }, [yearForm, yearConfigMutation]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="px-3 py-3 max-w-xl space-y-8">
        {/* Create new year */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Start New Academic Year</h3>
            <p className="text-xs text-gray-500 mt-0.5">Creates a new year and marks the previous one inactive.</p>
          </div>
          <div className="space-y-3">
            <Field label="Academic Year" required error={yearFormErrors.currentYear}>
              <Input
                value={yearForm.currentYear}
                onChange={(e) => handleYearFormChange("currentYear", e.target.value)}
                placeholder="e.g. 2026-27"
                disabled={yearConfigMutation.isPending}
                className={`h-9 w-40 text-sm ${yearFormErrors.currentYear ? "border-red-400" : ""}`}
              />
            </Field>
            <Field label="Start Date" required error={yearFormErrors.yearStartDate}>
              <Input
                type="date"
                value={yearForm.yearStartDate}
                onChange={(e) => handleYearFormChange("yearStartDate", e.target.value)}
                disabled={yearConfigMutation.isPending}
                className={`h-9 w-48 text-sm ${yearFormErrors.yearStartDate ? "border-red-400" : ""}`}
              />
            </Field>
            <Field label="End Date" required error={yearFormErrors.yearEndDate}>
              <Input
                type="date"
                value={yearForm.yearEndDate}
                onChange={(e) => handleYearFormChange("yearEndDate", e.target.value)}
                disabled={yearConfigMutation.isPending}
                className={`h-9 w-48 text-sm ${yearFormErrors.yearEndDate ? "border-red-400" : ""}`}
              />
            </Field>
          </div>
          {yearConfigMutation.isError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {yearConfigMutation.error instanceof Error ? yearConfigMutation.error.message : "Error"}
            </p>
          )}
          <Button size="sm" onClick={handleSaveYear} disabled={yearConfigMutation.isPending} className="gap-1.5">
            {yearConfigMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : yearSaved ? (
              <>
                <Check className="w-4 h-4" /> Year Started
              </>
            ) : (
              <>
                <CalendarDays className="w-4 h-4" /> Start Year
              </>
            )}
          </Button>
        </div>

        {/* End current year */}
        {activeYear && (
          <div className="space-y-3 border-t border-gray-100 pt-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">End Current Year</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Marks <strong>{activeYear.currentYear}</strong> as inactive. Students are not affected.
              </p>
            </div>
            {!endConfirm ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setEndConfirm(true)}
              >
                <Lock className="w-4 h-4" /> End Year {activeYear.currentYear}
              </Button>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-medium text-red-700">
                  Confirm ending <strong>{activeYear.currentYear}</strong>? Year will be marked inactive.
                </p>
                {endYearMutation.isError && (
                  <p className="text-xs text-red-600">
                    {endYearMutation.error instanceof Error ? endYearMutation.error.message : "Error"}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                    onClick={() => endYearMutation.mutate()}
                    disabled={endYearMutation.isPending}
                  >
                    {endYearMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Ending…
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" /> Confirm
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEndConfirm(false)} disabled={endYearMutation.isPending}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Year History */}
        {yearHistory.length > 0 && (
          <div className="space-y-3 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-800">Year History</h3>
            <div className="space-y-2">
              {yearHistory.map((y) => (
                <div key={y._id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 bg-white">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{y.currentYear}</span>
                    <p className="text-xs text-gray-400">
                      {new Date(y.yearStartDate).toLocaleDateString()} → {new Date(y.yearEndDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={`text-xs ${y.isActive ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {y.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}