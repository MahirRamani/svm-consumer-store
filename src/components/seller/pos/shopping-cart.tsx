// components/admin/pos/shopping-cart.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart as ShoppingCartIcon, Plus, Minus, Trash2, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import SuccessModal from '@/components/modals/success-modal';
import ConfirmationModal from '@/components/modals/confirmation-modal';

import type {
  Student,
  CartItem,
  TransactionItem,
  TransactionData,
  TransactionApiResponse
} from "@/types/seller/pos";
import { WILD_ROLL_NUMBERS } from '@/lib/constant';
import { ObjectId } from 'mongoose';
import { useSession } from 'next-auth/react';
import { ApiResponse } from '@/lib/api/base-handler';

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
  performedBy: ObjectId;
}

export default function ShoppingCart({
  selectedStudent,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onTransactionComplete,
}: ShoppingCartProps) {
  const { data: session } = useSession();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [transactionData, setTransactionData] = useState<TransactionData | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [showBottomToast, setShowBottomToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const queryClient = useQueryClient();

  const processTransactionMutation = useMutation<
    ApiResponse<TransactionApiResponse>,
    Error,
    CreateTransactionPayload
  >({
    mutationFn: async (payload) => {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result: ApiResponse<TransactionApiResponse> = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "Failed to process transaction");
      }

      return result;
    },
    onSuccess: (response) => {
      if (!response.data?.transaction || !selectedStudent) return;

      const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const remainingBalance = selectedStudent.balance - totalAmount;

      const transactionId = response.data.transaction._id;

      setTransactionData({
        student: selectedStudent.name,
        amount: totalAmount,
        remainingBalance,
        _id: transactionId,
        items: cartItems,
      });

      setShowSuccessModal(true);
      setShowConfirmationModal(false);

      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["fifo-stocks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

      // toast.success(`₹${totalAmount.toFixed(2)} deducted from ${selectedStudent.name}'s account`);
      setToastMessage(`₹${totalAmount.toFixed(2)} deducted from ${selectedStudent.name}'s account`);
      setShowBottomToast(true);

      // Auto hide after 2 seconds
      setTimeout(() => setShowBottomToast(false), 2000);
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
    if (selectedStudent && WILD_ROLL_NUMBERS.includes(selectedStudent.rollNumber)) {
      return true;
    }
    return selectedStudent && cartItems.length > 0 && selectedStudent.balance >= total;
  }, [selectedStudent, cartItems, total]);

  const hasInsufficientBalance = useMemo(() => {
    if (selectedStudent && WILD_ROLL_NUMBERS.includes(selectedStudent.rollNumber)) {
      return false;
    }
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
      categoryId: item.categoryId,
      stockTransactionId: item.stockTransactionId,
      quantity: item.quantity,
      price: item.price,
    }));

    processTransactionMutation.mutate({
      studentId: selectedStudent._id,
      items,
      performedBy: session?.user.id as unknown as ObjectId,
    });
  }, [selectedStudent, cartItems, processTransactionMutation]);

  const handleTransactionSuccess = useCallback(() => {
    setShowSuccessModal(false);
    setTransactionData(null);
    onTransactionComplete();
  }, [onTransactionComplete]);

  const getItemId = useCallback((item: CartItem): string => {
    return item.productId;
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
    <div className="h-full flex flex-col">
      <Card className="shadow-lg h-full flex flex-col">
        <CardHeader className="shrink-0">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <ShoppingCartIcon className="w-5 h-5 mr-2" />
            Shopping Cart
            {cartItems.length > 0 && (
              <Badge className="ml-2 bg-blue-500">{cartItems.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-10">
          {/* Scrollable cart items section */}
          <div className="flex-1 overflow-y-auto mb-4 min-h-30">
            <div className="space-y-3">
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
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.imageURL ? (
                          <img
                            src={item.imageURL}
                            alt={item.name}
                            className="w-10 h-10 rounded object-cover shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                            <ShoppingCartIcon className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm text-gray-900 truncate">{item.name}</h4>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-500">₹{item.price.toFixed(2)} each</p>
                            {item.size && (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {item.size}
                              </Badge>
                            )}
                          </div>
                        </div>
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
          </div>

          {/* Fixed footer section with total and buttons */}
          <div className="border-t border-gray-200 pt-4 shrink-0">
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
                    className={`font-medium ${selectedStudent.balance >= total ? "text-green-500" : "text-red-500"
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

              {!canCheckout && hasInsufficientBalance && selectedStudent && (
                <div className="text-center">
                  <Badge variant="destructive" className="text-xs">
                    Insufficient Balance (Need ₹{(total - selectedStudent.balance).toFixed(2)} more)
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={showConfirmationModal}
        onOpenChange={setShowConfirmationModal}
        onConfirm={handleConfirmTransaction}
        isLoading={processTransactionMutation.isPending}
        selectedStudent={selectedStudent}
        cartItems={cartItems}
      />

      {/* Success Modal */}
      <SuccessModal
        open={showSuccessModal}
        onOpenChange={(open) => {
          setShowSuccessModal(open);
          if (!open) {
            onTransactionComplete();
          }
        }}
        transactionData={transactionData}
        onClose={handleTransactionSuccess}
      />

      {showBottomToast && (
        <div className="fixed bottom-4 right-4 z-75 animate-in slide-in-from-bottom">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}