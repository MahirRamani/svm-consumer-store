// components/modals/low-stock-modal.tsx
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Package } from 'lucide-react'
import type { LowStockProduct } from '@/types/dashboard/overview'

interface LowStockModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: LowStockProduct[]
}

export default function LowStockModal({ open, onOpenChange, products }: LowStockModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Low Stock Alert ({products.length} items)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {products.length > 0 ? (
            products.map((product) => (
              <Card key={product.id} className="border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-red-100 p-2 rounded-lg">
                        <Package className="text-red-600 w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{product.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="capitalize text-xs">
                            {product.category.replace("-", " ")}
                          </Badge>
                          <span className="text-sm text-gray-600">₹{product.price.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="font-bold text-red-600">{product.stock} left</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Reorder needed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">All products are well stocked!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}