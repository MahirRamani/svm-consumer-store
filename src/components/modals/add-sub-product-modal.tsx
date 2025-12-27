// components/modals/add-sub-product-modal.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X, ImageIcon, Loader2, FileText } from "lucide-react";
import { useCreateSubProduct } from "@/hooks/use-subproduct-mutations";

import type { 
  ApiResponse,
  SubProductFormData, 
  SubProductFormErrors,
  ImageUploadResponse 
} from "@/types/subproduct";
import type { Product, ProductsResponse } from "@/types/product";

interface AddSubProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Input validation utilities
const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Please select a valid image file (JPEG, PNG, WebP, or GIF)' };
  }
  
  if (file.size > maxSize) {
    return { isValid: false, error: 'Image size should be less than 5MB' };
  }
  
  return { isValid: true };
};

export default function AddSubProductModal({ open, onOpenChange }: AddSubProductModalProps) {
  const createMutation = useCreateSubProduct();

  const [formData, setFormData] = useState<SubProductFormData>({
    productId: "",
    name: "",
    size: "",
    weight: "",
    volume: "",
    barcode: "",
    description: "",
    lowStockThreshold: "10",
    priority: "",
  });
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<SubProductFormErrors>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch products
  const { 
    data: productsResponse,
    isLoading: isProductsLoading,
    error: productsError 
  } = useQuery<ApiResponse<ProductsResponse>, Error>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await fetch("/api/products");
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
      }

      const data: ApiResponse<ProductsResponse> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch products");
      }

      return data;
    },
    retry: 2,
    staleTime: 10 * 60 * 1000,
  });

  const products = productsResponse?.data?.products || [];

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const resetForm = useCallback(() => {
    setFormData({
      productId: "",
      name: "",
      size: "",
      weight: "",
      volume: "",
      barcode: "",
      description: "",
      lowStockThreshold: "10",
      priority: "",
    });
    setImageFile(null);
    setImageName("");
    setImagePreview("");
    setIsUploading(false);
    setFormErrors({});
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const validateField = useCallback((name: keyof SubProductFormData, value: string): string | undefined => {
    switch (name) {
      case "name":
        if (!value.trim()) {
          return "Variant name is required";
        }
        if (value.trim().length > 100) {
          return "Variant name must be less than 100 characters";
        }
        break;
      case "productId":
        if (!value) {
          return "Parent product is required";
        }
        break;
      case "description":
        if (value.trim().length > 500) {
          return "Description must be less than 500 characters";
        }
        break;
      case "lowStockThreshold":
        if (value.trim()) {
          const num = Number(value);
          if (isNaN(num) || !Number.isInteger(num) || num < 0) {
            return "Low stock threshold must be a positive number";
          }
        }
        break;
      case "priority":
        if (value.trim()) {
          const num = Number(value);
          if (isNaN(num) || !Number.isInteger(num) || num < 0) {
            return "Priority must be a positive number";
          }
        }
        break;
    }
    return undefined;
  }, []);

  const validateForm = useCallback((): boolean => {
    const errors: SubProductFormErrors = {};
    
    const nameError = validateField("name", formData.name);
    if (nameError) errors.name = nameError;

    const productError = validateField("productId", formData.productId);
    if (productError) errors.productId = productError;

    const descError = validateField("description", formData.description);
    if (descError) errors.description = descError;

    const thresholdError = validateField("lowStockThreshold", formData.lowStockThreshold);
    if (thresholdError) errors.lowStockThreshold = thresholdError;

    const priorityError = validateField("priority", formData.priority);
    if (priorityError) errors.priority = priorityError;

    // Validate image name if file is selected
    if (imageFile && imageName.trim()) {
      if (imageName.length < 3) {
        errors.image = "Image name must be at least 3 characters long";
      } else if (imageName.length > 50) {
        errors.image = "Image name must be less than 50 characters";
      } else if (!/^[a-zA-Z0-9\s\-_.]+$/.test(imageName)) {
        errors.image = "Image name can only contain letters, numbers, spaces, hyphens, dots, and underscores";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, imageFile, imageName, validateField]);

  const handleFieldChange = useCallback(<K extends keyof SubProductFormData>(
    field: K,
    value: SubProductFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [formErrors]);

  const handleImageNameChange = useCallback((name: string) => {
    setImageName(name);
    
    if (formErrors.image) {
      setFormErrors(prev => ({ ...prev, image: undefined }));
    }
  }, [formErrors]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setImageFile(file);

    // Auto-suggest image name based on file name (without extension)
    const fileName = file.name.split('.').slice(0, -1).join('.');
    if (!imageName.trim()) {
      setImageName(fileName);
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  }, [imageName]);

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImageName("");
    setImagePreview("");
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Upload image function
  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      
      if (imageName.trim()) {
        formData.append("imageName", imageName.trim());
      }

      const response = await fetch("/api/sub-products/upload-image", {
        method: "POST",
        body: formData,
      });

      const result: ImageUploadResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Failed to upload image");
      }

      return result.data.secure_url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error("Please fix the form errors before submitting");
      return;
    }

    let imageUrl: string | undefined = undefined;

    // Upload image first if selected
    if (imageFile) {
      try {
        const uploadedUrl = await uploadImage();
        if (!uploadedUrl) {
          toast.error("Failed to upload image. Please try again.");
          return;
        }
        imageUrl = uploadedUrl;
      } catch (error) {
        // Error already toasted in uploadImage
        return;
      }
    }

    // Create sub-product with uploaded image URL
    const priorityValue = formData.priority.trim() ? Number(formData.priority) : undefined;
    const thresholdValue = formData.lowStockThreshold.trim() ? Number(formData.lowStockThreshold) : 10;

    createMutation.mutate(
      {
        productId: formData.productId,
        name: formData.name.trim(),
        size: formData.size.trim() || undefined,
        weight: formData.weight.trim() || undefined,
        volume: formData.volume.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        description: formData.description.trim() || undefined,
        imageURL: imageUrl,
        lowStockThreshold: thresholdValue,
        priority: priorityValue,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  }, [formData, imageFile, validateForm, createMutation, onOpenChange, uploadImage]);

  const handleClose = useCallback(() => {
    if (!createMutation.isPending && !isUploading) {
      onOpenChange(false);
    }
  }, [createMutation.isPending, isUploading, onOpenChange]);

  const isSubmitting = createMutation.isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl font-semibold">Add New Sub-Product Variant</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Parent Product Selection */}
          <div className="space-y-1">
            <Label htmlFor="productId" className="text-sm font-medium">
              Parent Product <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.productId}
              onValueChange={(value) => handleFieldChange("productId", value)}
              disabled={isProductsLoading}
            >
              <SelectTrigger className={formErrors.productId ? "border-red-500" : ""}>
                <SelectValue placeholder="Select parent product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product: Product) => (
                  <SelectItem key={product._id} value={product._id}>
                    {product.name} {product.category && `(${product.category.name})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors.productId && (
              <p className="text-xs text-red-500 mt-1">{formErrors.productId}</p>
            )}
            {productsError && (
              <p className="text-xs text-amber-600 mt-1">Warning: Failed to load products</p>
            )}
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="variantName" className="text-sm font-medium">
                Variant Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="variantName"
                value={formData.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                placeholder="e.g., Balaji Masala Wafer Small"
                className={formErrors.name ? "border-red-500" : ""}
              />
              {formErrors.name && (
                <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="size" className="text-sm font-medium">Size</Label>
              <Input
                id="size"
                value={formData.size}
                onChange={(e) => handleFieldChange("size", e.target.value)}
                placeholder="e.g., Small, Medium, Large"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Product Image (Optional)</Label>

            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Product preview"
                  className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                  onError={() => {
                    setImagePreview("");
                    toast.error("Failed to load image preview");
                  }}
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors text-xs"
                  disabled={isSubmitting}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="space-y-3">
              {/* Custom Image Name Input */}
              <div className="space-y-1">
                <Label htmlFor="imageName" className="text-sm font-medium flex items-center gap-2">
                  <FileText size={14} />
                  Custom Image Name (Optional)
                </Label>
                <Input
                  id="imageName"
                  value={imageName}
                  onChange={(e) => handleImageNameChange(e.target.value)}
                  placeholder="e.g., balaji-masala-wafer-small"
                  disabled={isSubmitting || !imageFile}
                  className={formErrors.image ? "border-red-500" : ""}
                />
                {formErrors.image && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.image}</p>
                )}
                <p className="text-xs text-gray-500">
                  Leave empty to use original filename
                </p>
              </div>

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
                  className="flex items-center gap-2"
                >
                  <ImageIcon size={14} />
                  {imageFile ? "Change Image" : "Select Image"}
                </Button>
                {imageFile && (
                  <span className="text-xs text-gray-600">{imageFile.name}</span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Support: JPEG, PNG, WebP, GIF. Max size: 5MB. Image will be uploaded when you submit the form.
              </p>
            </div>
          </div>

          {/* Physical Properties */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="weight" className="text-sm font-medium">Weight</Label>
              <Input
                id="weight"
                value={formData.weight}
                onChange={(e) => handleFieldChange("weight", e.target.value)}
                placeholder="e.g., 25g, 50g"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="volume" className="text-sm font-medium">Volume</Label>
              <Input
                id="volume"
                value={formData.volume}
                onChange={(e) => handleFieldChange("volume", e.target.value)}
                placeholder="e.g., 250ml, 500ml"
              />
            </div>
          </div>

          {/* Stock & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="lowStockThreshold" className="text-sm font-medium">
                Low Stock Threshold
              </Label>
              <Input
                id="lowStockThreshold"
                type="number"
                value={formData.lowStockThreshold}
                onChange={(e) => handleFieldChange("lowStockThreshold", e.target.value)}
                placeholder="10"
                min="0"
                className={formErrors.lowStockThreshold ? "border-red-500" : ""}
              />
              {formErrors.lowStockThreshold && (
                <p className="text-xs text-red-500 mt-1">{formErrors.lowStockThreshold}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="priority" className="text-sm font-medium">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => handleFieldChange("priority", e.target.value)}
                placeholder="Optional"
                min="0"
                className={formErrors.priority ? "border-red-500" : ""}
              />
              {formErrors.priority && (
                <p className="text-xs text-red-500 mt-1">{formErrors.priority}</p>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-1">
            <Label htmlFor="barcode" className="text-sm font-medium">Barcode</Label>
            <Input
              id="barcode"
              value={formData.barcode}
              onChange={(e) => handleFieldChange("barcode", e.target.value)}
              placeholder="Enter barcode number"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleFieldChange("description", e.target.value)}
              placeholder="Enter variant description"
              rows={3}
              className={`resize-none ${formErrors.description ? "border-red-500" : ""}`}
            />
            {formErrors.description && (
              <p className="text-xs text-red-500 mt-1">{formErrors.description}</p>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> After creating the sub-product, you'll need to add stock entries
              with buying/selling prices.
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex space-x-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {isUploading ? "Uploading Image..." : "Creating..."}
                </div>
              ) : (
                "Create Sub-Product"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}