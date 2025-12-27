// app/admin/dashboard/overview-tab.tsx
"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Package, 
  IndianRupee, 
  TrendingUp, 
  AlertTriangle, 
  Users,
  TrendingDown,
  Award,
  Wallet
} from "lucide-react"
import ProfitLossChart from "@/components/charts/profit-loss-chart"
import CategoryAnalyticsChart from "@/components/charts/category-analytics-chart"
import LowStockModal from "@/components/modals/low-stock-modal"
import LowBalanceStudentsModal from "@/components/modals/low-balance-students-modal"
import HighestPurchasedStudentModal from "@/components/modals/highest-purchased-student-modal"
import { useUserPermissions } from '@/hooks/use-user-permissions'
import { 
  type ApiResponse, 
  type DashboardStatsResponse,
  type AdminDashboardStats,
  type Category, 
  type Product,
  type AnalyticsView,
  isAdminStats,
  // isAdminStats
} from "@/types/dashboard/overview"

export default function OverviewTab() {
  const [showLowStockModal, setShowLowStockModal] = useState(false)
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false)
  const [showHighestPurchasedModal, setShowHighestPurchasedModal] = useState(false)
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>("category")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedProduct, setSelectedProduct] = useState<string>("all")

  // Get user role from permissions hook
  const { userRole, loading: permissionsLoading } = useUserPermissions()
  const isAdmin = userRole === "SUPERUSER" || userRole === "ADMIN"

  // Fetch dashboard statistics
  const { data: statsResponse, isLoading: statsLoading } = useQuery<ApiResponse<DashboardStatsResponse>>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/stats")
      if (!response.ok) throw new Error("Failed to fetch stats")
      return response.json()
    },
    refetchInterval: 30000,
    enabled: !permissionsLoading, // Don't fetch until we know the user role
  })

  const stats = statsResponse?.data

  // Type-safe check for admin stats
  const adminStats: AdminDashboardStats | undefined = stats && isAdminStats(stats) ? stats : undefined

  // Fetch categories for dropdown (only if admin)
  const { data: categoriesResponse } = useQuery<ApiResponse<{ categories: Category[] }>>({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories")
      if (!response.ok) throw new Error("Failed to fetch categories")
      return response.json()
    },
    enabled: isAdmin,
  })

  const categories = categoriesResponse?.data?.categories || []

  // Fetch products for dropdown (only if admin)
  const { data: productsResponse } = useQuery<ApiResponse<{ products: Product[] }>>({
    queryKey: ["products", selectedCategory],
    queryFn: async () => {
      const url = selectedCategory === "all" 
        ? "/api/products" 
        : `/api/products?categoryId=${selectedCategory}`
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch products")
      return response.json()
    },
    enabled: isAdmin && (analyticsView === "product" || analyticsView === "subproduct"),
  })

  const products = productsResponse?.data?.products || []

  if (statsLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading overview...</p>
        </div>
      </div>
    )
  }

  const profitChangePercent = adminStats?.yesterdayProfit 
    ? ((adminStats.todaysProfit - adminStats.yesterdayProfit) / adminStats.yesterdayProfit * 100).toFixed(1)
    : "0"

  return (
    <div className="space-y-6">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ADMIN: Total Sales Card */}
        {isAdmin && adminStats && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sales</p>
                  <p className="text-2xl font-bold text-gray-900">₹{adminStats.totalSales.toLocaleString('en-IN')}</p>
                  <div className="flex items-center text-xs mt-2">
                    {adminStats.totalSalesChange > 0 ? (
                      <>
                        <TrendingUp className="w-3 h-3 mr-1 text-green-600" />
                        <span className="text-green-600">+{adminStats.totalSalesChange}% from last month</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-3 h-3 mr-1 text-red-600" />
                        <span className="text-red-600">{adminStats.totalSalesChange}% from last month</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <IndianRupee className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Low Balance Students Card */}
        <Card 
          className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setShowLowBalanceModal(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Balance Students</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.lowBalanceCount || 0}</p>
                <p className="text-xs text-orange-600 mt-2 flex items-center">
                  <Wallet className="w-3 h-3 mr-1" />
                  Balance below ₹500
                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Subproducts Card */}
        <Card 
          className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setShowLowStockModal(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.lowStockCount || 0}</p>
                <p className="text-xs text-red-600 mt-2 flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Needs immediate attention
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <Package className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Sold Subproduct Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Selling Product</p>
                <p className="text-lg font-bold text-gray-900 truncate max-w-[150px]">
                  {stats?.topSoldProduct?.name || "N/A"}
                </p>
                <div className="flex items-center text-xs text-purple-600 mt-2">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {stats?.topSoldProduct?.quantitySold || 0} units sold
                </div>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Highest Purchased Student Card */}
        <Card 
          className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => setShowHighestPurchasedModal(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top Customer Today</p>
                <p className="text-lg font-bold text-gray-900 truncate max-w-[150px]">
                  {stats?.highestPurchasedStudent?.name || "N/A"}
                </p>
                <div className="flex items-center text-xs text-blue-600 mt-2">
                  <Award className="w-3 h-3 mr-1" />
                  ₹{stats?.highestPurchasedStudent?.totalPurchase?.toLocaleString('en-IN') || 0}
                </div>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Award className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ADMIN ONLY: Charts Section */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profit/Loss Chart with Today's Profit Tile */}
          <div className="flex gap-4">
            {/* Today's Profit Square Tile */}
            <Card className="w-40 h-40 flex-shrink-0">
              <CardContent className="p-4 h-full flex flex-col justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600">Today's Profit</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    ₹{adminStats.todaysProfit.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <div className="flex items-center text-xs">
                    {Number(profitChangePercent) > 0 ? (
                      <>
                        <TrendingUp className="w-3 h-3 mr-1 text-green-600" />
                        <span className="text-green-600">+{profitChangePercent}%</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-3 h-3 mr-1 text-red-600" />
                        <span className="text-red-600">{profitChangePercent}%</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Margin: {adminStats.todaysProfitMargin.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Profit/Loss Chart */}
            <Card className="flex-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Buying vs Selling Price</CardTitle>
              </CardHeader>
              <CardContent className="h-[120px]">
                <ProfitLossChart />
              </CardContent>
            </Card>
          </div>

          {/* Analytics Chart with Dropdowns */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Sales Analytics</CardTitle>
                <div className="flex gap-2">
                  <Select value={analyticsView} onValueChange={(value) => setAnalyticsView(value as AnalyticsView)}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue placeholder="View by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="subproduct">Subproduct</SelectItem>
                    </SelectContent>
                  </Select>

                  {analyticsView !== "category" && (
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat._id} value={cat._id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {analyticsView === "subproduct" && (
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product._id} value={product._id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[140px]">
              <CategoryAnalyticsChart 
                view={analyticsView}
                categoryId={selectedCategory}
                productId={selectedProduct}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modals */}
      <LowStockModal 
        open={showLowStockModal} 
        onOpenChange={setShowLowStockModal} 
        products={stats?.lowStockProducts || []} 
      />
      
      <LowBalanceStudentsModal
        open={showLowBalanceModal}
        onOpenChange={setShowLowBalanceModal}
        students={stats?.lowBalanceStudents || []}
      />

      <HighestPurchasedStudentModal
        open={showHighestPurchasedModal}
        onOpenChange={setShowHighestPurchasedModal}
        student={stats?.highestPurchasedStudent || null}
      />
    </div>
  )
}