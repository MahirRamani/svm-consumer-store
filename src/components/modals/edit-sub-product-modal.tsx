// components/modals/edit-sub-product-modal.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { X, ImageIcon, Loader2, FileText, Edit } from "lucide-react";
import { useUpdateSubProduct } from "@/hooks/use-subproduct-mutations";
import { useQueryClient } from "@tanstack/react-query";

import type { 
  SubProduct,
  SubProductFormData, 
  SubProductFormErrors,
  ImageUploadResponse 
} from "@/types/subproduct";
import type { Product } from "@/types/product";

interface EditSubProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subProduct: SubProduct | null;
}

// Input validation utilities
const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  const maxSize = 5 * 1024 * 1024;
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Please select a valid image file (JPEG, PNG, WebP, or GIF)' };
  }
  
  if (file.size > maxSize) {
    return { isValid: false, error: 'Image size should be less than 5MB' };
  }
  
  return { isValid: true };
};

export default function EditSubProductModal({ 
  open, 
  onOpenChange, 
  subProduct,
}: EditSubProductModalProps) {
  const updateMutation = useUpdateSubProduct();
  const queryClient = useQueryClient();

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
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<SubProductFormErrors>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form when subProduct changes
  useEffect(() => {
    if (subProduct && open) {
      setFormData({
        productId: subProduct.parentProduct._id || "",
        name: subProduct.name || "",
        size: subProduct.size || "",
        weight: subProduct.weight || "",
        volume: subProduct.volume || "",
        barcode: subProduct.barcode || "",
        description: subProduct.description || "",
        lowStockThreshold: subProduct.lowStockThreshold?.toString() || "10",
        priority: subProduct.priority?.toString() || "",
      });
      
      if (subProduct.imageURL) {
        setImagePreview(subProduct.imageURL);
        setCurrentImageUrl(subProduct.imageURL);
      } else {
        setImagePreview("");
        setCurrentImageUrl("");
      }
    }
  }, [subProduct, open]);

  // Reset form when modal closes
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
    setCurrentImageUrl("");
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

    const fileName = file.name.split('.').slice(0, -1).join('.');
    if (!imageName.trim()) {
      setImageName(fileName);
    }

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
    setImagePreview(currentImageUrl || "");
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [currentImageUrl]);

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

    if (!subProduct?._id) {
      toast.error("Invalid sub-product");
      return;
    }

    let imageUrl: string | undefined = currentImageUrl || undefined;

    // Upload new image if selected
    if (imageFile) {
      try {
        const uploadedUrl = await uploadImage();
        if (!uploadedUrl) {
          toast.error("Failed to upload image. Please try again.");
          return;
        }
        imageUrl = uploadedUrl;
      } catch (error) {
        return;
      }
    }

    const priorityValue = formData.priority.trim() ? Number(formData.priority) : undefined;
    const thresholdValue = formData.lowStockThreshold.trim() ? Number(formData.lowStockThreshold) : 10;

    updateMutation.mutate(
      {
        _id: subProduct._id,
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
          queryClient.invalidateQueries({ queryKey: ["sub-products"] });
          onOpenChange(false);
        },
      }
    );
  }, [formData, imageFile, subProduct, currentImageUrl, validateForm, updateMutation, queryClient, onOpenChange, uploadImage]);

  const handleClose = useCallback(() => {
    if (!updateMutation.isPending && !isUploading) {
      onOpenChange(false);
    }
  }, [updateMutation.isPending, isUploading, onOpenChange]);

  const isSubmitting = updateMutation.isPending || isUploading;

  // Get products from cache (already loaded in parent component)
  const productsData = queryClient.getQueryData<{
    success: boolean;
    data: { products: Product[] };
  }>(["products"]);
  const products = productsData?.data?.products || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl font-semibold flex items-center">
            <Edit className="w-5 h-5 mr-2" />
            Edit Sub-Product Variant
          </DialogTitle>
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
            <Label className="text-sm font-medium">Product Image</Label>

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
                  {imageFile ? "Change Image" : currentImageUrl ? "Replace Image" : "Select Image"}
                </Button>
                {imageFile && (
                  <span className="text-xs text-gray-600">{imageFile.name}</span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {imageFile 
                  ? "New image will be uploaded when you submit the form" 
                  : "Select a new image to replace the current one"}
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
                  {isUploading ? "Uploading Image..." : "Updating..."}
                </div>
              ) : (
                "Update Sub-Product"
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




// "use client"

// import { useState, useRef, useCallback, useEffect } from "react"
// import { useQuery } from "@tanstack/react-query"
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"
// import { Textarea } from "@/components/ui/textarea"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { toast } from "sonner"
// import { Upload, X, ImageIcon, Link2, Loader2, FileText, Edit } from "lucide-react"
// import {
//   useUpdateSubProduct,
//   useUploadSubProductImage,
// } from "@/hooks/use-sub-product-mutations"
// import type { SubProduct, ProductsListResponse } from "@/types"
// import { UpdateSubProductInput } from "@/lib/types/subproduct"

// // =============================================
// // Types
// // =============================================
// interface Product {
//   id: string
//   name: string
//   category?: {
//     id: string
//     name: string
//   }
// }

// interface EditSubProductModalProps {
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   subProduct: SubProduct | null
// }

// interface FormData {
//   productId: string
//   name: string
//   size: string
//   weight: string
//   volume: string
//   barcode: string
//   description: string
//   imageURL: string
// }

// interface FormErrors {
//   productId?: string
//   name?: string
//   size?: string
//   weight?: string
//   volume?: string
//   barcode?: string
//   description?: string
//   imageName?: string
// }

// // =============================================
// // Validation Utilities
// // =============================================
// const validateImageUrl = (url: string): boolean => {
//   if (!url.trim()) return false

//   try {
//     const urlObj = new URL(url)
//     return ["http:", "https:"].includes(urlObj.protocol)
//   } catch {
//     return false
//   }
// }

// const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
//   const maxSize = 5 * 1024 * 1024
//   const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]

//   if (!allowedTypes.includes(file.type)) {
//     return {
//       isValid: false,
//       error: "Please select a valid image file (JPEG, PNG, WebP, or GIF)",
//     }
//   }

//   if (file.size > maxSize) {
//     return { isValid: false, error: "Image size should be less than 5MB" }
//   }

//   return { isValid: true }
// }

// // =============================================
// // Component
// // =============================================
// export default function EditSubProductModal({
//   open,
//   onOpenChange,
//   subProduct,
// }: EditSubProductModalProps) {
//   const [formData, setFormData] = useState<FormData>({
//     productId: "",
//     name: "",
//     size: "",
//     weight: "",
//     volume: "",
//     barcode: "",
//     description: "",
//     imageURL: "",
//   })

//   const [imageFile, setImageFile] = useState<File | null>(null)
//   const [imageName, setImageName] = useState<string>("")
//   const [imageUrl, setImageUrl] = useState<string>("")
//   const [imagePreview, setImagePreview] = useState<string>("")
//   const [imageMethod, setImageMethod] = useState<"upload" | "url">("upload")
//   const [errors, setErrors] = useState<FormErrors>({})
//   const [touched, setTouched] = useState<Record<keyof FormData | "imageName", boolean>>({
//     productId: false,
//     name: false,
//     size: false,
//     weight: false,
//     volume: false,
//     barcode: false,
//     description: false,
//     imageURL: false,
//     imageName: false,
//   })

//   const fileInputRef = useRef<HTMLInputElement>(null)

//   // =============================================
//   // Use New Mutation Hooks
//   // =============================================
//   const updateMutation = useUpdateSubProduct()
//   const uploadImageMutation = useUploadSubProductImage()

//   const isUploadingImage = uploadImageMutation.isPending
//   const isSubmitting = updateMutation.isPending || isUploadingImage

//   // =============================================
//   // Fetch Products
//   // =============================================
//   const { data: products = [], isLoading: isProductsLoading } = useQuery<Product[]>({
//     queryKey: ["products"],
//     queryFn: async (): Promise<Product[]> => {
//       const response = await fetch("/api/products")

//       if (!response.ok) {
//         throw new Error(`Failed to fetch products: ${response.status}`)
//       }

//       const data: ProductsListResponse = await response.json()

//       if (data.success && data.data.products) {
//         return data.data.products.map((p) => ({
//           id: p.id,
//           name: p.name,
//           category: p.category || undefined,
//         }))
//       }

//       return []
//     },
//     retry: 2,
//     staleTime: 10 * 60 * 1000,
//   })

//   // =============================================
//   // Populate Form when SubProduct Changes
//   // =============================================
//   useEffect(() => {
//     if (subProduct && open) {
//       setFormData({
//         productId: subProduct.productId || "",
//         name: subProduct.name || "",
//         size: subProduct.size || "",
//         weight: subProduct.weight || "",
//         volume: subProduct.volume || "",
//         barcode: subProduct.barcode || "",
//         description: subProduct.description || "",
//         imageURL: subProduct.imageURL || "",
//       })

//       if (subProduct.imageURL) {
//         setImagePreview(subProduct.imageURL)
//         setImageUrl(subProduct.imageURL)
//         setImageMethod("url")
//       } else {
//         setImagePreview("")
//         setImageUrl("")
//       }
//     }
//   }, [subProduct, open])

//   // =============================================
//   // Reset Form when Modal Closes
//   // =============================================
//   useEffect(() => {
//     if (!open) {
//       resetForm()
//     }
//   }, [open])

//   // =============================================
//   // Field Validation
//   // =============================================
//   const validateField = (name: keyof FormData | "imageName", value: string): string | undefined => {
//     switch (name) {
//       case "productId":
//         if (!value.trim()) return "Parent product is required"
//         break
//       case "name":
//         if (!value.trim()) return "Variant name is required"
//         if (value.trim().length > 100) return "Name must be less than 100 characters"
//         break
//       case "size":
//         if (value.trim().length > 50) return "Size must be less than 50 characters"
//         break
//       case "weight":
//         if (value.trim().length > 50) return "Weight must be less than 50 characters"
//         break
//       case "volume":
//         if (value.trim().length > 50) return "Volume must be less than 50 characters"
//         break
//       case "barcode":
//         if (value.trim().length > 100) return "Barcode must be less than 100 characters"
//         break
//       case "description":
//         if (value.trim().length > 500) return "Description must be less than 500 characters"
//         break
//       case "imageName":
//         if (value.trim()) {
//           if (value.length < 3) return "Image name must be at least 3 characters long"
//           if (value.length > 50) return "Image name must be less than 50 characters"
//           if (!/^[a-zA-Z0-9\s\-_.]+$/.test(value))
//             return "Image name can only contain letters, numbers, spaces, hyphens, dots, and underscores"
//         }
//         break
//     }
//     return undefined
//   }

//   // =============================================
//   // Form Validation
//   // =============================================
//   const validateForm = useCallback((): boolean => {
//     const newErrors: FormErrors = {}

//     const productIdError = validateField("productId", formData.productId)
//     if (productIdError) newErrors.productId = productIdError

//     const nameError = validateField("name", formData.name)
//     if (nameError) newErrors.name = nameError

//     if (imageMethod === "upload" && imageName.trim()) {
//       const imageNameError = validateField("imageName", imageName)
//       if (imageNameError) newErrors.imageName = imageNameError
//     }

//     setErrors(newErrors)
//     return Object.keys(newErrors).length === 0
//   }, [formData, imageMethod, imageName])

//   // =============================================
//   // Event Handlers
//   // =============================================
//   const handleChange = (field: keyof FormData, value: string) => {
//     setFormData((prev) => ({ ...prev, [field]: value }))

//     if (touched[field]) {
//       const error = validateField(field, value)
//       setErrors((prev) => ({ ...prev, [field]: error }))
//     }
//   }

//   const handleBlur = (field: keyof FormData | "imageName") => {
//     setTouched((prev) => ({ ...prev, [field]: true }))

//     if (field === "imageName") {
//       const error = validateField("imageName", imageName)
//       setErrors((prev) => ({ ...prev, imageName: error }))
//     } else {
//       const error = validateField(field, formData[field])
//       setErrors((prev) => ({ ...prev, [field]: error }))
//     }
//   }

//   const handleImageNameChange = (name: string) => {
//     setImageName(name)

//     if (touched.imageName) {
//       const error = validateField("imageName", name)
//       setErrors((prev) => ({ ...prev, imageName: error }))
//     }
//   }

//   const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0]
//     if (!file) return

//     const validation = validateImageFile(file)
//     if (!validation.isValid) {
//       toast.error(validation.error)
//       return
//     }

//     setImageFile(file)
//     setImageMethod("upload")

//     const fileName = file.name.split(".").slice(0, -1).join(".")
//     if (!imageName.trim()) {
//       setImageName(fileName)
//     }

//     const reader = new FileReader()
//     reader.onload = (e) => {
//       const result = e.target?.result as string
//       setImagePreview(result)
//     }
//     reader.readAsDataURL(file)
//   }

//   const handleImageUrlChange = (url: string) => {
//     setImageUrl(url)

//     if (url.trim() && validateImageUrl(url)) {
//       setImagePreview(url)
//       setFormData((prev) => ({ ...prev, imageURL: url }))
//       setImageMethod("url")
//       setImageFile(null)
//       setImageName("")
//       if (fileInputRef.current) {
//         fileInputRef.current.value = ""
//       }
//     } else if (!url.trim()) {
//       setImagePreview("")
//       setFormData((prev) => ({ ...prev, imageURL: "" }))
//     }
//   }

//   const handleImageUpload = () => {
//     if (!imageFile) return

//     uploadImageMutation.mutate(
//       {
//         file: imageFile,
//         customName: imageName.trim() || undefined,
//       },
//       {
//         onSuccess: (data) => {
//           setFormData((prev) => ({ ...prev, imageURL: data.secure_url }))
//           setImagePreview(data.secure_url)
//         },
//       }
//     )
//   }

//   const removeImage = () => {
//     setImageFile(null)
//     setImageName("")
//     setImageUrl("")
//     setImagePreview("")
//     setFormData((prev) => ({ ...prev, imageURL: "" }))

//     if (fileInputRef.current) {
//       fileInputRef.current.value = ""
//     }
//   }

//   const resetForm = () => {
//     setFormData({
//       productId: "",
//       name: "",
//       size: "",
//       weight: "",
//       volume: "",
//       barcode: "",
//       description: "",
//       imageURL: "",
//     })
//     setImageFile(null)
//     setImageName("")
//     setImageUrl("")
//     setImagePreview("")
//     setImageMethod("upload")
//     setErrors({})
//     setTouched({
//       productId: false,
//       name: false,
//       size: false,
//       weight: false,
//       volume: false,
//       barcode: false,
//       description: false,
//       imageURL: false,
//       imageName: false,
//     })

//     if (fileInputRef.current) {
//       fileInputRef.current.value = ""
//     }
//   }

//   const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault()

//     if (!subProduct?.id) {
//       toast.error("Invalid sub-product")
//       return
//     }

//     setTouched({
//       productId: true,
//       name: true,
//       size: true,
//       weight: true,
//       volume: true,
//       barcode: true,
//       description: true,
//       imageURL: true,
//       imageName: true,
//     })

//     if (!validateForm()) {
//       toast.error("Please fix the form errors before submitting")
//       return
//     }

//     if (imageMethod === "upload" && imageFile && !formData.imageURL) {
//       toast.error("Please upload the selected image first")
//       return
//     }

//     const updateData: UpdateSubProductInput = {
//       id: subProduct.id,
//       productId: formData.productId.trim(),
//       name: formData.name.trim(),
//       size: formData.size.trim() || undefined,
//       weight: formData.weight.trim() || undefined,
//       volume: formData.volume.trim() || undefined,
//       barcode: formData.barcode.trim() || undefined,
//       description: formData.description.trim() || undefined,
//       imageURL: formData.imageURL.trim() || undefined,
//     }

//     updateMutation.mutate(updateData, {
//       onSuccess: () => {
//         onOpenChange(false)
//       },
//     })
//   }

//   const handleClose = () => {
//     if (!isSubmitting) {
//       onOpenChange(false)
//     }
//   }

//   const isFormValid = formData.productId.trim() && formData.name.trim() && !errors.productId && !errors.name

//   // Check if form has any changes
//   const hasChanges =
//     subProduct &&
//     (() => {
//       return (
//         formData.productId !== subProduct.productId ||
//         formData.name.trim() !== subProduct.name ||
//         formData.size.trim() !== (subProduct.size || "") ||
//         formData.weight.trim() !== (subProduct.weight || "") ||
//         formData.volume.trim() !== (subProduct.volume || "") ||
//         formData.barcode.trim() !== (subProduct.barcode || "") ||
//         formData.description.trim() !== (subProduct.description || "") ||
//         formData.imageURL.trim() !== (subProduct.imageURL || "")
//       )
//     })()

//   // =============================================
//   // Render
//   // =============================================
//   return (
//     <Dialog open={open} onOpenChange={handleClose}>
//       <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto p-0">
//         <DialogHeader className="px-6 pt-6 pb-2">
//           <DialogTitle className="text-xl font-semibold flex items-center">
//             <Edit className="w-5 h-5 mr-2" />
//             Edit Sub-Product Variant
//           </DialogTitle>
//         </DialogHeader>

//         <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
//           {/* Parent Product Selection */}
//           <div className="space-y-2">
//             <Label htmlFor="productId">
//               Parent Product <span className="text-destructive">*</span>
//             </Label>
//             <Select
//               value={formData.productId}
//               onValueChange={(value) => {
//                 handleChange("productId", value)
//                 setTouched((prev) => ({ ...prev, productId: true }))
//               }}
//               disabled={isProductsLoading || isSubmitting}
//             >
//               <SelectTrigger className={errors.productId && touched.productId ? "border-destructive" : ""}>
//                 <SelectValue placeholder="Select parent product" />
//               </SelectTrigger>
//               <SelectContent>
//                 {products.map((product) => (
//                   <SelectItem key={product.id} value={product.id}>
//                     {product.name} ({product.category?.name || "No Category"})
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//             {errors.productId && touched.productId && (
//               <p className="text-sm text-destructive">{errors.productId}</p>
//             )}
//           </div>

//           {/* Basic Information */}
//           <div className="grid grid-cols-2 gap-3">
//             <div className="space-y-2">
//               <Label htmlFor="variantName">
//                 Variant Name <span className="text-destructive">*</span>
//               </Label>
//               <Input
//                 id="variantName"
//                 value={formData.name}
//                 onChange={(e) => handleChange("name", e.target.value)}
//                 onBlur={() => handleBlur("name")}
//                 placeholder="e.g., Balaji Masala Wafer Small"
//                 className={errors.name && touched.name ? "border-destructive" : ""}
//                 disabled={isSubmitting}
//               />
//               {errors.name && touched.name && (
//                 <p className="text-sm text-destructive">{errors.name}</p>
//               )}
//             </div>
//             <div className="space-y-2">
//               <Label htmlFor="size">Size</Label>
//               <Input
//                 id="size"
//                 value={formData.size}
//                 onChange={(e) => handleChange("size", e.target.value)}
//                 onBlur={() => handleBlur("size")}
//                 placeholder="e.g., Small, Medium, Large"
//                 disabled={isSubmitting}
//               />
//             </div>
//           </div>

//           {/* Image Management */}
//           <div className="space-y-3">
//             <Label className="text-sm font-medium">Product Image</Label>

//             {/* Image Preview */}
//             {imagePreview && (
//               <div className="relative inline-block">
//                 <img
//                   src={imagePreview}
//                   alt="Product preview"
//                   className="w-24 h-24 object-cover rounded-lg border border-gray-200"
//                   onError={() => {
//                     setImagePreview("")
//                     toast.error("Failed to load image preview")
//                   }}
//                 />
//                 <button
//                   type="button"
//                   onClick={removeImage}
//                   className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors text-xs"
//                   disabled={isSubmitting}
//                 >
//                   <X size={12} />
//                 </button>
//               </div>
//             )}

//             {/* Image Input Methods */}
//             <Tabs
//               value={imageMethod}
//               onValueChange={(value) => setImageMethod(value as "upload" | "url")}
//             >
//               <TabsList className="grid w-full grid-cols-2">
//                 <TabsTrigger value="upload" className="text-xs">
//                   Upload File
//                 </TabsTrigger>
//                 <TabsTrigger value="url" className="text-xs">
//                   Image URL
//                 </TabsTrigger>
//               </TabsList>

//               <TabsContent value="upload" className="space-y-3 mt-2">
//                 <div className="space-y-2">
//                   <Label htmlFor="imageName" className="text-sm font-medium flex items-center gap-2">
//                     <FileText size={14} />
//                     Custom Image Name (Optional)
//                   </Label>
//                   <Input
//                     id="imageName"
//                     value={imageName}
//                     onChange={(e) => handleImageNameChange(e.target.value)}
//                     onBlur={() => handleBlur("imageName")}
//                     placeholder="e.g., balaji-masala-wafer-small"
//                     disabled={isSubmitting}
//                     className={errors.imageName && touched.imageName ? "border-destructive" : ""}
//                   />
//                   {errors.imageName && touched.imageName && (
//                     <p className="text-sm text-destructive">{errors.imageName}</p>
//                   )}
//                 </div>

//                 <div className="flex gap-2 items-center">
//                   <input
//                     ref={fileInputRef}
//                     type="file"
//                     accept="image/*"
//                     onChange={handleImageSelect}
//                     className="hidden"
//                   />
//                   <Button
//                     type="button"
//                     variant="outline"
//                     size="sm"
//                     onClick={() => fileInputRef.current?.click()}
//                     disabled={isSubmitting}
//                     className="flex items-center gap-2"
//                   >
//                     <ImageIcon size={14} />
//                     Select Image
//                   </Button>

//                   {imageFile && !formData.imageURL && (
//                     <Button
//                       type="button"
//                       size="sm"
//                       onClick={handleImageUpload}
//                       disabled={isUploadingImage}
//                       className="flex items-center gap-2"
//                     >
//                       {isUploadingImage ? (
//                         <Loader2 size={14} className="animate-spin" />
//                       ) : (
//                         <Upload size={14} />
//                       )}
//                       {isUploadingImage ? "Uploading..." : "Upload"}
//                     </Button>
//                   )}
//                 </div>
//                 <p className="text-xs text-gray-500">Support: JPEG, PNG, WebP, GIF. Max size: 5MB</p>
//               </TabsContent>

//               <TabsContent value="url" className="space-y-2 mt-2">
//                 <div className="flex gap-2 items-center">
//                   <div className="flex-1">
//                     <Input
//                       value={imageUrl}
//                       onChange={(e) => handleImageUrlChange(e.target.value)}
//                       placeholder="https://example.com/image.jpg"
//                       disabled={isSubmitting}
//                     />
//                   </div>
//                   <Link2 size={16} className="text-gray-400" />
//                 </div>
//               </TabsContent>
//             </Tabs>
//           </div>

//           {/* Physical Properties */}
//           <div className="grid grid-cols-2 gap-3">
//             <div className="space-y-2">
//               <Label htmlFor="weight">Weight</Label>
//               <Input
//                 id="weight"
//                 value={formData.weight}
//                 onChange={(e) => handleChange("weight", e.target.value)}
//                 onBlur={() => handleBlur("weight")}
//                 placeholder="e.g., 25g, 50g"
//                 disabled={isSubmitting}
//               />
//             </div>
//             <div className="space-y-2">
//               <Label htmlFor="volume">Volume</Label>
//               <Input
//                 id="volume"
//                 value={formData.volume}
//                 onChange={(e) => handleChange("volume", e.target.value)}
//                 onBlur={() => handleBlur("volume")}
//                 placeholder="e.g., 250ml, 500ml"
//                 disabled={isSubmitting}
//               />
//             </div>
//           </div>

//           {/* Additional Information */}
//           <div className="space-y-2">
//             <Label htmlFor="barcode">Barcode</Label>
//             <Input
//               id="barcode"
//               value={formData.barcode}
//               onChange={(e) => handleChange("barcode", e.target.value)}
//               onBlur={() => handleBlur("barcode")}
//               placeholder="Enter barcode number"
//               disabled={isSubmitting}
//             />
//           </div>

//           <div className="space-y-2">
//             <Label htmlFor="description">Description</Label>
//             <Textarea
//               id="description"
//               value={formData.description}
//               onChange={(e) => handleChange("description", e.target.value)}
//               onBlur={() => handleBlur("description")}
//               placeholder="Enter variant description"
//               rows={3}
//               className="resize-none"
//               disabled={isSubmitting}
//             />
//           </div>

//           {/* Form Actions */}
//           <div className="flex space-x-3 pt-4 border-t">
//             <Button
//               type="submit"
//               disabled={isSubmitting || !isFormValid || !hasChanges}
//               className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
//             >
//               {isSubmitting ? (
//                 <div className="flex items-center gap-2">
//                   <Loader2 size={16} className="animate-spin" />
//                   {isUploadingImage ? "Uploading..." : "Updating..."}
//                 </div>
//               ) : (
//                 "Update Sub-Product"
//               )}
//             </Button>
//             <Button
//               type="button"
//               variant="outline"
//               onClick={handleClose}
//               disabled={isSubmitting}
//               className="px-6"
//             >
//               Cancel
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   )
// }