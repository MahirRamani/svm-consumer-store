"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { X, Loader2, FileText, ImageIcon, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useCreateAccountTransaction } from '@/hooks/use-account-transaction-mutations';
import { validateFile, uploadFile, deleteFile, UploadResult } from '@/lib/utils/upload-file';
import { toLocalDateTimeString } from '@/lib/utils/dates';
import type { Account } from '@/types/admin/account';

interface AddAccountTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
}

interface TransactionFormData {
  type: "CREDIT" | "DEBIT";
  amount: string;
  note: string;
  enteredAt: string;
}

interface FormErrors {
  amount?: string;
  note?: string;
  enteredAt?: string;
}

const getInitialFormData = (): TransactionFormData => ({
  type: "CREDIT",
  amount: "",
  note: "",
  enteredAt: toLocalDateTimeString(new Date()),
});

export default function AddAccountTransactionModal({
  open,
  onOpenChange,
  account,
}: AddAccountTransactionModalProps) {
  const createMutation = useCreateAccountTransaction();

  const [formData, setFormData] = useState<TransactionFormData>(getInitialFormData());
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreview, setBillPreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const billFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData());
      setErrors({});
      setTouched({});
      setBillFile(null);
      setBillPreview("");
      if (billFileInputRef.current) billFileInputRef.current.value = "";
    }
  }, [open]);

  const handleChange = useCallback((field: keyof TransactionFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [touched]);

  const handleBlur = useCallback((field: keyof TransactionFormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleBillFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file, 'bill'); // 👈 shared utility
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setBillFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setBillPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setBillPreview("pdf");
    }
  }, []);

  const removeBillFile = useCallback(() => {
    setBillFile(null);
    setBillPreview("");
    if (billFileInputRef.current) billFileInputRef.current.value = "";
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.amount.trim()) {
      newErrors.amount = "Amount is required";
    } else {
      const num = parseFloat(formData.amount);
      if (isNaN(num) || num <= 0) {
        newErrors.amount = "Amount must be greater than 0";
      } else if (num > 10000000) {
        newErrors.amount = "Amount is too large";
      }
    }

    if (!formData.note.trim()) {
      newErrors.note = "Note is required";
    } else if (formData.note.length < 3) {
      newErrors.note = "Note cannot be less than 3 characters";
    } else if (formData.note.length > 50) {
      newErrors.note = "Note cannot exceed 50 characters";
    }

    if (!formData.enteredAt) {
      newErrors.enteredAt = "Date & time is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const uploadBill = useCallback(async (): Promise<UploadResult | null> => {
    if (!billFile) return null;
    setIsUploading(true);
    try {
      const result = await uploadFile({ // 👈 shared utility
        file: billFile,
        context: 'bill',
      });
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bill upload failed");
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [billFile]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    setTouched({ amount: true, note: true, enteredAt: true });
    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    let billUrl: string | undefined;
    let uploadedPublicId: string | undefined;
    let uploadedResourceType: "image" | "raw" = "image";

    if (billFile) {
      try {
        const result = await uploadBill();
        if (result) {
          billUrl = result.secure_url;
          uploadedPublicId = result.public_id; // 👈 track for cleanup
          uploadedResourceType = billFile.type === "application/pdf" ? "raw" : "image";
        }
      } catch {
        return;
      }
    }

    createMutation.mutate(
      {
        accountId: account._id,
        type: formData.type,
        amount: parseFloat(formData.amount),
        note: formData.note.trim(),
        billUrl,
        enteredAt: new Date(formData.enteredAt),
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: async () => {
          // ✅ No orphan — cleanup if DB save failed
          if (uploadedPublicId) {
            await deleteFile(uploadedPublicId, uploadedResourceType); // 👈 shared utility
          }
        },
      }
    );
  }, [account, formData, billFile, validateForm, uploadBill, createMutation, onOpenChange]);
  
  const handleClose = useCallback(() => {
    if (!createMutation.isPending && !isUploading) {
      onOpenChange(false);
    }
  }, [createMutation.isPending, isUploading, onOpenChange]);

  const getPreviewBalance = useCallback(() => {
    if (!account || !formData.amount) return null;
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) return null;
    return formData.type === "CREDIT"
      ? account.currentBalance + amount
      : account.currentBalance - amount;
  }, [account, formData.amount, formData.type]);

  if (!account) return null;

  const isSubmitting = createMutation.isPending || isUploading;
  const isFormValid = formData.amount.trim() && !errors.amount && formData.enteredAt && formData.note.trim();
  const previewBalance = getPreviewBalance();
  const formatCurrency = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Transaction - {account.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Transaction Type <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={formData.type === "CREDIT" ? "default" : "outline"}
                className={`h-14 flex flex-col gap-1 ${formData.type === "CREDIT"
                  ? "bg-green-500 hover:bg-green-600"
                  : "hover:bg-green-50 hover:border-green-300"
                  }`}
                onClick={() => handleChange("type", "CREDIT")}
              >
                <TrendingUp className="w-5 h-5" />
                <span className="text-xs">Credit (+)</span>
              </Button>
              <Button
                type="button"
                variant={formData.type === "DEBIT" ? "default" : "outline"}
                className={`h-14 flex flex-col gap-1 ${formData.type === "DEBIT"
                  ? "bg-red-500 hover:bg-red-600"
                  : "hover:bg-red-50 hover:border-red-300"
                  }`}
                onClick={() => handleChange("type", "DEBIT")}
              >
                <TrendingDown className="w-5 h-5" />
                <span className="text-xs">Debit (−)</span>
              </Button>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                id="amount"
                type="number"
                step="1"
                min="1"
                value={formData.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
                onBlur={() => handleBlur("amount")}
                placeholder="0"
                className={`pl-7 text-lg ${errors.amount && touched.amount ? "border-destructive" : ""}`}
              />
            </div>
            {errors.amount && touched.amount && (
              <p className="text-sm text-destructive">{errors.amount}</p>
            )}
          </div>

          {/* Date & Time */}
          <div className="space-y-2">
            <Label htmlFor="enteredAt" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date & Time <span className="text-destructive">*</span>
            </Label>
            <Input
              id="enteredAt"
              type="datetime-local"
              value={formData.enteredAt}
              onChange={(e) => handleChange("enteredAt", e.target.value)}
              onBlur={() => handleBlur("enteredAt")}
              className={errors.enteredAt && touched.enteredAt ? "border-destructive" : ""}
            />
            {errors.enteredAt && touched.enteredAt && (
              <p className="text-sm text-destructive">{errors.enteredAt}</p>
            )}
          </div>

          {/* Bill Attachment */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Bill Attachment (Optional)
            </Label>

            {billPreview && (
              <div className="relative inline-block">
                {billPreview === "pdf" ? (
                  <div className="w-24 h-24 rounded-lg border bg-red-50 flex flex-col items-center justify-center gap-1">
                    <FileText className="w-8 h-8 text-red-500" />
                    <span className="text-xs text-red-600 font-medium">PDF</span>
                  </div>
                ) : (
                  <img
                    src={billPreview}
                    alt="Bill preview"
                    className="w-24 h-24 object-cover rounded-lg border"
                  />
                )}
                <button
                  type="button"
                  onClick={removeBillFile}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={billFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleBillFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => billFileInputRef.current?.click()}
                disabled={isSubmitting}
                className="flex items-center gap-2"
              >
                <ImageIcon size={14} />
                {billFile ? "Change Bill" : "Upload Bill"}
              </Button>
              {billFile && (
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {billFile.name}
                </span>
              )}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Note <span className="text-destructive">*</span></Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => handleChange("note", e.target.value)}
              onBlur={() => handleBlur("note")}
              placeholder="e.g., Sold groceries, Paid supplier..."
              rows={2}
              className={errors.note ? "border-destructive" : ""}
            />
            {errors.note && touched.note && (
              <p className="text-sm text-destructive">{errors.note}</p>
            )}
          </div>

          {/* Balance Preview */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-medium">{formatCurrency(account.currentBalance)}</span>
            </div>
            {previewBalance !== null && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {formData.type === "CREDIT" ? "Adding" : "Subtracting"}
                  </span>
                  <span className={formData.type === "CREDIT" ? "text-green-600" : "text-red-600"}>
                    {formData.type === "CREDIT" ? "+" : "−"}
                    {formatCurrency(parseFloat(formData.amount))}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-medium">New Balance</span>
                  <span className={`font-bold text-lg ${previewBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(previewBalance)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className={`flex-1 ${formData.type === "CREDIT"
                ? "bg-green-500 hover:bg-green-600"
                : "bg-red-500 hover:bg-red-600"
                }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isUploading ? "Uploading..." : "Recording..."}
                </>
              ) : (
                `Record ${formData.type === "CREDIT" ? "Credit" : "Debit"}`
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// "use client";

// import { useState, useCallback, useEffect } from 'react';
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
// import { Loader2, TrendingUp, TrendingDown, Link2, Calendar } from 'lucide-react';
// import { toast } from 'sonner';
// import { useCreateAccountTransaction } from '@/hooks/use-account-transaction-mutations';
// import type { Account } from '@/types/admin/account';

// interface AddAccountTransactionModalProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
//   account: Account | null;
// }

// interface FormData {
//   type: "CREDIT" | "DEBIT";
//   amount: string;
//   note: string;
//   billUrl: string;
//   enteredAt: string;
// }

// interface FormErrors {
//   amount?: string;
//   note?: string;
//   billUrl?: string;
//   enteredAt?: string;
// }

// // ✅ Helper — add this above getInitialFormData
// const toLocalDateTimeString = (date: Date): string => {
//   const offset = date.getTimezoneOffset() * 60000;
//   return new Date(date.getTime() - offset).toISOString().slice(0, 16);
// };

// const getInitialFormData = (): FormData => ({
//   type: "CREDIT",
//   amount: "",
//   note: "",
//   billUrl: "",
//   enteredAt: toLocalDateTimeString(new Date()), // ✅ local time now
// });

// export default function AddAccountTransactionModal({
//   open,
//   onOpenChange,
//   account,
// }: AddAccountTransactionModalProps) {
//   const createMutation = useCreateAccountTransaction();

//   const [formData, setFormData] = useState<FormData>(getInitialFormData());
//   const [errors, setErrors] = useState<FormErrors>({});
//   const [touched, setTouched] = useState<Record<string, boolean>>({});

//   // Reset on open
//   useEffect(() => {
//     if (open) {
//       setFormData(getInitialFormData());
//       setErrors({});
//       setTouched({});
//     }
//   }, [open]);

//   const validateForm = useCallback((): boolean => {
//     const newErrors: FormErrors = {};

//     if (!formData.amount.trim()) {
//       newErrors.amount = "Amount is required";
//     } else {
//       const num = parseFloat(formData.amount);
//       if (isNaN(num) || num <= 0) {
//         newErrors.amount = "Amount must be greater than 0";
//       } else if (num > 10000000) {
//         newErrors.amount = "Amount is too large";
//       }
//     }

//     if (formData.note.length > 50) {
//       newErrors.note = "Note cannot exceed 50 characters";
//     }

//     if (formData.billUrl.trim()) {
//       try {
//         new URL(formData.billUrl);
//       } catch {
//         newErrors.billUrl = "Invalid URL format";
//       }
//     }

//     if (!formData.enteredAt) {
//       newErrors.enteredAt = "Date & time is required";
//     }

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   }, [formData]);

//   const handleChange = useCallback((field: keyof FormData, value: string) => {
//     setFormData((prev) => ({ ...prev, [field]: value }));
//     if (touched[field]) {
//       setErrors((prev) => ({ ...prev, [field]: undefined }));
//     }
//   }, [touched]);

//   const handleBlur = useCallback((field: keyof FormData) => {
//     setTouched((prev) => ({ ...prev, [field]: true }));
//   }, []);

//   const handleSubmit = useCallback(async (e: React.FormEvent) => {
//     e.preventDefault();

//     if (!account) return;

//     setTouched({ amount: true, note: true, billUrl: true, enteredAt: true });

//     if (!validateForm()) {
//       toast.error("Please fix the form errors");
//       return;
//     }

//     createMutation.mutate(
//       {
//         accountId: account._id,
//         type: formData.type,
//         amount: parseFloat(formData.amount),
//         note: formData.note.trim() || undefined,
//         billUrl: formData.billUrl.trim() || null,
//         enteredAt: new Date(formData.enteredAt),
//       },
//       {
//         onSuccess: () => onOpenChange(false),
//       }
//     );
//   }, [account, formData, validateForm, createMutation, onOpenChange]);

//   const handleClose = useCallback(() => {
//     if (!createMutation.isPending) {
//       onOpenChange(false);
//     }
//   }, [createMutation.isPending, onOpenChange]);

//   // Preview balance
//   const getPreviewBalance = useCallback(() => {
//     if (!account || !formData.amount) return null;
//     const amount = parseFloat(formData.amount);
//     if (isNaN(amount) || amount <= 0) return null;

//     return formData.type === "CREDIT"
//       ? account.currentBalance + amount
//       : account.currentBalance - amount;
//   }, [account, formData.amount, formData.type]);

//   if (!account) return null;

//   const isSubmitting = createMutation.isPending;
//   const isFormValid = formData.amount.trim() && !errors.amount && formData.enteredAt;
//   const previewBalance = getPreviewBalance();

//   const formatCurrency = (amount: number) =>
//     `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

//   return (
//     <Dialog open={open} onOpenChange={handleClose}>
//       <DialogContent className="max-w-md">
//         <DialogHeader>
//           <DialogTitle>Add Transaction - {account.name}</DialogTitle>
//         </DialogHeader>

//         <form onSubmit={handleSubmit} className="space-y-4">
//           {/* Type Selection */}
//           <div className="space-y-2">
//             <Label>Transaction Type <span className="text-destructive">*</span> </Label>
//             <div className="grid grid-cols-2 gap-3">
//               <Button
//                 type="button"
//                 variant={formData.type === "CREDIT" ? "default" : "outline"}
//                 className={`h-14 flex flex-col gap-1 ${formData.type === "CREDIT"
//                   ? "bg-green-500 hover:bg-green-600"
//                   : "hover:bg-green-50 hover:border-green-300"
//                   }`}
//                 onClick={() => handleChange("type", "CREDIT")}
//               >
//                 <TrendingUp className="w-5 h-5" />
//                 <span className="text-xs">Credit (+)</span>
//               </Button>
//               <Button
//                 type="button"
//                 variant={formData.type === "DEBIT" ? "default" : "outline"}
//                 className={`h-14 flex flex-col gap-1 ${formData.type === "DEBIT"
//                   ? "bg-red-500 hover:bg-red-600"
//                   : "hover:bg-red-50 hover:border-red-300"
//                   }`}
//                 onClick={() => handleChange("type", "DEBIT")}
//               >
//                 <TrendingDown className="w-5 h-5" />
//                 <span className="text-xs">Debit (−)</span>
//               </Button>
//             </div>
//           </div>

//           {/* Amount */}
//           <div className="space-y-2">
//             <Label htmlFor="amount">
//               Amount <span className="text-destructive">*</span>
//             </Label>
//             <div className="relative">
//               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
//               <Input
//                 id="amount"
//                 type="number"
//                 step="0.01"
//                 min="0.01"
//                 value={formData.amount}
//                 onChange={(e) => handleChange("amount", e.target.value)}
//                 onBlur={() => handleBlur("amount")}
//                 placeholder="0.00"
//                 className={`pl-7 text-lg ${errors.amount && touched.amount ? "border-destructive" : ""}`}
//               />
//             </div>
//             {errors.amount && touched.amount && (
//               <p className="text-sm text-destructive">{errors.amount}</p>
//             )}
//           </div>

//           {/* Date & Time */}
//           <div className="space-y-2">
//             <Label htmlFor="enteredAt" className="flex items-center gap-2">
//               <Calendar className="w-4 h-4" />
//               Date & Time <span className="text-destructive">*</span>
//             </Label>
//             <Input
//               id="enteredAt"
//               type="datetime-local"
//               value={formData.enteredAt}
//               onChange={(e) => handleChange("enteredAt", e.target.value)}
//               onBlur={() => handleBlur("enteredAt")}
//               className={errors.enteredAt && touched.enteredAt ? "border-destructive" : ""}
//             />
//             {errors.enteredAt && touched.enteredAt && (
//               <p className="text-sm text-destructive">{errors.enteredAt}</p>
//             )}
//           </div>

//           {/* Note */}
//           <div className="space-y-2">
//             <Label htmlFor="note">Note <span className="text-destructive">*</span> </Label>
//             <Textarea
//               id="note"
//               value={formData.note}
//               onChange={(e) => handleChange("note", e.target.value)}
//               onBlur={() => handleBlur("note")}
//               placeholder="e.g., Sold groceries, Paid supplier..."
//               rows={2}
//               className={errors.note ? "border-destructive" : ""}
//             />
//             {errors.note && touched.note && (
//               <p className="text-sm text-destructive">{errors.note}</p>
//             )}
//           </div>

//           {/* Bill URL */}
//           <div className="space-y-2">
//             <Label htmlFor="billUrl" className="flex items-center gap-2">
//               <Link2 className="w-4 h-4" />
//               Bill URL (Optional)
//             </Label>
//             <Input
//               id="billUrl"
//               type="url"
//               value={formData.billUrl}
//               onChange={(e) => handleChange("billUrl", e.target.value)}
//               onBlur={() => handleBlur("billUrl")}
//               placeholder="https://example.com/bill.pdf"
//               className={errors.billUrl && touched.billUrl ? "border-destructive" : ""}
//             />
//             {errors.billUrl && touched.billUrl && (
//               <p className="text-sm text-destructive">{errors.billUrl}</p>
//             )}
//           </div>

//           {/* Balance Preview */}
//           <div className="bg-muted/50 rounded-lg p-4 space-y-2">
//             <div className="flex justify-between text-sm">
//               <span className="text-muted-foreground">Current Balance</span>
//               <span className="font-medium">{formatCurrency(account.currentBalance)}</span>
//             </div>
//             {previewBalance !== null && (
//               <>
//                 <div className="flex justify-between text-sm">
//                   <span className="text-muted-foreground">
//                     {formData.type === "CREDIT" ? "Adding" : "Subtracting"}
//                   </span>
//                   <span className={formData.type === "CREDIT" ? "text-green-600" : "text-red-600"}>
//                     {formData.type === "CREDIT" ? "+" : "−"}
//                     {formatCurrency(parseFloat(formData.amount))}
//                   </span>
//                 </div>
//                 <div className="border-t pt-2 flex justify-between">
//                   <span className="font-medium">New Balance</span>
//                   <span className={`font-bold text-lg ${previewBalance >= 0 ? "text-green-600" : "text-red-600"
//                     }`}>
//                     {formatCurrency(previewBalance)}
//                   </span>
//                 </div>
//               </>
//             )}
//           </div>

//           {/* Actions */}
//           <div className="flex gap-3 pt-4 border-t">
//             <Button
//               type="submit"
//               disabled={isSubmitting || !isFormValid}
//               className={`flex-1 ${formData.type === "CREDIT"
//                 ? "bg-green-500 hover:bg-green-600"
//                 : "bg-red-500 hover:bg-red-600"
//                 }`}
//             >
//               {isSubmitting ? (
//                 <>
//                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                   Recording...
//                 </>
//               ) : (
//                 `Record ${formData.type === "CREDIT" ? "Credit" : "Debit"}`
//               )}
//             </Button>
//             <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
//               Cancel
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }