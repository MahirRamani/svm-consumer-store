// components/pos/shopping-cart.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart as ShoppingCartIcon, Plus, Minus, Trash2, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import SuccessModal from "@/components/modals/success-modal";
import ConfirmationModal from "@/components/modals/confirmation-modal";

import type { 
  Student, 
  CartItem, 
  TransactionItem,
  Transaction,
  TransactionData,
  ApiResponse 
} from "@/types/pos";

interface ShoppingCartProps {
  selectedStudent: Student | null;
  cartItems: CartItem[];
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  onTransactionComplete: () => void;
}

interface CreateTransactionPayload {
  studentId: string;
  items: TransactionItem[];
}

export default function ShoppingCart({
  selectedStudent,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onTransactionComplete,
}: ShoppingCartProps) {
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [transactionData, setTransactionData] = useState<TransactionData | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const queryClient = useQueryClient();

  const processTransactionMutation = useMutation<
    ApiResponse<Transaction>,
    Error,
    CreateTransactionPayload
  >({
    mutationFn: async (payload) => {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result: ApiResponse<Transaction> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "Failed to process transaction");
      }

      return result;
    },
    onSuccess: (response) => {
      if (!response.data || !selectedStudent) return;

      const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const remainingBalance = selectedStudent.balance - totalAmount;

      setTransactionData({
        student: selectedStudent.name,
        amount: totalAmount,
        remainingBalance,
        id: `#TXN${response.data.transactionId || response.data._id?.toString().padStart(6, "0")}`,
        items: cartItems,
      });

      setShowSuccessModal(true);
      setShowConfirmationModal(false);

      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["fifo-stocks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

      toast.success(`₹${totalAmount.toFixed(2)} deducted from ${selectedStudent.name}'s account`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setShowConfirmationModal(false);
    },
  });

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  const canCheckout = useMemo(() => {
    return selectedStudent && cartItems.length > 0 && selectedStudent.balance >= total;
  }, [selectedStudent, cartItems, total]);

  const hasInsufficientBalance = useMemo(() => {
    return selectedStudent && cartItems.length > 0 && selectedStudent.balance < total;
  }, [selectedStudent, cartItems, total]);

  useEffect(() => {
    if (hasInsufficientBalance && selectedStudent) {
      const deficit = total - selectedStudent.balance;
      toast.error(`Insufficient balance! Need ₹${deficit.toFixed(2)} more to complete this transaction.`, {
        position: "bottom-right",
        duration: 4000,
      });
    }
  }, [hasInsufficientBalance, total, selectedStudent]);

  const handleInitiateTransaction = useCallback(() => {
    if (!canCheckout) return;
    setShowConfirmationModal(true);
  }, [canCheckout]);

  const handleConfirmTransaction = useCallback(() => {
    if (!selectedStudent || cartItems.length === 0) {
      toast.error("No student selected or cart is empty");
      return;
    }

    const items: TransactionItem[] = cartItems.map((item) => ({
      productId: item.productId,
      subProductId: item.subProductId,
      quantity: item.quantity,
      price: item.price,
      stockTransactionId: item.stockTransactionId,
    }));

    processTransactionMutation.mutate({
      studentId: selectedStudent._id,
      items,
    });
  }, [selectedStudent, cartItems, processTransactionMutation]);

  const handleTransactionSuccess = useCallback(() => {
    setShowSuccessModal(false);
    onTransactionComplete();
  }, [onTransactionComplete]);

  const getItemId = useCallback((item: CartItem): string => {
    if (!item.subProductId) {
      console.error("Cart item missing subProductId:", item);
      throw new Error("Cart item must have a subProductId");
    }
    return item.subProductId;
  }, []);

  const handleQuantityClick = useCallback((item: CartItem) => {
    const itemId = getItemId(item);
    setEditingItemId(itemId);
    setEditingValue(item.quantity.toString());
  }, [getItemId]);

  const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setEditingValue(value);
    }
  }, []);

  const handleQuantityBlur = useCallback((item: CartItem) => {
    const itemId = getItemId(item);
    const newQuantity = parseInt(editingValue) || 1;
    
    if (newQuantity < 1) {
      toast.error("Quantity must be at least 1");
      setEditingValue(item.quantity.toString());
    } else if (newQuantity > item.stock) {
      toast.error(`Only ${item.stock} units available in stock`);
      setEditingValue(item.stock.toString());
      onUpdateQuantity(itemId, item.stock);
    } else {
      onUpdateQuantity(itemId, newQuantity);
    }
    
    setEditingItemId(null);
  }, [editingValue, getItemId, onUpdateQuantity]);

  const handleQuantityKeyPress = useCallback((e: React.KeyboardEvent, item: CartItem) => {
    if (e.key === "Enter") {
      handleQuantityBlur(item);
    } else if (e.key === "Escape") {
      setEditingItemId(null);
      setEditingValue("");
    }
  }, [handleQuantityBlur]);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <ShoppingCartIcon className="w-5 h-5 mr-2" />
            Shopping Cart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {cartItems.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <ShoppingCartIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No items in cart</p>
                <p className="text-sm">Add products to get started</p>
              </div>
            ) : (
              cartItems.map((item) => {
                const itemId = getItemId(item);
                const isEditing = editingItemId === itemId;
                
                return (
                  <div
                    key={itemId}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-gray-900">{item.name}</h4>
                      <p className="text-xs text-gray-500">₹{item.price.toFixed(2)} each</p>
                      {item.itemType === "subProduct" && (
                        <p className="text-xs text-blue-500">Variant</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(itemId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-6 h-6 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      
                      {isEditing ? (
                        <Input
                          type="text"
                          value={editingValue}
                          onChange={handleQuantityChange}
                          onBlur={() => handleQuantityBlur(item)}
                          onKeyDown={(e) => handleQuantityKeyPress(e, item)}
                          className="w-12 h-6 text-center text-sm p-1"
                          autoFocus
                        />
                      ) : (
                        <span 
                          className="text-sm font-medium w-8 text-center cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5"
                          onClick={() => handleQuantityClick(item)}
                          title="Click to edit quantity"
                        >
                          {item.quantity}
                        </span>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(itemId, item.quantity + 1)}
                        disabled={item.quantity >= item.stock}
                        className="w-6 h-6 p-0"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(itemId)}
                        className="text-red-500 hover:text-red-600 w-6 h-6 p-0 ml-2"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-900">Total:</span>
              <span className="text-xl font-bold text-green-500">₹{total.toFixed(2)}</span>
            </div>

            {selectedStudent && cartItems.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-gray-50">
                <div className="flex justify-between text-sm">
                  <span>Current Balance:</span>
                  <span className="font-medium">₹{selectedStudent.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>After Transaction:</span>
                  <span
                    className={`font-medium ${
                      selectedStudent.balance >= total ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    ₹{(selectedStudent.balance - total).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Button
                onClick={handleInitiateTransaction}
                disabled={!canCheckout || processTransactionMutation.isPending}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3"
              >
                {processTransactionMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Complete Transaction
                  </>
                )}
              </Button>

              {!canCheckout &&
                selectedStudent &&
                cartItems.length > 0 &&
                selectedStudent.balance < total && (
                  <div className="text-center">
                    <Badge variant="destructive" className="text-xs">
                      Insufficient Balance
                    </Badge>
                  </div>
                )}

              <Button
                variant="outline"
                onClick={onClearCart}
                disabled={cartItems.length === 0}
                className="w-full bg-transparent"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Cart
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmationModal
        open={showConfirmationModal}
        onOpenChange={setShowConfirmationModal}
        onConfirm={handleConfirmTransaction}
        isLoading={processTransactionMutation.isPending}
        selectedStudent={selectedStudent}
        cartItems={cartItems}
      />

      <SuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        transactionData={transactionData}
        onClose={handleTransactionSuccess}
      />
    </div>
  );
}


// // components/pos/shopping-cart.tsx
// "use client";

// import { useState, useCallback, useMemo } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Badge } from "@/components/ui/badge";
// import { Separator } from "@/components/ui/separator";
// import { ShoppingCart as ShoppingCartIcon, Plus, Minus, Trash2, CreditCard, Loader2, AlertCircle } from "lucide-react";
// import SuccessModal from "@/components/modals/success-modal";
// import ConfirmationModal from "@/components/modals/confirmation-modal";
// import { useCreateTransaction } from "@/hooks/use-transaction-mutations";
// import type { Student, CartItem } from "@/types";

// interface ShoppingCartProps {
//   selectedStudent: Student | null;
//   cartItems: CartItem[];
//   onUpdateQuantity: (itemId: string, newQuantity: number) => void;
//   onRemoveItem: (itemId: string) => void;
//   onClearCart: () => void;
//   onTransactionComplete: () => void;
// }

// // interface TransactionData {
// //   student: string;
// //   amount: number;
// //   remainingBalance: number;
// //   id: string;
// //   items: CartItem[];
// // }

// interface TransactionData {
//   student: string;
//   amount: number;
//   remainingBalance: number;
//   id: string;
//   items: Array<{
//     name: string;
//     quantity: number;
//     price: number;
//   }>;
// }

// export default function ShoppingCart({
//   selectedStudent,
//   cartItems,
//   onUpdateQuantity,
//   onRemoveItem,
//   onClearCart,
//   onTransactionComplete,
// }: ShoppingCartProps) {
//   const [showSuccessModal, setShowSuccessModal] = useState(false);
//   const [showConfirmationModal, setShowConfirmationModal] = useState(false);
//   const [transactionData, setTransactionData] = useState<TransactionData | null>(null);
//   const [editingItemId, setEditingItemId] = useState<string | null>(null);
//   const [editingValue, setEditingValue] = useState("");

//   const createTransactionMutation = useCreateTransaction();

//   const getItemId = useCallback((item: CartItem): string => {
//     if (!item.subProductId) {
//       console.error("Cart item missing subProductId:", item);
//       throw new Error("Cart item must have a subProductId");
//     }
//     return item.subProductId;
//   }, []);

//   const total = useMemo(() => {
//     return cartItems.reduce((sum, item) => {
//       const price = item.price || 0;
//       return sum + price * item.quantity;
//     }, 0);
//   }, [cartItems]);

//   const canCheckout = useMemo(() => {
//     return selectedStudent && cartItems.length > 0 && selectedStudent.balance >= total;
//   }, [selectedStudent, cartItems, total]);

//   const hasInsufficientBalance = useMemo(() => {
//     return selectedStudent && cartItems.length > 0 && selectedStudent.balance < total;
//   }, [selectedStudent, cartItems, total]);

//   const deficit = useMemo(() => {
//     if (!hasInsufficientBalance || !selectedStudent) return 0;
//     return total - selectedStudent.balance;
//   }, [hasInsufficientBalance, selectedStudent, total]);

//   const handleInitiateTransaction = useCallback(() => {
//     if (!canCheckout) return;
//     setShowConfirmationModal(true);
//   }, [canCheckout]);

//   const handleConfirmTransaction = useCallback(() => {
//     if (!selectedStudent || cartItems.length === 0) return;

//     const items = cartItems.map((item) => ({
//       productId: item.productId,
//       subProductId: item.subProductId!,
//       quantity: item.quantity,
//       price: item.price || 0,
//       stockTransactionId: item.stockTransactionId,
//     }));

//     createTransactionMutation.mutate(
//       {
//         studentId: selectedStudent.id,
//         items,
//       },
//       {
//         onSuccess: (response) => {
//           const remainingBalance = selectedStudent.balance - total;

//           setTransactionData({
//             student: selectedStudent.name,
//             amount: total,
//             remainingBalance,
//             id: `#TXN${response.data?.id?.toString().padStart(6, "0") || "000000"}`,
//             items: cartItems.map((item) => ({
//               name: item.name,
//               quantity: item.quantity,
//               price: item.price || 0,
//             })),
//           });
//           setShowSuccessModal(true);
//           setShowConfirmationModal(false);
//         },
//         onError: () => {
//           setShowConfirmationModal(false);
//         },
//       }
//     );
//   }, [selectedStudent, cartItems, total, createTransactionMutation]);

//   const handleTransactionSuccess = useCallback(() => {
//     setShowSuccessModal(false);
//     onTransactionComplete();
//   }, [onTransactionComplete]);

//   const handleQuantityClick = useCallback(
//     (item: CartItem) => {
//       const itemId = getItemId(item);
//       setEditingItemId(itemId);
//       setEditingValue(item.quantity.toString());
//     },
//     [getItemId]
//   );

//   const handleQuantityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value;
//     if (value === "" || /^\d+$/.test(value)) {
//       setEditingValue(value);
//     }
//   }, []);

//   const handleQuantityBlur = useCallback(
//     (item: CartItem) => {
//       const itemId = getItemId(item);
//       const newQuantity = parseInt(editingValue) || 1;

//       if (newQuantity < 1) {
//         onUpdateQuantity(itemId, 1);
//       } else if (newQuantity > item.stock) {
//         onUpdateQuantity(itemId, item.stock);
//       } else {
//         onUpdateQuantity(itemId, newQuantity);
//       }

//       setEditingItemId(null);
//     },
//     [editingValue, getItemId, onUpdateQuantity]
//   );

//   const handleQuantityKeyPress = useCallback(
//     (e: React.KeyboardEvent, item: CartItem) => {
//       if (e.key === "Enter") {
//         handleQuantityBlur(item);
//       } else if (e.key === "Escape") {
//         setEditingItemId(null);
//         setEditingValue("");
//       }
//     },
//     [handleQuantityBlur]
//   );

//   const itemsCount = useMemo(() => {
//     return cartItems.reduce((sum, item) => sum + item.quantity, 0);
//   }, [cartItems]);

//   return (
//     <div className="space-y-4">
//       <Card className="shadow-lg sticky top-4">
//         <CardHeader className="pb-3">
//           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <ShoppingCartIcon className="w-5 h-5" />
//               Shopping Cart
//             </div>
//             {cartItems.length > 0 && (
//               <Badge variant="secondary" className="text-xs">
//                 {itemsCount} items
//               </Badge>
//             )}
//           </CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-4">
//           {/* Cart Items */}
//           <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
//             {!cartItems || cartItems.length === 0 ? (
//               <div className="text-center text-gray-500 py-8">
//                 <ShoppingCartIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
//                 <p className="font-medium">No items in cart</p>
//                 <p className="text-sm text-gray-400">Add products to get started</p>
//               </div>
//             ) : (
//               cartItems.map((item) => {
//                 const itemId = getItemId(item);
//                 const isEditing = editingItemId === itemId;
//                 const itemTotal = (item.price || 0) * item.quantity;

//                 return (
//                   <div key={itemId} className="flex items-start gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
//                     <div className="flex-1 min-w-0">
//                       <h4 className="font-medium text-sm text-gray-900 truncate">{item.name}</h4>
//                       <div className="flex items-center gap-2 mt-1">
//                         <p className="text-xs text-gray-600">₹{(item.price || 0).toFixed(2)} each</p>
//                         {item.itemType === "subproduct" && (
//                           <Badge variant="outline" className="text-xs">
//                             Variant
//                           </Badge>
//                         )}
//                       </div>
//                       <p className="text-sm font-semibold text-green-600 mt-1">₹{itemTotal.toFixed(2)}</p>
//                     </div>

//                     {/* Quantity Controls */}
//                     <div className="flex flex-col items-end gap-2">
//                       <div className="flex items-center gap-1">
//                         <Button
//                           variant="outline"
//                           size="sm"
//                           onClick={() => onUpdateQuantity(itemId, item.quantity - 1)}
//                           disabled={item.quantity <= 1}
//                           className="h-7 w-7 p-0"
//                         >
//                           <Minus className="w-3 h-3" />
//                         </Button>

//                         {isEditing ? (
//                           <Input
//                             type="text"
//                             value={editingValue}
//                             onChange={handleQuantityChange}
//                             onBlur={() => handleQuantityBlur(item)}
//                             onKeyDown={(e) => handleQuantityKeyPress(e, item)}
//                             className="w-12 h-7 text-center text-sm p-1"
//                             autoFocus
//                           />
//                         ) : (
//                           <span
//                             className="w-12 text-center font-medium cursor-pointer hover:bg-gray-200 rounded px-2 py-1 text-sm"
//                             onClick={() => handleQuantityClick(item)}
//                             title="Click to edit quantity"
//                           >
//                             {item.quantity}
//                           </span>
//                         )}

//                         <Button
//                           variant="outline"
//                           size="sm"
//                           onClick={() => onUpdateQuantity(itemId, item.quantity + 1)}
//                           disabled={item.quantity >= item.stock}
//                           className="h-7 w-7 p-0"
//                         >
//                           <Plus className="w-3 h-3" />
//                         </Button>
//                       </div>

//                       <Button
//                         variant="ghost"
//                         size="sm"
//                         onClick={() => onRemoveItem(itemId)}
//                         className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 px-2"
//                       >
//                         <Trash2 className="w-3 h-3" />
//                       </Button>
//                     </div>
//                   </div>
//                 );
//               })
//             )}
//           </div>

//           {cartItems.length > 0 && <Separator />}

//           {/* Summary Section */}
//           <div className="space-y-3">
//             <div className="flex justify-between items-center">
//               <span className="text-base font-semibold text-gray-900">Subtotal:</span>
//               <span className="text-xl font-bold text-gray-900">₹{total.toFixed(2)}</span>
//             </div>

//             {selectedStudent && cartItems.length > 0 && (
//               <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
//                 <div className="flex justify-between text-sm mb-1">
//                   <span className="text-gray-700">Current Balance:</span>
//                   <span className="font-semibold text-gray-900">₹{selectedStudent.balance.toFixed(2)}</span>
//                 </div>
//                 <div className="flex justify-between text-sm">
//                   <span className="text-gray-700">After Transaction:</span>
//                   <span className={`font-semibold ${selectedStudent.balance >= total ? "text-green-600" : "text-red-600"}`}>
//                     ₹{(selectedStudent.balance - total).toFixed(2)}
//                   </span>
//                 </div>
//               </div>
//             )}

//             {hasInsufficientBalance && (
//               <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
//                 <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
//                 <div className="text-sm text-red-700">
//                   <p className="font-semibold">Insufficient Balance!</p>
//                   <p>Need ₹{deficit.toFixed(2)} more to complete this transaction.</p>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* Action Buttons */}
//           <div className="space-y-2 pt-2">
//             <Button
//               onClick={handleInitiateTransaction}
//               disabled={!canCheckout || createTransactionMutation.isPending}
//               className="w-full bg-green-500 hover:bg-green-600 text-white py-6 text-base font-semibold"
//             >
//               {createTransactionMutation.isPending ? (
//                 <span className="flex items-center gap-2">
//                   <Loader2 className="w-5 h-5 animate-spin" />
//                   Processing...
//                 </span>
//               ) : (
//                 <>
//                   <CreditCard className="w-5 h-5 mr-2" />
//                   Complete Transaction
//                 </>
//               )}
//             </Button>

//             <Button
//               variant="outline"
//               onClick={onClearCart}
//               disabled={!cartItems || cartItems.length === 0 || createTransactionMutation.isPending}
//               className="w-full"
//             >
//               <Trash2 className="w-4 h-4 mr-2" />
//               Clear Cart
//             </Button>
//           </div>
//         </CardContent>
//       </Card>

//       <ConfirmationModal
//         open={showConfirmationModal}
//         onOpenChange={setShowConfirmationModal}
//         onConfirm={handleConfirmTransaction}
//         isLoading={createTransactionMutation.isPending}
//         selectedStudent={selectedStudent}
//         cartItems={cartItems}
//       />

//       <SuccessModal
//         open={showSuccessModal}
//         onOpenChange={setShowSuccessModal}
//         transactionData={transactionData}
//         onClose={handleTransactionSuccess}
//       />
//     </div>
//   );
// }





// // "use client"

// // import { useState, useEffect } from "react"
// // import { useMutation, useQueryClient } from "@tanstack/react-query"
// // import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// // import { Button } from "@/components/ui/button"
// // import { Input } from "@/components/ui/input"
// // import { Badge } from "@/components/ui/badge"
// // import { ShoppingCart as ShoppingCartIcon, Plus, Minus, Trash2, CreditCard } from "lucide-react"
// // import { toast } from "sonner"
// // import SuccessModal from "@/components/modals/success-modal"
// // import ConfirmationModal from "@/components/modals/confirmation-modal"
// // import type { Student, CartItem } from "@/lib/types"

// // interface ShoppingCartProps {
// //   selectedStudent: Student | null
// //   cartItems: CartItem[]
// //   onUpdateQuantity: (itemId: string, newQuantity: number) => void
// //   onRemoveItem: (itemId: string) => void
// //   onClearCart: () => void
// //   onTransactionComplete: () => void
// // }

// // export default function ShoppingCart({
// //   selectedStudent,
// //   cartItems,
// //   onUpdateQuantity,
// //   onRemoveItem,
// //   onClearCart,
// //   onTransactionComplete,
// // }: ShoppingCartProps) {
// //   const [showSuccessModal, setShowSuccessModal] = useState(false)
// //   const [showConfirmationModal, setShowConfirmationModal] = useState(false)
// //   const [transactionData, setTransactionData] = useState<any>(null)
// //   // Feature 4: State for manual quantity editing
// //   const [editingItemId, setEditingItemId] = useState<string | null>(null)
// //   const [editingValue, setEditingValue] = useState("")
// //   const queryClient = useQueryClient()

// //   const processTransactionMutation = useMutation({
// //     mutationFn: async () => {
// //       if (!selectedStudent || cartItems.length === 0) {
// //         throw new Error("No student selected or cart is empty")
// //       }

// //       const items = cartItems.map((item) => ({
// //         productId: item.productId,
// //         subProductId: item.subProductId,
// //         quantity: item.quantity,
// //         price: item.price,
// //         stockTransactionId: item.stockTransactionId
// //       }))

// //       const response = await fetch("/api/transactions", {
// //         method: "POST",
// //         headers: { "Content-Type": "application/json" },
// //         body: JSON.stringify({
// //           studentId: selectedStudent.id,
// //           items,
// //         }),
// //       })

// //       if (!response.ok) {
// //         const error = await response.json()
// //         throw new Error(error.message || "Failed to process transaction")
// //       }

// //       return response.json()
// //     },
// //     onSuccess: (transaction) => {
// //       const totalAmount = cartItems?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0
// //       const remainingBalance = selectedStudent!.balance - totalAmount

// //       setTransactionData({
// //         student: selectedStudent!.name,
// //         amount: totalAmount,
// //         remainingBalance,
// //         id: `#TXN${transaction.id?.toString().padStart(6, "0")}`,
// //         items: cartItems,
// //       })

// //       setShowSuccessModal(true)
// //       setShowConfirmationModal(false)

// //       queryClient.invalidateQueries({ queryKey: ["students"] })
// //       queryClient.invalidateQueries({ queryKey: ["products"] })
// //       queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })

// //       toast.success(`₹${totalAmount.toFixed(2)} deducted from ${selectedStudent!.name}'s account`)
// //     },
// //     onError: (error: Error) => {
// //       toast.error(error.message)
// //       setShowConfirmationModal(false)
// //     },
// //   })

// //   const total = cartItems?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0
// //   const canCheckout = selectedStudent && cartItems?.length > 0 && selectedStudent.balance >= total
// //   const hasInsufficientBalance = selectedStudent && cartItems?.length > 0 && selectedStudent.balance < total

// //   useEffect(() => {
// //     if (hasInsufficientBalance) {
// //       const deficit = total - selectedStudent!.balance
// //       toast.error(`Insufficient balance! Need ₹${deficit.toFixed(2)} more to complete this transaction.`, {
// //         position: "bottom-right",
// //         duration: 4000,
// //       })
// //     }
// //   }, [hasInsufficientBalance, total, selectedStudent])

// //   const handleInitiateTransaction = () => {
// //     if (!canCheckout) return
// //     setShowConfirmationModal(true)
// //   }

// //   const handleConfirmTransaction = () => {
// //     processTransactionMutation.mutate()
// //   }

// //   const handleTransactionSuccess = () => {
// //     setShowSuccessModal(false)
// //     onTransactionComplete()
// //   }

// //   const getItemId = (item: CartItem) => {
// //     if (!item.subProductId) {
// //       console.error("Cart item missing subProductId:", item)
// //       throw new Error("Cart item must have a subProductId")
// //     }
// //     return item.subProductId
// //   }

// //   // Feature 4: Manual quantity editing handlers
// //   const handleQuantityClick = (item: CartItem) => {
// //     const itemId = getItemId(item)
// //     setEditingItemId(itemId)
// //     setEditingValue(item.quantity.toString())
// //   }

// //   const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
// //     const value = e.target.value
// //     // Only allow numeric input
// //     if (value === "" || /^\d+$/.test(value)) {
// //       setEditingValue(value)
// //     }
// //   }

// //   const handleQuantityBlur = (item: CartItem) => {
// //     const itemId = getItemId(item)
// //     const newQuantity = parseInt(editingValue) || 1
    
// //     // Validate quantity
// //     if (newQuantity < 1) {
// //       toast.error("Quantity must be at least 1")
// //       setEditingValue(item.quantity.toString())
// //     } else if (newQuantity > item.stock) {
// //       toast.error(`Only ${item.stock} units available in stock`)
// //       setEditingValue(item.stock.toString())
// //       onUpdateQuantity(itemId, item.stock)
// //     } else {
// //       onUpdateQuantity(itemId, newQuantity)
// //     }
    
// //     setEditingItemId(null)
// //   }

// //   const handleQuantityKeyPress = (e: React.KeyboardEvent, item: CartItem) => {
// //     if (e.key === "Enter") {
// //       handleQuantityBlur(item)
// //     } else if (e.key === "Escape") {
// //       setEditingItemId(null)
// //       setEditingValue("")
// //     }
// //   }

// //   return (
// //     <div className="space-y-6">
// //       <Card className="shadow-lg">
// //         <CardHeader>
// //           <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
// //             <ShoppingCartIcon className="w-5 h-5 mr-2" />
// //             Shopping Cart
// //           </CardTitle>
// //         </CardHeader>
// //         <CardContent>
// //           <div className="space-y-3 max-h-64 overflow-y-auto">
// //             {!cartItems || cartItems.length === 0 ? (
// //               <div className="text-center text-gray-500 py-8">
// //                 <ShoppingCartIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
// //                 <p>No items in cart</p>
// //                 <p className="text-sm">Add products to get started</p>
// //               </div>
// //             ) : (
// //               cartItems.map((item) => {
// //                 const itemId = getItemId(item)
// //                 const isEditing = editingItemId === itemId
                
// //                 return (
// //                   <div
// //                     key={itemId}
// //                     className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
// //                   >
// //                     <div className="flex-1">
// //                       <h4 className="font-medium text-sm text-gray-900">{item.name}</h4>
// //                       <p className="text-xs text-gray-500">₹{item.price?.toFixed(2)} each</p>
// //                       {item.itemType === "subProduct" && <p className="text-xs text-blue-500">Variant</p>}
// //                     </div>
// //                     <div className="flex items-center space-x-2">
// //                       <Button
// //                         variant="outline"
// //                         size="sm"
// //                         onClick={() => onUpdateQuantity(itemId, item.quantity - 1)}
// //                         disabled={item.quantity <= 1}
// //                         className="w-6 h-6 p-0"
// //                       >
// //                         <Minus className="w-3 h-3" />
// //                       </Button>
                      
// //                       {/* Feature 4: Editable quantity field */}
// //                       {isEditing ? (
// //                         <Input
// //                           type="text"
// //                           value={editingValue}
// //                           onChange={handleQuantityChange}
// //                           onBlur={() => handleQuantityBlur(item)}
// //                           onKeyDown={(e) => handleQuantityKeyPress(e, item)}
// //                           className="w-12 h-6 text-center text-sm p-1"
// //                           autoFocus
// //                         />
// //                       ) : (
// //                         <span 
// //                           className="text-sm font-medium w-8 text-center cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5"
// //                           onClick={() => handleQuantityClick(item)}
// //                           title="Click to edit quantity"
// //                         >
// //                           {item.quantity}
// //                         </span>
// //                       )}
                      
// //                       <Button
// //                         variant="outline"
// //                         size="sm"
// //                         onClick={() => onUpdateQuantity(itemId, item.quantity + 1)}
// //                         disabled={item.quantity >= item.stock}
// //                         className="w-6 h-6 p-0"
// //                       >
// //                         <Plus className="w-3 h-3" />
// //                       </Button>
// //                       <Button
// //                         variant="ghost"
// //                         size="sm"
// //                         onClick={() => onRemoveItem(itemId)}
// //                         className="text-red-500 hover:text-red-600 w-6 h-6 p-0 ml-2"
// //                       >
// //                         <Trash2 className="w-3 h-3" />
// //                       </Button>
// //                     </div>
// //                   </div>
// //                 )
// //               })
// //             )}
// //           </div>

// //           <div className="border-t border-gray-200 pt-4 mt-4">
// //             <div className="flex justify-between items-center mb-4">
// //               <span className="text-lg font-semibold text-gray-900">Total:</span>
// //               <span className="text-xl font-bold text-green-500">₹{total.toFixed(2)}</span>
// //             </div>

// //             {selectedStudent && cartItems && cartItems.length > 0 && (
// //               <div className="mb-4 p-3 rounded-lg bg-gray-50">
// //                 <div className="flex justify-between text-sm">
// //                   <span>Current Balance:</span>
// //                   <span className="font-medium">₹{selectedStudent.balance.toFixed(2)}</span>
// //                 </div>
// //                 <div className="flex justify-between text-sm">
// //                   <span>After Transaction:</span>
// //                   <span
// //                     className={`font-medium ${selectedStudent.balance >= total ? "text-green-500" : "text-red-500"}`}
// //                   >
// //                     ₹{(selectedStudent.balance - total).toFixed(2)}
// //                   </span>
// //                 </div>
// //               </div>
// //             )}

// //             <div className="space-y-2">
// //               <Button
// //                 onClick={handleInitiateTransaction}
// //                 disabled={!canCheckout}
// //                 className="w-full bg-green-500 hover:bg-green-600 text-white py-3"
// //               >
// //                 <CreditCard className="w-4 h-4 mr-2" />
// //                 Complete Transaction
// //               </Button>

// //               {!canCheckout &&
// //                 selectedStudent &&
// //                 cartItems &&
// //                 cartItems.length > 0 &&
// //                 selectedStudent.balance < total && (
// //                   <div className="text-center">
// //                     <Badge variant="destructive" className="text-2xs">
// //                       Insufficient Balance
// //                     </Badge>
// //                   </div>
// //                 )}

// //               <Button
// //                 variant="outline"
// //                 onClick={onClearCart}
// //                 disabled={!cartItems || cartItems.length === 0}
// //                 className="w-full bg-transparent"
// //               >
// //                 <Trash2 className="w-4 h-4 mr-2" />
// //                 Clear Cart
// //               </Button>
// //             </div>
// //           </div>
// //         </CardContent>
// //       </Card>

// //       <ConfirmationModal
// //         open={showConfirmationModal}
// //         onOpenChange={setShowConfirmationModal}
// //         onConfirm={handleConfirmTransaction}
// //         isLoading={processTransactionMutation.isPending}
// //         selectedStudent={selectedStudent}
// //         cartItems={cartItems}
// //       />

// //       <SuccessModal
// //         open={showSuccessModal}
// //         onOpenChange={setShowSuccessModal}
// //         transactionData={transactionData}
// //         onClose={handleTransactionSuccess}
// //       />
// //     </div>
// //   )
// // }