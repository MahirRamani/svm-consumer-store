// components/modals/add-student-modal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useCreateStudent } from "@/hooks/use-student-mutations";
import type { CreateStudentDto } from "@/types";

interface AddStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  name: string;
  rollNumber: string;
  standard: string;
  year: string;
  mobileNo: string;
  balance: string;
}

interface FormErrors {
  name?: string;
  rollNumber?: string;
  standard?: string;
  year?: string;
  mobileNo?: string;
  balance?: string;
}

type FormField = keyof FormData;

const STANDARDS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

export default function AddStudentModal({ open, onOpenChange }: AddStudentModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    rollNumber: "",
    standard: "",
    year: "",
    mobileNo: "",
    balance: "0",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<FormField, boolean>>({
    name: false,
    rollNumber: false,
    standard: false,
    year: false,
    mobileNo: false,
    balance: false,
  });

  const createMutation = useCreateStudent();

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData({
        name: "",
        rollNumber: "",
        standard: "",
        year: "",
        mobileNo: "",
        balance: "0",
      });
      setErrors({});
      setTouched({
        name: false,
        rollNumber: false,
        standard: false,
        year: false,
        mobileNo: false,
        balance: false,
      });
    }
  }, [open]);

  const validateField = useCallback((name: FormField, value: string): string | undefined => {
    switch (name) {
      case "name":
        if (!value.trim()) {
          return "Student name is required";
        }
        if (value.trim().length < 2) {
          return "Name must be at least 2 characters";
        }
        if (value.trim().length > 100) {
          return "Name must be less than 100 characters";
        }
        if (!/^[a-zA-Z\s.]+$/.test(value)) {
          return "Name can only contain letters, spaces, and dots";
        }
        break;
      case "rollNumber":
        if (!value.trim()) {
          return "Roll number is required";
        }
        if (value.trim().length < 3) {
          return "Roll number must be at least 3 characters";
        }
        if (value.trim().length > 50) {
          return "Roll number must be less than 50 characters";
        }
        break;
      case "standard":
        if (!value.trim()) {
          return "Standard is required";
        }
        break;
      case "year":
        if (!value.trim()) {
          return "Year is required";
        }
        break;
      case "mobileNo":
        if (value.trim() && !/^[0-9]{10}$/.test(value.trim())) {
          return "Mobile number must be 10 digits";
        }
        break;
      case "balance":
        if (value.trim()) {
          const num = Number(value);
          if (isNaN(num)) {
            return "Balance must be a valid number";
          }
          if (num < 0) {
            return "Balance cannot be negative";
          }
          if (num > 100000) {
            return "Balance cannot exceed ₹1,00,000";
          }
        }
        break;
    }
    return undefined;
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    Object.keys(formData).forEach((key) => {
      const field = key as FormField;
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  const handleChange = useCallback(
    (field: FormField, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Real-time validation if field was touched
      if (touched[field]) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [touched, validateField]
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

      // Mark all fields as touched
      setTouched({
        name: true,
        rollNumber: true,
        standard: true,
        year: true,
        mobileNo: true,
        balance: true,
      });

      if (!validateForm()) {
        toast.error("Please fix the form errors before submitting");
        return;
      }

      const createData: CreateStudentDto = {
        name: formData.name.trim(),
        rollNumber: formData.rollNumber.trim(),
        standard: formData.standard,
        year: Number(formData.year),
        ...(formData.mobileNo.trim() && { mobileNo: formData.mobileNo.trim() }),
        ...(formData.balance.trim() && { balance: Number(formData.balance) }),
      };

      createMutation.mutate(createData, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    },
    [formData, validateForm, createMutation, onOpenChange]
  );

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) {
      onOpenChange(false);
    }
  }, [createMutation.isPending, onOpenChange]);

  const isFormValid =
    formData.name.trim() &&
    formData.rollNumber.trim() &&
    formData.standard &&
    formData.year &&
    !errors.name &&
    !errors.rollNumber &&
    !errors.standard &&
    !errors.year &&
    !errors.mobileNo &&
    !errors.balance;

  const canSubmit = isFormValid && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Add New Student
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              placeholder="Enter student's full name"
              disabled={createMutation.isPending}
              className={errors.name && touched.name ? "border-destructive" : ""}
            />
            {errors.name && touched.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rollNumber">
              Roll Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rollNumber"
              value={formData.rollNumber}
              onChange={(e) => handleChange("rollNumber", e.target.value)}
              onBlur={() => handleBlur("rollNumber")}
              placeholder="e.g., STD2021045"
              disabled={createMutation.isPending}
              className={errors.rollNumber && touched.rollNumber ? "border-destructive" : ""}
            />
            {errors.rollNumber && touched.rollNumber && <p className="text-sm text-destructive">{errors.rollNumber}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="standard">
                Standard <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.standard}
                onValueChange={(value) => handleChange("standard", value)}
                disabled={createMutation.isPending}
              >
                <SelectTrigger className={errors.standard && touched.standard ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select standard" />
                </SelectTrigger>
                <SelectContent>
                  {STANDARDS.map((std) => (
                    <SelectItem key={std} value={std}>
                      {std}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.standard && touched.standard && <p className="text-sm text-destructive">{errors.standard}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">
                Year <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.year}
                onValueChange={(value) => handleChange("year", value)}
                disabled={createMutation.isPending}
              >
                <SelectTrigger className={errors.year && touched.year ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.year && touched.year && <p className="text-sm text-destructive">{errors.year}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobileNo">Mobile Number</Label>
            <Input
              id="mobileNo"
              type="tel"
              value={formData.mobileNo}
              onChange={(e) => handleChange("mobileNo", e.target.value)}
              onBlur={() => handleBlur("mobileNo")}
              placeholder="10-digit mobile number"
              disabled={createMutation.isPending}
              className={errors.mobileNo && touched.mobileNo ? "border-destructive" : ""}
              maxLength={10}
            />
            {errors.mobileNo && touched.mobileNo && <p className="text-sm text-destructive">{errors.mobileNo}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance">Initial Balance (₹)</Label>
            <Input
              id="balance"
              type="number"
              step="1"
              min="0"
              value={formData.balance}
              onChange={(e) => handleChange("balance", e.target.value)}
              onBlur={() => handleBlur("balance")}
              placeholder="0"
              disabled={createMutation.isPending}
              className={errors.balance && touched.balance ? "border-destructive" : ""}
            />
            {errors.balance && touched.balance && <p className="text-sm text-destructive">{errors.balance}</p>}
            <p className="text-xs text-muted-foreground">Initial balance to add to student's account</p>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button type="submit" disabled={!canSubmit} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white">
              {createMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </span>
              ) : (
                "Add Student"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}