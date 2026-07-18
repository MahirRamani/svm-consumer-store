// components/pos/confirmation-modal.tsx
"use client";

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, CreditCard, X, ShoppingCart } from 'lucide-react';
import type { Student, CartItem } from '@/types/seller/pos';
import { WILD_ROLL_NUMBERS } from '@/lib/constant';

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