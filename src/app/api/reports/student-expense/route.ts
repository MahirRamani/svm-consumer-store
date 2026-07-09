// app/api/reports/student-expense/route.ts
//
// GET /api/reports/student-expense?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
//
// Columns returned per student:
//   openingBalance  — balance at the START of fromDate
//   topupInPeriod   — sum of Topup transactions in [fromDate, toDate]
//   expenseInPeriod — sum of Purchase/Deduction transactions in [fromDate, toDate]
//   closingBalance  — balance at END of toDate  (= opening + topup - expense)
//   currentBalance  — live balance right now (from Student doc)
//
// Key formula:
//   closingBalance = currentBalance - topupAfterPeriod + expenseAfterPeriod
//   openingBalance = closingBalance - topupInPeriod    + expenseInPeriod

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/config/db';
import { Student } from '@/models';
import { Transaction } from '@/models';
import mongoose from 'mongoose';

interface StudentLean {
  _id: mongoose.Types.ObjectId;
  id?: string;
  rollNumber: string;
  name: string;
  standard: string;
  balance: number;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: "fromDate and toDate are required" },
        { status: 400 }
      );
    }

    // IST offset (+05:30) so midnight means midnight India time, not UTC
    const periodStart = new Date(`${fromDate}T00:00:00+05:30`);
    const periodEnd = new Date(`${toDate}T23:59:59+05:30`);

    // ── 1. Fetch all active students ──────────────────────────────────────
    const students = await Student.find({ isActive: true })
      .select("_id id rollNumber name standard balance")
      .lean<StudentLean[]>();

    if (students.length === 0) {
      return NextResponse.json({
        data: [],
        summary: { totalStudents: 0, totalTopup: 0, totalExpense: 0, totalClosing: 0 },
      });
    }

    const studentObjectIds = students.map((s) => s._id);

    // ── 2. Single aggregation — split into in-period and after-period ─────
    //
    // We fetch all transactions from periodStart onwards (no upper bound).
    // Inside $group we split them into two buckets using $cond on createdAt.
    //
    // This gives us everything we need in one round-trip:
    //   topupInPeriod, expenseInPeriod  → activity during the chosen range
    //   topupAfterPeriod, expAfterPeriod → what to reverse from currentBalance

    const aggregation = await Transaction.aggregate([
      {
        $match: {
          studentId: { $in: studentObjectIds },
          status: "Completed",
          createdAt: { $gte: periodStart },   // everything from period start onwards
        },
      },
      {
        $group: {
          _id: "$studentId",

          // ── In-period: fromDate 00:00 → toDate 23:59 ──────────────────
          topupInPeriod: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$type", "Topup"] },
                    { $lte: ["$createdAt", periodEnd] },
                  ],
                },
                "$totalAmount",
                0,
              ],
            },
          },
          expenseInPeriod: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$type", ["Purchase", "Deduction"]] },
                    { $lte: ["$createdAt", periodEnd] },
                  ],
                },
                "$totalAmount",
                0,
              ],
            },
          },

          // ── After period: after toDate 23:59 ──────────────────────────
          topupAfterPeriod: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$type", "Topup"] },
                    { $gt: ["$createdAt", periodEnd] },
                  ],
                },
                "$totalAmount",
                0,
              ],
            },
          },
          expenseAfterPeriod: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$type", ["Purchase", "Deduction"]] },
                    { $gt: ["$createdAt", periodEnd] },
                  ],
                },
                "$totalAmount",
                0,
              ],
            },
          },
        },
      },
    ]);

    // ── 3. Lookup map: _id string → aggregated buckets ────────────────────
    type TxnBuckets = {
      topupInPeriod: number;
      expenseInPeriod: number;
      topupAfterPeriod: number;
      expenseAfterPeriod: number;
    };
    const txnMap = new Map<string, TxnBuckets>();
    for (const row of aggregation) {
      txnMap.set(String(row._id), {
        topupInPeriod: row.topupInPeriod ?? 0,
        expenseInPeriod: row.expenseInPeriod ?? 0,
        topupAfterPeriod: row.topupAfterPeriod ?? 0,
        expenseAfterPeriod: row.expenseAfterPeriod ?? 0,
      });
    }

    // ── 4. Build response rows ─────────────────────────────────────────────
    const data = students.map((s) => {
      const idStr = String(s._id);
      const {
        topupInPeriod = 0,
        expenseInPeriod = 0,
        topupAfterPeriod = 0,
        expenseAfterPeriod = 0,
      } = txnMap.get(idStr) ?? {};

      const currentBalance = s.balance ?? 0;

      // Step 1: Remove post-period changes to get the balance at end of period
      const closingBalance = currentBalance - topupAfterPeriod + expenseAfterPeriod;

      // Step 2: Remove in-period changes to get the balance at start of period
      const openingBalance = closingBalance - topupInPeriod + expenseInPeriod;

      const round = (n: number) => Math.round(n * 100) / 100;

      return {
        studentId: s.id ?? idStr,
        rollNumber: s.rollNumber,
        name: s.name,
        standard: s.standard,
        currentBalance: round(currentBalance),
        closingBalance: round(closingBalance),   // balance at end of toDate
        openingBalance: round(openingBalance),   // balance at start of fromDate
        topupInPeriod: round(topupInPeriod),
        expenseInPeriod: round(expenseInPeriod),
      };
    });

    const summary = {
      totalStudents: data.length,
      totalTopup: data.reduce((a, r) => a + r.topupInPeriod, 0),
      totalExpense: data.reduce((a, r) => a + r.expenseInPeriod, 0),
      totalClosing: data.reduce((a, r) => a + r.closingBalance, 0),
    };

    return NextResponse.json({ data, summary });
  } catch (err) {
    console.error("[student-expense report]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}





// // app/api/reports/student-expense/route.ts

// import { NextRequest, NextResponse } from 'next/server';
// import dbConnect from '@/lib/config/db';
// import {Student} from '@/models';
// import {Transaction} from '@/models';
// import mongoose from 'mongoose';

// interface StudentLean {
//   _id: mongoose.Types.ObjectId;
//   id?: string;           // custom field — may or may not exist on lean()
//   rollNumber: string;
//   name: string;
//   standard: string;
//   balance: number;
// }

// export async function GET(req: NextRequest) {
//   try {
//     await dbConnect();

//     const { searchParams } = new URL(req.url);
//     const fromDate = searchParams.get("fromDate");
//     const toDate   = searchParams.get("toDate");

//     if (!fromDate || !toDate) {
//       return NextResponse.json(
//         { error: "fromDate and toDate are required" },
//         { status: 400 }
//       );
//     }

//     const from = new Date(`${fromDate}T00:00:00.000Z`);
//     const to   = new Date(`${toDate}T23:59:59.999Z`);

//     // ── 1. Fetch all active students ──────────────────────────────────────
//     // Use _id (always present on lean) + the custom `id` field
//     const students = await Student.find({ isActive: true })
//       .select("_id id rollNumber name standard balance")
//       .lean<StudentLean[]>();

//     if (students.length === 0) {
//       return NextResponse.json({
//         data: [],
//         summary: { totalStudents: 0, totalTopup: 0, totalExpense: 0, totalBalance: 0 },
//       });
//     }

//     // Use _id (ObjectId) for matching against Transaction.studentId
//     const studentObjectIds = students.map((s) => s._id);

//     // ── 2. Aggregate transactions in the date range ───────────────────────
//     const aggregation = await Transaction.aggregate([
//       {
//         $match: {
//           studentId: { $in: studentObjectIds },
//           createdAt: { $gte: from, $lte: to },
//           status: "Completed",
//         },
//       },
//       {
//         $group: {
//           _id: "$studentId",
//           topupInPeriod: {
//             $sum: { $cond: [{ $eq: ["$type", "Topup"] }, "$totalAmount", 0] },
//           },
//           expenseInPeriod: {
//             $sum: {
//               $cond: [
//                 { $in: ["$type", ["Purchase", "Deduction"]] },
//                 "$totalAmount",
//                 0,
//               ],
//             },
//           },
//         },
//       },
//     ]);

//     // ── 3. Lookup map: _id string → totals ────────────────────────────────
//     const txnMap = new Map<string, { topupInPeriod: number; expenseInPeriod: number }>();
//     for (const row of aggregation) {
//       txnMap.set(String(row._id), {
//         topupInPeriod:   row.topupInPeriod   ?? 0,
//         expenseInPeriod: row.expenseInPeriod ?? 0,
//       });
//     }

//     // ── 4. Build response ─────────────────────────────────────────────────
//     const data = students.map((s) => {
//       const idStr = String(s._id);                  // always defined
//       const { topupInPeriod = 0, expenseInPeriod = 0 } = txnMap.get(idStr) ?? {};

//       const currentBalance    = s.balance ?? 0;
//       const lastPeriodBalance = currentBalance - topupInPeriod + expenseInPeriod;

//       return {
//         // Use the custom `id` field if present, otherwise fall back to _id string
//         studentId:         s.id ?? idStr,
//         rollNumber:        s.rollNumber,
//         name:              s.name,
//         standard:          s.standard,
//         currentBalance:    Math.round(currentBalance    * 100) / 100,
//         lastPeriodBalance: Math.round(lastPeriodBalance * 100) / 100,
//         topupInPeriod:     Math.round(topupInPeriod     * 100) / 100,
//         expenseInPeriod:   Math.round(expenseInPeriod   * 100) / 100,
//       };
//     });

//     const summary = {
//       totalStudents: data.length,
//       totalTopup:    data.reduce((a, r) => a + r.topupInPeriod,   0),
//       totalExpense:  data.reduce((a, r) => a + r.expenseInPeriod, 0),
//       totalBalance:  data.reduce((a, r) => a + r.currentBalance,  0),
//     };

//     return NextResponse.json({ data, summary });
//   } catch (err) {
//     console.error("[student-expense report]", err);
//     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
//   }
// }