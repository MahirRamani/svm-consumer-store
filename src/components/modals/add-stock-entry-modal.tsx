// components/modals/add-stock-entry-modal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Package, Calendar, DollarSign, Hash, Loader2 } from "lucide-react";
import { useCreateStockTransaction } from "@/hooks/use-stock-transaction-mutations";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import type { 
  StockEntryFormData, 
  StockEntryFormErrors 
} from "@/types/stock-transaction";

interface AddStockEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  categoryId: string;
}

interface ProfitCalculation {
  perUnit: number;
  percentage: number;
  total: number;
}

export default function AddStockEntryModal({
  open,
  onOpenChange,
  productId,
  productName,
  categoryId,
}: AddStockEntryModalProps) {
  const createMutation = useCreateStockTransaction();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState<StockEntryFormData>({
    buyingPrice: "",
    sellingPrice: "",
    initialQuantity: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [calculatedProfit, setCalculatedProfit] = useState<ProfitCalculation>({
    perUnit: 0,
    percentage: 0,
    total: 0,
  });

  const [formErrors, setFormErrors] = useState<StockEntryFormErrors>({});

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    const purchase = Number(formData.buyingPrice) || 0;
    const selling = Number(formData.sellingPrice) || 0;
    const quantity = Number(formData.initialQuantity) || 0;

    const profitPerUnit = selling - purchase;
    const profitPercentage = purchase > 0 ? (profitPerUnit / purchase) * 100 : 0;
    const totalProfit = profitPerUnit * quantity;

    setCalculatedProfit({
      perUnit: profitPerUnit,
      percentage: profitPercentage,
      total: totalProfit,
    });
  }, [formData.buyingPrice, formData.sellingPrice, formData.initialQuantity]);

  const resetForm = useCallback(() => {
    setFormData({
      buyingPrice: "",
      sellingPrice: "",
      initialQuantity: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setFormErrors({});
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: StockEntryFormErrors = {};

    // Validate buying price
    if (!formData.buyingPrice.trim()) {
      errors.buyingPrice = "Purchase price is required";
    } else {
      const buyingPrice = Number(formData.buyingPrice);
      if (isNaN(buyingPrice) || buyingPrice < 0) {
        errors.buyingPrice = "Purchase price must be greater or equal to 0";
      }
    }

    // Validate selling price
    if (!formData.sellingPrice.trim()) {
      errors.sellingPrice = "Selling price is required";
    } else {
      const sellingPrice = Number(formData.sellingPrice);
      if (isNaN(sellingPrice) || sellingPrice <= 0) {
        errors.sellingPrice = "Selling price must be greater than 0";
      }
    }

    // Validate quantity
    if (!formData.initialQuantity.trim()) {
      errors.initialQuantity = "Quantity is required";
    } else {
      const quantity = Number(formData.initialQuantity);
      if (isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
        errors.initialQuantity = "Quantity must be a positive whole number";
      }
    }

    // Validate purchase date
    if (!formData.purchaseDate.trim()) {
      errors.purchaseDate = "Purchase date is required";
    } else {
      const selectedDate = new Date(formData.purchaseDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        errors.purchaseDate = "Purchase date cannot be in the future";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleFieldChange = useCallback((
    field: keyof StockEntryFormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (formErrors[field as keyof StockEntryFormErrors]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [formErrors]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the form errors before submitting");
      return;
    }

    if (!isAuthenticated || !user?.id) {
      toast.error("You must be logged in to add stock entries");
      return;
    }

    createMutation.mutate(
      {
        productId,
        categoryId,
        buyingPrice: Number(formData.buyingPrice),
        sellingPrice: Number(formData.sellingPrice),
        initialQuantity: Number(formData.initialQuantity),
        quantityLeft: Number(formData.initialQuantity),
        purchaseDate: new Date(formData.purchaseDate),
        stockType: "Buy",
        notes: formData.notes.trim() || undefined,
        createdBy: user.id,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          onOpenChange(false);
        },
      }
    );
  }, [formData, productId, categoryId, user, isAuthenticated, validateForm, createMutation, queryClient, onOpenChange]);

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      onOpenChange(false);
    }
  }, [createMutation.isPending, onOpenChange]);

  const getProfitColor = (profit: number): string => {
    if (profit > 0) return "text-green-600";
    if (profit < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Package className="w-5 h-5 mr-2 text-blue-500" />
            Add Stock Entry
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-1">
            Record stock information for <span className="font-semibold">{productName}</span>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Purchase Information */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-blue-600" />
              Purchase Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="buyingPrice" className="text-sm font-medium text-gray-700">
                  Purchase Price (per unit) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    ₹
                  </span>
                  <Input
                    id="buyingPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.buyingPrice}
                    onChange={(e) => handleFieldChange("buyingPrice", e.target.value)}
                    placeholder="0.00"
                    className={`pl-8 ${formErrors.buyingPrice ? "border-red-500" : ""}`}
                  />
                </div>
                {formErrors.buyingPrice && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.buyingPrice}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="purchaseDate" className="text-sm font-medium text-gray-700">
                  Purchase Date <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => handleFieldChange("purchaseDate", e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    className={`pl-10 ${formErrors.purchaseDate ? "border-red-500" : ""}`}
                  />
                </div>
                {formErrors.purchaseDate && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.purchaseDate}</p>
                )}
              </div>
            </div>
          </div>

          {/* Selling Information */}
          <div className="bg-green-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-green-600" />
              Selling Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="sellingPrice" className="text-sm font-medium text-gray-700">
                  Selling Price (per unit) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    ₹
                  </span>
                  <Input
                    id="sellingPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => handleFieldChange("sellingPrice", e.target.value)}
                    placeholder="0.00"
                    className={`pl-8 ${formErrors.sellingPrice ? "border-red-500" : ""}`}
                  />
                </div>
                {formErrors.sellingPrice && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.sellingPrice}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="initialQuantity" className="text-sm font-medium text-gray-700">
                  Quantity <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="initialQuantity"
                    type="number"
                    min="1"
                    value={formData.initialQuantity}
                    onChange={(e) => handleFieldChange("initialQuantity", e.target.value)}
                    placeholder="0"
                    className={`pl-10 ${formErrors.initialQuantity ? "border-red-500" : ""}`}
                  />
                </div>
                {formErrors.initialQuantity && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.initialQuantity}</p>
                )}
              </div>
            </div>
          </div>

          {/* Profit Analysis */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Profit Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <p className="text-xs text-gray-600 mb-1">Profit per Unit</p>
                <p className={`text-lg font-bold ${getProfitColor(calculatedProfit.perUnit)}`}>
                  ₹ {calculatedProfit.perUnit.toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <p className="text-xs text-gray-600 mb-1">Profit Margin</p>
                <p className={`text-lg font-bold ${getProfitColor(calculatedProfit.percentage)}`}>
                  {calculatedProfit.percentage.toFixed(2)}%
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <p className="text-xs text-gray-600 mb-1">Total Profit</p>
                <p className={`text-lg font-bold ${getProfitColor(calculatedProfit.total)}`}>
                  ₹ {calculatedProfit.total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              placeholder="Add any additional notes about this stock entry..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              {createMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Adding...
                </div>
              ) : (
                "Add Stock Entry"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// // components/modals/add-stock-entry-modal.tsx
// "use client";

// import { useState, useEffect, useCallback } from "react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { toast } from "sonner";
// import { Package, Calendar, DollarSign, Hash, Loader2 } from "lucide-react";
// import { useCreateStockTransaction } from "@/hooks/use-stock-transaction-mutations";
// import { useQueryClient } from "@tanstack/react-query";
// // Import your auth hook - adjust the import path based on your project structure
// import { useAuth } from "@/hooks/use-auth"; // or wherever your auth context is

// import type { 
//   StockEntryFormData, 
//   StockEntryFormErrors 
// } from "@/types/stock-transaction";

// interface AddStockEntryModalProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   subProductId: string;
//   subProductName: string;
//   productId: string; // Add this
//   categoryId: string; // Add this
// }

// interface ProfitCalculation {
//   perUnit: number;
//   percentage: number;
//   total: number;
// }

// export default function AddStockEntryModal({
//   open,
//   onOpenChange,
//   subProductId,
//   subProductName,
//   productId, // Add this
//   categoryId, // Add this
// }: AddStockEntryModalProps) {
//   const createMutation = useCreateStockTransaction();
//   const queryClient = useQueryClient();
  
//   // Get user from NextAuth session
//   const { user, isAuthenticated } = useAuth();

//   const [formData, setFormData] = useState<StockEntryFormData>({
//     buyingPrice: "",
//     sellingPrice: "",
//     initialQuantity: "",
//     purchaseDate: new Date().toISOString().split("T")[0],
//     notes: "",
//   });

//   const [calculatedProfit, setCalculatedProfit] = useState<ProfitCalculation>({
//     perUnit: 0,
//     percentage: 0,
//     total: 0,
//   });

//   const [formErrors, setFormErrors] = useState<StockEntryFormErrors>({});

//   useEffect(() => {
//     if (!open) {
//       resetForm();
//     }
//   }, [open]);

//   useEffect(() => {
//     const purchase = Number(formData.buyingPrice) || 0;
//     const selling = Number(formData.sellingPrice) || 0;
//     const quantity = Number(formData.initialQuantity) || 0;

//     const profitPerUnit = selling - purchase;
//     const profitPercentage = purchase > 0 ? (profitPerUnit / purchase) * 100 : 0;
//     const totalProfit = profitPerUnit * quantity;

//     setCalculatedProfit({
//       perUnit: profitPerUnit,
//       percentage: profitPercentage,
//       total: totalProfit,
//     });
//   }, [formData.buyingPrice, formData.sellingPrice, formData.initialQuantity]);

//   const resetForm = useCallback(() => {
//     setFormData({
//       buyingPrice: "",
//       sellingPrice: "",
//       initialQuantity: "",
//       purchaseDate: new Date().toISOString().split("T")[0],
//       notes: "",
//     });
//     setFormErrors({});
//   }, []);

//   const validateField = useCallback((name: keyof StockEntryFormData, value: string): string | undefined => {
//     switch (name) {
//       case "buyingPrice":
//         if (!value.trim()) {
//           return "Purchase price is required";
//         }
//         const buyingPrice = Number(value);
//         if (isNaN(buyingPrice) || buyingPrice <= 0) {
//           return "Purchase price must be greater than 0";
//         }
//         break;
//       case "sellingPrice":
//         if (!value.trim()) {
//           return "Selling price is required";
//         }
//         const sellingPrice = Number(value);
//         if (isNaN(sellingPrice) || sellingPrice <= 0) {
//           return "Selling price must be greater than 0";
//         }
//         break;
//       case "initialQuantity":
//         if (!value.trim()) {
//           return "Quantity is required";
//         }
//         const quantity = Number(value);
//         if (isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
//           return "Quantity must be a positive whole number";
//         }
//         break;
//       case "purchaseDate":
//         if (!value.trim()) {
//           return "Purchase date is required";
//         }
//         const selectedDate = new Date(value);
//         const today = new Date();
//         today.setHours(23, 59, 59, 999);
//         if (selectedDate > today) {
//           return "Purchase date cannot be in the future";
//         }
//         break;
//       case "notes":
//         break;
//     }
//     return undefined;
//   }, []);

//   const validateForm = useCallback((): boolean => {
//     const errors: StockEntryFormErrors = {};

//     const buyingPriceError = validateField("buyingPrice", formData.buyingPrice);
//     if (buyingPriceError) errors.buyingPrice = buyingPriceError;

//     const sellingPriceError = validateField("sellingPrice", formData.sellingPrice);
//     if (sellingPriceError) errors.sellingPrice = sellingPriceError;

//     const quantityError = validateField("initialQuantity", formData.initialQuantity);
//     if (quantityError) errors.initialQuantity = quantityError;

//     const dateError = validateField("purchaseDate", formData.purchaseDate);
//     if (dateError) errors.purchaseDate = dateError;

//     setFormErrors(errors);
//     return Object.keys(errors).length === 0;
//   }, [formData, validateField]);

//   const handleFieldChange = useCallback((
//     field: keyof StockEntryFormData,
//     value: string
//   ) => {
//     setFormData(prev => ({ ...prev, [field]: value }));

//     const fieldsWithErrors: (keyof StockEntryFormErrors)[] = [
//       'buyingPrice',
//       'sellingPrice',
//       'initialQuantity',
//       'purchaseDate'
//     ];

//     if (fieldsWithErrors.includes(field as keyof StockEntryFormErrors)) {
//       setFormErrors(prev => ({ ...prev, [field]: undefined }));
//     }
//   }, []);

//   const handleSubmit = useCallback((e: React.FormEvent) => {
//     e.preventDefault();

//     if (!validateForm()) {
//       toast.error("Please fix the form errors before submitting");
//       return;
//     }

//     // Check if user is authenticated
//     if (!isAuthenticated || !user?.id) {
//       toast.error("You must be logged in to add stock entries");
//       return;
//     }

//     createMutation.mutate(
//       {
//         subProductId,
//         productId, // Add this
//         categoryId, // Add this
//         buyingPrice: Number(formData.buyingPrice),
//         sellingPrice: Number(formData.sellingPrice),
//         initialQuantity: Number(formData.initialQuantity),
//         quantityLeft: Number(formData.initialQuantity),
//         purchaseDate: new Date(formData.purchaseDate),
//         transactionType: "Buy",
//         notes: formData.notes.trim() || undefined,
//         createdBy: user.id, // Use actual user ID from auth context
//       },
//       {
//         onSuccess: () => {
//           queryClient.invalidateQueries({ queryKey: ["sub-products"] });
//           queryClient.invalidateQueries({ queryKey: ["stock-transactions"] });
//           queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
//           onOpenChange(false);
//         },
//       }
//     );
//   }, [formData, subProductId, user, validateForm, createMutation, queryClient, onOpenChange]);

//   const handleClose = useCallback(() => {
//     if (!createMutation.isPending) {
//       onOpenChange(false);
//     }
//   }, [createMutation.isPending, onOpenChange]);

//   const getProfitColor = (profit: number): string => {
//     if (profit > 0) return "text-green-600";
//     if (profit < 0) return "text-red-600";
//     return "text-gray-600";
//   };

//   return (
//     <Dialog open={open} onOpenChange={handleClose}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center text-xl">
//             <Package className="w-5 h-5 mr-2 text-blue-500" />
//             Add Stock Entry
//           </DialogTitle>
//           <p className="text-sm text-gray-600 mt-1">
//             Record stock information for <span className="font-semibold">{subProductName}</span>
//           </p>
//         </DialogHeader>

//         <form onSubmit={handleSubmit} className="space-y-6 mt-4">
//           {/* Purchase Information */}
//           <div className="bg-blue-50 p-4 rounded-lg space-y-4">
//             <h3 className="font-semibold text-gray-900 flex items-center">
//               <DollarSign className="w-4 h-4 mr-2 text-blue-600" />
//               Purchase Information
//             </h3>
            
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div className="space-y-1">
//                 <Label htmlFor="buyingPrice" className="text-sm font-medium text-gray-700">
//                   Purchase Price (per unit) <span className="text-red-500">*</span>
//                 </Label>
//                 <div className="relative">
//                   <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
//                     ₹
//                   </span>
//                   <Input
//                     id="buyingPrice"
//                     type="number"
//                     step="0.01"
//                     min="0"
//                     value={formData.buyingPrice}
//                     onChange={(e) => handleFieldChange("buyingPrice", e.target.value)}
//                     placeholder="0.00"
//                     className={`pl-8 ${formErrors.buyingPrice ? "border-red-500" : ""}`}
//                   />
//                 </div>
//                 {formErrors.buyingPrice && (
//                   <p className="text-xs text-red-500 mt-1">{formErrors.buyingPrice}</p>
//                 )}
//               </div>

//               <div className="space-y-1">
//                 <Label htmlFor="purchaseDate" className="text-sm font-medium text-gray-700">
//                   Purchase Date <span className="text-red-500">*</span>
//                 </Label>
//                 <div className="relative">
//                   <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//                   <Input
//                     id="purchaseDate"
//                     type="date"
//                     value={formData.purchaseDate}
//                     onChange={(e) => handleFieldChange("purchaseDate", e.target.value)}
//                     max={new Date().toISOString().split("T")[0]}
//                     className={`pl-10 ${formErrors.purchaseDate ? "border-red-500" : ""}`}
//                   />
//                 </div>
//                 {formErrors.purchaseDate && (
//                   <p className="text-xs text-red-500 mt-1">{formErrors.purchaseDate}</p>
//                 )}
//               </div>
//             </div>
//           </div>

//           {/* Selling Information */}
//           <div className="bg-green-50 p-4 rounded-lg space-y-4">
//             <h3 className="font-semibold text-gray-900 flex items-center">
//               <DollarSign className="w-4 h-4 mr-2 text-green-600" />
//               Selling Information
//             </h3>
            
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div className="space-y-1">
//                 <Label htmlFor="sellingPrice" className="text-sm font-medium text-gray-700">
//                   Selling Price (per unit) <span className="text-red-500">*</span>
//                 </Label>
//                 <div className="relative">
//                   <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
//                     ₹
//                   </span>
//                   <Input
//                     id="sellingPrice"
//                     type="number"
//                     step="0.01"
//                     min="0"
//                     value={formData.sellingPrice}
//                     onChange={(e) => handleFieldChange("sellingPrice", e.target.value)}
//                     placeholder="0.00"
//                     className={`pl-8 ${formErrors.sellingPrice ? "border-red-500" : ""}`}
//                   />
//                 </div>
//                 {formErrors.sellingPrice && (
//                   <p className="text-xs text-red-500 mt-1">{formErrors.sellingPrice}</p>
//                 )}
//               </div>

//               <div className="space-y-1">
//                 <Label htmlFor="initialQuantity" className="text-sm font-medium text-gray-700">
//                   Quantity <span className="text-red-500">*</span>
//                 </Label>
//                 <div className="relative">
//                   <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
//                   <Input
//                     id="initialQuantity"
//                     type="number"
//                     min="1"
//                     value={formData.initialQuantity}
//                     onChange={(e) => handleFieldChange("initialQuantity", e.target.value)}
//                     placeholder="0"
//                     className={`pl-10 ${formErrors.initialQuantity ? "border-red-500" : ""}`}
//                   />
//                 </div>
//                 {formErrors.initialQuantity && (
//                   <p className="text-xs text-red-500 mt-1">{formErrors.initialQuantity}</p>
//                 )}
//               </div>
//             </div>
//           </div>

//           {/* Profit Analysis */}
//           <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg">
//             <h3 className="font-semibold text-gray-900 mb-3">Profit Analysis</h3>
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div className="bg-white p-3 rounded-lg shadow-sm">
//                 <p className="text-xs text-gray-600 mb-1">Profit per Unit</p>
//                 <p className={`text-lg font-bold ${getProfitColor(calculatedProfit.perUnit)}`}>
//                   ₹ {calculatedProfit.perUnit.toFixed(2)}
//                 </p>
//               </div>
//               <div className="bg-white p-3 rounded-lg shadow-sm">
//                 <p className="text-xs text-gray-600 mb-1">Profit Margin</p>
//                 <p className={`text-lg font-bold ${getProfitColor(calculatedProfit.percentage)}`}>
//                   {calculatedProfit.percentage.toFixed(2)}%
//                 </p>
//               </div>
//               <div className="bg-white p-3 rounded-lg shadow-sm">
//                 <p className="text-xs text-gray-600 mb-1">Total Profit</p>
//                 <p className={`text-lg font-bold ${getProfitColor(calculatedProfit.total)}`}>
//                   ₹ {calculatedProfit.total.toFixed(2)}
//                 </p>
//               </div>
//             </div>
//           </div>

//           {/* Additional Notes */}
//           <div className="space-y-1">
//             <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
//               Notes (Optional)
//             </Label>
//             <Textarea
//               id="notes"
//               value={formData.notes}
//               onChange={(e) => handleFieldChange("notes", e.target.value)}
//               placeholder="Add any additional notes about this stock entry..."
//               rows={3}
//               className="resize-none"
//             />
//           </div>

//           {/* Action Buttons */}
//           <div className="flex space-x-3 pt-4 border-t">
//             <Button
//               type="button"
//               variant="outline"
//               onClick={handleClose}
//               disabled={createMutation.isPending}
//               className="flex-1"
//             >
//               Cancel
//             </Button>
//             <Button
//               type="submit"
//               disabled={createMutation.isPending}
//               className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
//             >
//               {createMutation.isPending ? (
//                 <div className="flex items-center gap-2">
//                   <Loader2 size={16} className="animate-spin" />
//                   Adding...
//                 </div>
//               ) : (
//                 "Add Stock Entry"
//               )}
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }