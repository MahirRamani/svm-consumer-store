"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    X, Loader2, FileText, ImageIcon, Download,
    TrendingUp, TrendingDown, Edit,
    Calendar
} from 'lucide-react';
import { useUpdateAccountTransaction } from '@/hooks/use-account-transaction-mutations';
import { validateFile, uploadFile, deleteFile } from '@/lib/utils/upload-file';
import type { AccountTransaction } from '@/types/admin/accountTransaction';
import { Input } from '@/components/ui/input';
import { toLocalDateTimeString } from '@/lib/utils/dates';

interface EditTransactionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transaction: AccountTransaction | null;
}

export default function EditTransactionModal({
    open,
    onOpenChange,
    transaction,
}: EditTransactionModalProps) {
    const updateMutation = useUpdateAccountTransaction();

    const [enteredAt, setEnteredAt] = useState("");
    const [enteredAtError, setEnteredAtError] = useState<string | undefined>();
    const [note, setNote] = useState("");
    const [noteError, setNoteError] = useState<string | undefined>();

    const [billFile, setBillFile] = useState<File | null>(null);
    const [billPreview, setBillPreview] = useState<string>("");
    const [currentBillUrl, setCurrentBillUrl] = useState<string>("");
    const [shouldDeleteBill, setShouldDeleteBill] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const billFileInputRef = useRef<HTMLInputElement>(null);

    // Populate form when transaction changes
    useEffect(() => {
        if (transaction && open) {
            setEnteredAt(toLocalDateTimeString(new Date(transaction.enteredAt)));
            setCurrentBillUrl(transaction.billUrl || "");
            setNote(transaction.note || "");
            setBillFile(null);
            setBillPreview("");
            setShouldDeleteBill(false);
            setEnteredAtError(undefined);
            setNoteError(undefined);
            if (billFileInputRef.current) billFileInputRef.current.value = "";
        }
    }, [transaction, open]);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setBillFile(null);
            setBillPreview("");
            setShouldDeleteBill(false);
            setNoteError(undefined);
            if (billFileInputRef.current) billFileInputRef.current.value = "";
        }
    }, [open]);

    const handleBillFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateFile(file, 'bill');
        if (!validation.isValid) {
            toast.error(validation.error);
            return;
        }

        setBillFile(file);
        setShouldDeleteBill(false); // cancel any pending delete

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setBillPreview(e.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setBillPreview("pdf");
        }
    }, []);

    const removeBill = useCallback(() => {
        if (billFile) {
            // Just cancel the new file — no Cloudinary delete needed
            setBillFile(null);
            setBillPreview("");
            if (billFileInputRef.current) billFileInputRef.current.value = "";
        } else if (currentBillUrl) {
            // Mark existing bill for deletion
            setShouldDeleteBill(true);
            setBillPreview("");
        }
    }, [billFile, currentBillUrl]);

    const uploadBill = useCallback(async (): Promise<{
        secure_url: string;
        public_id: string;
    } | null> => {
        if (!billFile) return null;
        setIsUploading(true);
        try {
            const result = await uploadFile({
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

    const validateEnteredAt = useCallback((value: string): boolean => {
        if (!value) {
            setEnteredAtError("Date & time is required");
            return false;
        }
        setEnteredAtError(undefined);
        return true;
    }, []);

    const validateNote = useCallback((value: string): boolean => {
        if (value.trim().length > 50) {
            setNoteError("Note cannot exceed 50 characters");
            return false;
        }
        setNoteError(undefined);
        return true;
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transaction) return;

        if (!validateEnteredAt(enteredAt) || !validateNote(note)) {
            toast.error("Please fix the form errors");
            return;
        }

        let billUrl: string | null | undefined = undefined; // undefined = no change
        let uploadedPublicId: string | undefined;

        // Case 1 — New bill uploaded
        if (billFile) {
            try {
                const result = await uploadBill();
                if (result) {
                    billUrl = result.secure_url;
                    uploadedPublicId = result.public_id;

                    // Delete old bill if replacing
                    if (currentBillUrl) {
                        const oldPublicId = currentBillUrl
                            .split('/upload/')[1]
                            ?.replace(/^v\d+\//, '')
                            ?.replace(/\.[^/.]+$/, '');
                        if (oldPublicId) {
                            await deleteFile(oldPublicId, "image").catch(() => {
                                // Non-critical — old bill delete failure shouldn't block update
                            });
                        }
                    }
                }
            } catch {
                return;
            }
        }
        // Case 2 — Bill removed
        else if (shouldDeleteBill && currentBillUrl) {
            const oldPublicId = currentBillUrl
                .split('/upload/')[1]
                ?.replace(/^v\d+\//, '')
                ?.replace(/\.[^/.]+$/, '');
            if (oldPublicId) {
                await deleteFile(oldPublicId, "image").catch(() => { });
            }
            billUrl = null; // null = remove from DB
        }

        updateMutation.mutate(
            {
                _id: transaction._id,
                enteredAt: new Date(enteredAt),
                note: note.trim(),
                billUrl,
            },
            {
                onSuccess: () => onOpenChange(false),
                onError: async () => {
                    // ✅ No orphan — cleanup if DB update failed
                    if (uploadedPublicId) {
                        await deleteFile(uploadedPublicId, "image");
                    }
                },
            }
        );
    }, [
        transaction, note, billFile, currentBillUrl,
        shouldDeleteBill, validateNote, uploadBill,
        updateMutation, onOpenChange,
    ]);

    const handleClose = useCallback(() => {
        if (!updateMutation.isPending && !isUploading) {
            onOpenChange(false);
        }
    }, [updateMutation.isPending, isUploading, onOpenChange]);

    if (!transaction) return null;

    const isSubmitting = updateMutation.isPending || isUploading;
    const hasExistingBill = currentBillUrl && !shouldDeleteBill;

    const fmt = (n: number) =>
        `₹${Math.abs(n).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit className="w-5 h-5" />
                        Edit Transaction
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Read-only transaction info */}
                    <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Type</span>
                            <Badge className={transaction.type === "CREDIT"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }>
                                {transaction.type === "CREDIT"
                                    ? <TrendingUp className="w-3 h-3 mr-1" />
                                    : <TrendingDown className="w-3 h-3 mr-1" />
                                }
                                {transaction.type}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Amount</span>
                            <span className={`font-bold ${transaction.type === "CREDIT"
                                ? "text-green-600"
                                : "text-red-600"
                                }`}>
                                {transaction.type === "CREDIT" ? "+" : "−"}
                                {fmt(transaction.amount)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Date</span>
                            <span className="text-sm font-medium">
                                {new Date(transaction.enteredAt).toLocaleDateString("en-IN", {
                                    day: "2-digit", month: "short", year: "numeric",
                                })}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="enteredAt" className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Date & Time <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="enteredAt"
                            type="datetime-local"
                            value={enteredAt}
                            onChange={(e) => {
                                setEnteredAt(e.target.value);
                                validateEnteredAt(e.target.value);
                            }}
                            disabled={isSubmitting}
                            className={enteredAtError ? "border-destructive" : ""}
                        />
                        {enteredAtError && (
                            <p className="text-sm text-destructive">{enteredAtError}</p>
                        )}
                    </div>


                    {/* Bill Attachment */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Bill Attachment
                        </Label>

                        {/* Existing bill */}
                        {hasExistingBill && !billFile && (
                            <div className="flex items-center gap-2 p-2 border rounded-lg bg-blue-50">
                                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                <a
                                    href={currentBillUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex-1 truncate"
                                >
                                    View Current Bill
                                </a>
                                <button
                                    type="button"
                                    onClick={removeBill}
                                    disabled={isSubmitting}
                                    className="text-red-400 hover:text-red-600"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Removed bill indicator */}
                        {shouldDeleteBill && !billFile && (
                            <div className="flex items-center gap-2 p-2 border border-red-200 rounded-lg bg-red-50">
                                <X className="w-4 h-4 text-red-500 shrink-0" />
                                <span className="text-xs text-red-600 flex-1">Bill will be removed</span>
                                <button
                                    type="button"
                                    onClick={() => setShouldDeleteBill(false)}
                                    className="text-xs text-blue-500 hover:underline"
                                >
                                    Undo
                                </button>
                            </div>
                        )}

                        {/* New bill preview */}
                        {billFile && (
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
                                    onClick={removeBill}
                                    disabled={isSubmitting}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        {/* Upload button */}
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
                                {billFile
                                    ? "Change Bill"
                                    : hasExistingBill
                                        ? "Replace Bill"
                                        : "Upload Bill"
                                }
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
                        <Label htmlFor="note">
                            Note
                            <span className="text-xs text-muted-foreground ml-2">
                                ({note.length}/50)
                            </span>
                        </Label>
                        <Textarea
                            id="note"
                            value={note}
                            onChange={(e) => {
                                setNote(e.target.value);
                                validateNote(e.target.value);
                            }}
                            placeholder="e.g., Sold groceries, Paid supplier..."
                            rows={2}
                            disabled={isSubmitting}
                            className={noteError ? "border-destructive" : ""}
                        />
                        {noteError && (
                            <p className="text-sm text-destructive">{noteError}</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t">
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {isUploading ? "Uploading..." : "Updating..."}
                                </>
                            ) : "Update Transaction"}
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