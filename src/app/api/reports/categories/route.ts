// app/api/reports/categories/route.ts
// Returns a flat list of categories for the filter dropdown.

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/config/db';
import { Category } from '@/models';
import type { CategoryOption } from '@/lib/types/reports';

export async function GET(): Promise<NextResponse> {
  try {
    await dbConnect();

    const categories = await Category.find({ isActive: true })
      .select("_id name")
      .sort({ name: 1 })
      .lean();

    const data: CategoryOption[] = categories.map((c) => ({
      _id: (c._id as { toString(): string }).toString(),
      name: c.name as string,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("[/api/reports/categories] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}