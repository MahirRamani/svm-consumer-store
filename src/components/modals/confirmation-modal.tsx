// components/pos/confirmation-modal.tsx
"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, CreditCard, X, ShoppingCart } from "lucide-react";
import type { Student, CartItem } from "@/types/seller/pos";
import { WILD_ROLL_NUMBERS } from "@/lib/constant";

interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  selectedStudent: Student | null;
  cartItems: CartItem[];
}

export default function ConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  selectedStudent,
  cartItems,
}: ConfirmationModalProps) {
  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  }, [cartItems]);

  const itemsCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  const remainingBalance = useMemo(() => {
    if (!selectedStudent) return 0;
    return selectedStudent.balance - total;
  }, [selectedStudent, total]);

  if (!selectedStudent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Confirm Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Student Info */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Student Details</h3>
            <div className="space-y-1 text-sm text-blue-700">
              <p>
                <strong>Name:</strong> {selectedStudent.name}
              </p>
              <p>
                <strong>Roll Number:</strong> {selectedStudent.rollNumber}
              </p>
              {selectedStudent.standard && (
                <p>
                  <strong>Standard:</strong> {selectedStudent.standard} - {selectedStudent.year}
                </p>
              )}
              <p>
                <strong>Current Balance:</strong> ₹{selectedStudent.balance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Cart Items */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">
              Items to Purchase ({itemsCount} {itemsCount === 1 ? "item" : "items"})
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {cartItems.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium text-gray-900">
                    ₹{((item.price || 0) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction Summary */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-green-900">Total Amount:</span>
              <span className="text-xl font-bold text-green-600">₹{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-700">Remaining Balance:</span>
              <span
                className={`text-sm font-medium ${remainingBalance >= 0 ? "text-green-600" : "text-red-600"
                  }`}
              >
                ₹{remainingBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Warning for low balance */}
          {remainingBalance >= 0 && remainingBalance < 100 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                Student will have low balance after this transaction.
              </p>
            </div>
          )}

          {/* Insufficient balance warning */}
          {remainingBalance < 0 && !WILD_ROLL_NUMBERS.includes(selectedStudent.rollNumber) && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Insufficient balance! Student needs ₹{Math.abs(remainingBalance).toFixed(2)} more.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isLoading || cartItems.length === 0 || (remainingBalance < 0 && !WILD_ROLL_NUMBERS.includes(selectedStudent.rollNumber))}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
// // NOTE - Working
// // components/pos/confirmation-modal.tsx
// "use client";

// import { useMemo } from "react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Separator } from "@/components/ui/separator";
// import { Badge } from "@/components/ui/badge";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { AlertTriangle, Loader2, CreditCard, X, User, Package, Receipt } from "lucide-react";
// import type { Student, CartItem } from "@/types/pos";

// interface ConfirmationModalProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   onConfirm: () => void;
//   isLoading: boolean;
//   selectedStudent: Student | null;
//   cartItems: CartItem[];
// }

// export default function ConfirmationModal({
//   open,
//   onOpenChange,
//   onConfirm,
//   isLoading,
//   selectedStudent,
//   cartItems,
// }: ConfirmationModalProps) {
//   const total = useMemo(() => {
//     return cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
//   }, [cartItems]);

//   const itemsCount = useMemo(() => {
//     return cartItems.reduce((sum, item) => sum + item.quantity, 0);
//   }, [cartItems]);

//   const remainingBalance = useMemo(() => {
//     if (!selectedStudent) return 0;
//     return selectedStudent.balance - total;
//   }, [selectedStudent, total]);

//   const balanceStatus = useMemo(() => {
//     if (remainingBalance < 0) return { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Insufficient" };
//     if (remainingBalance < 100) return { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Low" };
//     return { color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "Sufficient" };
//   }, [remainingBalance]);

//   if (!selectedStudent) return null;

//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <DialogContent className="sm:max-w-lg">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2 text-xl">
//             <div className="p-2 bg-amber-100 rounded-lg">
//               <AlertTriangle className="w-5 h-5 text-amber-600" />
//             </div>
//             Confirm Transaction
//           </DialogTitle>
//           <p className="text-sm text-muted-foreground">Please review the transaction details before confirming</p>
//         </DialogHeader>

//         <div className="space-y-4">
//           {/* Student Info Card */}
//           <div className={`p-4 rounded-lg border-2 ${balanceStatus.bg} ${balanceStatus.border}`}>
//             <div className="flex items-start gap-3">
//               <div className="p-2 bg-white rounded-lg">
//                 <User className="w-5 h-5 text-blue-600" />
//               </div>
//               <div className="flex-1 min-w-0">
//                 <h4 className="font-semibold text-gray-900 mb-2">Student Information</h4>
//                 <div className="space-y-1.5 text-sm">
//                   <div className="flex justify-between items-center">
//                     <span className="text-gray-600">Name:</span>
//                     <span className="font-medium text-gray-900 truncate ml-2">{selectedStudent.name}</span>
//                   </div>
//                   <div className="flex justify-between items-center">
//                     <span className="text-gray-600">Roll Number:</span>
//                     <span className="font-medium text-gray-900">{selectedStudent.rollNumber}</span>
//                   </div>
//                   {selectedStudent.standard && (
//                     <div className="flex justify-between items-center">
//                       <span className="text-gray-600">Standard:</span>
//                       <span className="font-medium text-gray-900">
//                         {selectedStudent.standard} - {selectedStudent.year}
//                       </span>
//                     </div>
//                   )}
//                   <Separator className="my-2" />
//                   <div className="flex justify-between items-center">
//                     <span className="text-gray-600">Current Balance:</span>
//                     <span className="font-bold text-green-600">₹{selectedStudent.balance.toFixed(2)}</span>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Transaction Summary Card */}
//           <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
//             <div className="flex items-start gap-3">
//               <div className="p-2 bg-white rounded-lg">
//                 <Receipt className="w-5 h-5 text-blue-600" />
//               </div>
//               <div className="flex-1">
//                 <h4 className="font-semibold text-gray-900 mb-3">Transaction Summary</h4>
//                 <div className="space-y-2 text-sm">
//                   <div className="flex justify-between items-center">
//                     <span className="text-gray-600">Total Items:</span>
//                     <Badge variant="secondary" className="font-semibold">
//                       {itemsCount} {itemsCount === 1 ? "item" : "items"}
//                     </Badge>
//                   </div>
//                   <div className="flex justify-between items-center">
//                     <span className="text-gray-600">Transaction Amount:</span>
//                     <span className="font-bold text-lg text-red-600">-₹{total.toFixed(2)}</span>
//                   </div>
//                   <Separator className="my-2" />
//                   <div className="flex justify-between items-center">
//                     <span className="font-semibold text-gray-900">Remaining Balance:</span>
//                     <div className="text-right">
//                       <span className={`font-bold text-lg ${balanceStatus.color}`}>₹{remainingBalance.toFixed(2)}</span>
//                       <Badge variant="outline" className={`ml-2 ${balanceStatus.color}`}>
//                         {balanceStatus.label}
//                       </Badge>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Items List */}
//           <div className="space-y-2">
//             <div className="flex items-center gap-2">
//               <Package className="w-4 h-4 text-gray-600" />
//               <h4 className="font-semibold text-gray-900 text-sm">Items to Purchase ({cartItems.length})</h4>
//             </div>
//             <ScrollArea className="max-h-48 pr-4">
//               <div className="space-y-2">
//                 {cartItems.map((item, index) => (
//                   <div
//                     key={index}
//                     className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
//                   >
//                     <div className="flex-1 min-w-0">
//                       <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
//                       <p className="text-xs text-gray-600">
//                         ₹{(item.price || 0).toFixed(2)} × {item.quantity}
//                       </p>
//                     </div>
//                     <span className="font-bold text-sm text-gray-900 ml-2">
//                       ₹{((item.price || 0) * item.quantity).toFixed(2)}
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             </ScrollArea>
//           </div>

//           {/* Warning Messages */}
//           {remainingBalance < 0 && (
//             <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg flex items-start gap-2 animate-pulse">
//               <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
//               <div className="text-sm">
//                 <p className="font-semibold text-red-900">Insufficient Balance!</p>
//                 <p className="text-red-700">
//                   Student needs ₹{Math.abs(remainingBalance).toFixed(2)} more to complete this transaction.
//                 </p>
//               </div>
//             </div>
//           )}

//           {remainingBalance >= 0 && remainingBalance < 100 && (
//             <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
//               <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
//               <div className="text-sm">
//                 <p className="font-semibold text-amber-900">Low Balance Warning</p>
//                 <p className="text-amber-700">Student will have low balance after this transaction.</p>
//               </div>
//             </div>
//           )}

//           {/* Confirmation Message */}
//           <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
//             <p className="text-sm text-blue-900">
//               <strong>Please confirm:</strong> This will deduct{" "}
//               <span className="font-bold">₹{total.toFixed(2)}</span> from {selectedStudent.name}'s account.
//             </p>
//           </div>

//           {/* Actions */}
//           <div className="flex gap-3 pt-2">
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => onOpenChange(false)}
//               disabled={isLoading}
//               className="flex-1"
//             >
//               <X className="w-4 h-4 mr-2" />
//               Cancel
//             </Button>
//             <Button
//               onClick={onConfirm}
//               disabled={isLoading || remainingBalance < 0 || cartItems.length === 0}
//               className="flex-1 bg-green-500 hover:bg-green-600 text-white"
//             >
//               {isLoading ? (
//                 <>
//                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                   Processing...
//                 </>
//               ) : (
//                 <>
//                   <CreditCard className="w-4 h-4 mr-2" />
//                   Confirm Payment
//                 </>
//               )}
//             </Button>
//           </div>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }