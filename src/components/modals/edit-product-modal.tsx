// components/modals/edit-product-modal.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { X, ImageIcon, Loader2, FileText, Edit } from 'lucide-react';
import { useUpdateProduct } from '@/hooks/use-product-mutations';

import type {
  Product,
  ProductFormData,
  ProductFormErrors,
  ImageUploadResponse,
} from "@/lib/types/product";
import type {
  Category,
  CategoriesResponse
} from "@/types/seller/category";
import { ApiResponse } from '@/lib/api/base-handler';

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

const validateImageFile = (
  file: File
): { isValid: boolean; error?: string } => {
  const maxSize = 5 * 1024 * 1024;
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid image format' };
  }
  if (file.size > maxSize) {
    return { isValid: false, error: 'Image must be less than 5MB' };
  }
  return { isValid: true };
};

export default function EditProductModal({
  open,
  onOpenChange,
  product
}: EditProductModalProps) {
  const updateMutation = useUpdateProduct();

  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    categoryId: "",
    priority: "",
    imageURL: "",
    size: "",
    weight: "",
    volume: "",
    barcode: "",
    lowStockThreshold: "10",
  });

  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [shouldDeleteCurrentImage, setShouldDeleteCurrentImage] = useState(false);

  const [errors, setErrors] = useState<ProductFormErrors>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch categories
  const { data: categoriesResponse } = useQuery<
    ApiResponse<CategoriesResponse>,
    Error
  >({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message);
      return data;
    },
  });

  const categories = categoriesResponse?.data?.categories || [];

  // Populate form when product changes
  useEffect(() => {
    if (product && open) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        categoryId: product.categoryId || "",
        priority: product.priority?.toString() || "",
        imageURL: product.imageURL || "",
        size: product.size || "",
        weight: product.weight || "",
        volume: product.volume || "",
        barcode: product.barcode || "",
        lowStockThreshold: product.lowStockThreshold?.toString() || "10",
      });
      setIsActive(product.isActive);

      if (product.imageURL) {
        setImagePreview(product.imageURL);
        setCurrentImageUrl(product.imageURL);
      } else {
        setImagePreview("");
        setCurrentImageUrl("");
      }

      setErrors({});
    }
  }, [product, open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setImageFile(null);
      setImageName("");
      setErrors({});
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  // Add this effect to both modals
  useEffect(() => {
    if (imageFile) {
      // Keep image name in sync with product name while user is typing
      setImageName(formData.name.trim() || imageFile.name.split('.').slice(0, -1).join('.'));
    }
  }, [formData.name, imageFile]);

  const validateField = useCallback((
    name: keyof ProductFormData,
    value: string
  ): string | undefined => {
    switch (name) {
      case "name":
        if (!value.trim()) return "Product name is required";
        if (value.length > 150) return "Name too long";
        break;
      case "categoryId":
        if (!value) return "Category is required";
        break;
      case "priority":
      case "lowStockThreshold":
        if (value.trim()) {
          const num = Number(value);
          if (isNaN(num) || num < 0) return "Must be a positive number";
        }
        break;
    }
    return undefined;
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: ProductFormErrors = {};

    const nameErr = validateField("name", formData.name);
    if (nameErr) newErrors.name = nameErr;

    const catErr = validateField("categoryId", formData.categoryId);
    if (catErr) newErrors.categoryId = catErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  const handleChange = useCallback((
    field: keyof ProductFormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  }, [validateField]);

  // const handleImageSelect = useCallback((
  //   e: React.ChangeEvent<HTMLInputElement>
  // ) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   const validation = validateImageFile(file);
  //   if (!validation.isValid) {
  //     toast.error(validation.error);
  //     return;
  //   }

  //   setImageFile(file);
  //   if (!imageName) {
  //     setImageName(file.name.split('.').slice(0, -1).join('.'));
  //   }

  //   const reader = new FileReader();
  //   reader.onload = (e) => setImagePreview(e.target?.result as string);
  //   reader.readAsDataURL(file);
  // }, [imageName]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setImageFile(file);

    // ✅ Prefer product name, fallback to file name
    const nameToUse = formData.name.trim() || file.name.split('.').slice(0, -1).join('.');
    setImageName(nameToUse);

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [imageName]);

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImageName("");
    setImagePreview("");
    setShouldDeleteCurrentImage(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [currentImageUrl]);

  // const uploadImage = async (): Promise<string | null> => {
  //   if (!imageFile) return null;

  //   setIsUploading(true);
  //   try {
  //     const formData = new FormData();
  //     formData.append("image", imageFile);
  //     if (imageName.trim()) formData.append("imageName", imageName.trim());

  //     const response = await fetch("/api/products/upload-image", {
  //       method: "PUT",
  //       body: formData,
  //     });

  //     const result: ImageUploadResponse = await response.json();
  //     if (!response.ok || !result.success) {
  //       throw new Error(result.error || "Upload failed");
  //     }

  //     return result.data!.secure_url;
  //   } catch (error) {
  //     toast.error(error instanceof Error ? error.message : "Upload failed");
  //     throw error;
  //   } finally {
  //     setIsUploading(false);
  //   }
  // };

  const uploadImage = useCallback(async (): Promise<string | null> => {
    if (!imageFile) return null;
    setIsUploading(true);

    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      if (imageName.trim()) fd.append("imageName", imageName.trim());

      // If replacing an existing image, use PUT with the existing publicId
      const isReplacing = !!currentImageUrl;
      if (isReplacing) {
        // Cloudinary public_id is the URL path between /upload/ and the extension
        const publicId = currentImageUrl
          .split("/upload/")[1]         // "v123/folder/name.jpg"
          .replace(/\.[^/.]+$/, "")     // "v123/folder/name"
          .replace(/^v\d+\//, "");      // "folder/name"
        fd.append("publicId", publicId);
      }

      const response = await fetch("/api/products/upload-image", {
        method: isReplacing ? "PUT" : "POST",
        body: fd,
      });

      const result: ImageUploadResponse = await response.json();
      if (!result.success) throw new Error(result.error || "Upload failed");
      return result.data!.secure_url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [imageFile, imageName]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !product?._id) return;

    let imageUrl = currentImageUrl || undefined;

    if (imageFile) {
      try {
        const url = await uploadImage();
        if (url) imageUrl = url;
      } catch {
        return;
      }
    }

    if (shouldDeleteCurrentImage && currentImageUrl && !imageFile) {
      const publicId = currentImageUrl
        .split("/upload/")[1]
        .replace(/\.[^/.]+$/, "")
        .replace(/^v\d+\//, "");

      await fetch("/api/products/upload-image", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      });

      imageUrl = undefined; // clear from product record too
    }

    updateMutation.mutate(
      {
        _id: product._id,
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        description: formData.description.trim() || undefined,
        priority: formData.priority.trim()
          ? Number(formData.priority)
          : undefined,
        isActive,
        imageURL: imageUrl,
        size: formData.size.trim() || undefined,
        weight: formData.weight.trim() || undefined,
        volume: formData.volume.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        lowStockThreshold: formData.lowStockThreshold.trim()
          ? Number(formData.lowStockThreshold)
          : undefined,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  }, [formData, imageFile, product, isActive, currentImageUrl, shouldDeleteCurrentImage, validateForm, updateMutation, onOpenChange, uploadImage]);

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending && !isUploading) {
      onOpenChange(false);
    }
  }, [updateMutation.isPending, isUploading, onOpenChange]);

  const isSubmitting = updateMutation.isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit Product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Active Status */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label htmlFor="isActive">Product Status</Label>
            <div className="flex items-center gap-2">
              <span className={isActive ? "text-green-600" : "text-gray-400"}>
                {isActive ? "Active" : "Inactive"}
              </span>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category <span className="text-destructive">*</span></Label>
            <Select
              value={formData.categoryId}
              onValueChange={(v) => handleChange("categoryId", v)}
            >
              <SelectTrigger className={errors.categoryId ? "border-destructive" : ""}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat: Category) => (
                  <SelectItem key={cat._id} value={cat._id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-sm text-destructive">{errors.categoryId}</p>
            )}
          </div>

          {/* Name & Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product Name <span className="text-destructive">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Size</Label>
              <Input
                value={formData.size}
                onChange={(e) => handleChange("size", e.target.value)}
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-3">
            <Label>Product Image</Label>

            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={isSubmitting}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                <ImageIcon size={14} className="mr-2" />
                {imageFile ? "Change" : currentImageUrl ? "Replace" : "Select"} Image
              </Button>
            </div>
          </div>

          {/* Weight & Volume */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Weight</Label>
              <Input
                value={formData.weight}
                onChange={(e) => handleChange("weight", e.target.value)}
                placeholder="e.g., 500g"
              />
            </div>
            <div className="space-y-2">
              <Label>Volume</Label>
              <Input
                value={formData.volume}
                onChange={(e) => handleChange("volume", e.target.value)}
                placeholder="e.g., 1L"
              />
            </div>
          </div>

          {/* Barcode & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Barcode</Label>
              <Input
                value={formData.barcode}
                onChange={(e) => handleChange("barcode", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
                min="0"
              />
            </div>
          </div>

          {/* Low Stock Threshold */}
          <div className="space-y-2">
            <Label>Low Stock Threshold</Label>
            <Input
              type="number"
              value={formData.lowStockThreshold}
              onChange={(e) => handleChange("lowStockThreshold", e.target.value)}
              min="0"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : null}
              {isSubmitting ? "Updating..." : "Update Product"}
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