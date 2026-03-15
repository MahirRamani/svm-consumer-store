"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useUpdateAccount } from "@/hooks/use-account-mutations";
import type { Account } from "@/types/account";

interface EditAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
}

interface FormData {
  name: string;
  description: string;
  isActive: boolean;
}

interface FormErrors {
  name?: string;
  description?: string;
}

export default function EditAccountModal({ 
  open, 
  onOpenChange, 
  account 
}: EditAccountModalProps) {
  const updateMutation = useUpdateAccount();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Populate form when account changes
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        description: account.description || "",
        isActive: account.isActive,
      });
      setErrors({});
      setTouched({});
    }
  }, [account]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Account name is required";
    } else if (formData.name.length > 100) {
      newErrors.name = "Name cannot exceed 100 characters";
    }

    if (formData.description.length > 500) {
      newErrors.description = "Description cannot exceed 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleChange = useCallback((field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [touched]);

  const handleBlur = useCallback((field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) return;

    setTouched({ name: true, description: true });

    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    updateMutation.mutate(
      {
        _id: account._id,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isActive: formData.isActive,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  }, [account, formData, validateForm, updateMutation, onOpenChange]);

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending) {
      onOpenChange(false);
    }
  }, [updateMutation.isPending, onOpenChange]);

  if (!account) return null;

  const isSubmitting = updateMutation.isPending;
  const isFormValid = formData.name.trim() && !errors.name;

  const formatCurrency = (amount: number) => 
    `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-blue-500" />
            Edit Account
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">
              Account Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              className={errors.name && touched.name ? "border-destructive" : ""}
            />
            {errors.name && touched.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && touched.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="edit-isActive">Active Account</Label>
              <p className="text-sm text-muted-foreground">
                Inactive accounts are hidden from forms
              </p>
            </div>
            <Switch
              id="edit-isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleChange("isActive", checked)}
            />
          </div>

          {/* Balance Display */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className={`text-xl font-bold ${
              account.currentBalance >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              {formatCurrency(account.currentBalance)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}