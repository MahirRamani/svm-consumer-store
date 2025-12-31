// =============================================
// app/api/balance-report/route.ts - Using ExcelJS (SECURE)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/db";
import { Transaction } from "@/models/Transaction";
import mongoose from "mongoose";
import ExcelJS from "exceljs";

interface BalanceReportFilter {
  studentId?: mongoose.Types.ObjectId;
  transactionType?: { $in: string[] };
  status: string;
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
}

interface PopulatedTransaction {
  _id: mongoose.Types.ObjectId;
  studentId: {
    _id: mongoose.Types.ObjectId;
    name: string;
    rollNumber: string;
    standard: string;
    year: number;
  } | null;
  transactionType: "Purchase" | "Topup" | "Deduction";
  totalAmount: number;
  reason?: string;
  status: string;
  performedBy?: {
    _id: mongoose.Types.ObjectId;
    username?: string;
  } | null;
  createdAt: Date;
}

interface ReportRow {
  Date: string;
  Time: string;
  "Student Name": string;
  "Roll Number": string;
  Standard: string;
  Year: number;
  "Transaction Type": string;
  "Amount (₹)": number;
  Reason: string;
  "Performed By": string;
}

interface ReportSummary {
  totalEntries: number;
  totalPurchases: number;
  totalTopups: number;
  totalDeductions: number;
  purchaseAmount: number;
  topupAmount: number;
  deductionAmount: number;
  netAmount: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const reportType = searchParams.get("reportType") as "today" | "specific" | "range" | "all";
    const format = searchParams.get("format") || "csv";
    const studentId = searchParams.get("studentId");
    const transactionType = searchParams.get("transactionType") || "all";
    const date = searchParams.get("date");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const filter: BalanceReportFilter = { status: "Completed" };

    if (transactionType === "topup") {
      filter.transactionType = { $in: ["Topup"] };
    } else if (transactionType === "deduction") {
      filter.transactionType = { $in: ["Deduction"] };
    } else {
      filter.transactionType = { $in: ["Purchase", "Topup", "Deduction"] };
    }

    if (studentId && studentId !== "all") {
      filter.studentId = new mongoose.Types.ObjectId(studentId);
    }

    const now = new Date();
    switch (reportType) {
      case "today": {
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        filter.createdAt = { $gte: todayStart, $lte: todayEnd };
        break;
      }
      case "specific": {
        if (date) {
          const specificStart = new Date(date);
          specificStart.setHours(0, 0, 0, 0);
          const specificEnd = new Date(date);
          specificEnd.setHours(23, 59, 59, 999);
          filter.createdAt = { $gte: specificStart, $lte: specificEnd };
        }
        break;
      }
      case "range": {
        if (fromDate && toDate) {
          const rangeStart = new Date(fromDate);
          rangeStart.setHours(0, 0, 0, 0);
          const rangeEnd = new Date(toDate);
          rangeEnd.setHours(23, 59, 59, 999);
          filter.createdAt = { $gte: rangeStart, $lte: rangeEnd };
        }
        break;
      }
    }

    const transactions = await Transaction.find(filter)
      .populate({
        path: "studentId",
        select: "name rollNumber standard year",
      })
      .populate({
        path: "performedBy",
        select: "name username email",
      })
      .sort({ createdAt: -1 })
      .lean<PopulatedTransaction[]>();

    const reportData: ReportRow[] = transactions.map((transaction) => {
      const transactionDate = new Date(transaction.createdAt);
      
      let performedByName = "System";
      if (transaction.performedBy) {
        if (typeof transaction.performedBy === 'object' && '_id' in transaction.performedBy) {
          performedByName = transaction.performedBy.username || "System";
        }
      }

      return {
        "Date": transactionDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        "Time": transactionDate.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        "Student Name": transaction.studentId?.name || "Unknown Student",
        "Roll Number": transaction.studentId?.rollNumber || "N/A",
        "Standard": transaction.studentId?.standard || "N/A",
        "Year": transaction.studentId?.year || 0,
        "Transaction Type": transaction.transactionType,
        "Amount (₹)": transaction.totalAmount,
        "Reason": transaction.reason || (transaction.transactionType === "Purchase" ? "Store Purchase" : "-"),
        "Performed By": performedByName,
      };
    });

    const summary = calculateSummary(reportData);

