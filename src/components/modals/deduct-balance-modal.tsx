// components/modals/deduct-balance-modal.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateStudentBalance } from '@/hooks/use-student-mutations';

interface DeductBalanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
}

interface FormData {
  amount: string;
  reason: string;
}

interface FormErrors {
  amount?: string;
  reason?: string;
}

export default function DeductBalanceModal({ open, onOpenChange, studentId }: DeductBalanceModalProps) {
  const [formData, setFormData] = useState<FormData>({
    amount: "",
    reason: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState({ amount: false, reason: false });

  const updateBalanceMutation = useUpdateStudentBalance();

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData({ amount: "", reason: "" });
      setErrors({});
      setTouched({ amount: false, reason: false });
    }
  }, [open]);

  const validateAmount = useCallback((value: string): string | undefined => {
    if (!value.trim()) {
      return "Amount is required";
    }

    const num = Number(value);
    if (isNaN(num)) {
      return "Amount must be a valid number";
    }
    if (num <= 0) {
      return "Amount must be greater than 0";
    }
    if (num > 100000) {
      return "Amount cannot exceed ₹1,00,000";
    }
    if (!Number.isInteger(num)) {
      return "Amount must be a whole number";
    }

    return undefined;
  }, []);

  const validateReason = useCallback((value: string): string | undefined => {
    if (!value.trim()) {
      return "Reason is required for deductions";
    }
    if (value.trim().length < 3) {
      return "Reason must be at least 3 characters";
    }
    if (value.trim().length > 200) {
      return "Reason must be less than 200 characters";
    }
    return undefined;
  }, []);

  const handleAmountChange = useCallback(
    (value: string) => {
      setFormData((prev) => ({ ...prev, amount: value }));

      if (touched.amount) {
        const error = validateAmount(value);
        setErrors((prev) => ({ ...prev, amount: error }));
      }
    },
    [touched.amount, validateAmount]
  );

  const handleReasonChange = useCallback(
    (value: string) => {
      setFormData((prev) => ({ ...prev, reason: value }));

      if (touched.reason) {
        const error = validateReason(value);
        setErrors((prev) => ({ ...prev, reason: error }));
      }
    },
    [touched.reason, validateReason]
  );

  const handleAmountBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, amount: true }));
    const error = validateAmount(formData.amount);
    setErrors((prev) => ({ ...prev, amount: error }));
  }, [formData.amount, validateAmount]);

  const handleReasonBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, reason: true }));
    const error = validateReason(formData.reason);
    setErrors((prev) => ({ ...prev, reason: error }));
  }, [formData.reason, validateReason]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      console.log("🚀 ~ DeductBalanceModal ~ studentId:", studentId)
      if (!studentId) {
        toast.error("No student selected");
        return;
      }

      // Mark all fields as touched
      setTouched({ amount: true, reason: true });

      const amountError = validateAmount(formData.amount);
      const reasonError = validateReason(formData.reason);

      if (amountError || reasonError) {
        setErrors({ amount: amountError, reason: reasonError });
        toast.error("Please fix the form errors before submitting");
        return;
      }

      updateBalanceMutation.mutate(
        {
          studentId,
          amount: -Number(formData.amount), // Negative for deduction
          reason: formData.reason.trim(),
        },
        {
          onSuccess: () => {
            onOpenChange(false);
          },
        }
      );
    },
    [studentId, formData, validateAmount, validateReason, updateBalanceMutation, onOpenChange]
  );

  const handleClose = useCallback(() => {
    if (!updateBalanceMutation.isPending) {
      onOpenChange(false);
    }
  }, [updateBalanceMutation.isPending, onOpenChange]);

  const canSubmit =
    formData.amount.trim() &&
    formData.reason.trim() &&
    !errors.amount &&
    !errors.reason &&
    !updateBalanceMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Minus className="w-5 h-5 text-red-500" />
            Deduct Balance
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This action will deduct balance from the student's account. Please provide a clear reason.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount (₹) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="1"
              value={formData.amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              onBlur={handleAmountBlur}
              placeholder="Enter amount to deduct"
              disabled={updateBalanceMutation.isPending}
              className={errors.amount && touched.amount ? "border-destructive" : ""}
            />
            {errors.amount && touched.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => handleReasonChange(e.target.value)}
              onBlur={handleReasonBlur}
              placeholder="e.g., Other"
              disabled={updateBalanceMutation.isPending}
              rows={3}
              className={`resize-none ${errors.reason && touched.reason ? "border-destructive" : ""}`}
            />
            {errors.reason && touched.reason && <p className="text-sm text-destructive">{errors.reason}</p>}
            <p className="text-xs text-muted-foreground">{formData.reason.length}/200 characters</p>
          </div>

          {formData.amount && !errors.amount && (
            <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">
                <strong>₹{Number(formData.amount).toFixed(2)}</strong> will be deducted from student's account
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={updateBalanceMutation.isPending} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
              {updateBalanceMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deducting...
                </span>
              ) : (
                "Deduct Balance"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}