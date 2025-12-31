// components/modals/add-product-modal.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { X, ImageIcon, Loader2, FileText } from "lucide-react";
import { useCreateProduct } from "@/hooks/use-product-mutations";

import type { 
  ProductFormData, 
  ProductFormErrors,
  ImageUploadResponse,
} from "@/lib/types/product";
import type { 
  ApiResponse, 
  Category, 
  CategoriesResponse 
} from "@/types/category";

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Validation utility
const validateImageFile = (
  file: File
): { isValid: boolean; error?: string } => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/webp', 
    'image/gif'
  ];
  
  if (!allowedTypes.includes(file.type)) {
    return { 
      isValid: false, 
      error: 'Please select a valid image file (JPEG, PNG, WebP, or GIF)' 
    };
  }
  
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      error: 'Image size should be less than 5MB' 
    };
  }
  
  return { isValid: true };
};

const initialFormData: ProductFormData = {
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
};

export default function AddProductModal({ 
  open, 
  onOpenChange 
}: AddProductModalProps) {
  const createMutation = useCreateProduct();

  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
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
      const data: ApiResponse<CategoriesResponse> = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error?.message || "Failed to fetch categories");
      }
      return data;
    },
  });

  const categories = categoriesResponse?.data?.categories || [];

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setFormData(initialFormData);
      setImageFile(null);
      setImageName("");
      setImagePreview("");
      setErrors({});
      setTouched({});
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

  const validateField = useCallback((
    name: keyof ProductFormData, 
    value: string
  ): string | undefined => {
    switch (name) {
      case "name":
        if (!value.trim()) return "Product name is required";
        if (value.trim().length > 150) {
          return "Product name must be less than 150 characters";
        }
        break;
      case "categoryId":
        if (!value) return "Category is required";
        break;
      case "description":
        if (value.trim().length > 1000) {
          return "Description must be less than 1000 characters";
        }
        break;
      case "priority":
      case "lowStockThreshold":
        if (value.trim()) {
          const num = Number(value);
          if (isNaN(num) || !Number.isInteger(num) || num < 0) {
            return `${name === 'priority' ? 'Priority' : 'Threshold'} must be a positive number`;
          }
        }
        break;
      case "size":
      case "weight":
      case "volume":
        if (value.trim().length > 50) {
          return `${name.charAt(0).toUpperCase() + name.slice(1)} must be less than 50 characters`;
        }
        break;
      case "barcode":
        if (value.trim().length > 100) {
          return "Barcode must be less than 100 characters";
        }
        break;
    }
    return undefined;
  }, []);

  // const validateForm = useCallback((): boolean => {
  //   const newErrors: ProductFormErrors = {};
    
  //   (Object.keys(formData) as Array<keyof ProductFormData>).forEach((field) => {
  //     const error = validateField(field, formData[field]);
  //     if (error) newErrors[field] = error;
  //   });

  //   // Validate image name if file selected
  //   if (imageFile && imageName.trim()) {
  //     if (imageName.length < 3) {
  //       newErrors.image = "Image name must be at least 3 characters";
  //     } else if (imageName.length > 50) {
  //       newErrors.image = "Image name must be less than 50 characters";
  //     } else if (!/^[a-zA-Z0-9\s\-_.]+$/.test(imageName)) {
  //       newErrors.image = "Image name can only contain letters, numbers, spaces, hyphens, dots, underscores";
  //     }
  //   }

  //   setErrors(newErrors);
  //   return Object.keys(newErrors).length === 0;
  // }, [formData, imageFile, imageName, validateField]);

  // ✅ BETTER: Validate only the fields that need it
const validateForm = useCallback((): boolean => {
  const newErrors: ProductFormErrors = {};

  // Required field validations
  if (!formData.name.trim()) {
    newErrors.name = "Product name is required";
  } else if (formData.name.length > 150) {
    newErrors.name = "Product name cannot exceed 150 characters";
  }

  if (!formData.categoryId) {
    newErrors.categoryId = "Category is required";
  }

  // Optional field validations
  if (formData.description.length > 1000) {
    newErrors.description = "Description cannot exceed 1000 characters";
  }

  if (formData.priority.trim()) {
    const num = Number(formData.priority);
    if (isNaN(num) || num < 0) {
      newErrors.priority = "Priority must be a positive number";
    }
  }

  if (formData.lowStockThreshold.trim()) {
    const num = Number(formData.lowStockThreshold);
    if (isNaN(num) || num < 0) {
      newErrors.lowStockThreshold = "Threshold must be a positive number";
    }
  }

  if (formData.barcode.length > 100) {
    newErrors.barcode = "Barcode cannot exceed 100 characters";
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}, [formData]);
  
  const handleChange = useCallback((
    field: keyof ProductFormData, 
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((field: keyof ProductFormData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: error }));
  }, [formData, validateField]);

  const handleImageSelect = useCallback((
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setImageFile(file);
    
    if (!imageName.trim()) {
      const fileName = file.name.split('.').slice(0, -1).join('.');
      setImageName(fileName);
    }

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [imageName]);

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImageName("");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (imageName.trim()) {
        formData.append("imageName", imageName.trim());
      }

      const response = await fetch("/api/products/upload-image", {
        method: "POST",
        body: formData,
      });

      const result: ImageUploadResponse = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Failed to upload image");
      }

      return result.data.secure_url;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast.error(msg);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all as touched
    const allTouched = Object.keys(formData).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setTouched(allTouched);

    if (!validateForm()) {
      toast.error("Please fix the form errors");
      return;
    }

    let imageUrl: string | undefined;

    if (imageFile) {
      try {
        const url = await uploadImage();
        if (url) imageUrl = url;
      } catch {
        return;
      }
    }

    createMutation.mutate(
      {
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        description: formData.description.trim() || undefined,
        priority: formData.priority.trim() 
          ? Number(formData.priority) 
          : undefined,
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
  }, [formData, imageFile, validateForm, createMutation, onOpenChange]);

  const handleClose = useCallback(() => {
    if (!createMutation.isPending && !isUploading) {
      onOpenChange(false);
    }
  }, [createMutation.isPending, isUploading, onOpenChange]);

  const isSubmitting = createMutation.isPending || isUploading;
  const isFormValid = formData.name.trim() && 
    formData.categoryId && 
    !errors.name && 
    !errors.categoryId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Add New Product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.categoryId}
              onValueChange={(v) => handleChange("categoryId", v)}
            >
              <SelectTrigger 
                className={errors.categoryId ? "border-destructive" : ""}
              >
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
            {errors.categoryId && touched.categoryId && (
              <p className="text-sm text-destructive">{errors.categoryId}</p>
            )}
          </div>

          {/* Name & Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                onBlur={() => handleBlur("name")}
                placeholder="e.g., Balaji Masala Wafer"
                className={errors.name && touched.name ? "border-destructive" : ""}
              />
              {errors.name && touched.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <Input
                id="size"
                value={formData.size}
                onChange={(e) => handleChange("size", e.target.value)}
                placeholder="e.g., Small, Medium, 250g"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-3">
            <Label>Product Image (Optional)</Label>
            
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
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 text-xs"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="space-y-2">
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
                  <span className="text-xs text-muted-foreground">
                    {imageFile.name}
                  </span>
                )}
              </div>

              {imageFile && (
                <div className="space-y-1">
                  <Label htmlFor="imageName" className="text-sm flex items-center gap-2">
                    <FileText size={14} /> Custom Image Name
                  </Label>
                  <Input
                    id="imageName"
                    value={imageName}
                    onChange={(e) => setImageName(e.target.value)}
                    placeholder="e.g., balaji-masala-wafer"
                    disabled={isSubmitting}
                    className={errors.image ? "border-destructive" : ""}
                  />
                  {errors.image && (
                    <p className="text-xs text-destructive">{errors.image}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Weight & Volume */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                value={formData.weight}
                onChange={(e) => handleChange("weight", e.target.value)}
                placeholder="e.g., 25g, 500g"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="volume">Volume</Label>
              <Input
                id="volume"
                value={formData.volume}
                onChange={(e) => handleChange("volume", e.target.value)}
                placeholder="e.g., 250ml, 1L"
              />
            </div>
          </div>

          {/* Barcode & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => handleChange("barcode", e.target.value)}
                placeholder="Enter barcode"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
                onBlur={() => handleBlur("priority")}
                placeholder="0"
                min="0"
                className={errors.priority && touched.priority ? "border-destructive" : ""}
              />
              {errors.priority && touched.priority && (
                <p className="text-sm text-destructive">{errors.priority}</p>
              )}
            </div>
          </div>

          {/* Low Stock Threshold */}
          <div className="space-y-2">
            <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
            <Input
              id="lowStockThreshold"
              type="number"
              value={formData.lowStockThreshold}
              onChange={(e) => handleChange("lowStockThreshold", e.target.value)}
              onBlur={() => handleBlur("lowStockThreshold")}
              placeholder="10"
              min="0"
              className={errors.lowStockThreshold ? "border-destructive" : ""}
            />
            {errors.lowStockThreshold && touched.lowStockThreshold && (
              <p className="text-sm text-destructive">
                {errors.lowStockThreshold}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              placeholder="Enter product description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && touched.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {isUploading ? "Uploading..." : "Creating..."}
                </div>
              ) : (
                "Create Product"
              )}
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



// // components/modals/add-product-modal.tsx
// "use client";

// import { useState, useEffect } from "react";
// import { useQuery } from "@tanstack/react-query";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Textarea } from "@/components/ui/textarea";
// import { useCreateProduct } from "@/hooks/use-product-mutations";

// import type { 
//   ProductFormData, 
//   ProductFormErrors 
// } from "@/types/product";
// import type { ApiResponse, Category, CategoriesResponse } from "@/types/category";

// interface AddProductModalProps {
//   open: boolean;
//   onOpenChange: (open: boolean) => void;
// }

// export default function AddProductModal({ open, onOpenChange }: AddProductModalProps) {
//   const createMutation = useCreateProduct();

//   const [formData, setFormData] = useState<ProductFormData>({
//     name: "",
//     description: "",
//     categoryId: "",
//     priority: "",
//     hasVariants: false,
//   });

//   const [errors, setErrors] = useState<ProductFormErrors>({});
//   const [touched, setTouched] = useState<Record<keyof Omit<ProductFormData, 'hasVariants'>, boolean>>({
//     name: false,
//     description: false,
//     categoryId: false,
//     priority: false,
//   });

//   // Fetch categories
//   const { data: categoriesResponse } = useQuery<ApiResponse<CategoriesResponse>, Error>({
//     queryKey: ["categories"],
//     queryFn: async () => {
//       const response = await fetch("/api/categories");
//       if (!response.ok) throw new Error("Failed to fetch categories");

//       const data: ApiResponse<CategoriesResponse> = await response.json();

//       if (!data.success || !data.data) {
//         throw new Error(data.error?.message || "Failed to fetch categories");
//       }

//       return data;
//     },
//   });

//   const categories = categoriesResponse?.data?.categories || [];

//   // Reset form when modal opens/closes
//   useEffect(() => {
//     if (!open) {
//       setFormData({
//         name: "",
//         description: "",
//         categoryId: "",
//         priority: "",
//         hasVariants: false,
//       });
//       setErrors({});
//       setTouched({ name: false, description: false, categoryId: false, priority: false });
//     }
//   }, [open]);

//   const validateField = (name: keyof Omit<ProductFormData, 'hasVariants'>, value: string): string | undefined => {
//     switch (name) {
//       case "name":
//         if (!value.trim()) {
//           return "Product name is required";
//         }
//         if (value.trim().length > 100) {
//           return "Product name must be less than 100 characters";
//         }
//         break;
//       case "categoryId":
//         if (!value) {
//           return "Category is required";
//         }
//         break;
//       case "description":
//         if (value.trim().length > 500) {
//           return "Description must be less than 500 characters";
//         }
//         break;
//       case "priority":
//         if (value.trim()) {
//           const num = Number(value);
//           if (isNaN(num)) {
//             return "Priority must be a valid number";
//           }
//           if (!Number.isInteger(num)) {
//             return "Priority must be a whole number";
//           }
//           if (num < 0) {
//             return "Priority must be a positive number";
//           }
//           if (num > 999999) {
//             return "Priority must be less than 1,000,000";
//           }
//         }
//         break;
//     }
//     return undefined;
//   };

//   const validateForm = (): boolean => {
//     const newErrors: ProductFormErrors = {};

//     const nameError = validateField("name", formData.name);
//     if (nameError) newErrors.name = nameError;

//     const categoryError = validateField("categoryId", formData.categoryId);
//     if (categoryError) newErrors.categoryId = categoryError;

//     const descError = validateField("description", formData.description);
//     if (descError) newErrors.description = descError;

//     const priorityError = validateField("priority", formData.priority);
//     if (priorityError) newErrors.priority = priorityError;

//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleChange = (field: keyof ProductFormData, value: string | boolean) => {
//     setFormData((prev) => ({ ...prev, [field]: value }));

//     // Clear error when user starts typing
//     if (field !== 'hasVariants' && touched[field as keyof typeof touched]) {
//       const error = validateField(field as keyof Omit<ProductFormData, 'hasVariants'>, value as string);
//       setErrors((prev) => ({ ...prev, [field]: error }));
//     }
//   };

//   const handleBlur = (field: keyof Omit<ProductFormData, 'hasVariants'>) => {
//     setTouched((prev) => ({ ...prev, [field]: true }));
//     const error = validateField(field, formData[field]);
//     setErrors((prev) => ({ ...prev, [field]: error }));
//   };

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();

//     // Mark all fields as touched
//     setTouched({ name: true, description: true, categoryId: true, priority: true });

//     if (!validateForm()) {
//       return;
//     }

//     const priorityValue = formData.priority.trim() ? Number(formData.priority) : undefined;

//     createMutation.mutate(
//       {
//         name: formData.name.trim(),
//         categoryId: formData.categoryId,
//         description: formData.description.trim() || undefined,
//         priority: priorityValue,
//       },
//       {
//         onSuccess: () => {
//           onOpenChange(false);
//         },
//       }
//     );
//   };

//   const handleClose = () => {
//     if (!createMutation.isPending) {
//       onOpenChange(false);
//     }
//   };

//   const isFormValid =
//     formData.name.trim() &&
//     formData.categoryId &&
//     !errors.name &&
//     !errors.categoryId &&
//     !errors.description &&
//     !errors.priority;

//   return (
//     <Dialog open={open} onOpenChange={handleClose}>
//       <DialogContent className="max-w-md">
//         <DialogHeader>
//           <DialogTitle>Add New Product</DialogTitle>
//         </DialogHeader>

//         <form onSubmit={handleSubmit} className="space-y-4">
//           <div className="space-y-2">
//             <Label htmlFor="productName">
//               Product Name <span className="text-destructive">*</span>
//             </Label>
//             <Input
//               id="productName"
//               value={formData.name}
//               onChange={(e) => handleChange("name", e.target.value)}
//               onBlur={() => handleBlur("name")}
//               placeholder="Enter product name"
//               className={errors.name && touched.name ? "border-destructive" : ""}
//             />
//             {errors.name && touched.name && <p className="text-sm text-destructive">{errors.name}</p>}
//           </div>

//           <div className="space-y-2">
//             <Label htmlFor="category">
//               Category <span className="text-destructive">*</span>
//             </Label>
//             <Select
//               value={formData.categoryId}
//               onValueChange={(value) => handleChange("categoryId", value)}
//             >
//               <SelectTrigger className={errors.categoryId && touched.categoryId ? "border-destructive" : ""}>
//                 <SelectValue placeholder="Select category" />
//               </SelectTrigger>
//               <SelectContent>
//                 {categories.map((category: Category) => (
//                   <SelectItem key={category._id} value={category._id}>
//                     {category.name}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//             {errors.categoryId && touched.categoryId && (
//               <p className="text-sm text-destructive">{errors.categoryId}</p>
//             )}
//           </div>

//           <div className="space-y-2">
//             <Label htmlFor="description">Description (Optional)</Label>
//             <Textarea
//               id="description"
//               value={formData.description}
//               onChange={(e) => handleChange("description", e.target.value)}
//               onBlur={() => handleBlur("description")}
//               placeholder="Enter product description"
//               rows={3}
//               className={errors.description && touched.description ? "border-destructive" : ""}
//             />
//             {errors.description && touched.description && (
//               <p className="text-sm text-destructive">{errors.description}</p>
//             )}
//           </div>

//           <div className="space-y-2">
//             <Label htmlFor="priority">Priority (Optional)</Label>
//             <Input
//               id="priority"
//               type="number"
//               value={formData.priority}
//               onChange={(e) => handleChange("priority", e.target.value)}
//               onBlur={() => handleBlur("priority")}
//               placeholder="Enter priority"
//               min="0"
//               step="1"
//               className={errors.priority && touched.priority ? "border-destructive" : ""}
//             />
//             {errors.priority && touched.priority && (
//               <p className="text-sm text-destructive">{errors.priority}</p>
//             )}
//             <p className="text-xs text-muted-foreground">Higher numbers indicate higher priority</p>
//           </div>

//           <div className="bg-blue-50 p-3 rounded-lg">
//             <p className="text-sm text-blue-700">
//               <strong>Note:</strong> After creating the product, you'll need to add variants
//               (sub-products) with specific prices, stock, and images.
//             </p>
//           </div>

//           <div className="flex space-x-2 pt-4">
//             <Button
//               type="submit"
//               disabled={createMutation.isPending || !isFormValid}
//               className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
//             >
//               {createMutation.isPending ? "Adding..." : "Add Product"}
//             </Button>
//             <Button
//               type="button"
//               variant="outline"
//               onClick={handleClose}
//               disabled={createMutation.isPending}
//             >
//               Cancel
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }