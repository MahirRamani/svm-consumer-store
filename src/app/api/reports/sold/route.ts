// app/api/reports/sold/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/db";
import { Transaction } from "@/models/Transaction";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { StockTransaction } from "@/models/StockTransaction";
import type {
  SoldProduct,
  SoldBatch,
  SoldReportResponse,
  SoldReportSummary,
} from "@/lib/types/reports";

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation result types
// ─────────────────────────────────────────────────────────────────────────────

interface AggregatedSoldItem {
  productId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId | null;
  stockTransactionId: mongoose.Types.ObjectId | null;
  totalQtySold: number;
  totalRevenue: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/sold?date=YYYY-MM-DD&categoryId=...
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;

    // ── Parse date ────────────────────────────────────────────────────────────
    const dateParam = searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date parameter. Use YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // ── Optional category filter ───────────────────────────────────────────────
    const categoryIdParam = searchParams.get("categoryId");
    let productIdsInCategory: mongoose.Types.ObjectId[] | null = null;

    if (categoryIdParam && mongoose.Types.ObjectId.isValid(categoryIdParam)) {
      const products = await Product.find({
        categoryId: new mongoose.Types.ObjectId(categoryIdParam),
        isActive: true,
      }).select("_id");

      productIdsInCategory = products.map(
        (p) => p._id as mongoose.Types.ObjectId
      );

      // If no products exist in this category, return empty
      if (productIdsInCategory.length === 0) {
        return NextResponse.json({
          data: [],
          summary: {
            totalProducts: 0,
            totalUnitsSold: 0,
            totalRevenue: 0,
            date: dayStart.toISOString(),
          },
        } satisfies SoldReportResponse);
      }
    }

    // ── Build match stage ─────────────────────────────────────────────────────
    const matchStage: Record<string, unknown> = {
      status: "Completed",
      type: { $in: ["Purchase"] },
      createdAt: { $gte: dayStart, $lte: dayEnd },
    };

    // ── Aggregate: unwind items, group by product + stockTransaction ──────────
    const pipeline: mongoose.PipelineStage[] = [
      { $match: matchStage },
      { $unwind: "$items" },
      // Filter by category if provided
      ...(productIdsInCategory
        ? [
            {
              $match: {
                "items.productId": { $in: productIdsInCategory },
              },
            } as mongoose.PipelineStage,
          ]
        : []),
      {
        $group: {
          _id: {
            productId: "$items.productId",
            categoryId: "$items.categoryId",
            stockTransactionId: "$items.stockTransactionId",
          },
          totalQtySold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.totalPrice" },
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$_id.productId",
          categoryId: "$_id.categoryId",
          stockTransactionId: "$_id.stockTransactionId",
          totalQtySold: 1,
          totalRevenue: 1,
        },
      },
    ];

    const aggregated =
      await Transaction.aggregate<AggregatedSoldItem>(pipeline);

    if (aggregated.length === 0) {
      return NextResponse.json({
        data: [],
        summary: {
          totalProducts: 0,
          totalUnitsSold: 0,
          totalRevenue: 0,
          date: dayStart.toISOString(),
        },
      } satisfies SoldReportResponse);
    }

    // ── Batch-fetch Product, Category, StockTransaction names ────────────────
    const uniqueProductIds = [
      ...new Set(aggregated.map((r) => r.productId?.toString()).filter(Boolean)),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const uniqueCategoryIds = [
      ...new Set(
        aggregated
          .map((r) => r.categoryId?.toString())
          .filter(Boolean) as string[]
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const uniqueStockTxIds = [
      ...new Set(
        aggregated
          .map((r) => r.stockTransactionId?.toString())
          .filter(Boolean) as string[]
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const [products, categories, stockTxs] = await Promise.all([
      Product.find({ _id: { $in: uniqueProductIds } }).select(
        "_id name categoryId"
      ),
      Category.find({ _id: { $in: uniqueCategoryIds } }).select("_id name"),
      StockTransaction.find({ _id: { $in: uniqueStockTxIds } }).select(
        "_id buyingPrice purchaseDate"
      ),
    ]);

    // ── Build lookup maps ─────────────────────────────────────────────────────
    const productMap = new Map(
      products.map((p) => [
        p._id.toString(),
        { name: p.name, categoryId: p.categoryId?.toString() },
      ])
    );

    const categoryMap = new Map(
      categories.map((c) => [c._id.toString(), c.name as string])
    );

    const stockTxMap = new Map(
      stockTxs.map((st) => [
        st._id.toString(),
        {
          buyingPrice: st.buyingPrice
            ? typeof st.buyingPrice === "object" && "toString" in st.buyingPrice
              ? parseFloat((st.buyingPrice as { toString(): string }).toString())
              : Number(st.buyingPrice)
            : 0,
          purchaseDate: st.purchaseDate?.toISOString() ?? new Date().toISOString(),
        },
      ])
    );

    // ── Group aggregation results by product ──────────────────────────────────
    const productGrouped = new Map<
      string,
      {
        productId: string;
        productName: string;
        categoryId: string;
        categoryName: string;
        totalQtySold: number;
        totalRevenue: number;
        batchMap: Map<string, SoldBatch>;
      }
    >();

    for (const row of aggregated) {
      const pid = row.productId?.toString();
      if (!pid) continue;

      const productInfo = productMap.get(pid);
      const productName = productInfo?.name ?? "Unknown Product";
      const catId =
        row.categoryId?.toString() ?? productInfo?.categoryId ?? "";
      const categoryName = categoryMap.get(catId) ?? "Unknown Category";

      if (!productGrouped.has(pid)) {
        productGrouped.set(pid, {
          productId: pid,
          productName,
          categoryId: catId,
          categoryName,
          totalQtySold: 0,
          totalRevenue: 0,
          batchMap: new Map(),
        });
      }

      const entry = productGrouped.get(pid)!;
      entry.totalQtySold += row.totalQtySold;
      entry.totalRevenue += row.totalRevenue;

      const bid = row.stockTransactionId?.toString();
      if (bid) {
        const stInfo = stockTxMap.get(bid);
        if (!entry.batchMap.has(bid)) {
          entry.batchMap.set(bid, {
            batchId: bid,
            purchaseDate: stInfo?.purchaseDate ?? new Date().toISOString(),
            buyingPrice: stInfo?.buyingPrice ?? 0,
            qtySold: 0,
            revenue: 0,
          });
        }
        const batch = entry.batchMap.get(bid)!;
        batch.qtySold += row.totalQtySold;
        batch.revenue += row.totalRevenue;
      }
    }

    // ── Shape final response ──────────────────────────────────────────────────
    const data: SoldProduct[] = Array.from(productGrouped.values()).map(
      (entry) => ({
        productId: entry.productId,
        productName: entry.productName,
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        totalQtySold: entry.totalQtySold,
        totalRevenue: entry.totalRevenue,
        batches: Array.from(entry.batchMap.values()).sort(
          (a, b) =>
            new Date(a.purchaseDate).getTime() -
            new Date(b.purchaseDate).getTime()
        ),
      })
    );

    // Sort by revenue descending
    data.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const summary: SoldReportSummary = {
      totalProducts: data.length,
      totalUnitsSold: data.reduce((acc, p) => acc + p.totalQtySold, 0),
      totalRevenue: data.reduce((acc, p) => acc + p.totalRevenue, 0),
      date: dayStart.toISOString(),
    };

    return NextResponse.json({ data, summary } satisfies SoldReportResponse);
  } catch (error) {
    console.error("[/api/reports/sold] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sold products report" },
      { status: 500 }
    );
  }
}