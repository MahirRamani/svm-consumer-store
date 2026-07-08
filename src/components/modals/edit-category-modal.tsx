// components/modals/edit-category-modal.tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit } from "lucide-react";
import { useUpdateCategory } from "@/hooks/use-category-mutations";
import type { Category, CategoryFormData, CategoryFormErrors } from "@/types/seller/category";

interface EditCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

export default function EditCategoryModal({ open, onOpenChange, category }: EditCategoryModalProps) {
  const updateMutation = useUpdateCategory();

  const [formData, setFormData] = useState<CategoryFormData>({
    name: "",
    description: "",
    priority: "",
  });

  const [errors, setErrors] = useState<CategoryFormErrors>({});
  const [touched, setTouched] = useState<Record<keyof CategoryFormData, boolean>>({
    name: false,
    description: false,
    priority: false,
  });

  // Populate form when category changes
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || "",
        priority: category.priority !== undefined ? String(category.priority) : "",
      });
      setErrors({});
      setTouched({ name: false, description: false, priority: false });
    }
  }, [category]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData({ name: "", description: "", priority: "" });
      setErrors({});
      setTouched({ name: false, description: false, priority: false });
    }
  }, [open]);

  const validateField = (name: keyof CategoryFormData, value: string): string | undefined => {
    switch (name) {
      case "name":
        if (!value.trim()) {
          return "Category name is required";
        }
        if (value.trim().length > 100) {
          return "Category name must be less than 100 characters";
        }
        break;
      case "description":
        if (value.trim().length > 500) {
          return "Description must be less than 500 characters";
        }
        break;
      case "priority":
        if (value.trim()) {
          const num = Number(value);
          if (isNaN(num)) {
            return "Priority must be a valid number";
          }
          if (!Number.isInteger(num)) {
            return "Priority must be a whole number";
          }
          if (num < 0) {
            return "Priority must be a positive number";
          }
          if (num > 999999) {
            return "Priority must be less than 1,000,000";
          }
        }
        break;
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: CategoryFormErrors = {};

    const nameError = validateField("name", formData.name);
    if (nameError) newErrors.name = nameError;

    const descError = validateField("description", formData.description);
    if (descError) newErrors.description = descError;

    const priorityError = validateField("priority", formData.priority);
    if (priorityError) newErrors.priority = priorityError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof CategoryFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field: keyof CategoryFormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!category?._id) return; // Changed from id to _id

    setTouched({ name: true, description: true, priority: true });

    if (!validateForm()) {
      return;
    }

    const priorityValue = formData.priority.trim() ? Number(formData.priority) : undefined;

    updateMutation.mutate(
      {
        _id: category._id, // Changed from id to _id
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        priority: priorityValue,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const handleClose = () => {
    if (!updateMutation.isPending) {
      onOpenChange(false);
    }
  };

  const isFormValid =
    formData.name.trim() && !errors.name && !errors.description && !errors.priority;

  const hasChanges =
    category &&
    (() => {
      const trimmedName = formData.name.trim();
      const trimmedDesc = formData.description.trim();
      const newPriority = formData.priority.trim() ? Number(formData.priority) : undefined;

      return (
        trimmedName !== category.name ||
        trimmedDesc !== (category.description || "") ||
        newPriority !== category.priority
      );
    })();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Category
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Category Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              placeholder="Enter category name"
              className={errors.name && touched.name ? "border-destructive" : ""}
            />
            {errors.name && touched.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              placeholder="Enter category description (optional)"
              className={`min-h-[80px] ${errors.description && touched.description ? "border-destructive" : ""}`}
            />
            {errors.description && touched.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Input
              id="priority"
              type="number"
              value={formData.priority}
              onChange={(e) => handleChange("priority", e.target.value)}
              onBlur={() => handleBlur("priority")}
              placeholder="Enter priority (optional)"
              min="0"
              step="1"
              className={errors.priority && touched.priority ? "border-destructive" : ""}
            />
            {errors.priority && touched.priority && (
              <p className="text-sm text-destructive">{errors.priority}</p>
            )}
            <p className="text-xs text-muted-foreground">Higher numbers indicate higher priority</p>
          </div>

          <div className="flex gap-3 pt-4">
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
              disabled={updateMutation.isPending || !isFormValid || !hasChanges}
              className="flex-1"
            >
              {updateMutation.isPending ? "Updating..." : "Update Category"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}