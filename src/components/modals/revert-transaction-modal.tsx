// components/modals/revert-transaction-modal.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  RotateCcw, 
  Loader2, 
  AlertTriangle,
  Package,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TransactionType } from "@/types";

// Use base TransactionItem from @/types but extend with display properties
export interface RevertTransactionItem {
  categoryId: string;
  productId: string;
  stockTransactionId: string;
  quantity: number;
  price: number;
  totalPrice: number;
  name?: string;
  size?: string;
}

export interface StudentInfo {
  name: string;
  rollNumber: number;
}

export interface RevertTransaction {
  _id: string;
  student: StudentInfo;
  items: RevertTransactionItem[];
  totalAmount: number;
  status: string;
  createdAt: Date | string;
  type: TransactionType;
}

interface RevertTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: RevertTransaction | null;
}

type RevertType = 'Full' | 'Partial';

export default function RevertTransactionModal({
  open,
  onOpenChange,
  transaction,
}: RevertTransactionModalProps) {
  console.log("🔍 Full transaction object:", transaction);
  console.log("🔍 Transaction items:", transaction?.items);
  const queryClient = useQueryClient();

  const [revertType, setRevertType] = useState<RevertType>('Full');
  const [reason, setReason] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // =============================================
  // MUTATIONS
  // =============================================
  const revertMutation = useMutation({
    mutationFn: async (data: {
      transactionId: string;
      revertType: RevertType;
      reason: string;
      items?: RevertTransactionItem[];
    }) => {
      const response = await fetch(`/api/transactions/${data.transactionId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: data.reason,
          revertType: data.revertType,
          items: data.items,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || 'Failed to revert transaction');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Transaction reverted successfully!');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revert transaction');
    },
  });

  // =============================================
  // COMPUTED VALUES
  // =============================================
  const selectedItemsData = useMemo(() => {
    if (!transaction || revertType === 'Full') return transaction?.items || [];
    
    return transaction.items.filter(item => 
      selectedItems.has(item.productId)
    );
  }, [transaction, selectedItems, revertType]);

  const totalRevertAmount = useMemo(() => {
    return selectedItemsData.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [selectedItemsData]);

  const canSubmit = useMemo(() => {
    if (!reason.trim()) return false;
    if (revertType === 'Partial' && selectedItems.size === 0) return false;
    return !revertMutation.isPending;
  }, [reason, revertType, selectedItems.size, revertMutation.isPending]);

  // =============================================
  // HANDLERS
  // =============================================
  const handleToggleItem = useCallback((productId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!transaction) return;
    
    if (selectedItems.size === transaction.items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(transaction.items.map(item => item.productId)));
    }
  }, [transaction, selectedItems.size]);

  const handleRevertTypeChange = useCallback((type: RevertType) => {
    setRevertType(type);
    if (type === 'Full') {
      setSelectedItems(new Set());
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!transaction || !canSubmit) return;

      const itemsToRevert = revertType === 'Full' 
        ? undefined 
        : selectedItemsData.map(item => ({
            categoryId: item.categoryId,
            productId: item.productId,
            stockTransactionId: item.stockTransactionId,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice,
          }));
      console.log("🚀 ~ RevertTransactionModal ~ itemsToRevert:", itemsToRevert)

      revertMutation.mutate({
        transactionId: transaction._id,
        revertType,
        reason: reason.trim(),
        items: itemsToRevert,
      });
    },
    [transaction, canSubmit, revertType, selectedItemsData, reason, revertMutation]
  );

  const handleClose = useCallback(() => {
    if (!revertMutation.isPending) {
      setRevertType('Full');
      setReason('');
      setSelectedItems(new Set());
      onOpenChange(false);
    }
  }, [revertMutation.isPending, onOpenChange]);

  // =============================================
  // RENDER
  // =============================================
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-600" />
            Revert Transaction
          </DialogTitle>
        </DialogHeader>

        {transaction && (
          <>
            {/* Warning Alert */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Warning: This action cannot be undone</p>
                <p className="mt-1">
                  Reverting will restore the student's balance and return items to stock.
                </p>
              </div>
            </div>

            {/* Transaction Info */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Student</p>
                  <p className="font-medium text-gray-900">
                    {transaction.student.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {transaction.student.rollNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transaction Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Original Amount</p>
                  <p className="font-medium text-gray-900">
                    ₹{transaction.totalAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Items Count</p>
                  <p className="font-medium text-gray-900">
                    {transaction.items.length} item{transaction.items.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Revert Type Selection */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label>Revert Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleRevertTypeChange('Full')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      revertType === 'Full'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">Full Revert</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Revert entire transaction
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevertTypeChange('Partial')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      revertType === 'Partial'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">Partial Revert</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Select specific items
                    </p>
                  </button>
                </div>
              </div>

              {/* Items List (for Partial revert) */}
              {revertType === 'Partial' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Select Items to Revert</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      {selectedItems.size === transaction.items.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {transaction.items.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50"
                      >
                        <Checkbox
                          checked={selectedItems.has(item.productId)}
                          onCheckedChange={() => handleToggleItem(item.productId)}
                        />
                        <Package className="w-8 h-8 text-gray-400" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {item.name || 'Unknown Product'}
                            {item.size && <span className="text-gray-500"> • {item.size}</span>}
                          </p>
                          <p className="text-sm text-gray-600">
                            Qty: {item.quantity} × ₹{Number(item.price || 0).toFixed(2)} = ₹{Number(item.totalPrice || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revert Summary */}
              <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900">Amount to Restore</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">
                    ₹{Number(totalRevertAmount || 0).toFixed(2)}
                  </span>
                </div>
                {revertType === 'Partial' && (
                  <p className="text-sm text-gray-600 mt-2">
                    {selectedItems.size} of {transaction.items.length} items selected
                  </p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Reason for Revert <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a reason for reverting this transaction..."
                  disabled={revertMutation.isPending}
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500">
                  {reason.length}/500 characters
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={revertMutation.isPending}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {revertMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reverting...
                    </span>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Revert Transaction
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}