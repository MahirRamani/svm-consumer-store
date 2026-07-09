// components/modals/todays-sales-modal.tsx
"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from '@/components/ui/badge'
import type { TodaysSoldProduct } from '@/types/dashboard/overview'

interface TodaysSalesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: TodaysSoldProduct[]
}

export default function TodaysSalesModal({ open, onOpenChange, products }: TodaysSalesModalProps) {
  const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0)
  const totalQuantity = products.reduce((sum, product) => sum + product.quantity, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Today's Sales Details</DialogTitle>
          <DialogDescription>
            Products sold today with quantities and revenue
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-600 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-green-900">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-600 font-medium">Total Items Sold</p>
              <p className="text-2xl font-bold text-blue-900">{totalQuantity}</p>
            </div>
          </div>

          {/* Products List */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700">Product Details</h4>
            <div className="space-y-2">
              {products.length > 0 ? (
                products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          Qty: {product.quantity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          ₹{product.revenue.toLocaleString('en-IN')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-8 text-gray-500">
                  No products sold today
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}