// components/modals/edit-student-modal.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUpdateStudent } from "@/hooks/use-student-mutations";
import type { Student, UpdateStudentDto } from "@/types";

interface EditStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
}

interface FormData {
  name: string;
  rollNumber: string;
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
}

type FormField = keyof FormData;

const STANDARDS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
const YEARS = [2024, 2023, 2022, 2021, 2020, 2019];

export default function EditStudentModal({ open, onOpenChange, student }: EditStudentModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    rollNumber: "",
    standard: "",
    year: "",
    mobileNo: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<FormField, boolean>>({
    name: false,
    rollNumber: false,
    standard: false,
    year: false,
    mobileNo: false,
  });

  const updateMutation = useUpdateStudent();

  // Populate form when student changes
  useEffect(() => {
    if (student && open) {
      setFormData({
        name: student.name || "",
        rollNumber: student.rollNumber || "",
        standard: student.standard || "",
        year: student.year ? student.year.toString() : "",
        mobileNo: student.mobileNo || "",
      });
      
      setErrors({});
      setTouched({
        name: false,
        rollNumber: false,
        standard: false,
        year: false,
        mobileNo: false,
      });
    }
  }, [student, open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData({
        name: "",
        rollNumber: "",
        standard: "",
        year: "",
        mobileNo: "",
      });
      setErrors({});
      setTouched({
        name: false,
        rollNumber: false,
        standard: false,
        year: false,
        mobileNo: false,
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

      // Mark as touched when value changes
      setTouched((prev) => ({ ...prev, [field]: true }));

      // Real-time validation
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [validateField]
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

      if (!student?._id) return;

      // Mark all fields as touched
      setTouched({
        name: true,
        rollNumber: true,
        standard: true,
        year: true,
        mobileNo: true,
      });

      if (!validateForm()) {
        toast.error("Please fix the form errors before submitting");
        return;
      }

      const updateData: UpdateStudentDto = {
        _id: student._id,
        name: formData.name.trim(),
        rollNumber: formData.rollNumber.trim(),
        standard: formData.standard,
        year: Number(formData.year),
        ...(formData.mobileNo.trim() && { mobileNo: formData.mobileNo.trim() }),
      };

      updateMutation.mutate(updateData, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    },
    [student, formData, validateForm, updateMutation, onOpenChange]
  );

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending) {
      onOpenChange(false);
    }
  }, [updateMutation.isPending, onOpenChange]);

  // Check if form has any changes from original student
  const hasChanges = useCallback((): boolean => {
    if (!student) return false;

    return (
      formData.name.trim() !== student.name ||
      formData.rollNumber.trim() !== student.rollNumber ||
      formData.standard !== student.standard ||
      Number(formData.year) !== student.year ||
      formData.mobileNo.trim() !== (student.mobileNo || "")
    );
  }, [student, formData]);

  const isFormValid =
    formData.name.trim() &&
    formData.rollNumber.trim() &&
    formData.standard &&
    formData.year &&
    !errors.name &&
    !errors.rollNumber &&
    !errors.standard &&
    !errors.year &&
    !errors.mobileNo;

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
          <div className="space-y-2">
            <Label htmlFor="name">
              Student Name <span className="text-destructive">*</span>
            </Label>
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

          <div className="space-y-2">
            <Label htmlFor="rollNumber">
              Roll Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rollNumber"
              value={formData.rollNumber}
              onChange={(e) => handleChange("rollNumber", e.target.value)}
              onBlur={() => handleBlur("rollNumber")}
              placeholder="Enter roll number"
              disabled={updateMutation.isPending}
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
                disabled={updateMutation.isPending}
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
                disabled={updateMutation.isPending}
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
              disabled={updateMutation.isPending}
              className={errors.mobileNo && touched.mobileNo ? "border-destructive" : ""}
              maxLength={10}
            />
            {errors.mobileNo && touched.mobileNo && <p className="text-sm text-destructive">{errors.mobileNo}</p>}
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={updateMutation.isPending} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white">
              {updateMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </span>
              ) : (
                "Update Student"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}