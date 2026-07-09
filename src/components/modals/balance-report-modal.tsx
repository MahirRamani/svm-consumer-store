// components/modals/balance-report-modal.tsx
"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar,
  ArrowRightLeft,
  List,
  Download,
  Loader2,
  Wallet,
  CalendarDays,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import type { Student } from '@/types';

// =============================================
// Type Definitions
// =============================================
type ReportType = "today" | "specific" | "range" | "all";
type ExportFormat = "csv" | "pdf" | "excel";
type TransactionTypeFilter = "all" | "topup" | "deduction";

interface BalanceReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  preSelectedStudentId?: string | null;
}

interface ReportTypeOption {
  type: ReportType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

// =============================================
// Component
// =============================================
export default function BalanceReportModal({
  open,
  onOpenChange,
  students,
  preSelectedStudentId = null,
}: BalanceReportModalProps) {
  // State
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [specificDate, setSpecificDate] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<TransactionTypeFilter>("all");
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split("T")[0];
      setSpecificDate(today);
      setFromDate(today);
      setToDate(today);
      setSelectedStudentId(preSelectedStudentId || "all");
      setReportType(null);
      setExportFormat("csv");
      setTransactionTypeFilter("all");
    }
  }, [open, preSelectedStudentId]);

  const reportTypeOptions: ReportTypeOption[] = [
    {
      type: "today",
      label: "Today",
      description: "Today's entries",
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      type: "specific",
      label: "Specific Date",
      description: "Pick a date",
      icon: <CalendarDays className="w-4 h-4" />,
    },
    {
      type: "range",
      label: "Date Range",
      description: "From - To",
      icon: <ArrowRightLeft className="w-4 h-4" />,
    },
    {
      type: "all",
      label: "All Entries",
      description: "Complete history",
      icon: <List className="w-4 h-4" />,
    },
  ];

  const transactionTypes = [
    { value: "all", label: "All Transactions", icon: <Wallet className="w-4 h-4" /> },
    { value: "topup", label: "Top-ups Only", icon: <TrendingUp className="w-4 h-4 text-green-500" /> },
    { value: "deduction", label: "Deductions Only", icon: <TrendingDown className="w-4 h-4 text-red-500" /> },
  ];

  const isFormValid = (): boolean => {
    if (!reportType) return false;
    if (reportType === "specific" && !specificDate) return false;
    if (reportType === "range") {
      if (!fromDate || !toDate) return false;
      if (new Date(fromDate) > new Date(toDate)) return false;
    }
    return true;
  };

  const getDateRangeDescription = (): string => {
    switch (reportType) {
      case "today":
        return `Today (${new Date().toLocaleDateString("en-GB")})`;
      case "specific":
        return new Date(specificDate).toLocaleDateString("en-GB");
      case "range":
        return `${new Date(fromDate).toLocaleDateString("en-GB")} - ${new Date(toDate).toLocaleDateString("en-GB")}`;
      case "all":
        return "All time";
      default:
        return "";
    }
  };

  const getSelectedStudentName = (): string => {
    if (selectedStudentId === "all") return "All Students";
    const student = students.find((s) => s._id === selectedStudentId);
    return student?.name || "Selected Student";
  };

  const getTransactionTypeLabel = (): string => {
    switch (transactionTypeFilter) {
      case "topup":
        return "Top-ups";
      case "deduction":
        return "Deductions";
      default:
        return "All Transactions";
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleGenerateReport = async () => {
    if (!isFormValid()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);

    try {
      const params = new URLSearchParams();
      params.append("reportType", reportType!);
      params.append("format", exportFormat);
      params.append("transactionType", transactionTypeFilter);

      if (selectedStudentId !== "all") {
        params.append("studentId", selectedStudentId);
      }

      switch (reportType) {
        case "today":
          params.append("date", new Date().toISOString().split("T")[0]);
          break;
        case "specific":
          params.append("date", specificDate);
          break;
        case "range":
          params.append("fromDate", fromDate);
          params.append("toDate", toDate);
          break;
      }

      const response = await fetch(`/api/balance-report?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to generate report");
      }

      if (exportFormat === "pdf") {
        const jsonData = await response.json();
        if (jsonData.success) {
          const blob = new Blob([JSON.stringify(jsonData.data, null, 2)], {
            type: "application/json",
          });
          downloadBlob(blob, `balance-report-${reportType}.json`);
          toast.success("Report data generated!");
        }
      } else {
        const blob = await response.blob();
        const contentDisposition = response.headers.get("Content-Disposition");
        const filename = contentDisposition
          ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
          : `balance-report-${reportType}-${new Date().toISOString().split("T")[0]}.${exportFormat === "excel" ? "xlsx" : "csv"}`;

        downloadBlob(blob, filename);
        toast.success(`Balance report downloaded successfully! (${exportFormat.toUpperCase()})`);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Report generation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">Generate Balance Report</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Generate report for top-ups and deductions
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Report Type Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Report Period <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {reportTypeOptions.map(({ type, label, description, icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setReportType(type)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-4 py-3 border-2 rounded-xl transition-all text-sm",
                    reportType === type
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/50"
                  )}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {icon}
                    {label}
                  </div>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Specific Date Input */}
          {reportType === "specific" && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <Label htmlFor="specificDate" className="text-sm font-medium mb-2 block">
                Select Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="specificDate"
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full"
              />
            </div>
          )}

          {/* Date Range Inputs */}
          {reportType === "range" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <Label htmlFor="fromDate" className="text-sm font-medium mb-2 block">
                  From Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  max={toDate || new Date().toISOString().split("T")[0]}
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="toDate" className="text-sm font-medium mb-2 block">
                  To Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={fromDate}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full"
                />
              </div>
              {fromDate && toDate && new Date(fromDate) > new Date(toDate) && (
                <p className="text-sm text-red-500">From date cannot be after To date</p>
              )}
            </div>
          )}

          {/* Transaction Type Filter */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Transaction Type</Label>
            <div className="flex gap-2">
              {transactionTypes.map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTransactionTypeFilter(value as TransactionTypeFilter)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 border-2 rounded-lg transition-all text-sm flex-1",
                    transactionTypeFilter === value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-blue-300"
                  )}
                >
                  {icon}
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Student Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Student (Optional)</Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="All Students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                {students
                  .filter((student) => student.isActive)
                  .map((student) => (
                    <SelectItem key={student._id} value={student._id}>
                      {student.name} ({student.rollNumber})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Export Format */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Export Format</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as ExportFormat)}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="csv" id="format-csv" />
                <Label htmlFor="format-csv" className="text-sm cursor-pointer font-normal">
                  CSV
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="excel" id="format-excel" />
                <Label htmlFor="format-excel" className="text-sm cursor-pointer font-normal">
                  Excel
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pdf" id="format-pdf" />
                <Label htmlFor="format-pdf" className="text-sm cursor-pointer font-normal">
                  PDF
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Preview Summary */}
          {reportType && (
            <div className="bg-gray-50 rounded-lg p-4 border animate-in fade-in duration-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Report Preview</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Period:</span> {getDateRangeDescription()}
                </p>
                <p>
                  <span className="font-medium">Student:</span> {getSelectedStudentName()}
                </p>
                <p>
                  <span className="font-medium">Type:</span> {getTransactionTypeLabel()}
                </p>
                <p>
                  <span className="font-medium">Format:</span> {exportFormat.toUpperCase()}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerateReport}
            disabled={!isFormValid() || isGenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}