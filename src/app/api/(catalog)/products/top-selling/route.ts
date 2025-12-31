// app/api/products/top-selling/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/config/db";
import { Transaction } from "@/models/Transaction";
import { Product } from "@/models/Product";
import mongoose from "mongoose";

// =============================================
// Type Definitions
// =============================================
interface TopProductAggregation {
  _id: mongoose.Types.ObjectId;
  totalQuantitySold: number;
  totalRevenue: number;
  transactionCount: number;
}

interface PopulatedProduct {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  categoryId: {
    _id: mongoose.Types.ObjectId;
    name: string;
  } | mongoose.Types.ObjectId;
  size?: string;
  weight?: string;
  volume?: string;
  barcode?: string;
  imageURL?: string;
  isActive: boolean;
  lowStockThreshold: number;
}

interface TopProductResponse {
  productId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  size?: string;
  imageURL?: string;
  totalQuantitySold: number;
  totalRevenue: number;
  transactionCount: number;
  isActive: boolean;
  lowStockThreshold: number;
}

// =============================================
// GET - Fetch Top Selling Products
// =============================================
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const period = searchParams.get("period") || "all";

    // Build date filter
    const dateFilter: Record<string, unknown> = {};
    const now = new Date();

    switch (period) {
      case "today": {
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        dateFilter.createdAt = { $gte: todayStart };
        break;
      }
      case "week": {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        weekStart.setHours(0, 0, 0, 0);
        dateFilter.createdAt = { $gte: weekStart };
        break;
      }
      case "month": {
        const monthStart = new Date(now);
        monthStart.setDate(now.getDate() - 30);
        monthStart.setHours(0, 0, 0, 0);
        dateFilter.createdAt = { $gte: monthStart };
        break;
      }
      case "all":
      default:
        // No date filter
        break;
    }

    // Aggregate top selling products from transactions
    const topProducts = await Transaction.aggregate<TopProductAggregation>([
      {
        $match: {
          transactionType: "Purchase",
          status: "Completed",
          ...dateFilter,
        },
      },
      {
        $unwind: "$items",
      },
      {
        $group: {
          _id: "$items.productId",
          totalQuantitySold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.totalPrice" },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalQuantitySold: -1 },
      },
      {
        $limit: limit,
      },
    ]);

    if (topProducts.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          products: [],
          totalCount: 0,
        },
      });
    }

    // Get product details for top products
    const productIds = topProducts.map((p) => p._id);

    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
    })
      .populate("categoryId", "name")
      .lean<PopulatedProduct[]>();

    // Create a map for quick lookup
    const productMap = new Map<string, PopulatedProduct>();
    products.forEach((product) => {
      productMap.set(product._id.toString(), product);
    });

    // Combine aggregation data with product details
    const topProductsWithDetails: TopProductResponse[] = [];

    for (const aggProduct of topProducts) {
      const product = productMap.get(aggProduct._id.toString());
      if (!product) continue;

      let categoryId = "";
      let categoryName = "Uncategorized";

      if (product.categoryId) {
        if (typeof product.categoryId === "object" && "name" in product.categoryId) {
          categoryId = product.categoryId._id.toString();
          categoryName = product.categoryId.name;
        } else {
          categoryId = product.categoryId.toString();
        }
      }

      const topProductItem: TopProductResponse = {
        productId: product._id.toString(),
        name: product.name,
        categoryId,
        categoryName,
        totalQuantitySold: aggProduct.totalQuantitySold,
        totalRevenue: aggProduct.totalRevenue,
        transactionCount: aggProduct.transactionCount,
        isActive: product.isActive,
        lowStockThreshold: product.lowStockThreshold,
      };

      // Add optional properties only if they exist
      if (product.size) {
        topProductItem.size = product.size;
      }
      if (product.imageURL) {
        topProductItem.imageURL = product.imageURL;
      }

      topProductsWithDetails.push(topProductItem);
    }

    return NextResponse.json({
      success: true,
      data: {
        products: topProductsWithDetails,
        totalCount: topProductsWithDetails.length,
        period,
      },
    });
  } catch (error) {
    console.error("Error fetching top selling products:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Failed to fetch top selling products",
        },
      },
      { status: 500 }
    );
  }
}