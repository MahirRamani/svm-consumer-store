// components/charts/profit-loss-chart.tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { ApiResponse, ProfitLossDataPoint, CustomTooltipProps } from "@/types/dashboard/overview"

export default function ProfitLossChart() {
  const { data: chartResponse, isLoading } = useQuery<ApiResponse<ProfitLossDataPoint[]>>({
    queryKey: ["profit-loss-chart"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/profit-loss")
      if (!response.ok) throw new Error("Failed to fetch profit/loss data")
      return response.json()
    },
    refetchInterval: 60000,
  })

  const chartData = chartResponse?.data || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    )
  }

  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const sales = payload[0]?.value || 0
      const cost = payload[1]?.value || 0
      const profit = sales - cost
      const profitPercent = sales > 0 ? ((profit / sales) * 100).toFixed(1) : 0
        
      return (
        <div className="bg-white p-2 border rounded-lg shadow-lg text-xs">
          <p className="font-medium mb-1">{label}</p>
          <p style={{ color: "#22c55e" }}>
            Sales: ₹{sales.toLocaleString('en-IN')}
          </p>
          <p style={{ color: "#ef4444" }}>
            Cost: ₹{cost.toLocaleString('en-IN')}
          </p>
          <div className="border-t mt-1 pt-1">
            <p className={`font-medium ${profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
              Profit: ₹{profit.toLocaleString('en-IN')} ({profitPercent}%)
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 9 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 9 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `₹${value}`}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "10px" }}
          iconType="line"
        />
        <Line
          type="monotone"
          dataKey="totalSales"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          name="Daily Sales"
        />
        <Line
          type="monotone"
          dataKey="totalCost"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          name="Purchase Cost"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}


// // components/charts/profit-loss-chart.tsx
// "use client"

// import { useQuery } from "@tanstack/react-query"
// import {
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
// } from "recharts"

// export default function ProfitLossChart() {
//   const { data: chartData, isLoading } = useQuery({
//     queryKey: ["profit-loss-chart"],
//     queryFn: async () => {
//       const response = await fetch("/api/dashboard/profit-loss")
//       if (!response.ok) throw new Error("Failed to fetch profit/loss data")
//       return response.json()
//     },
//     refetchInterval: 60000,
//   })

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center h-full">
//         <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
//       </div>
//     )
//   }

//   const CustomTooltip = ({ active, payload, label }: any) => {
//     if (active && payload && payload.length) {
//       const sales = payload[0]?.value || 0
//       const cost = payload[1]?.value || 0
//       const profit = sales - cost
//       const profitPercent = sales > 0 ? ((profit / sales) * 100).toFixed(1) : 0
        
//       return (
//         <div className="bg-white p-2 border rounded-lg shadow-lg text-xs">
//           <p className="font-medium mb-1">{label}</p>
//           <p style={{ color: "#22c55e" }}>
//             Sales: ₹{sales.toLocaleString('en-IN')}
//           </p>
//           <p style={{ color: "#ef4444" }}>
//             Cost: ₹{cost.toLocaleString('en-IN')}
//           </p>
//           <div className="border-t mt-1 pt-1">
//             <p className={`font-medium ${profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
//               Profit: ₹{profit.toLocaleString('en-IN')} ({profitPercent}%)
//             </p>
//           </div>
//         </div>
//       )
//     }
//     return null
//   }

//   return (
//     <ResponsiveContainer width="100%" height="100%">
//       <LineChart
//         data={chartData?.data || []}
//         margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
//       >
//         <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
//         <XAxis
//           dataKey="date"
//           tick={{ fontSize: 9 }}
//           tickLine={false}
//           axisLine={false}
//         />
//         <YAxis
//           tick={{ fontSize: 9 }}
//           tickLine={false}
//           axisLine={false}
//           tickFormatter={(value) => `₹${value}`}
//           width={45}
//         />
//         <Tooltip content={<CustomTooltip />} />
//         <Legend
//           wrapperStyle={{ fontSize: "10px" }}
//           iconType="line"
//         />
//         <Line
//           type="monotone"
//           dataKey="totalSales"
//           stroke="#22c55e"
//           strokeWidth={2}
//           dot={{ r: 2 }}
//           activeDot={{ r: 4 }}
//           name="Daily Sales"
//         />
//         <Line
//           type="monotone"
//           dataKey="totalCost"
//           stroke="#ef4444"
//           strokeWidth={2}
//           dot={{ r: 2 }}
//           activeDot={{ r: 4 }}
//           name="Purchase Cost"
//         />
//       </LineChart>
//     </ResponsiveContainer>
//   )
// }
// // // components/charts/profit-loss-chart.tsx
// // "use client"

// // import { useQuery } from "@tanstack/react-query"
// // import {
// //   LineChart,
// //   Line,
// //   XAxis,
// //   YAxis,
// //   CartesianGrid,
// //   Tooltip,
// //   Legend,
// //   ResponsiveContainer,
// // } from "recharts"

// // export default function ProfitLossChart() {
// //   const { data: chartData, isLoading } = useQuery({
// //     queryKey: ["profit-loss-chart"],
// //     queryFn: async () => {
// //       const response = await fetch("/api/dashboard/profit-loss")
// //       if (!response.ok) throw new Error("Failed to fetch profit/loss data")
// //       return response.json()
// //     },
// //     refetchInterval: 60000,
// //   })

// //   if (isLoading) {
// //     return (
// //       <div className="flex items-center justify-center h-full">
// //         <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
// //       </div>
// //     )
// //   }

// //   const CustomTooltip = ({ active, payload, label }: any) => {
// //     if (active && payload && payload.length) {
// //       const profit = (payload[0]?.value || 0) - (payload[1]?.value || 0)
// //       const profitPercent = payload[0]?.value > 0 
// //         ? ((profit / payload[0]?.value) * 100).toFixed(1)
// //         : 0
        
// //       return (
// //         <div className="bg-white p-2 border rounded-lg shadow-lg text-xs">
// //           <p className="font-medium mb-1">{label}</p>
// //           <p style={{ color: "#22c55e" }}>
// //             Sales: ₹{payload[0]?.value?.toLocaleString('en-IN')}
// //           </p>
// //           <p style={{ color: "#ef4444" }}>
// //             Cost: ₹{payload[1]?.value?.toLocaleString('en-IN')}
// //           </p>
// //           <div className="border-t mt-1 pt-1">
// //             <p className={`font-medium ${profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
// //               Profit: ₹{profit?.toLocaleString('en-IN')} ({profitPercent}%)
// //             </p>
// //           </div>
// //         </div>
// //       )
// //     }
// //     return null
// //   }

// //   return (
// //     <ResponsiveContainer width="100%" height="100%">
// //       <LineChart
// //         data={chartData?.data || []}
// //         margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
// //       >
// //         <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
// //         <XAxis
// //           dataKey="date"
// //           tick={{ fontSize: 9 }}
// //           tickLine={false}
// //           axisLine={false}
// //         />
// //         <YAxis
// //           tick={{ fontSize: 9 }}
// //           tickLine={false}
// //           axisLine={false}
// //           tickFormatter={(value) => `₹${value}`}
// //         />
// //         <Tooltip content={<CustomTooltip />} />
// //         <Legend
// //           wrapperStyle={{ fontSize: "10px" }}
// //           iconType="line"
// //         />
// //         <Line
// //           type="monotone"
// //           dataKey="totalSales"
// //           stroke="#22c55e"
// //           strokeWidth={2}
// //           dot={{ r: 2 }}
// //           activeDot={{ r: 4 }}
// //           name="Total Sales"
// //         />
// //         <Line
// //           type="monotone"
// //           dataKey="totalCost"
// //           stroke="#ef4444"
// //           strokeWidth={2}
// //           dot={{ r: 2 }}
// //           activeDot={{ r: 4 }}
// //           name="Total Cost"
// //         />
// //       </LineChart>
// //     </ResponsiveContainer>
// //   )
// // }
// // // // components/charts/profit-loss-chart.tsx
// // // "use client"

// // // import { useQuery } from "@tanstack/react-query"
// // // import {
// // //   LineChart,
// // //   Line,
// // //   XAxis,
// // //   YAxis,
// // //   CartesianGrid,
// // //   Tooltip,
// // //   Legend,
// // //   ResponsiveContainer,
// // // } from "recharts"

// // // export default function ProfitLossChart() {
// // //   const { data: chartData, isLoading } = useQuery({
// // //     queryKey: ["profit-loss-chart"],
// // //     queryFn: async () => {
// // //       const response = await fetch("/api/dashboard/profit-loss")
// // //       if (!response.ok) throw new Error("Failed to fetch profit/loss data")
// // //       return response.json()
// // //     },
// // //     refetchInterval: 60000,
// // //   })

// // //   if (isLoading) {
// // //     return (
// // //       <div className="flex items-center justify-center h-full">
// // //         <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
// // //       </div>
// // //     )
// // //   }

// // //   const CustomTooltip = ({ active, payload, label }: any) => {
// // //     if (active && payload && payload.length) {
// // //       const profit = payload[1]?.value - payload[0]?.value
// // //       return (
// // //         <div className="bg-white p-2 border rounded-lg shadow-lg text-xs">
// // //           <p className="font-medium">{label}</p>
// // //           <p style={{ color: "#ef4444" }}>
// // //             Buying: ₹{payload[0]?.value?.toLocaleString('en-IN')}
// // //           </p>
// // //           <p style={{ color: "#22c55e" }}>
// // //             Selling: ₹{payload[1]?.value?.toLocaleString('en-IN')}
// // //           </p>
// // //           <p className={`font-medium ${profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
// // //             Profit: ₹{profit?.toLocaleString('en-IN')}
// // //           </p>
// // //         </div>
// // //       )
// // //     }
// // //     return null
// // //   }

// // //   return (
// // //     <ResponsiveContainer width="100%" height="100%">
// // //       <LineChart
// // //         data={chartData?.data || []}
// // //         margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
// // //       >
// // //         <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
// // //         <XAxis
// // //           dataKey="date"
// // //           tick={{ fontSize: 9 }}
// // //           tickLine={false}
// // //           axisLine={false}
// // //         />
// // //         <YAxis
// // //           tick={{ fontSize: 9 }}
// // //           tickLine={false}
// // //           axisLine={false}
// // //           tickFormatter={(value) => `₹${value}`}
// // //         />
// // //         <Tooltip content={<CustomTooltip />} />
// // //         <Legend
// // //           wrapperStyle={{ fontSize: "10px" }}
// // //           iconType="line"
// // //         />
// // //         <Line
// // //           type="monotone"
// // //           dataKey="buyingPrice"
// // //           stroke="#ef4444"
// // //           strokeWidth={2}
// // //           dot={{ r: 2 }}
// // //           activeDot={{ r: 4 }}
// // //           name="Buying Price"
// // //         />
// // //         <Line
// // //           type="monotone"
// // //           dataKey="sellingPrice"
// // //           stroke="#22c55e"
// // //           strokeWidth={2}
// // //           dot={{ r: 2 }}
// // //           activeDot={{ r: 4 }}
// // //           name="Selling Price"
// // //         />
// // //       </LineChart>
// // //     </ResponsiveContainer>
// // //   )
// // // }

// // // // // components/charts/profit-loss-chart.tsx
// // // // "use client"

// // // // import { useQuery } from "@tanstack/react-query"
// // // // import {
// // // //   LineChart,
// // // //   Line,
// // // //   XAxis,
// // // //   YAxis,
// // // //   CartesianGrid,
// // // //   Tooltip,
// // // //   Legend,
// // // //   ResponsiveContainer,
// // // // } from "recharts"

// // // // export default function ProfitLossChart() {
// // // //   const { data: chartData, isLoading } = useQuery({
// // // //     queryKey: ["profit-loss-chart"],
// // // //     queryFn: async () => {
// // // //       const response = await fetch("/api/dashboard/profit-loss")
// // // //       if (!response.ok) throw new Error("Failed to fetch profit/loss data")
// // // //       return response.json()
// // // //     },
// // // //     refetchInterval: 60000,
// // // //   })

// // // //   if (isLoading) {
// // // //     return (
// // // //       <div className="flex items-center justify-center h-full">
// // // //         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
// // // //       </div>
// // // //     )
// // // //   }

// // // //   const CustomTooltip = ({ active, payload, label }: any) => {
// // // //     if (active && payload && payload.length) {
// // // //       return (
// // // //         <div className="bg-white p-3 border rounded-lg shadow-lg">
// // // //           <p className="text-sm font-medium">{label}</p>
// // // //           {payload.map((entry: any, index: number) => (
// // // //             <p key={index} className="text-sm" style={{ color: entry.color }}>
// // // //               {entry.name}: ₹{entry.value.toLocaleString('en-IN')}
// // // //             </p>
// // // //           ))}
// // // //         </div>
// // // //       )
// // // //     }
// // // //     return null
// // // //   }

// // // //   return (
// // // //     <ResponsiveContainer width="100%" height="100%">
// // // //       <LineChart
// // // //         data={chartData?.data || []}
// // // //         margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
// // // //       >
// // // //         <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
// // // //         <XAxis
// // // //           dataKey="date"
// // // //           tick={{ fontSize: 10 }}
// // // //           tickLine={false}
// // // //           axisLine={false}
// // // //         />
// // // //         <YAxis
// // // //           tick={{ fontSize: 10 }}
// // // //           tickLine={false}
// // // //           axisLine={false}
// // // //           tickFormatter={(value) => `₹${value}`}
// // // //         />
// // // //         <Tooltip content={<CustomTooltip />} />
// // // //         <Legend
// // // //           wrapperStyle={{ fontSize: "11px" }}
// // // //           iconType="line"
// // // //         />
// // // //         <Line
// // // //           type="monotone"
// // // //           dataKey="profit"
// // // //           stroke="#22c55e"
// // // //           strokeWidth={2}
// // // //           dot={{ r: 3 }}
// // // //           activeDot={{ r: 5 }}
// // // //           name="Profit"
// // // //         />
// // // //         <Line
// // // //           type="monotone"
// // // //           dataKey="loss"
// // // //           stroke="#ef4444"
// // // //           strokeWidth={2}
// // // //           dot={{ r: 3 }}
// // // //           activeDot={{ r: 5 }}
// // // //           name="Loss"
// // // //         />
// // // //       </LineChart>
// // // //     </ResponsiveContainer>
// // // //   )
// // // // }