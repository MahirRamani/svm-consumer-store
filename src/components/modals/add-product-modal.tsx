// components/modals/add-product-modal.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProduct } from "@/hooks/use-product-mutations";

import type { 
  ProductFormData, 
  ProductFormErrors 
} from "@/types/product";
import type { ApiResponse, Category, CategoriesResponse } from "@/types/category";

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddProductModal({ open, onOpenChange }: AddProductModalProps) {
  const createMutation = useCreateProduct();

  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    categoryId: "",
    priority: "",
    hasVariants: false,
  });

  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [touched, setTouched] = useState<Record<keyof Omit<ProductFormData, 'hasVariants'>, boolean>>({
    name: false,
    description: false,
    categoryId: false,
    priority: false,
  });

  // Fetch categories
  const { data: categoriesResponse } = useQuery<ApiResponse<CategoriesResponse>, Error>({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");

      const data: ApiResponse<CategoriesResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch categories");
      }

      return data;
    },
  });

  const categories = categoriesResponse?.data?.categories || [];

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setFormData({
        name: "",
        description: "",
        categoryId: "",
        priority: "",
        hasVariants: false,
      });
      setErrors({});
      setTouched({ name: false, description: false, categoryId: false, priority: false });
    }
  }, [open]);

  const validateField = (name: keyof Omit<ProductFormData, 'hasVariants'>, value: string): string | undefined => {
    switch (name) {
      case "name":
        if (!value.trim()) {
          return "Product name is required";
        }
        if (value.trim().length > 100) {
          return "Product name must be less than 100 characters";
        }
        break;
      case "categoryId":
        if (!value) {
          return "Category is required";
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
    const newErrors: ProductFormErrors = {};

    const nameError = validateField("name", formData.name);
    if (nameError) newErrors.name = nameError;

    const categoryError = validateField("categoryId", formData.categoryId);
    if (categoryError) newErrors.categoryId = categoryError;

    const descError = validateField("description", formData.description);
    if (descError) newErrors.description = descError;

    const priorityError = validateField("priority", formData.priority);
    if (priorityError) newErrors.priority = priorityError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof ProductFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (field !== 'hasVariants' && touched[field as keyof typeof touched]) {
      const error = validateField(field as keyof Omit<ProductFormData, 'hasVariants'>, value as string);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field: keyof Omit<ProductFormData, 'hasVariants'>) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({ name: true, description: true, categoryId: true, priority: true });

    if (!validateForm()) {
      return;
    }

    const priorityValue = formData.priority.trim() ? Number(formData.priority) : undefined;

    createMutation.mutate(
      {
        name: formData.name.trim(),
        categoryId: formData.categoryId,
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
    if (!createMutation.isPending) {
      onOpenChange(false);
    }
  };

  const isFormValid =
    formData.name.trim() &&
    formData.categoryId &&
    !errors.name &&
    !errors.categoryId &&
    !errors.description &&
    !errors.priority;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="productName">
              Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="productName"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              onBlur={() => handleBlur("name")}
              placeholder="Enter product name"
              className={errors.name && touched.name ? "border-destructive" : ""}
            />
            {errors.name && touched.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) => handleChange("categoryId", value)}
            >
              <SelectTrigger className={errors.categoryId && touched.categoryId ? "border-destructive" : ""}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category: Category) => (
                  <SelectItem key={category._id} value={category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && touched.categoryId && (
              <p className="text-sm text-destructive">{errors.categoryId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              placeholder="Enter product description"
              rows={3}
              className={errors.description && touched.description ? "border-destructive" : ""}
            />
            {errors.description && touched.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority (Optional)</Label>
            <Input
              id="priority"
              type="number"
              value={formData.priority}
              onChange={(e) => handleChange("priority", e.target.value)}
              onBlur={() => handleBlur("priority")}
              placeholder="Enter priority"
              min="0"
              step="1"
              className={errors.priority && touched.priority ? "border-destructive" : ""}
            />
            {errors.priority && touched.priority && (
              <p className="text-sm text-destructive">{errors.priority}</p>
            )}
            <p className="text-xs text-muted-foreground">Higher numbers indicate higher priority</p>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> After creating the product, you'll need to add variants
              (sub-products) with specific prices, stock, and images.
            </p>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button
              type="submit"
              disabled={createMutation.isPending || !isFormValid}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              {createMutation.isPending ? "Adding..." : "Add Product"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}