"use client";

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateStudent } from '@/hooks/use-student-mutations';
import z from 'zod';
import { createStudentSchema, updateStudentSchema } from '@/lib/validations/student';
import type { Student, UpdateStudentDto } from '@/types';
import { STANDARDS, YEARS } from '@/lib/config/constants';

interface EditStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
}

interface FormData {
  id: string;
  rollNumber: string;
  name: string;
  standard: string;
  year: string;
  mobileNo: string;
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

const UNTOUCHED: Record<FormField, boolean> = {
  name: false, rollNumber: false, standard: false,
  year: false, mobileNo: false, id: false,
};

export default function EditStudentModal({ open, onOpenChange, student }: EditStudentModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "", rollNumber: "", standard: "", year: "", mobileNo: "", id: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<FormField, boolean>>(UNTOUCHED);

  const updateMutation = useUpdateStudent();

  // Populate when student changes
  useEffect(() => {
    if (student && open) {
      setFormData({
        id: student.id?.toString() || "",
        rollNumber: student.rollNumber?.toString() || "",
        name: student.name || "",
        standard: student.standard?.toString() || "",
        year: student.year || "",
        mobileNo: student.mobileNo || "",
      });
      setErrors({});
      setTouched(UNTOUCHED);
    }
  }, [student, open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setFormData({ name: "", rollNumber: "", standard: "", year: "", mobileNo: "", id: "" });
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
  // const validateField = useCallback((field: FormField, value: string) => {
  //   const fieldSchema = createStudentSchema.pick({ [field]: true } as any);
  //   const result = fieldSchema.safeParse({ [field]: value });

  //   if (result.success) return undefined;

  //   return result.error.issues[0]?.message;
  // }, []);
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
  // const validateForm = useCallback((): boolean => {
  //   const newErrors: FormErrors = {};
  //   (Object.keys(formData) as FormField[]).forEach((field) => {
  //     const error = validateField(field, formData[field]);
  //     if (error) newErrors[field] = error;
  //   });
  //   setErrors(newErrors);
  //   return Object.keys(newErrors).length === 0;
  // }, [formData, validateField]);

  // const validateForm = useCallback((): boolean => {
  // const result = createStudentSchema.safeParse(formData);

  // if (!result.success) {
  //   setErrors(zodToFormErrors(result.error));
  //   return false;
  // }

  // setErrors({});
  // return true;
  // }, [formData]);

  const validateForm = useCallback((): boolean => {
    const coerced = {
      ...formData,
      id: Number(formData.id),
      rollNumber: Number(formData.rollNumber),
      standard: Number(formData.standard),
    };
    const result = updateStudentSchema.safeParse(coerced);
    if (!result.success) { setErrors(zodToFormErrors(result.error)); return false; }
    setErrors({});
    return true;
  }, [formData]);

  const handleChange = useCallback((field: FormField, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  }, [validateField]);

  const handleBlur = useCallback((field: FormField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, formData[field]) }));
  }, [formData, validateField]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!student?._id) return;
    setTouched({ name: true, rollNumber: true, standard: true, year: true, mobileNo: true, id: true });
    if (!validateForm()) {
      toast.error("Please fix the form errors before submitting");
      return;
    }
    const updateData: UpdateStudentDto = {
      // _id:        student._id,
      // name:       formData.name.trim(),
      // rollNumber: formData.rollNumber.trim(),
      // standard:   formData.standard,
      // year:       formData.year,
      // id:         Number(formData.id),                                          // mandatory number
      // ...(formData.mobileNo.trim() && { mobileNo: formData.mobileNo.trim() }), // optional
      _id: student._id,
      name: formData.name.trim(),
      rollNumber: Number(formData.rollNumber),   // ← was .trim() string
      standard: Number(formData.standard),     // ← was string
      year: formData.year,                 // string, unchanged
      id: Number(formData.id),           // already was Number()
      ...(formData.mobileNo.trim() && { mobileNo: formData.mobileNo.trim() }),
    };
    updateMutation.mutate(updateData, { onSuccess: () => onOpenChange(false) });
  }, [student, formData, validateForm, updateMutation, onOpenChange]);

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending) onOpenChange(false);
  }, [updateMutation.isPending, onOpenChange]);

  // const hasChanges = useCallback((): boolean => {
  //   if (!student) return false;
  //   return (
  //     formData.name.trim()      !== student.name                  ||
  //     formData.rollNumber.trim() !== student.rollNumber           ||
  //     formData.standard          !== student.standard             ||
  //     formData.year      !== student.year                 ||
  //     formData.mobileNo.trim()   !== (student.mobileNo || "")    ||
  //     Number(formData.id)        !== student.id
  //   );
  // }, [student, formData]);
  const hasChanges = useCallback((): boolean => {
    if (!student) return false;
    return (
      formData.name.trim() !== student.name ||
      Number(formData.rollNumber) !== student.rollNumber ||
      Number(formData.standard) !== student.standard ||
      formData.year !== student.year ||
      formData.mobileNo.trim() !== (student.mobileNo || "") ||
      Number(formData.id) !== student.id
    );
  }, [student, formData]);

  const isFormValid =
    formData.name.trim() && formData.rollNumber.trim() &&
    formData.standard && formData.year && formData.id.trim() &&
    !errors.name && !errors.rollNumber && !errors.standard &&
    !errors.year && !errors.mobileNo && !errors.id;

  const canSubmit = isFormValid && hasChanges() && !updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit Student Details
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Student Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              placeholder="Enter student name"
              disabled={updateMutation.isPending}
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
                onChange={(e) =>
                // handleChange("rollNumber", e.target.value)
                {
                  const digits = e.target.value.replace(/\D/g, "");
                  handleChange("rollNumber", digits);
                }
                }
                onBlur={() => handleBlur("rollNumber")}
                placeholder="Enter roll number"
                disabled={updateMutation.isPending}
                className={errors.rollNumber && touched.rollNumber ? "border-destructive" : ""}
              />
              {errors.rollNumber && touched.rollNumber && <p className="text-sm text-destructive">{errors.rollNumber}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">Student ID <span className="text-destructive">*</span></Label>
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
                disabled={updateMutation.isPending}
                className={errors.id && touched.id ? "border-destructive" : ""}
              />
              {errors.id && touched.id && <p className="text-sm text-destructive">{errors.id}</p>}
            </div>
          </div>

          {/* Standard + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="standard">Standard <span className="text-destructive">*</span></Label>
              <Select value={formData.standard} onValueChange={(v) => handleChange("standard", v)} disabled={updateMutation.isPending}>
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
              <Select value={formData.year} onValueChange={(v) => handleChange("year", v)} disabled={updateMutation.isPending}>
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
                const normalized = digits.replace(/^0+(?=\d)/, "");
                handleChange("mobileNo", normalized);
              }}
              onBlur={() => handleBlur("mobileNo")}
              placeholder="10-digit mobile number"
              disabled={updateMutation.isPending}
              className={errors.mobileNo && touched.mobileNo ? "border-destructive" : ""}
              maxLength={10}
            />
            {errors.mobileNo && touched.mobileNo && <p className="text-sm text-destructive">{errors.mobileNo}</p>}
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={updateMutation.isPending} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white">
              {updateMutation.isPending
                ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Updating...</span>
                : "Update Student"
              }
            </Button>
          </div>

        </form>
      </DialogContent>
    </Dialog>
  );
}