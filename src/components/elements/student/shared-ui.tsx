"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, Check, ChevronDown, Loader2 } from 'lucide-react';
import type { AssignReport } from '@/types/manage-student/manage-student-bulk';

// ── Empty / loading state ───────────────────────────────────────────────────

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
      {icon}
      <p className="font-medium text-gray-500">{text}</p>
    </div>
  );
}

// ── Labeled form field ───────────────────────────────────────────────────────

export function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Conflict / error list block (with swap-rolls hint) ──────────────────────

export function ErrorBlock({ message }: { message: string }) {
  // const errors = message.split(" | ").map((s) => s.trim()).filter(Boolean);
  const [sentence, ...errors] = message.split(" | ").map((s) => s.trim()).filter(Boolean);
  return (
    <div className="mt-2 rounded-md border border-red-200 bg-red-50">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-red-200">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm font-medium text-red-700">
          {errors.length} conflict{errors.length !== 1 ? "s" : ""} found - {sentence}
        </span>
      </div>
      <ul className="max-h-36 overflow-y-auto divide-y divide-red-100 px-3 py-1">
        {errors.map((err, i) => (
          <li key={i} className="py-1.5 text-sm text-red-700">{err}</li>
        ))}
      </ul>
      {errors.length > 3 && (
        <p className="px-3 py-1.5 text-xs text-red-400 border-t border-red-100">Scroll to see all conflicts</p>
      )}
      <div className="px-3 py-2.5 border-t border-red-200 bg-amber-50 rounded-b-md space-y-1">
        <p className="text-xs font-semibold text-amber-700">Need to swap roll numbers?</p>
        <p className="text-xs text-amber-600">
          Use the <strong>Swap Rolls</strong> button above — select both students and their rolls are exchanged in
          one submission, bypassing the conflict check.
        </p>
      </div>
    </div>
  );
}

// ── Preview / done report view (used by Assign Rolls tab) ──────────────────

export function ReportView({
  mode,
  report,
  year,
  onBack,
  onConfirm,
  onReset,
  isConfirming,
}: {
  mode: "preview" | "done";
  report: AssignReport;
  year: string;
  onBack?: () => void;
  onConfirm?: () => void;
  onReset?: () => void;
  isConfirming?: boolean;
}) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const sections = [
    {
      key: "rollChanged", label: "Roll will change", doneLabel: "Roll changed",
      bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700",
      items: report.rollChanged.map((i) => `${i.name} — ${i.from} → ${i.to}`),
    },
    {
      key: "stdChanged", label: "Class will change", doneLabel: "Class changed",
      bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700",
      items: report.stdChanged.map((i) => `${i.name} (Roll ${i.rollNumber}) — ${i.from} → ${i.to}`),
    },
    {
      key: "yearMoved", label: "Moving to new year", doneLabel: "Moved to new year",
      bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700",
      items: report.yearMoved.map((i) => `${i.name} (Roll ${i.rollNumber}) from ${i.fromYear}`),
    },
    {
      key: "activated", label: "Will be re-activated", doneLabel: "Re-activated",
      bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700",
      items: report.activated.map((i) => `${i.name} (Roll ${i.rollNumber})`),
    },
    {
      key: "unchanged", label: "No change", doneLabel: "No change",
      bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-500",
      items: report.unchanged.map((i) => `${i.name} (Roll ${i.rollNumber})`),
    },
  ].filter((s) => s.items.length > 0);

  const total = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`px-6 py-4 border-b flex-shrink-0 ${mode === "preview" ? "bg-amber-50 border-amber-100" : "border-gray-100"}`}>
        <div className="flex items-center gap-2">
          {mode === "preview" ? (
            <AlertCircle className="w-5 h-5 text-amber-500" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          )}
          <p className="font-semibold text-gray-800">
            {mode === "preview"
              ? `Preview — ${total} students will be affected in ${year}`
              : `Done — ${total} students updated in ${year}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {sections.map((s) => (
            <span key={s.key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>
              {s.items.length} {mode === "preview" ? s.label : s.doneLabel}
            </span>
          ))}
        </div>
        {mode === "preview" && (
          <p className="mt-2 text-xs text-amber-600">Review carefully — no changes have been saved yet.</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
        {sections.map((s) => (
          <div key={s.key} className={`rounded-lg border ${s.border} overflow-hidden`}>
            <button
              className={`w-full flex items-center justify-between px-3 py-2.5 ${s.bg} hover:brightness-95 transition-all`}
              onClick={() => setOpenSection(openSection === s.key ? null : s.key)}
            >
              <span className={`text-sm font-medium ${s.text}`}>
                {mode === "preview" ? s.label : s.doneLabel}
                <span className="font-bold ml-1">{s.items.length}</span>
              </span>
              <ChevronDown className={`w-4 h-4 ${s.text} transition-transform duration-150 ${openSection === s.key ? "rotate-180" : ""}`} />
            </button>
            {openSection === s.key && (
              <ul className="max-h-44 overflow-y-auto divide-y divide-gray-100 bg-white">
                {s.items.map((item, i) => (
                  <li key={i} className="px-3 py-1.5 text-sm text-gray-700">{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0 flex justify-between items-center">
        {mode === "preview" ? (
          <>
            <Button variant="outline" size="sm" onClick={onBack} disabled={isConfirming}>
              ← Back &amp; Edit
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={isConfirming}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Assigning…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Confirm &amp; Assign
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={onReset}>
              Assign Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}