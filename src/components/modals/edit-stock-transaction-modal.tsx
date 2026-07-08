// components/modals/edit-stock-transaction-modal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Loader2, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUpdateStockTransaction } from "@/hooks/use-stock-transaction-mutations";
import type { StockTransaction, StockTransactionFormData, StockTransactionFormErrors, StockTransactionReason } from "@/types/seller/stock-transaction";

interface EditStockTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: StockTransaction | null;
}

type FormField = keyof StockTransactionFormData;

const REASON_OPTIONS: { value: StockTransactionReason; label: string }[] = [
  { value: "Adjustment", label: "Adjustment" },
  { value: "Return", label: "Return" },
  { value: "Damage", label: "Damage" },
  { value: "Expired", label: "Expired" },
  { value: "Loss", label: "Loss" },
];

export default function EditStockTransactionModal({
  open,
  onOpenChange,
  transaction,
}: EditStockTransactionModalProps) {
  const [displayTransaction, setDisplayTransaction] = useState<StockTransaction | null>(null);
  const [formData, setFormData] = useState<StockTransactionFormData>({
    buyingPrice: "",
    sellingPrice: "",
    initialQuantity: "",
    quantityLeft: "",
    reason: "Adjustment",
    notes: "",
  });

  const [errors, setErrors] = useState<StockTransactionFormErrors>({});
  const [touched, setTouched] = useState<Record<FormField, boolean>>({
    buyingPrice: false,
    sellingPrice: false,
    initialQuantity: false,
    quantityLeft: false,
    reason: false,
    notes: false,
  });

  const updateMutation = useUpdateStockTransaction();

  // Helper to convert MongoDB Decimal to number
  const convertToNumber = useCallback((value: any): number => {
    if (typeof value === 'number') return value;
    if (value?.$numberDecimal) return parseFloat(value.$numberDecimal);
    return 0;
  }, []);

  // =============================================
  // EFFECTS
  // =============================================
  useEffect(() => {
    if (open && transaction) {
      setDisplayTransaction(transaction); // Save it
    }
    // Don't clear immediately when closing
  }, [open, transaction]);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setDisplayTransaction(null); // Clear after 300ms
        // Also clear form data
      }, 300); // Match dialog animation duration

      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (transaction && open) {
      setFormData({
        buyingPrice: transaction.buyingPrice ? convertToNumber(transaction.buyingPrice).toString() : "",
        sellingPrice: transaction.sellingPrice ? convertToNumber(transaction.sellingPrice).toString() : "",
        initialQuantity: transaction.initialQuantity.toString(),
        quantityLeft: transaction.quantityLeft.toString(),
        reason: transaction.reason as StockTransactionReason,
        notes: transaction.notes || "",
      });

      setErrors({});
      setTouched({
        buyingPrice: false,
        sellingPrice: false,
        initialQuantity: false,
        quantityLeft: false,
        reason: false,
        notes: false,
      });
    }
  }, [transaction, open, convertToNumber]);

  useEffect(() => {
    if (!open) {
      setFormData({
        buyingPrice: "",
        sellingPrice: "",
        initialQuantity: "",
        quantityLeft: "",
        reason: "Adjustment",
        notes: "",
      });
      setErrors({});
      setTouched({
        buyingPrice: false,
        sellingPrice: false,
        initialQuantity: false,
        quantityLeft: false,
        reason: false,
        notes: false,
      });
    }
  }, [open]);

  // =============================================
  // VALIDATION
  // =============================================
  const validateField = useCallback((name: FormField, value: string): string | undefined => {
    switch (name) {
      case "buyingPrice":
        if (value.trim()) {
          const price = Number(value);
          if (isNaN(price) || price < 0) {
            return "Buying price must be a positive number";
          }
          if (price > 1000000) {
            return "Buying price seems too high";
          }
        }
        break;
      case "sellingPrice":
        if (value.trim()) {
          const price = Number(value);
          if (isNaN(price) || price < 0) {
            return "Selling price must be a positive number";
          }
          if (price > 1000000) {
            return "Selling price seems too high";
          }
        }
        break;
      case "initialQuantity":
        if (!value.trim()) {
          return "Initial quantity is required";
        }
        const initialQty = Number(value);
        if (isNaN(initialQty) || initialQty <= 0 || !Number.isInteger(initialQty)) {
          return "Initial quantity must be a positive integer";
        }
        if (initialQty > 100000) {
          return "Initial quantity seems too high";
        }
        break;
      case "quantityLeft":
        if (!value.trim()) {
          return "Quantity left is required";
        }
        const qtyLeft = Number(value);
        if (isNaN(qtyLeft) || qtyLeft < 0 || !Number.isInteger(qtyLeft)) {
          return "Quantity left must be a non-negative integer";
        }
        // Cross-field validation
        const initialQtyValue = Number(formData.initialQuantity);
        if (!isNaN(initialQtyValue) && qtyLeft > initialQtyValue) {
          return "Quantity left cannot exceed initial quantity";
        }
        break;
      case "reason":
        if (value && !['Adjustment', 'Return', 'Damage', 'Expired', 'Loss'].includes(value)) {
          return "Invalid reason selected";
        }
        break;
      case "notes":
        if (value.trim() && value.trim().length > 500) {
          return "Notes must be less than 500 characters";
        }
        break;
    }
    return undefined;
  }, [formData.initialQuantity]);

  const validateForm = useCallback((): boolean => {
    const newErrors: StockTransactionFormErrors = {};

    Object.keys(formData).forEach((key) => {
      const field = key as FormField;
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  // =============================================
  // HANDLERS
  // =============================================
  const handleChange = useCallback(
    (field: FormField, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setTouched((prev) => ({ ...prev, [field]: true }));

      // Real-time validation
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));

      // Re-validate quantityLeft when initialQuantity changes
      if (field === "initialQuantity" && formData.quantityLeft) {
        const qtyLeftError = validateField("quantityLeft", formData.quantityLeft);
        setErrors((prev) => ({ ...prev, quantityLeft: qtyLeftError }));
      }
    },
    [validateField, formData.quantityLeft]
  );

  const handleBlur = useCallback(
    (field: FormField) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field, formData[field]);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [formData, validateField]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!transaction?._id) return;

      // Mark all fields as touched
      setTouched({
        buyingPrice: true,
        sellingPrice: true,
        initialQuantity: true,
        quantityLeft: true,
        reason: true,
        notes: true,
      });

      if (!validateForm()) {
        toast.error("Please fix the form errors before submitting");
        return;
      }

      updateMutation.mutate({
        _id: transaction._id,
        buyingPrice: formData.buyingPrice ? Number(formData.buyingPrice) : undefined,
        sellingPrice: formData.sellingPrice ? Number(formData.sellingPrice) : undefined,
        initialQuantity: Number(formData.initialQuantity),
        quantityLeft: Number(formData.quantityLeft),
        reason: formData.reason as StockTransactionReason,
        notes: formData.notes.trim() || undefined,
      }, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    },
    [transaction, formData, validateForm, updateMutation, onOpenChange]
  );

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending) {
      onOpenChange(false);
    }
  }, [updateMutation.isPending, onOpenChange]);

  const hasChanges = useCallback((): boolean => {
    if (!transaction) return false;

    return (
      (formData.buyingPrice ? Number(formData.buyingPrice) : undefined) !== transaction.buyingPrice ||
      (formData.sellingPrice ? Number(formData.sellingPrice) : undefined) !== transaction.sellingPrice ||
      Number(formData.initialQuantity) !== transaction.initialQuantity ||
      Number(formData.quantityLeft) !== transaction.quantityLeft ||
      formData.reason !== (transaction.reason || "") ||
      formData.notes.trim() !== (transaction.notes || "")
    );
  }, [transaction, formData]);

  const isFormValid =
    formData.initialQuantity.trim() &&
    formData.quantityLeft.trim() &&
    !errors.buyingPrice &&
    !errors.sellingPrice &&
    !errors.initialQuantity &&
    !errors.quantityLeft &&
    !errors.reason &&
    !errors.notes;

  const canSubmit = isFormValid && hasChanges() && !updateMutation.isPending;

  // =============================================
  // RENDER
  // =============================================
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit Stock Transaction
          </DialogTitle>
        </DialogHeader>

        {displayTransaction && (
          <>
            {/* Transaction Info */}
            <div className="rounded-lg bg-gray-50 p-4 mb-4">
              <div className="flex items-start gap-3">
                {displayTransaction.productId?.imageURL ? (
                  <img
                    src={displayTransaction.productId.imageURL}
                    alt={displayTransaction.productId.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded bg-gray-200 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{displayTransaction.productId?.name || 'Unknown Product'}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {displayTransaction.categoryId?.name}
                    {displayTransaction.productId?.size && ` • ${displayTransaction.productId.size}`}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-gray-600">
                      Type: <span className="font-medium">{displayTransaction.stockType}</span>
                    </span>
                    <span className="text-gray-600">
                      Date: <span className="font-medium">
                        {new Date(displayTransaction.purchaseDate || displayTransaction.date || displayTransaction.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Price Fields Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Buying Price */}
                <div className="space-y-2">
                  <Label htmlFor="buyingPrice">Buying Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <Input
                      id="buyingPrice"
                      type="number"
                      step="0.01"
                      value={formData.buyingPrice}
                      onChange={(e) => handleChange("buyingPrice", e.target.value)}
                      onBlur={() => handleBlur("buyingPrice")}
                      placeholder="0.00"
                      disabled={updateMutation.isPending}
                      className={`pl-8 ${errors.buyingPrice && touched.buyingPrice ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.buyingPrice && touched.buyingPrice && (
                    <p className="text-sm text-destructive">{errors.buyingPrice}</p>
                  )}
                </div>

                {/* Selling Price */}
                <div className="space-y-2">
                  <Label htmlFor="sellingPrice">Selling Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <Input
                      id="sellingPrice"
                      type="number"
                      step="0.01"
                      value={formData.sellingPrice}
                      onChange={(e) => handleChange("sellingPrice", e.target.value)}
                      onBlur={() => handleBlur("sellingPrice")}
                      placeholder="0.00"
                      disabled={updateMutation.isPending}
                      className={`pl-8 ${errors.sellingPrice && touched.sellingPrice ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.sellingPrice && touched.sellingPrice && (
                    <p className="text-sm text-destructive">{errors.sellingPrice}</p>
                  )}
                </div>
              </div>

              {/* Quantity Fields Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Initial Quantity */}
                <div className="space-y-2">
                  <Label htmlFor="initialQuantity">
                    Initial Quantity <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="initialQuantity"
                    type="number"
                    value={formData.initialQuantity}
                    onChange={(e) => handleChange("initialQuantity", e.target.value)}
                    onBlur={() => handleBlur("initialQuantity")}
                    placeholder="0"
                    disabled={updateMutation.isPending}
                    className={errors.initialQuantity && touched.initialQuantity ? "border-destructive" : ""}
                  />
                  {errors.initialQuantity && touched.initialQuantity && (
                    <p className="text-sm text-destructive">{errors.initialQuantity}</p>
                  )}
                </div>

                {/* Quantity Left */}
                <div className="space-y-2">
                  <Label htmlFor="quantityLeft">
                    Quantity Left <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="quantityLeft"
                    type="number"
                    value={formData.quantityLeft}
                    onChange={(e) => handleChange("quantityLeft", e.target.value)}
                    onBlur={() => handleBlur("quantityLeft")}
                    placeholder="0"
                    disabled={updateMutation.isPending}
                    className={errors.quantityLeft && touched.quantityLeft ? "border-destructive" : ""}
                  />
                  {errors.quantityLeft && touched.quantityLeft && (
                    <p className="text-sm text-destructive">{errors.quantityLeft}</p>
                  )}
                </div>
              </div>

              {/* Quantity Warning */}
              {formData.initialQuantity && formData.quantityLeft &&
                Number(formData.quantityLeft) > Number(formData.initialQuantity) && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">Warning</p>
                      <p>Quantity left ({formData.quantityLeft}) exceeds initial quantity ({formData.initialQuantity})</p>
                    </div>
                  </div>
                )}

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Select
                  value={formData.reason}
                  onValueChange={(value) => handleChange("reason", value)}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger className={errors.reason && touched.reason ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.reason && touched.reason && (
                  <p className="text-sm text-destructive">{errors.reason}</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  onBlur={() => handleBlur("notes")}
                  placeholder="Any additional details about this transaction..."
                  disabled={updateMutation.isPending}
                  className={errors.notes && touched.notes ? "border-destructive" : ""}
                  maxLength={500}
                  rows={3}
                />
                {errors.notes && touched.notes && (
                  <p className="text-sm text-destructive">{errors.notes}</p>
                )}
                <p className="text-xs text-gray-500">
                  {formData.notes.length}/500 characters
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {updateMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </span>
                  ) : (
                    "Update Transaction"
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


// // components/modals/edit-stock-transaction-modal.tsx
// "use client";

// import { useState, useEffect, useCallback } from "react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Edit, Loader2, Package, AlertCircle } from "lucide-react";
// import { toast } from "sonner";
// import { useUpdateStockTransaction } from "@/hooks/use-stock-transaction-mutations";
// import type { StockTransaction, StockTransactionFormData, StockTransactionFormErrors } from "@/types/stock-transaction";

// interface EditStockTransactionModalProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   transaction: StockTransaction | null;
// }

// type FormField = keyof StockTransactionFormData;

// // const REASON_OPTIONS: { value: ''; label: string }[] = [
// //   { value: '', label: 'No reason' },
// //   { value: 'purchase', label: 'Purchase' },
// //   { value: 'return', label: 'Return' },
// //   { value: 'damage', label: 'Damage' },
// //   { value: 'expired', label: 'Expired' },
// //   { value: 'adjustment', label: 'Adjustment' },
// // ];

// export default function EditStockTransactionModal({
//   open,
//   onOpenChange,
//   transaction,
// }: EditStockTransactionModalProps) {
//   const [formData, setFormData] = useState<StockTransactionFormData>({
//     buyingPrice: "",
//     sellingPrice: "",
//     initialQuantity: "",
//     quantityLeft: "",
//     // reason: "",
//     notes: "",
//   });

//   const [errors, setErrors] = useState<StockTransactionFormErrors>({});
//   const [touched, setTouched] = useState<Record<FormField, boolean>>({
//     buyingPrice: false,
//     sellingPrice: false,
//     initialQuantity: false,
//     quantityLeft: false,
//     // reason: false,
//     notes: false,
//   });

//   const updateMutation = useUpdateStockTransaction();

//   // =============================================
//   // EFFECTS
//   // =============================================
//   useEffect(() => {
//     if (transaction && open) {
//       setFormData({
//         buyingPrice: transaction.buyingPrice?.toString() || "",
//         sellingPrice: transaction.sellingPrice?.toString() || "",
//         initialQuantity: transaction.initialQuantity.toString(),
//         quantityLeft: transaction.quantityLeft.toString(),
//         // reason: transaction.reason || "",
//         notes: transaction.notes || "",
//       });

//       setErrors({});
//       setTouched({
//         buyingPrice: false,
//         sellingPrice: false,
//         initialQuantity: false,
//         quantityLeft: false,
//         // reason: false,
//         notes: false,
//       });
//     }
//   }, [transaction, open]);

//   useEffect(() => {
//     if (!open) {
//       setFormData({
//         buyingPrice: "",
//         sellingPrice: "",
//         initialQuantity: "",
//         quantityLeft: "",
//         // reason: "",
//         notes: "",
//       });
//       setErrors({});
//       setTouched({
//         buyingPrice: false,
//         sellingPrice: false,
//         initialQuantity: false,
//         quantityLeft: false,
//         // reason: false,
//         notes: false,
//       });
//     }
//   }, [open]);

//   // =============================================
//   // VALIDATION
//   // =============================================
//   const validateField = useCallback((name: FormField, value: string): string | undefined => {
//     switch (name) {
//       case "buyingPrice":
//         if (value.trim()) {
//           const price = Number(value);
//           if (isNaN(price) || price < 0) {
//             return "Buying price must be a positive number";
//           }
//           if (price > 1000000) {
//             return "Buying price seems too high";
//           }
//         }
//         break;
//       case "sellingPrice":
//         if (value.trim()) {
//           const price = Number(value);
//           if (isNaN(price) || price < 0) {
//             return "Selling price must be a positive number";
//           }
//           if (price > 1000000) {
//             return "Selling price seems too high";
//           }
//         }
//         break;
//       case "initialQuantity":
//         if (!value.trim()) {
//           return "Initial quantity is required";
//         }
//         const initialQty = Number(value);
//         if (isNaN(initialQty) || initialQty <= 0 || !Number.isInteger(initialQty)) {
//           return "Initial quantity must be a positive integer";
//         }
//         if (initialQty > 100000) {
//           return "Initial quantity seems too high";
//         }
//         break;
//       case "quantityLeft":
//         if (!value.trim()) {
//           return "Quantity left is required";
//         }
//         const qtyLeft = Number(value);
//         if (isNaN(qtyLeft) || qtyLeft < 0 || !Number.isInteger(qtyLeft)) {
//           return "Quantity left must be a non-negative integer";
//         }
//         // Cross-field validation
//         const initialQtyValue = Number(formData.initialQuantity);
//         if (!isNaN(initialQtyValue) && qtyLeft > initialQtyValue) {
//           return "Quantity left cannot exceed initial quantity";
//         }
//         break;
//       // case "reason":
//       //   if (value && !['purchase', 'return', 'damage', 'expired', 'adjustment', ''].includes(value)) {
//       //     return "Invalid reason selected";
//       //   }
//       //   break;
//       case "notes":
//         if (value.trim() && value.trim().length > 500) {
//           return "Notes must be less than 500 characters";
//         }
//         break;
//     }
//     return undefined;
//   }, [formData.initialQuantity]);

//   const validateForm = useCallback((): boolean => {
//     const newErrors: StockTransactionFormErrors = {};

//     Object.keys(formData).forEach((key) => {
//       const field = key as FormField;
//       const error = validateField(field, formData[field]);
//       if (error) newErrors[field] = error;
//     });

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   }, [formData, validateField]);

//   // =============================================
//   // HANDLERS
//   // =============================================
//   const handleChange = useCallback(
//     (field: FormField, value: string) => {
//       setFormData((prev) => ({ ...prev, [field]: value }));
//       setTouched((prev) => ({ ...prev, [field]: true }));

//       // Real-time validation
//       const error = validateField(field, value);
//       setErrors((prev) => ({ ...prev, [field]: error }));

//       // Re-validate quantityLeft when initialQuantity changes
//       if (field === "initialQuantity" && formData.quantityLeft) {
//         const qtyLeftError = validateField("quantityLeft", formData.quantityLeft);
//         setErrors((prev) => ({ ...prev, quantityLeft: qtyLeftError }));
//       }
//     },
//     [validateField, formData.quantityLeft]
//   );

//   const handleBlur = useCallback(
//     (field: FormField) => {
//       setTouched((prev) => ({ ...prev, [field]: true }));
//       const error = validateField(field, formData[field]);
//       setErrors((prev) => ({ ...prev, [field]: error }));
//     },
//     [formData, validateField]
//   );

//   const handleSubmit = useCallback(
//     (e: React.FormEvent) => {
//       e.preventDefault();

//       if (!transaction?._id) return;

//       // Mark all fields as touched
//       setTouched({
//         buyingPrice: true,
//         sellingPrice: true,
//         initialQuantity: true,
//         quantityLeft: true,
//         // reason: true,
//         notes: true,
//       });

//       if (!validateForm()) {
//         toast.error("Please fix the form errors before submitting");
//         return;
//       }

//       updateMutation.mutate({
//         _id: transaction._id,
//         buyingPrice: formData.buyingPrice ? Number(formData.buyingPrice) : undefined,
//         sellingPrice: formData.sellingPrice ? Number(formData.sellingPrice) : undefined,
//         initialQuantity: Number(formData.initialQuantity),
//         quantityLeft: Number(formData.quantityLeft),
//         // reason: formData.reason || undefined,
//         notes: formData.notes.trim() || undefined,
//       }, {
//         onSuccess: () => {
//           onOpenChange(false);
//         },
//       });
//     },
//     [transaction, formData, validateForm, updateMutation, onOpenChange]
//   );

//   const handleClose = useCallback(() => {
//     if (!updateMutation.isPending) {
//       onOpenChange(false);
//     }
//   }, [updateMutation.isPending, onOpenChange]);

//   const hasChanges = useCallback((): boolean => {
//     if (!transaction) return false;

//     return (
//       (formData.buyingPrice ? Number(formData.buyingPrice) : undefined) !== transaction.buyingPrice ||
//       (formData.sellingPrice ? Number(formData.sellingPrice) : undefined) !== transaction.sellingPrice ||
//       Number(formData.initialQuantity) !== transaction.initialQuantity ||
//       Number(formData.quantityLeft) !== transaction.quantityLeft ||
//       // formData.reason !== (transaction.reason || "") ||
//       formData.notes.trim() !== (transaction.notes || "")
//     );
//   }, [transaction, formData]);

//   const isFormValid =
//     formData.initialQuantity.trim() &&
//     formData.quantityLeft.trim() &&
//     !errors.buyingPrice &&
//     !errors.sellingPrice &&
//     !errors.initialQuantity &&
//     !errors.quantityLeft &&
//     !errors.reason &&
//     !errors.notes;

//   const canSubmit = isFormValid && hasChanges() && !updateMutation.isPending;

//   // =============================================
//   // RENDER
//   // =============================================
//   return (
//     <Dialog open={open} onOpenChange={handleClose}>
//       <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2">
//             <Edit className="w-5 h-5" />
//             Edit Stock Transaction
//           </DialogTitle>
//         </DialogHeader>

//         {transaction && (
//           <>
//             {/* Transaction Info */}
//             <div className="rounded-lg bg-gray-50 p-4 mb-4">
//               <div className="flex items-start gap-3">
//                 {transaction.product?.imageURL ? (
//                   <img
//                     src={transaction.product.imageURL}
//                     alt={transaction.product.name}
//                     className="w-16 h-16 rounded object-cover"
//                   />
//                 ) : (
//                   <div className="w-16 h-16 rounded bg-gray-200 flex items-center justify-center">
//                     <Package className="w-8 h-8 text-gray-400" />
//                   </div>
//                 )}
//                 <div className="flex-1">
//                   <h3 className="font-medium text-gray-900">{transaction.product?.name || 'Unknown Product'}</h3>
//                   <p className="text-sm text-gray-500 mt-1">
//                     {transaction.category?.name}
//                     {transaction.product?.size && ` • ${transaction.product.size}`}
//                   </p>
//                   <div className="flex items-center gap-4 mt-2 text-sm">
//                     <span className="text-gray-600">
//                       Type: <span className="font-medium">{transaction.transactionType}</span>
//                     </span>
//                     <span className="text-gray-600">
//                       Date: <span className="font-medium">
//                         {new Date(transaction.purchaseDate).toLocaleDateString()}
//                       </span>
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* Edit Form */}
//             <form onSubmit={handleSubmit} className="space-y-4">
//               {/* Price Fields Row */}
//               <div className="grid grid-cols-2 gap-4">
//                 {/* Buying Price */}
//                 <div className="space-y-2">
//                   <Label htmlFor="buyingPrice">Buying Price</Label>
//                   <div className="relative">
//                     <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
//                       ₹
//                     </span>
//                     <Input
//                       id="buyingPrice"
//                       type="number"
//                       step="0.01"
//                       value={formData.buyingPrice}
//                       onChange={(e) => handleChange("buyingPrice", e.target.value)}
//                       onBlur={() => handleBlur("buyingPrice")}
//                       placeholder="0.00"
//                       disabled={updateMutation.isPending}
//                       className={`pl-8 ${errors.buyingPrice && touched.buyingPrice ? "border-destructive" : ""}`}
//                     />
//                   </div>
//                   {errors.buyingPrice && touched.buyingPrice && (
//                     <p className="text-sm text-destructive">{errors.buyingPrice}</p>
//                   )}
//                 </div>

//                 {/* Selling Price */}
//                 <div className="space-y-2">
//                   <Label htmlFor="sellingPrice">Selling Price</Label>
//                   <div className="relative">
//                     <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
//                       ₹
//                     </span>
//                     <Input
//                       id="sellingPrice"
//                       type="number"
//                       step="0.01"
//                       value={formData.sellingPrice}
//                       onChange={(e) => handleChange("sellingPrice", e.target.value)}
//                       onBlur={() => handleBlur("sellingPrice")}
//                       placeholder="0.00"
//                       disabled={updateMutation.isPending}
//                       className={`pl-8 ${errors.sellingPrice && touched.sellingPrice ? "border-destructive" : ""}`}
//                     />
//                   </div>
//                   {errors.sellingPrice && touched.sellingPrice && (
//                     <p className="text-sm text-destructive">{errors.sellingPrice}</p>
//                   )}
//                 </div>
//               </div>

//               {/* Quantity Fields Row */}
//               <div className="grid grid-cols-2 gap-4">
//                 {/* Initial Quantity */}
//                 <div className="space-y-2">
//                   <Label htmlFor="initialQuantity">
//                     Initial Quantity <span className="text-destructive">*</span>
//                   </Label>
//                   <Input
//                     id="initialQuantity"
//                     type="number"
//                     value={formData.initialQuantity}
//                     onChange={(e) => handleChange("initialQuantity", e.target.value)}
//                     onBlur={() => handleBlur("initialQuantity")}
//                     placeholder="0"
//                     disabled={updateMutation.isPending}
//                     className={errors.initialQuantity && touched.initialQuantity ? "border-destructive" : ""}
//                   />
//                   {errors.initialQuantity && touched.initialQuantity && (
//                     <p className="text-sm text-destructive">{errors.initialQuantity}</p>
//                   )}
//                 </div>

//                 {/* Quantity Left */}
//                 <div className="space-y-2">
//                   <Label htmlFor="quantityLeft">
//                     Quantity Left <span className="text-destructive">*</span>
//                   </Label>
//                   <Input
//                     id="quantityLeft"
//                     type="number"
//                     value={formData.quantityLeft}
//                     onChange={(e) => handleChange("quantityLeft", e.target.value)}
//                     onBlur={() => handleBlur("quantityLeft")}
//                     placeholder="0"
//                     disabled={updateMutation.isPending}
//                     className={errors.quantityLeft && touched.quantityLeft ? "border-destructive" : ""}
//                   />
//                   {errors.quantityLeft && touched.quantityLeft && (
//                     <p className="text-sm text-destructive">{errors.quantityLeft}</p>
//                   )}
//                 </div>
//               </div>

//               {/* Quantity Warning */}
//               {formData.initialQuantity && formData.quantityLeft &&
//                 Number(formData.quantityLeft) > Number(formData.initialQuantity) && (
//                 <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
//                   <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
//                   <div className="text-sm text-amber-800">
//                     <p className="font-medium">Warning</p>
//                     <p>Quantity left ({formData.quantityLeft}) exceeds initial quantity ({formData.initialQuantity})</p>
//                   </div>
//                 </div>
//               )}

//               {/* Reason */}
//               {/* <div className="space-y-2">
//                 <Label htmlFor="reason">Reason</Label>
//                 <Select
//                   value={formData.reason}
//                   onValueChange={(value) => handleChange("reason", value)}
//                   disabled={updateMutation.isPending}
//                 >
//                   <SelectTrigger className={errors.reason && touched.reason ? "border-destructive" : ""}>
//                     <SelectValue placeholder="Select a reason" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {REASON_OPTIONS.map((option) => (
//                       <SelectItem key={option.value} value={option.value}>
//                         {option.label}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//                 {errors.reason && touched.reason && (
//                   <p className="text-sm text-destructive">{errors.reason}</p>
//                 )}
//               </div> */}

//               {/* Notes */}
//               <div className="space-y-2">
//                 <Label htmlFor="notes">Additional Notes</Label>
//                 <Textarea
//                   id="notes"
//                   value={formData.notes}
//                   onChange={(e) => handleChange("notes", e.target.value)}
//                   onBlur={() => handleBlur("notes")}
//                   placeholder="Any additional details about this transaction..."
//                   disabled={updateMutation.isPending}
//                   className={errors.notes && touched.notes ? "border-destructive" : ""}
//                   maxLength={500}
//                   rows={3}
//                 />
//                 {errors.notes && touched.notes && (
//                   <p className="text-sm text-destructive">{errors.notes}</p>
//                 )}
//                 <p className="text-xs text-gray-500">
//                   {formData.notes.length}/500 characters
//                 </p>
//               </div>

//               {/* Action Buttons */}
//               <div className="flex space-x-3 pt-4">
//                 <Button
//                   type="button"
//                   variant="outline"
//                   onClick={handleClose}
//                   disabled={updateMutation.isPending}
//                   className="flex-1"
//                 >
//                   Cancel
//                 </Button>
//                 <Button
//                   type="submit"
//                   disabled={!canSubmit}
//                   className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
//                 >
//                   {updateMutation.isPending ? (
//                     <span className="flex items-center gap-2">
//                       <Loader2 className="h-4 w-4 animate-spin" />
//                       Updating...
//                     </span>
//                   ) : (
//                     "Update Transaction"
//                   )}
//                 </Button>
//               </div>
//             </form>
//           </>
//         )}
//       </DialogContent>
//     </Dialog>
//   );
// }




// // // components/modals/edit-stock-transaction-modal.tsx
// // "use client";

// // import { useState, useEffect, useCallback } from "react";
// // import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// // import { Button } from "@/components/ui/button";
// // import { Input } from "@/components/ui/input";
// // import { Label } from "@/components/ui/label";
// // import { Textarea } from "@/components/ui/textarea";
// // import { Edit, Loader2, Package } from "lucide-react";
// // import { toast } from "sonner";
// // import { useUpdateStockTransaction } from "@/hooks/use-stock-transaction-mutations";
// // import type { StockTransaction } from "@/types";

// // interface EditStockTransactionModalProps {
// //   open: boolean;
// //   onOpenChange: (open: boolean) => void;
// //   transaction: StockTransaction | null;
// // }

// // interface FormData {
// //   sellingPrice: string;
// //   reason: string;
// //   description: string;
// // }

// // interface FormErrors {
// //   sellingPrice?: string;
// //   reason?: string;
// //   description?: string;
// // }

// // type FormField = keyof FormData;

// // export default function EditStockTransactionModal({
// //   open,
// //   onOpenChange,
// //   transaction,
// // }: EditStockTransactionModalProps) {
// //   const [formData, setFormData] = useState<FormData>({
// //     sellingPrice: "",
// //     reason: "",
// //     description: "",
// //   });

// //   const [errors, setErrors] = useState<FormErrors>({});
// //   const [touched, setTouched] = useState<Record<FormField, boolean>>({
// //     sellingPrice: false,
// //     reason: false,
// //     description: false,
// //   });

// //   // Use existing mutation hook
// //   const updateMutation = useUpdateStockTransaction();

// //   // =============================================
// //   // EFFECTS
// //   // =============================================
// //   // Populate form when transaction changes
// //   useEffect(() => {
// //     if (transaction && open) {
// //       setFormData({
// //         sellingPrice: transaction.sellingPrice.toString(),
// //         reason: transaction.reason || "",
// //         description: transaction.description || "",
// //       });

// //       setErrors({});
// //       setTouched({
// //         sellingPrice: false,
// //         reason: false,
// //         description: false,
// //       });
// //     }
// //   }, [transaction, open]);

// //   // Reset form when modal closes
// //   useEffect(() => {
// //     if (!open) {
// //       setFormData({
// //         sellingPrice: "",
// //         reason: "",
// //         description: "",
// //       });
// //       setErrors({});
// //       setTouched({
// //         sellingPrice: false,
// //         reason: false,
// //         description: false,
// //       });
// //     }
// //   }, [open]);

// //   // =============================================
// //   // VALIDATION
// //   // =============================================
// //   const validateField = useCallback((name: FormField, value: string): string | undefined => {
// //     switch (name) {
// //       case "sellingPrice":
// //         if (!value.trim()) {
// //           return "Selling price is required";
// //         }
// //         const price = Number(value);
// //         if (isNaN(price) || price <= 0) {
// //           return "Selling price must be a positive number";
// //         }
// //         if (price > 1000000) {
// //           return "Selling price seems too high";
// //         }
// //         break;
// //       case "reason":
// //         if (value.trim() && value.trim().length > 200) {
// //           return "Reason must be less than 200 characters";
// //         }
// //         break;
// //       case "description":
// //         if (value.trim() && value.trim().length > 500) {
// //           return "Description must be less than 500 characters";
// //         }
// //         break;
// //     }
// //     return undefined;
// //   }, []);

// //   const validateForm = useCallback((): boolean => {
// //     const newErrors: FormErrors = {};

// //     Object.keys(formData).forEach((key) => {
// //       const field = key as FormField;
// //       const error = validateField(field, formData[field]);
// //       if (error) newErrors[field] = error;
// //     });

// //     setErrors(newErrors);
// //     return Object.keys(newErrors).length === 0;
// //   }, [formData, validateField]);

// //   // =============================================
// //   // HANDLERS
// //   // =============================================
// //   const handleChange = useCallback(
// //     (field: FormField, value: string) => {
// //       setFormData((prev) => ({ ...prev, [field]: value }));
// //       setTouched((prev) => ({ ...prev, [field]: true }));

// //       // Real-time validation
// //       const error = validateField(field, value);
// //       setErrors((prev) => ({ ...prev, [field]: error }));
// //     },
// //     [validateField]
// //   );

// //   const handleBlur = useCallback(
// //     (field: FormField) => {
// //       setTouched((prev) => ({ ...prev, [field]: true }));
// //       const error = validateField(field, formData[field]);
// //       setErrors((prev) => ({ ...prev, [field]: error }));
// //     },
// //     [formData, validateField]
// //   );

// //   const handleSubmit = useCallback(
// //     (e: React.FormEvent) => {
// //       e.preventDefault();

// //       if (!transaction?._id) return;

// //       // Mark all fields as touched
// //       setTouched({
// //         sellingPrice: true,
// //         reason: true,
// //         description: true,
// //       });

// //       if (!validateForm()) {
// //         toast.error("Please fix the form errors before submitting");
// //         return;
// //       }

// //       // Use existing mutation pattern
// //       updateMutation.mutate({
// //         _id: transaction._id,
// //         sellingPrice: Number(formData.sellingPrice),
// //         reason: formData.reason.trim() || undefined,
// //         description: formData.description.trim() || undefined,
// //       }, {
// //         onSuccess: () => {
// //           onOpenChange(false);
// //         },
// //       });
// //     },
// //     [transaction, formData, validateForm, updateMutation, onOpenChange]
// //   );

// //   const handleClose = useCallback(() => {
// //     if (!updateMutation.isPending) {
// //       onOpenChange(false);
// //     }
// //   }, [updateMutation.isPending, onOpenChange]);

// //   // Check if form has any changes from original transaction
// //   const hasChanges = useCallback((): boolean => {
// //     if (!transaction) return false;

// //     return (
// //       Number(formData.sellingPrice) !== transaction.sellingPrice ||
// //       formData.reason.trim() !== (transaction.reason || "") ||
// //       formData.description.trim() !== (transaction.description || "")
// //     );
// //   }, [transaction, formData]);

// //   const isFormValid =
// //     formData.sellingPrice.trim() &&
// //     !errors.sellingPrice &&
// //     !errors.reason &&
// //     !errors.description;

// //   const canSubmit = isFormValid && hasChanges() && !updateMutation.isPending;

// //   // =============================================
// //   // RENDER
// //   // =============================================
// //   return (
// //     <Dialog open={open} onOpenChange={handleClose}>
// //       <DialogContent className="sm:max-w-lg">
// //         <DialogHeader>
// //           <DialogTitle className="flex items-center gap-2">
// //             <Edit className="w-5 h-5" />
// //             Edit Stock Transaction
// //           </DialogTitle>
// //         </DialogHeader>

// //         {transaction && (
// //           <>
// //             {/* Transaction Info */}
// //             <div className="rounded-lg bg-gray-50 p-4 mb-4">
// //               <div className="flex items-start gap-3">
// //                 {transaction.productId.imageURL ? (
// //                   <img
// //                     src={transaction.productId.imageURL}
// //                     alt={transaction.productId.name}
// //                     className="w-16 h-16 rounded object-cover"
// //                   />
// //                 ) : (
// //                   <div className="w-16 h-16 rounded bg-gray-200 flex items-center justify-center">
// //                     <Package className="w-8 h-8 text-gray-400" />
// //                   </div>
// //                 )}
// //                 <div className="flex-1">
// //                   <h3 className="font-medium text-gray-900">{transaction.productId.name}</h3>
// //                   <p className="text-sm text-gray-500 mt-1">
// //                     {transaction.categoryId.name}
// //                     {transaction.productId.size && ` • ${transaction.productId.size}`}
// //                   </p>
// //                   <div className="flex items-center gap-4 mt-2 text-sm">
// //                     <span className="text-gray-600">
// //                       Type: <span className="font-medium">{transaction.transactionType}</span>
// //                     </span>
// //                     <span className="text-gray-600">
// //                       Qty: <span className="font-medium">{transaction.quantityLeft}/{transaction.initialQuantity}</span>
// //                     </span>
// //                   </div>
// //                 </div>
// //               </div>
// //             </div>

// //             {/* Edit Form */}
// //             <form onSubmit={handleSubmit} className="space-y-4">
// //               {/* Selling Price */}
// //               <div className="space-y-2">
// //                 <Label htmlFor="sellingPrice">
// //                   Selling Price <span className="text-destructive">*</span>
// //                 </Label>
// //                 <div className="relative">
// //                   <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
// //                     ₹
// //                   </span>
// //                   <Input
// //                     id="sellingPrice"
// //                     type="number"
// //                     step="0.01"
// //                     value={formData.sellingPrice}
// //                     onChange={(e) => handleChange("sellingPrice", e.target.value)}
// //                     onBlur={() => handleBlur("sellingPrice")}
// //                     placeholder="0.00"
// //                     disabled={updateMutation.isPending}
// //                     className={`pl-8 ${errors.sellingPrice && touched.sellingPrice ? "border-destructive" : ""}`}
// //                   />
// //                 </div>
// //                 {errors.sellingPrice && touched.sellingPrice && (
// //                   <p className="text-sm text-destructive">{errors.sellingPrice}</p>
// //                 )}
// //                 {transaction.buyingPrice && (
// //                   <p className="text-xs text-gray-500">
// //                     Original buying price: ₹{transaction.buyingPrice.toFixed(2)}
// //                   </p>
// //                 )}
// //               </div>

// //               {/* Reason */}
// //               <div className="space-y-2">
// //                 <Label htmlFor="reason">Reason for Edit</Label>
// //                 <Input
// //                   id="reason"
// //                   value={formData.reason}
// //                   onChange={(e) => handleChange("reason", e.target.value)}
// //                   onBlur={() => handleBlur("reason")}
// //                   placeholder="e.g., Price correction, market adjustment..."
// //                   disabled={updateMutation.isPending}
// //                   className={errors.reason && touched.reason ? "border-destructive" : ""}
// //                   maxLength={200}
// //                 />
// //                 {errors.reason && touched.reason && (
// //                   <p className="text-sm text-destructive">{errors.reason}</p>
// //                 )}
// //               </div>

// //               {/* Description */}
// //               <div className="space-y-2">
// //                 <Label htmlFor="description">Additional Notes</Label>
// //                 <Textarea
// //                   id="description"
// //                   value={formData.description}
// //                   onChange={(e) => handleChange("description", e.target.value)}
// //                   onBlur={() => handleBlur("description")}
// //                   placeholder="Any additional details about this transaction..."
// //                   disabled={updateMutation.isPending}
// //                   className={errors.description && touched.description ? "border-destructive" : ""}
// //                   maxLength={500}
// //                   rows={3}
// //                 />
// //                 {errors.description && touched.description && (
// //                   <p className="text-sm text-destructive">{errors.description}</p>
// //                 )}
// //                 <p className="text-xs text-gray-500">
// //                   {formData.description.length}/500 characters
// //                 </p>
// //               </div>

// //               {/* Action Buttons */}
// //               <div className="flex space-x-3 pt-4">
// //                 <Button
// //                   type="button"
// //                   variant="outline"
// //                   onClick={handleClose}
// //                   disabled={updateMutation.isPending}
// //                   className="flex-1"
// //                 >
// //                   Cancel
// //                 </Button>
// //                 <Button
// //                   type="submit"
// //                   disabled={!canSubmit}
// //                   className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
// //                 >
// //                   {updateMutation.isPending ? (
// //                     <span className="flex items-center gap-2">
// //                       <Loader2 className="h-4 w-4 animate-spin" />
// //                       Updating...
// //                     </span>
// //                   ) : (
// //                     "Update Transaction"
// //                   )}
// //                 </Button>
// //               </div>
// //             </form>
// //           </>
// //         )}
// //       </DialogContent>
// //     </Dialog>
// //   );
// // }