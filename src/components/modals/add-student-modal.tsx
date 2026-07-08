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
import { STANDARDS, YEARS } from "@/lib/config/constants";
import { createStudentSchema } from "@/lib/validations/student";
import z from "zod";

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
  id: string;
}

interface FormErrors {
  name?: string;
  rollNumber?: string;
  standard?: string;
  year?: string;
  mobileNo?: string;
  id?: string;
}

type FormField = keyof FormData;

const EMPTY_FORM: FormData = {
  name: "",
  rollNumber: "",
  standard: "",
  year: "",
  mobileNo: "",
  id: "",
};

const UNTOUCHED: Record<FormField, boolean> = {
  name: false,
  rollNumber: false,
  standard: false,
  year: false,
  mobileNo: false,
  id: false,
};

export default function AddStudentModal({ open, onOpenChange }: AddStudentModalProps) {
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<FormField, boolean>>(UNTOUCHED);

  const createMutation = useCreateStudent();

  useEffect(() => {
    if (!open) {
      setFormData(EMPTY_FORM);
      setErrors({});
      setTouched(UNTOUCHED);
    }
  }, [open]);

  // const validateField = useCallback((name: FormField, value: string): string | undefined => {
  //   switch (name) {
  //     case "name":
  //       if (!value.trim())                           return "Student name is required";
  //       if (value.trim().length < 2)                 return "Name must be at least 2 characters";
  //       if (value.trim().length > 100)               return "Name must be less than 100 characters";
  //       if (!/^[a-zA-Z\s.]+$/.test(value))           return "Name can only contain letters, spaces, and dots";
  //       break;
  //     case "rollNumber":
  //       if (!value.trim())                           return "Roll number is required";
  //       if (value.trim().length < 3)                 return "Roll number must be at least 3 characters";
  //       if (value.trim().length > 50)                return "Roll number must be less than 50 characters";
  //       break;
  //     case "standard":
  //       if (!value.trim())                           return "Standard is required";
  //       break;
  //     case "year":
  //       if (!value.trim())                           return "Year is required";
  //       break;
  //     case "mobileNo":
  //       if (value.trim() && !/^[0-9]{10}$/.test(value.trim()))
  //                                                    return "Mobile number must be 10 digits";
  //       break;
  //     case "id":
  //       if (!value.trim())                           return "Student ID is required";
  //       if (!/^\d+$/.test(value.trim()))             return "ID must be numbers only";
  //       break;
  //   }
  //   return undefined;
  // }, []);

  // const validateForm = useCallback((): boolean => {
  //   const newErrors: FormErrors = {};
  //   (Object.keys(formData) as FormField[]).forEach((field) => {
  //     const error = validateField(field, formData[field]);
  //     if (error) newErrors[field] = error;
  //   });
  //   setErrors(newErrors);
  //   return Object.keys(newErrors).length === 0;
  // }, [formData, validateField]);
  const NUMERIC_FIELDS = ["id", "rollNumber", "standard"] as const;

  const validateField = useCallback((field: FormField, value: string) => {
    const payload = (NUMERIC_FIELDS as readonly string[]).includes(field)
      ? { [field]: value === "" ? value : Number(value) }
      : { [field]: value };
    const fieldSchema = createStudentSchema.pick({ [field]: true } as any);
    const result = fieldSchema.safeParse(payload);
    return result.success ? undefined : result.error.issues[0]?.message;
  }, []);
  function zodToFormErrors(error: z.ZodError): FormErrors {
    const out: FormErrors = {};

    for (const iss of error.issues) {
      const key = iss.path[0];
      if (typeof key === "string" && out[key as keyof FormErrors] == null) {
        out[key as keyof FormErrors] = iss.message;
      }
    }

    return out;
  }

  const validateForm = useCallback((): boolean => {
    const coerced = {
      ...formData,
      id: Number(formData.id),
      rollNumber: Number(formData.rollNumber),
      standard: Number(formData.standard),
    };
    const result = createStudentSchema.safeParse(coerced);
    if (!result.success) { setErrors(zodToFormErrors(result.error)); return false; }
    setErrors({});
    return true;
  }, [formData]);

  const handleChange = useCallback((field: FormField, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((field: FormField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, formData[field]) }));
  }, [formData, validateField]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, rollNumber: true, standard: true, year: true, mobileNo: true, id: true });
    if (!validateForm()) {
      toast.error("Please fix the form errors before submitting");
      return;
    }
    const createData: CreateStudentDto = {
      name: formData.name.trim(),
      rollNumber: Number(formData.rollNumber),  // ← was .trim() string
      standard: Number(formData.standard),    // ← was string
      year: formData.year,
      id: Number(formData.id),
      ...(formData.mobileNo.trim() && { mobileNo: formData.mobileNo.trim() }),
    };
    createMutation.mutate(createData, { onSuccess: () => onOpenChange(false) });
  }, [formData, validateForm, createMutation, onOpenChange]);

  const handleClose = useCallback(() => {
    if (!createMutation.isPending) onOpenChange(false);
  }, [createMutation.isPending, onOpenChange]);

  const isFormValid =
    formData.name.trim() && formData.rollNumber &&
    formData.standard && formData.year.trim() && formData.id &&
    !errors.name && !errors.rollNumber && !errors.standard &&
    !errors.year && !errors.mobileNo && !errors.id;

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

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
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

          {/* Roll Number + ID side by side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rollNumber">Roll Number <span className="text-destructive">*</span></Label>
              <Input
                id="rollNumber"
                value={formData.rollNumber}
                // onChange={(e) => handleChange("rollNumber", e.target.value)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const normalized = digits.replace(/^0+(?=\d)/, "");
                  handleChange("rollNumber", normalized);
                }}
                onBlur={() => handleBlur("rollNumber")}
                placeholder="e.g., STD2021045"
                disabled={createMutation.isPending}
                className={errors.rollNumber && touched.rollNumber ? "border-destructive" : ""}
              />
              {errors.rollNumber && touched.rollNumber && <p className="text-sm text-destructive">{errors.rollNumber}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">Account ID <span className="text-destructive">*</span></Label>
              <Input
                id="id"
                value={formData.id}
                // onChange={(e) => handleChange("id", e.target.value.replace(/\D/g, ""))}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const normalized = digits.replace(/^0+(?=\d)/, "");
                  handleChange("id", normalized);
                }}
                onBlur={() => handleBlur("id")}
                placeholder="Numeric ID"
                inputMode="numeric"
                disabled={createMutation.isPending}
                className={errors.id && touched.id ? "border-destructive" : ""}
              />
              {errors.id && touched.id && <p className="text-sm text-destructive">{errors.id}</p>}
            </div>
          </div>

          {/* Standard + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="standard">Standard <span className="text-destructive">*</span></Label>
              <Select value={formData.standard} onValueChange={(v) => handleChange("standard", v)} disabled={createMutation.isPending}>
                <SelectTrigger className={errors.standard && touched.standard ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select standard" />
                </SelectTrigger>
                <SelectContent>
                  {STANDARDS.map((std) => <SelectItem key={std} value={std.toString()}>{std}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.standard && touched.standard && <p className="text-sm text-destructive">{errors.standard}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year <span className="text-destructive">*</span></Label>
              <Select value={formData.year} onValueChange={(v) => handleChange("year", v)} disabled={createMutation.isPending}>
                <SelectTrigger className={errors.year && touched.year ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.year && touched.year && <p className="text-sm text-destructive">{errors.year}</p>}
            </div>
          </div>

          {/* Mobile */}
          <div className="space-y-2">
            <Label htmlFor="mobileNo">Mobile Number</Label>
            <Input
              id="mobileNo"
              type="tel"
              value={formData.mobileNo}
              // onChange={(e) => handleChange("mobileNo", e.target.value)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                handleChange("mobileNo", digits);  // no leading zero strip — mobile nos can start with 0
              }}
              onBlur={() => handleBlur("mobileNo")}
              placeholder="10-digit mobile number"
              disabled={createMutation.isPending}
              className={errors.mobileNo && touched.mobileNo ? "border-destructive" : ""}
              maxLength={10}
            />
            {errors.mobileNo && touched.mobileNo && <p className="text-sm text-destructive">{errors.mobileNo}</p>}
          </div>

          {/* Buttons */}
          <div className="flex space-x-2 pt-2">
            <Button type="submit" disabled={!canSubmit} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white">
              {createMutation.isPending
                ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Adding...</span>
                : "Add Student"
              }
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