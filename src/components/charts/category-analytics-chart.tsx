// components/charts/category-analytics-chart.tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { ApiResponse, AnalyticsDataPoint, AnalyticsView, CustomTooltipProps } from "@/types/dashboard/overview"

interface CategoryAnalyticsChartProps {
  view: AnalyticsView
  categoryId?: string
  productId?: string
}

export default function CategoryAnalyticsChart({ view, categoryId, productId }: CategoryAnalyticsChartProps) {
  const { data: chartResponse, isLoading } = useQuery<ApiResponse<AnalyticsDataPoint[]>>({
    queryKey: ["analytics-chart", view, categoryId, productId],
    queryFn: async () => {
      const params = new URLSearchParams({ view })
      if (categoryId && categoryId !== "all") params.append("categoryId", categoryId)
      if (productId && productId !== "all") params.append("productId", productId)
      
      const response = await fetch(`/api/dashboard/analytics?${params}`)
      if (!response.ok) throw new Error("Failed to fetch analytics data")
      return response.json()
    },
    refetchInterval: 60000,
  })

  const chartData = chartResponse?.data || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="text-sm font-medium mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === "Sales" 
                ? `₹${entry.value.toLocaleString('en-IN')}`
                : entry.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `₹${value}`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "11px" }}
        />
        <Bar
          yAxisId="left"
          dataKey="sales"
          fill="#6366f1"
          radius={[4, 4, 0, 0]}
          name="Sales"
        />
        <Bar
          yAxisId="right"
          dataKey="quantity"
          fill="#22c55e"
          radius={[4, 4, 0, 0]}
          name="Quantity"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}