// components/modals/stock-report-modal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Calendar,
  ArrowRightLeft,
  List,
  Download,
  Loader2,
  FileSpreadsheet,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type { Product } from "@/types/product";

type ReportType = "today" | "specific" | "range" | "all";
type ExportFormat = "csv" | "pdf" | "excel";

interface StockReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  preSelectedProductId?: string | null;
  categoryId?: string | null; // NEW: Add categoryId prop
}

interface ReportTypeOption {
  type: ReportType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export default function StockReportModal({
  open,
  onOpenChange,
  products,
  preSelectedProductId = null,
  categoryId = null, // NEW: Accept categoryId
}: StockReportModalProps) {
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [specificDate, setSpecificDate] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().split("T")[0];
      setSpecificDate(today);
      setFromDate(today);
      setToDate(today);
      setSelectedProductId(preSelectedProductId || "all");
      setReportType(null);
      setExportFormat("csv");
    }
  }, [open, preSelectedProductId]);

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

      // NEW: Add categoryId to params if available
      if (categoryId && categoryId !== "all") {
        params.append("categoryId", categoryId);
      }

      if (selectedProductId !== "all") {
        params.append("productId", selectedProductId);
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

      const response = await fetch(`/api/stock-transactions/report?${params}`);

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
          downloadBlob(blob, `stock-report-${reportType}.json`);
          toast.success("Report data generated! (PDF generation requires additional setup)");
        }
      } else {
        const blob = await response.blob();
        const contentDisposition = response.headers.get("Content-Disposition");
        const filename = contentDisposition
          ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
          : `stock-report-${reportType}-${new Date().toISOString().split("T")[0]}.${exportFormat === "excel" ? "xlsx" : "csv"}`;

        downloadBlob(blob, filename);
        toast.success(`Stock report downloaded successfully! (${exportFormat.toUpperCase()})`);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Report generation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate report");
    } finally {
      setIsGenerating(false);
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

  const getSelectedProductName = (): string => {
    if (selectedProductId === "all") return "All Products";
    const product = products.find((p) => p._id === selectedProductId);
    return product?.name || "Selected Product";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">Generate Stock Report</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Select filters to generate stock entry report
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Report Type <span className="text-red-500">*</span>
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
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50/50"
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

          <div>
            <Label className="text-sm font-medium mb-2 block">Product (Optional)</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Products {categoryId ? "(in this category)" : ""}
                </SelectItem>
                {products
                  .filter((product) => product.isActive)
                  .map((product) => (
                    <SelectItem key={product._id} value={product._id}>
                      {product.name}
                      {product.size && ` (${product.size})`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {categoryId 
                ? "Showing products from selected category only" 
                : "Leave as 'All Products' to include all stock entries"}
            </p>
          </div>

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

          {reportType && (
            <div className="bg-gray-50 rounded-lg p-4 border animate-in fade-in duration-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Report Preview</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Date Range:</span> {getDateRangeDescription()}
                </p>
                <p>
                  <span className="font-medium">Product:</span> {getSelectedProductName()}
                </p>
                <p>
                  <span className="font-medium">Format:</span> {exportFormat.toUpperCase()}
                </p>
                {categoryId && (
                  <p>
                    <span className="font-medium">Scope:</span> Current category only
                  </p>
                )}
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
            className="bg-green-600 hover:bg-green-700 text-white"
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
}// // components/modals/stock-report-modal.tsx
// "use client";

// import { useState, useEffect } from "react";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import {
//   Calendar,
//   ArrowRightLeft,
//   List,
//   Download,
//   Loader2,
//   FileSpreadsheet,
//   CalendarDays,
// } from "lucide-react";
// import { toast } from "sonner";
// import { cn } from "@/lib/utils";

// import type { Product } from "@/types/product";

// // =============================================
// // Type Definitions
// // =============================================
// type ReportType = "today" | "specific" | "range" | "all";
// type ExportFormat = "csv" | "pdf" | "excel";

// interface StockReportModalProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   products: Product[];
//   preSelectedProductId?: string | null;
// }

// interface ReportTypeOption {
//   type: ReportType;
//   label: string;
//   description: string;
//   icon: React.ReactNode;
// }

// // =============================================
// // Component
// // =============================================
// export default function StockReportModal({
//   open,
//   onOpenChange,
//   products,
//   preSelectedProductId = null,
// }: StockReportModalProps) {
//   // State
//   const [reportType, setReportType] = useState<ReportType | null>(null);
//   const [selectedProductId, setSelectedProductId] = useState<string>("all");
//   const [specificDate, setSpecificDate] = useState<string>("");
//   const [fromDate, setFromDate] = useState<string>("");
//   const [toDate, setToDate] = useState<string>("");
//   const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
//   const [isGenerating, setIsGenerating] = useState(false);

//   // Set default dates and pre-selected product when modal opens
//   useEffect(() => {
//     if (open) {
//       const today = new Date().toISOString().split("T")[0];
//       setSpecificDate(today);
//       setFromDate(today);
//       setToDate(today);
//       setSelectedProductId(preSelectedProductId || "all");
//       setReportType(null);
//       setExportFormat("csv");
//     }
//   }, [open, preSelectedProductId]);

//   // Report type options
//   const reportTypeOptions: ReportTypeOption[] = [
//     {
//       type: "today",
//       label: "Today",
//       description: "Today's entries",
//       icon: <Calendar className="w-4 h-4" />,
//     },
//     {
//       type: "specific",
//       label: "Specific Date",
//       description: "Pick a date",
//       icon: <CalendarDays className="w-4 h-4" />,
//     },
//     {
//       type: "range",
//       label: "Date Range",
//       description: "From - To",
//       icon: <ArrowRightLeft className="w-4 h-4" />,
//     },
//     {
//       type: "all",
//       label: "All Entries",
//       description: "Complete history",
//       icon: <List className="w-4 h-4" />,
//     },
//   ];

//   // Validation
//   const isFormValid = (): boolean => {
//     if (!reportType) return false;
//     if (reportType === "specific" && !specificDate) return false;
//     if (reportType === "range") {
//       if (!fromDate || !toDate) return false;
//       if (new Date(fromDate) > new Date(toDate)) return false;
//     }
//     return true;
//   };

//   // Get date range description for confirmation
//   const getDateRangeDescription = (): string => {
//     switch (reportType) {
//       case "today":
//         return `Today (${new Date().toLocaleDateString("en-GB")})`;
//       case "specific":
//         return new Date(specificDate).toLocaleDateString("en-GB");
//       case "range":
//         return `${new Date(fromDate).toLocaleDateString("en-GB")} - ${new Date(toDate).toLocaleDateString("en-GB")}`;
//       case "all":
//         return "All time";
//       default:
//         return "";
//     }
//   };

//   // Handle report generation
//   const handleGenerateReport = async () => {
//     if (!isFormValid()) {
//       toast.error("Please fill in all required fields");
//       return;
//     }

//     setIsGenerating(true);

//     try {
//       // Build query parameters
//       const params = new URLSearchParams();
//       params.append("reportType", reportType!);
//       params.append("format", exportFormat);

//       if (selectedProductId !== "all") {
//         params.append("productId", selectedProductId);
//       }

//       switch (reportType) {
//         case "today":
//           params.append("date", new Date().toISOString().split("T")[0]);
//           break;
//         case "specific":
//           params.append("date", specificDate);
//           break;
//         case "range":
//           params.append("fromDate", fromDate);
//           params.append("toDate", toDate);
//           break;
//       }

//       // Make API call
//       const response = await fetch(`/api/stock-transactions/report?${params}`);

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.error?.message || "Failed to generate report");
//       }

//       // Handle PDF format (returns JSON for client-side generation)
//       if (exportFormat === "pdf") {
//         const jsonData = await response.json();
//         if (jsonData.success) {
//           // Here you would use a PDF library like jsPDF or react-pdf
//           // For now, we'll download as JSON
//           const blob = new Blob([JSON.stringify(jsonData.data, null, 2)], {
//             type: "application/json",
//           });
//           downloadBlob(blob, `stock-report-${reportType}.json`);
//           toast.success("Report data generated! (PDF generation requires additional setup)");
//         }
//       } else {
//         // Handle CSV/Excel (returns blob)
//         const blob = await response.blob();
//         const contentDisposition = response.headers.get("Content-Disposition");
//         const filename = contentDisposition
//           ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
//           : `stock-report-${reportType}-${new Date().toISOString().split("T")[0]}.${exportFormat === "excel" ? "xlsx" : "csv"}`;

//         downloadBlob(blob, filename);
//         toast.success(`Stock report downloaded successfully! (${exportFormat.toUpperCase()})`);
//       }

//       onOpenChange(false);
//     } catch (error) {
//       console.error("Report generation error:", error);
//       toast.error(error instanceof Error ? error.message : "Failed to generate report");
//     } finally {
//       setIsGenerating(false);
//     }
//   };

//   // Helper to download blob
//   const downloadBlob = (blob: Blob, filename: string) => {
//     const url = window.URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.href = url;
//     link.download = filename;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     window.URL.revokeObjectURL(url);
//   };

//   // Get selected product name
//   const getSelectedProductName = (): string => {
//     if (selectedProductId === "all") return "All Products";
//     const product = products.find((p) => p._id === selectedProductId);
//     return product?.name || "Selected Product";
//   };

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="sm:max-w-lg">
//         <DialogHeader>
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
//               <FileSpreadsheet className="w-5 h-5 text-green-600" />
//             </div>
//             <div>
//               <DialogTitle className="text-lg">Generate Stock Report</DialogTitle>
//               <p className="text-sm text-muted-foreground mt-0.5">
//                 Select filters to generate stock entry report
//               </p>
//             </div>
//           </div>
//         </DialogHeader>

//         <div className="space-y-5 py-4">
//           {/* Report Type Selection */}
//           <div>
//             <Label className="text-sm font-medium mb-3 block">
//               Report Type <span className="text-red-500">*</span>
//             </Label>
//             <div className="grid grid-cols-2 gap-3">
//               {reportTypeOptions.map(({ type, label, description, icon }) => (
//                 <button
//                   key={type}
//                   type="button"
//                   onClick={() => setReportType(type)}
//                   className={cn(
//                     "flex flex-col items-center justify-center gap-1 px-4 py-3 border-2 rounded-xl transition-all text-sm",
//                     reportType === type
//                       ? "border-green-500 bg-green-50 text-green-700"
//                       : "border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50/50"
//                   )}
//                 >
//                   <div className="flex items-center gap-2 font-medium">
//                     {icon}
//                     {label}
//                   </div>
//                   <span className="text-xs text-muted-foreground">{description}</span>
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* Specific Date Input */}
//           {reportType === "specific" && (
//             <div className="animate-in fade-in slide-in-from-top-2 duration-200">
//               <Label htmlFor="specificDate" className="text-sm font-medium mb-2 block">
//                 Select Date <span className="text-red-500">*</span>
//               </Label>
//               <Input
//                 id="specificDate"
//                 type="date"
//                 value={specificDate}
//                 onChange={(e) => setSpecificDate(e.target.value)}
//                 max={new Date().toISOString().split("T")[0]}
//                 className="w-full"
//               />
//             </div>
//           )}

//           {/* Date Range Inputs */}
//           {reportType === "range" && (
//             <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
//               <div>
//                 <Label htmlFor="fromDate" className="text-sm font-medium mb-2 block">
//                   From Date <span className="text-red-500">*</span>
//                 </Label>
//                 <Input
//                   id="fromDate"
//                   type="date"
//                   value={fromDate}
//                   onChange={(e) => setFromDate(e.target.value)}
//                   max={toDate || new Date().toISOString().split("T")[0]}
//                   className="w-full"
//                 />
//               </div>
//               <div>
//                 <Label htmlFor="toDate" className="text-sm font-medium mb-2 block">
//                   To Date <span className="text-red-500">*</span>
//                 </Label>
//                 <Input
//                   id="toDate"
//                   type="date"
//                   value={toDate}
//                   onChange={(e) => setToDate(e.target.value)}
//                   min={fromDate}
//                   max={new Date().toISOString().split("T")[0]}
//                   className="w-full"
//                 />
//               </div>
//               {fromDate && toDate && new Date(fromDate) > new Date(toDate) && (
//                 <p className="text-sm text-red-500">From date cannot be after To date</p>
//               )}
//             </div>
//           )}

//           {/* Product Selection */}
//           <div>
//             <Label className="text-sm font-medium mb-2 block">Product (Optional)</Label>
//             <Select value={selectedProductId} onValueChange={setSelectedProductId}>
//               <SelectTrigger>
//                 <SelectValue placeholder="All Products" />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="all">All Products</SelectItem>
//                 {products
//                   .filter((product) => product.isActive)
//                   .map((product) => (
//                     <SelectItem key={product._id} value={product._id}>
//                       {product.name}
//                       {product.size && ` (${product.size})`}
//                     </SelectItem>
//                   ))}
//               </SelectContent>
//             </Select>
//             <p className="text-xs text-muted-foreground mt-1">
//               Leave as "All Products" to include all stock entries
//             </p>
//           </div>

//           {/* Export Format */}
//           <div>
//             <Label className="text-sm font-medium mb-2 block">Export Format</Label>
//             <RadioGroup
//               value={exportFormat}
//               onValueChange={(value) => setExportFormat(value as ExportFormat)}
//               className="flex gap-6"
//             >
//               <div className="flex items-center gap-2">
//                 <RadioGroupItem value="csv" id="format-csv" />
//                 <Label htmlFor="format-csv" className="text-sm cursor-pointer font-normal">
//                   CSV
//                 </Label>
//               </div>
//               <div className="flex items-center gap-2">
//                 <RadioGroupItem value="excel" id="format-excel" />
//                 <Label htmlFor="format-excel" className="text-sm cursor-pointer font-normal">
//                   Excel
//                 </Label>
//               </div>
//               <div className="flex items-center gap-2">
//                 <RadioGroupItem value="pdf" id="format-pdf" />
//                 <Label htmlFor="format-pdf" className="text-sm cursor-pointer font-normal">
//                   PDF
//                 </Label>
//               </div>
//             </RadioGroup>
//           </div>

//           {/* Preview Summary */}
//           {reportType && (
//             <div className="bg-gray-50 rounded-lg p-4 border animate-in fade-in duration-200">
//               <h4 className="text-sm font-medium text-gray-900 mb-2">Report Preview</h4>
//               <div className="space-y-1 text-sm text-gray-600">
//                 <p>
//                   <span className="font-medium">Date Range:</span> {getDateRangeDescription()}
//                 </p>
//                 <p>
//                   <span className="font-medium">Product:</span> {getSelectedProductName()}
//                 </p>
//                 <p>
//                   <span className="font-medium">Format:</span> {exportFormat.toUpperCase()}
//                 </p>
//               </div>
//             </div>
//           )}
//         </div>

//         <DialogFooter className="gap-2 sm:gap-0">
//           <Button
//             type="button"
//             variant="outline"
//             onClick={() => onOpenChange(false)}
//             disabled={isGenerating}
//           >
//             Cancel
//           </Button>
//           <Button
//             type="button"
//             onClick={handleGenerateReport}
//             disabled={!isFormValid() || isGenerating}
//             className="bg-green-600 hover:bg-green-700 text-white"
//           >
//             {isGenerating ? (
//               <>
//                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                 Generating...
//               </>
//             ) : (
//               <>
//                 <Download className="w-4 h-4 mr-2" />
//                 Generate Report
//               </>
//             )}
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }