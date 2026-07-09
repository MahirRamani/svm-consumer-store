// app/api/stock-transactions/report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/config/db';
import { StockTransaction } from '@/models';
import { Product } from '@/models';
import { Category } from '@/models';
import mongoose from 'mongoose';

interface StockReportFilter {
  productId?: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId; // NEW: Add categoryId to filter
  purchaseDate?: {
    $gte?: Date;
    $lte?: Date;
  };
}

interface PopulatedStockTransaction {
  _id: mongoose.Types.ObjectId;
  productId: {
    _id: mongoose.Types.ObjectId;
    name: string;
    size?: string;
    barcode?: string;
  };
  categoryId?: {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
  stockType: "Buy" | "Sell" | "Adjustment";
  buyingPrice: number;
  sellingPrice: number;
  initialQuantity: number;
  quantityLeft: number;
  reason?: string;
  notes?: string;
  purchaseDate: Date;
  createdAt: Date;
}

interface ReportRow {
  date: string;
  productName: string;
  productSize: string;
  category: string;
  stockType: string;
  initialQuantity: number;
  quantityLeft: number;
  buyingPrice: number;
  sellingPrice: number;
  totalValue: number;
  reason: string;
  notes: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;

    const reportType = searchParams.get("reportType") as "today" | "specific" | "range" | "all";
    const format = searchParams.get("format") || "csv";
    const productId = searchParams.get("productId");
    const categoryId = searchParams.get("categoryId"); // NEW: Get categoryId from params
    const date = searchParams.get("date");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // Build filter query
    const filter: StockReportFilter = {};

    // Product filter (takes precedence over category)
    if (productId && productId !== "all") {
      filter.productId = new mongoose.Types.ObjectId(productId);
    }
    // NEW: Category filter (only if no specific product is selected)
    else if (categoryId && categoryId !== "all") {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    // Date filter based on report type
    const now = new Date();

    switch (reportType) {
      case "today": {
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        filter.purchaseDate = { $gte: todayStart, $lte: todayEnd };
        break;
      }

      case "specific": {
        if (date) {
          const specificStart = new Date(date);
          specificStart.setHours(0, 0, 0, 0);
          const specificEnd = new Date(date);
          specificEnd.setHours(23, 59, 59, 999);
          filter.purchaseDate = { $gte: specificStart, $lte: specificEnd };
        }
        break;
      }

      case "range": {
        if (fromDate && toDate) {
          const rangeStart = new Date(fromDate);
          rangeStart.setHours(0, 0, 0, 0);
          const rangeEnd = new Date(toDate);
          rangeEnd.setHours(23, 59, 59, 999);
          filter.purchaseDate = { $gte: rangeStart, $lte: rangeEnd };
        }
        break;
      }

      case "all":
      default:
        // No date filter - fetch all entries
        break;
    }

    // Fetch stock transactions with populated data
    const stockTransactions = await StockTransaction.find(filter)
      .populate<{ productId: PopulatedStockTransaction["productId"] }>(
        "productId",
        "name size barcode"
      )
      .populate<{ categoryId: PopulatedStockTransaction["categoryId"] }>(
        "categoryId",
        "name"
      )
      .sort({ purchaseDate: -1 })
      .lean<PopulatedStockTransaction[]>();

    // Process data for report
    const reportData: ReportRow[] = stockTransactions.map((transaction) => {
      const productName = transaction.productId?.name || "Unknown Product";
      const productSize = transaction.productId?.size || "N/A";
      const categoryName = transaction.categoryId?.name || "Uncategorized";

      return {
        date: new Date(transaction.purchaseDate).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        productName,
        productSize,
        category: categoryName,
        stockType: transaction.stockType,
        initialQuantity: transaction.initialQuantity,
        quantityLeft: transaction.quantityLeft,
        buyingPrice: transaction.buyingPrice || 0,
        sellingPrice: transaction.sellingPrice || 0,
        totalValue:
          transaction.stockType === "Buy"
            ? transaction.initialQuantity * (transaction.buyingPrice || 0)
            : transaction.initialQuantity * (transaction.sellingPrice || 0),
        reason: transaction.reason || "",
        notes: transaction.notes || "",
      };
    });

    // Generate report based on format
    if (format === "csv") {
      const csvContent = generateCSV(reportData, reportType);
      const filename = generateFilename(reportType, productId, categoryId, "csv");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "excel") {
      const csvContent = generateCSV(reportData, reportType);
      const filename = generateFilename(reportType, productId, categoryId, "xlsx");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "pdf") {
      return NextResponse.json({
        success: true,
        data: {
          reportType,
          generatedAt: new Date().toISOString(),
          totalEntries: reportData.length,
          entries: reportData,
          summary: calculateSummary(reportData),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        reportType,
        generatedAt: new Date().toISOString(),
        totalEntries: reportData.length,
        entries: reportData,
        summary: calculateSummary(reportData),
      },
    });
  } catch (error) {
    console.error("Stock report generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Failed to generate stock report",
        },
      },
      { status: 500 }
    );
  }
}

function generateCSV(data: ReportRow[], reportType: string): string {
  const headers = [
    "Date",
    "Product Name",
    "Size",
    "Category",
    "Transaction Type",
    "Initial Qty",
    "Qty Left",
    "Buying Price",
    "Selling Price",
    "Total Value",
    "Reason",
    "Notes",
  ];

  const rows = data.map((row) =>
    [
      row.date,
      `"${row.productName}"`,
      `"${row.productSize}"`,
      `"${row.category}"`,
      row.stockType,
      row.initialQuantity,
      row.quantityLeft,
      Number(row.buyingPrice || 0).toFixed(2),  // Ensure it's a number
      Number(row.sellingPrice || 0).toFixed(2), // Ensure it's a number
      Number(row.totalValue || 0).toFixed(2),   // Ensure it's a number
      `"${row.reason}"`,
      `"${row.notes.replace(/"/g, '""')}"`,
    ].join(",")
  );

  const summary = calculateSummary(data);
  const summaryRows = [
    "",
    "SUMMARY",
    `Total Entries,${summary.totalEntries}`,
    `Total Buy Transactions,${summary.buyCount}`,
    `Total Sell Transactions,${summary.sellCount}`,
    `Total Adjustment Transactions,${summary.adjustmentCount}`,
    `Total Buy Value,${summary.totalBuyValue.toFixed(2)}`,
    `Total Sell Value,${summary.totalSellValue.toFixed(2)}`,
    `Total Quantity In,${summary.totalQuantityIn}`,
    `Total Quantity Out,${summary.totalQuantityOut}`,
    `Current Stock (Qty Left),${summary.currentStock}`,
  ];

  return [headers.join(","), ...rows, ...summaryRows].join("\n");
}

// NEW: Updated to include categoryId
function generateFilename(
  reportType: string,
  productId: string | null,
  categoryId: string | null,
  extension: string
): string {
  const dateStr = new Date().toISOString().split("T")[0];

  let suffix = "";
  if (productId && productId !== "all") {
    suffix = `-product-${productId}`;
  } else if (categoryId && categoryId !== "all") {
    suffix = `-category-${categoryId}`;
  } else {
    suffix = "-all";
  }

  return `stock-report-${reportType}${suffix}-${dateStr}.${extension}`;
}

interface ReportSummary {
  totalEntries: number;
  buyCount: number;
  sellCount: number;
  adjustmentCount: number;
  totalBuyValue: number;
  totalSellValue: number;
  totalQuantityIn: number;
  totalQuantityOut: number;
  currentStock: number;
}

function calculateSummary(data: ReportRow[]): ReportSummary {
  return data.reduce(
    (acc, row) => {
      acc.totalEntries++;

      if (row.stockType === "Buy") {
        acc.buyCount++;
        acc.totalBuyValue += row.totalValue;
        acc.totalQuantityIn += row.initialQuantity;
      } else if (row.stockType === "Sell") {
        acc.sellCount++;
        acc.totalSellValue += row.totalValue;
        acc.totalQuantityOut += row.initialQuantity;
      } else {
        acc.adjustmentCount++;
      }

      acc.currentStock += row.quantityLeft;

      return acc;
    },
    {
      totalEntries: 0,
      buyCount: 0,
      sellCount: 0,
      adjustmentCount: 0,
      totalBuyValue: 0,
      totalSellValue: 0,
      totalQuantityIn: 0,
      totalQuantityOut: 0,
      currentStock: 0,
    } as ReportSummary
  );
}