    // CSV FORMAT
    if (format === "csv") {
      const csvContent = generateCSV(reportData, summary, reportType, transactionType);
      const filename = generateFilename(reportType, studentId, transactionType, "csv");
      
      const BOM = "\uFEFF";
      const csvWithBOM = BOM + csvContent;

      return new NextResponse(csvWithBOM, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // EXCEL FORMAT - Using ExcelJS
    if (format === "excel") {
      const excelBuffer = await generateExcel(reportData, summary, reportType, transactionType);
      const filename = generateFilename(reportType, studentId, transactionType, "xlsx");
      
      return new NextResponse(Buffer.from(excelBuffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // PDF/JSON FORMAT
    return NextResponse.json({
      success: true,
      data: {
        reportType,
        transactionType,
        generatedAt: new Date().toISOString(),
        totalEntries: reportData.length,
        entries: reportData,
        summary,
      },
    });
  } catch (error) {
    console.error("Balance report generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Failed to generate balance report",
        },
      },
      { status: 500 }
    );
  }
}

// =============================================
// Helper Functions
// =============================================

function generateCSV(
  data: ReportRow[], 
  summary: ReportSummary, 
  reportType: string, 
  transactionType: string
): string {
  if (data.length === 0) {
    return "No data available";
  }

  const headers = Object.keys(data[0]);
  
  const rows = data.map((row) =>
    headers.map((header) => {
      const value = row[header as keyof ReportRow];
      if (typeof value === 'string') {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(",")
  );

  const summaryRows = [
    "",
    "",
    "SUMMARY",
    `Report Type,${reportType}`,
    `Transaction Filter,${transactionType}`,
    "",
    `Total Entries,${summary.totalEntries}`,
    `Total Purchases,${summary.totalPurchases}`,
    `Total Top-ups,${summary.totalTopups}`,
    `Total Deductions,${summary.totalDeductions}`,
    "",
    `Purchase Amount (₹),${summary.purchaseAmount.toFixed(2)}`,
    `Top-up Amount (₹),${summary.topupAmount.toFixed(2)}`,
    `Deduction Amount (₹),${summary.deductionAmount.toFixed(2)}`,
    "",
    `Net Amount (₹),${summary.netAmount.toFixed(2)}`,
  ];

  return [headers.join(","), ...rows, ...summaryRows].join("\n");
}

async function generateExcel(
  data: ReportRow[], 
  summary: ReportSummary, 
  reportType: string, 
  transactionType: string
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Balance Report");

  // Set column widths
  worksheet.columns = [
    { key: "Date", width: 20 },
    { key: "Time", width: 10 },
    { key: "Student Name", width: 30 },
    { key: "Roll Number", width: 15 },
    { key: "Standard", width: 12 },
    { key: "Year", width: 8 },
    { key: "Transaction Type", width: 18 },
    { key: "Amount", width: 15 },
    { key: "Reason", width: 15 },
    { key: "Performed By", width: 20 },
  ];

  // Add header row with styling
  const headerRow = worksheet.addRow([
    "Date",
    "Time",
    "Student Name",
    "Roll Number",
    "Standard",
    "Year",
    "Transaction Type",
    "Amount (₹)",
    "Reason",
    "Performed By",
  ]);

  // Apply styling to each cell individually
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  headerRow.height = 20;

  // Add data rows
  data.forEach((row) => {
    const dataRow = worksheet.addRow([
      row.Date,
      row.Time,
      row["Student Name"],
      row["Roll Number"],
      row.Standard,
      row.Year,
      row["Transaction Type"],
      row["Amount (₹)"],
      row.Reason,
      row["Performed By"],
    ]);

    // Apply center vertical and middle alignment to all cells except amount
    dataRow.eachCell((cell, colNumber) => {
      if (colNumber !== 8) { // Not the amount column
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });

    // Color code only the transaction type cell (not entire row)
    const typeCell = dataRow.getCell(7);
    if (row["Transaction Type"] === "Purchase") {
      typeCell.font = { color: { argb: "FFFF6B35" }, bold: true };
      // typeCell.fill = {
      //   type: "pattern",
      //   pattern: "solid",
      //   fgColor: { argb: "FFFFE6DC" }, // Light orange background
      // };
    } else if (row["Transaction Type"] === "Topup") {
      typeCell.font = { color: { argb: "FF00A878" }, bold: true };
      // typeCell.fill = {
      //   type: "pattern",
      //   pattern: "solid",
      //   fgColor: { argb: "FFD4F4E8" }, // Light green background
      // };
    } else if (row["Transaction Type"] === "Deduction") {
      typeCell.font = { color: { argb: "FFDC3545" }, bold: true };
      // typeCell.fill = {
      //   type: "pattern",
      //   pattern: "solid",
      //   fgColor: { argb: "FFFFD6DA" }, // Light red background
      // };
    }
    typeCell.alignment = { vertical: "middle", horizontal: "center" };

    // Format amount column - right aligned
    const amountCell = dataRow.getCell(8);
    amountCell.numFmt = '#,##0.00';
    amountCell.alignment = { vertical: "middle", horizontal: "right" };
  });

  // Add summary section
  const summaryStartRow = worksheet.rowCount + 3;
  
  // Summary title
  const summaryTitleRow = worksheet.getRow(summaryStartRow);
  summaryTitleRow.getCell(1).value = "SUMMARY";
  summaryTitleRow.getCell(1).font = { bold: true, size: 14 };
  summaryTitleRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7E6E6" },
  };
  summaryTitleRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  worksheet.mergeCells(summaryStartRow, 1, summaryStartRow, 2);

  // Summary data
  let currentRow = summaryStartRow + 1;
  
  const addSummaryRow = (label: string, value: string | number, isBold = false) => {
    const row = worksheet.getRow(currentRow);
    const labelCell = row.getCell(1);
    const valueCell = row.getCell(2);
    
    labelCell.value = label;
    valueCell.value = value;
    
    // Left align labels, right align values
    if (label == "Purchase Amount (₹):" || label == "Top-up Amount (₹):" || label == "Deduction Amount (₹):") {
      valueCell.alignment = { vertical: "middle", horizontal: "right" };
    } else {
      valueCell.alignment = { vertical: "middle", horizontal: "center" };
    }
    
    if (isBold) {
      labelCell.font = { bold: true };
      valueCell.font = { bold: true };
    }
    currentRow++;
  };

  addSummaryRow("Report Type:", reportType);
  addSummaryRow("Transaction Filter:", transactionType);
  currentRow++; // Empty row

  addSummaryRow("Total Transactions:", summary.totalEntries, true);
  addSummaryRow("Total Purchases:", summary.totalPurchases);
  addSummaryRow("Total Top-ups:", summary.totalTopups);
  addSummaryRow("Total Deductions:", summary.totalDeductions);
  currentRow++; // Empty row

  addSummaryRow("Purchase Amount (₹):", summary.purchaseAmount.toFixed(2));
  addSummaryRow("Top-up Amount (₹):", summary.topupAmount.toFixed(2));
  addSummaryRow("Deduction Amount (₹):", summary.deductionAmount.toFixed(2));
  currentRow++; // Empty row

  const netRow = worksheet.getRow(currentRow);
  const netLabelCell = netRow.getCell(1);
  const netValueCell = netRow.getCell(2);
  
  netLabelCell.value = "Net Amount (₹):";
  netValueCell.value = summary.netAmount.toFixed(2);
  
  netLabelCell.font = { bold: true, size: 12 };
  netValueCell.font = { bold: true, size: 12 };
  
  netLabelCell.alignment = { vertical: "middle", horizontal: "left" };
  netValueCell.alignment = { vertical: "middle", horizontal: "right" };
  
  // Only color the value cell, not the label
  netValueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: summary.netAmount >= 0 ? "FFC6EFCE" : "FFFFC7CE" },
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

function generateFilename(
  reportType: string,
  studentId: string | null,
  transactionType: string,
  extension: string
): string {
  const dateStr = new Date().toISOString().split("T")[0];
  const studentSuffix = studentId && studentId !== "all" ? `-student` : "-all-students";
  const typeSuffix = transactionType !== "all" ? `-${transactionType}` : "";
  return `balance-report-${reportType}${typeSuffix}${studentSuffix}-${dateStr}.${extension}`;
}

function calculateSummary(data: ReportRow[]): ReportSummary {
  return data.reduce(
    (acc, row) => {
      acc.totalEntries++;

      if (row["Transaction Type"] === "Purchase") {
        acc.totalPurchases++;
        acc.purchaseAmount += row["Amount (₹)"];
      } else if (row["Transaction Type"] === "Topup") {
        acc.totalTopups++;
        acc.topupAmount += row["Amount (₹)"];
      } else if (row["Transaction Type"] === "Deduction") {
        acc.totalDeductions++;
        acc.deductionAmount += row["Amount (₹)"];
      }

      acc.netAmount = acc.topupAmount - acc.deductionAmount - acc.purchaseAmount;

      return acc;
    },
    {
      totalEntries: 0,
      totalPurchases: 0,
      totalTopups: 0,
      totalDeductions: 0,
      purchaseAmount: 0,
      topupAmount: 0,
      deductionAmount: 0,
      netAmount: 0,
    } as ReportSummary
  );
}