// components/modals/low-stock-modal.tsx
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Package } from "lucide-react"
import type { LowStockProduct } from "@/types/dashboard/overview"

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


// "use client"

// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Badge } from "@/components/ui/badge"
// import { Card, CardContent } from "@/components/ui/card"
// import { AlertTriangle, Package } from "lucide-react"

// interface LowStockProduct {
//   id: string
//   name: string
//   category: string
//   price: number
//   stock: number
// }

// interface LowStockModalProps {
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   products: LowStockProduct[]
// }

// export default function LowStockModal({ open, onOpenChange, products }: LowStockModalProps) {
//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2">
//             <AlertTriangle className="w-5 h-5 text-red-600" />
//             Low Stock Alert ({products.length} items)
//           </DialogTitle>
//         </DialogHeader>

//         <div className="space-y-3">
//           {products.length > 0 ? (
//             products.map((product) => (
//               <Card key={product.id} className="border-l-4 border-l-red-500">
//                 <CardContent className="p-4">
//                   <div className="flex items-center justify-between">
//                     <div className="flex items-center space-x-3">
//                       <div className="bg-red-100 p-2 rounded-lg">
//                         <Package className="text-red-600 w-5 h-5" />
//                       </div>
//                       <div>
//                         <h3 className="font-semibold text-gray-900">{product.name}</h3>
//                         <div className="flex items-center gap-2 mt-1">
//                           <Badge variant="outline" className="capitalize text-xs">
//                             {product?.category?.replace("-", " ")}
//                           </Badge>
//                           <span className="text-sm text-gray-600">₹{product.price?.toFixed(2)}</span>
//                         </div>
//                       </div>
//                     </div>
//                     <div className="text-right">
//                       <div className="flex items-center gap-1">
//                         <AlertTriangle className="w-4 h-4 text-red-600" />
//                         <span className="font-bold text-red-600">{product.stock} left</span>
//                       </div>
//                       <p className="text-xs text-gray-500 mt-1">Reorder needed</p>
//                     </div>
//                   </div>
//                 </CardContent>
//               </Card>
//             ))
//           ) : (
//             <div className="text-center py-8">
//               <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
//               <p className="text-gray-500">All products are well stocked!</p>
//             </div>
//           )}
//         </div>
//       </DialogContent>
//     </Dialog>
//   )
// }

// // "use client"

// // import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// // import { Button } from "@/components/ui/button"
// // import { Badge } from "@/components/ui/badge"
// // import { AlertTriangle, Package } from "lucide-react"

// // interface LowStockModalProps {
// //   open: boolean
// //   onOpenChange: (open: boolean) => void
// //   products: Array<{
// //     id: string
// //     name: string
// //     category: string
// //     stock: number
// //     lowStockThreshold: number
// //   }>
// // }

// // export default function LowStockModal({ open, onOpenChange, products }: LowStockModalProps) {
// //   const getCategoryIcon = (category: string) => {
// //     switch (category) {
// //       case "food":
// //         return "🍜"
// //       case "stationery":
// //         return "📚"
// //       case "daily-use":
// //         return "🧴"
// //       case "pooja":
// //         return "🔥"
// //       default:
// //         return "📦"
// //     }
// //   }

// //   return (
// //     <Dialog open={open} onOpenChange={onOpenChange}>
// //       <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
// //         <DialogHeader>
// //           <DialogTitle className="flex items-center text-red-600">
// //             <AlertTriangle className="w-6 h-6 mr-2" />
// //             Low Stock Products ({products.length} items)
// //           </DialogTitle>
// //         </DialogHeader>

// //         <div className="space-y-4">
// //           {products.length === 0 ? (
// //             <div className="text-center py-8 text-gray-500">
// //               <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
// //               <p>All products are well stocked!</p>
// //             </div>
// //           ) : (
// //             <div className="grid gap-4">
// //               {products.map((product) => (
// //                 <div
// //                   key={product.id}
// //                   className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50"
// //                 >
// //                   <div className="flex items-center space-x-3">
// //                     <div className="bg-white p-2 rounded-lg text-xl">{getCategoryIcon(product.category)}</div>
// //                     <div>
// //                       <h4 className="font-medium text-gray-900">{product.name}</h4>
// //                       <p className="text-sm text-gray-600 capitalize">{product.category.replace("-", " ")}</p>
// //                     </div>
// //                   </div>
// //                   <div className="text-right">
// //                     <Badge variant="destructive" className="mb-1">
// //                       {product.stock} left
// //                     </Badge>
// //                     <p className="text-xs text-gray-500">Min required: {product.lowStockThreshold}</p>
// //                   </div>
// //                 </div>
// //               ))}
// //             </div>
// //           )}

// //           <div className="flex justify-end pt-4">
// //             <Button onClick={() => onOpenChange(false)} className="bg-gray-600 hover:bg-gray-700 text-white">
// //               Close
// //             </Button>
// //           </div>
// //         </div>
// //       </DialogContent>
// //     </Dialog>
// //   )
// // }
