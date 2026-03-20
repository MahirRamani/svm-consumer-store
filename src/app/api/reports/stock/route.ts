// app/api/reports/stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/db";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { StockTransaction } from "@/models/StockTransaction";
import type {
  StockProduct,
  StockBatch,
  StockStatus,
  StockReportResponse,
  StockReportSummary,
} from "@/lib/types/reports";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/stock?categoryId=...
// Returns remaining stock grouped by product, with batch-level breakdown.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const categoryIdParam = searchParams.get("categoryId");

    // ── Build product filter ──────────────────────────────────────────────────
    const productFilter: Record<string, unknown> = { isActive: true };

    if (categoryIdParam && mongoose.Types.ObjectId.isValid(categoryIdParam)) {
      productFilter.categoryId = new mongoose.Types.ObjectId(categoryIdParam);
    }

    // ── Fetch active products ─────────────────────────────────────────────────
    const products = await Product.find(productFilter).select(
      "_id name categoryId lowStockThreshold"
    );

    if (products.length === 0) {
      return NextResponse.json({
        data: [],
        summary: {
          totalProducts: 0,
          totalUnitsLeft: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        },
      } satisfies StockReportResponse);
    }

    const productIds = products.map((p) => p._id as mongoose.Types.ObjectId);

    // ── Fetch all "Buy" stock transactions for these products ─────────────────
    const stockTxs = await StockTransaction.find({
      productId: { $in: productIds },
      stockType: "Buy",
    })
      .select(
        "_id productId categoryId buyingPrice initialQuantity quantityLeft purchaseDate endedAt"
      )
      .sort({ productId: 1, purchaseDate: 1 })
      .lean();

    // ── Fetch categories ──────────────────────────────────────────────────────
    const uniqueCatIds = [
      ...new Set(
        products
          .map((p) => (p.categoryId as mongoose.Types.ObjectId)?.toString())
          .filter(Boolean)
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const categories = await Category.find({
      _id: { $in: uniqueCatIds },
    }).select("_id name");

    // ── Build lookup maps ─────────────────────────────────────────────────────
    const categoryMap = new Map(
      categories.map((c) => [c._id.toString(), c.name as string])
    );

    const productMap = new Map(
      products.map((p) => [
        (p._id as mongoose.Types.ObjectId).toString(),
        {
          name: p.name as string,
          categoryId: (p.categoryId as mongoose.Types.ObjectId)?.toString() ?? "",
          lowStockThreshold: (p.lowStockThreshold as number) ?? 10,
        },
      ])
    );

    // ── Group stock transactions by productId ─────────────────────────────────
    const productStockMap = new Map<
      string,
      {
        batches: StockBatch[];
        totalInitial: number;
        totalLeft: number;
        totalSold: number;
      }
    >();

    for (const st of stockTxs) {
      const productId = (st.productId as mongoose.Types.ObjectId).toString();

      if (!productStockMap.has(productId)) {
        productStockMap.set(productId, {
          batches: [],
          totalInitial: 0,
          totalLeft: 0,
          totalSold: 0,
        });
      }

      const entry = productStockMap.get(productId)!;

      // Parse buyingPrice — stored as Decimal128
      const buyingPrice =
        st.buyingPrice !== null && st.buyingPrice !== undefined
          ? typeof st.buyingPrice === "object" &&
            "toString" in (st.buyingPrice as object)
            ? parseFloat((st.buyingPrice as { toString(): string }).toString())
            : Number(st.buyingPrice)
          : 0;

      const soldQty = st.initialQuantity - st.quantityLeft;
      const threshold = productMap.get(productId)?.lowStockThreshold ?? 10;

      // Determine batch-level status
      let batchStatus: StockStatus = "ok";
      if (st.quantityLeft === 0) {
        batchStatus = "empty";
      } else if (st.quantityLeft <= threshold) {
        batchStatus = "low";
      }

      const batch: StockBatch = {
        batchId: st._id.toString(),
        purchaseDate:
          st.purchaseDate instanceof Date
            ? st.purchaseDate.toISOString()
            : new Date(st.purchaseDate as Date).toISOString(),
        buyingPrice,
        initialQuantity: st.initialQuantity,
        quantityLeft: st.quantityLeft,
        soldQuantity: soldQty,
        endedAt:
          st.endedAt instanceof Date
            ? st.endedAt.toISOString()
            : st.endedAt
            ? new Date(st.endedAt as Date).toISOString()
            : null,
        status: batchStatus,
      };

      entry.batches.push(batch);
      entry.totalInitial += st.initialQuantity;
      entry.totalLeft += st.quantityLeft;
      entry.totalSold += soldQty;
    }

    // ── Assemble final response ───────────────────────────────────────────────
    const data: StockProduct[] = [];

    for (const product of products) {
      const productId = (product._id as mongoose.Types.ObjectId).toString();
      const info = productMap.get(productId)!;
      const stockEntry = productStockMap.get(productId) ?? {
        batches: [],
        totalInitial: 0,
        totalLeft: 0,
        totalSold: 0,
      };

      // Product-level status
      let stockStatus: StockStatus = "ok";
      if (stockEntry.totalLeft === 0 && stockEntry.totalInitial > 0) {
        stockStatus = "empty";
      } else if (
        stockEntry.totalLeft > 0 &&
        stockEntry.totalLeft <= info.lowStockThreshold
      ) {
        stockStatus = "low";
      }

      data.push({
        productId: productId,
        productName: info.name,
        categoryId: info.categoryId,
        categoryName: categoryMap.get(info.categoryId) ?? "Unknown",
        lowStockThreshold: info.lowStockThreshold,
        totalInitial: stockEntry.totalInitial,
        totalLeft: stockEntry.totalLeft,
        totalSold: stockEntry.totalSold,
        stockStatus,
        batches: stockEntry.batches.sort(
          (b, a) =>
            new Date(a.purchaseDate).getTime() -
            new Date(b.purchaseDate).getTime()
        ),
      });
    }

    // Sort: empty first, then low, then ok; within each group by name
    const statusOrder: Record<StockStatus, number> = {
      empty: 0,
      low: 1,
      ok: 2,
    };
    data.sort((a, b) => {
      // First, compare Category Names
      const catCompare = a.categoryName.localeCompare(b.categoryName);
      
      // If categories are different, return the result
      if (catCompare !== 0) return catCompare;

      // If categories are the same, sort by Product Name
      return a.productName.localeCompare(b.productName);
    });

    const summary: StockReportSummary = {
      totalProducts: data.length,
      totalUnitsLeft: data.reduce((acc, p) => acc + p.totalLeft, 0),
      lowStockCount: data.filter((p) => p.stockStatus === "low").length,
      outOfStockCount: data.filter((p) => p.stockStatus === "empty").length,
    };

    return NextResponse.json({ data, summary } satisfies StockReportResponse);
  } catch (error) {
    console.error("[/api/reports/stock] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock report" },
      { status: 500 }
    );
  }
}