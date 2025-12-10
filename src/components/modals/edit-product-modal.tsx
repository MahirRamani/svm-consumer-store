// components/modals/edit-product-modal.tsx
"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Edit } from "lucide-react";
import { useUpdateProduct } from "@/hooks/use-product-mutations";

import type { Product, ProductFormData, ProductFormErrors } from "@/types/product";
import type { ApiResponse, Category, CategoriesResponse } from "@/types/category";

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export default function EditProductModal({ open, onOpenChange, product }: EditProductModalProps) {
  const updateMutation = useUpdateProduct();

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

  // Populate form when product changes
  useEffect(() => {
    if (product && open) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        categoryId: product.categoryId || "",
        priority: product.priority !== undefined ? String(product.priority) : "",
        hasVariants: product.hasVariants || false,
      });
      setErrors({});
      setTouched({ name: false, description: false, categoryId: false, priority: false });
    }
  }, [product, open]);

  // Reset form when modal closes
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

    if (!product?._id) return;

    setTouched({ name: true, description: true, categoryId: true, priority: true });

    if (!validateForm()) {
      return;
    }

    const priorityValue = formData.priority.trim() ? Number(formData.priority) : undefined;

    updateMutation.mutate(
      {
        _id: product._id,
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        description: formData.description.trim() || undefined,
        priority: priorityValue,
        hasVariants: formData.hasVariants,
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
    formData.name.trim() &&
    formData.categoryId &&
    !errors.name &&
    !errors.categoryId &&
    !errors.description &&
    !errors.priority;

  const hasChanges =
    product &&
    (() => {
      const trimmedName = formData.name.trim();
      const trimmedDesc = formData.description.trim();
      const newPriority = formData.priority.trim() ? Number(formData.priority) : undefined;

      return (
        trimmedName !== product.name ||
        trimmedDesc !== (product.description || "") ||
        formData.categoryId !== product.categoryId ||
        newPriority !== product.priority ||
        formData.hasVariants !== product.hasVariants
      );
    })();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Edit className="w-5 h-5 mr-2" />
            Edit Product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
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
              <Select value={formData.categoryId} onValueChange={(value) => handleChange("categoryId", value)}>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              placeholder="Enter product description (optional)"
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

          <div className="space-y-2">
            <Label>Product Configuration</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.hasVariants}
                onCheckedChange={(checked) => handleChange("hasVariants", checked)}
              />
              <span className="text-sm text-gray-600">This product has variants (sizes, colors, etc.)</span>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 bg-transparent"
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || !isFormValid || !hasChanges}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              {updateMutation.isPending ? "Updating..." : "Update Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}





// "use client"

// import { useState, useEffect } from "react"
// import { useQuery } from "@tanstack/react-query"
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Textarea } from "@/components/ui/textarea"
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"
// import { Edit } from "lucide-react"
// import { useUpdateProduct } from "@/hooks/use-product-mutations"
// import type { Product, Category, CategoriesListResponse } from "@/types"
// import { UpdateProductInput } from "@/lib/types/product"

// // =============================================
// // Props Interface
// // =============================================
// interface EditProductModalProps {
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   product: Product | null
// }

// // =============================================
// // Form Data Interface
// // =============================================
// interface FormData {
//   name: string
//   categoryId: string
//   description: string
// }

// // =============================================
// // Form Errors Interface
// // =============================================
// interface FormErrors {
//   name?: string
//   categoryId?: string
//   description?: string
// }

// // =============================================
// // Component
// // =============================================
// export default function EditProductModal({
//   open,
//   onOpenChange,
//   product,
// }: EditProductModalProps) {
//   const [formData, setFormData] = useState<FormData>({
//     name: "",
//     categoryId: "",
//     description: "",
//   })

//   const [errors, setErrors] = useState<FormErrors>({})
//   const [touched, setTouched] = useState<Record<keyof FormData, boolean>>({
//     name: false,
//     categoryId: false,
//     description: false,
//   })

//   // =============================================
//   // Use New Update Hook
//   // =============================================
//   const updateMutation = useUpdateProduct()

//   // =============================================
//   // Fetch Categories
//   // =============================================
//   const { data: categoriesData, isLoading: isLoadingCategories } = useQuery<Category[]>({
//     queryKey: ["categories"],
//     queryFn: async (): Promise<Category[]> => {
//       const response = await fetch("/api/categories?includeInactive=false")

//       if (!response.ok) {
//         throw new Error("Failed to fetch categories")
//       }

//       const data: CategoriesListResponse = await response.json()

//       if (!data.success || !data.data.categories) {
//         throw new Error("Invalid response format")
//       }

//       return data.data.categories
//     },
//   })

//   const categories = categoriesData || []

//   // =============================================
//   // Populate Form when Product Changes
//   // =============================================
//   useEffect(() => {
//     if (product && open) {
//       setFormData({
//         name: product.name,
//         categoryId: product.categoryId,
//         description: product.description || "",
//       })
//       setErrors({})
//       setTouched({ name: false, categoryId: false, description: false })
//     }
//   }, [product, open])

//   // =============================================
//   // Reset Form when Modal Closes
//   // =============================================
//   useEffect(() => {
//     if (!open) {
//       setFormData({ name: "", categoryId: "", description: "" })
//       setErrors({})
//       setTouched({ name: false, categoryId: false, description: false })
//     }
//   }, [open])

//   // =============================================
//   // Field Validation
//   // =============================================
//   const validateField = (name: keyof FormData, value: string): string | undefined => {
//     switch (name) {
//       case "name":
//         if (!value.trim()) {
//           return "Product name is required"
//         }
//         if (value.trim().length > 150) {
//           return "Product name must be less than 150 characters"
//         }
//         break
//       case "categoryId":
//         if (!value) {
//           return "Category is required"
//         }
//         break
//       case "description":
//         if (value.trim().length > 1000) {
//           return "Description must be less than 1000 characters"
//         }
//         break
//     }
//     return undefined
//   }

//   // =============================================
//   // Form Validation
//   // =============================================
//   const validateForm = (): boolean => {
//     const newErrors: FormErrors = {}

//     const nameError = validateField("name", formData.name)
//     if (nameError) newErrors.name = nameError

//     const categoryError = validateField("categoryId", formData.categoryId)
//     if (categoryError) newErrors.categoryId = categoryError

//     const descError = validateField("description", formData.description)
//     if (descError) newErrors.description = descError

//     setErrors(newErrors)
//     return Object.keys(newErrors).length === 0
//   }

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

//   const handleBlur = (field: keyof FormData) => {
//     setTouched((prev) => ({ ...prev, [field]: true }))
//     const error = validateField(field, formData[field])
//     setErrors((prev) => ({ ...prev, [field]: error }))
//   }

//   const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault()

//     if (!product?.id) return

//     setTouched({ name: true, categoryId: true, description: true })

//     if (!validateForm()) {
//       return
//     }

//     const updateData: UpdateProductInput = {
//       id: product.id,
//       name: formData.name.trim(),
//       categoryId: formData.categoryId,
//       description: formData.description.trim() || undefined,
//     }

//     updateMutation.mutate(updateData, {
//       onSuccess: () => {
//         onOpenChange(false)
//       },
//     })
//   }

//   const handleClose = () => {
//     if (!updateMutation.isPending) {
//       onOpenChange(false)
//     }
//   }

//   // =============================================
//   // Form Validation State
//   // =============================================
//   const isFormValid =
//     formData.name.trim() &&
//     formData.categoryId &&
//     !errors.name &&
//     !errors.categoryId &&
//     !errors.description

//   // Check if form has any changes from original product
//   const hasChanges =
//     product &&
//     (() => {
//       const trimmedName = formData.name.trim()
//       const trimmedDesc = formData.description.trim()

//       return (
//         trimmedName !== product.name ||
//         formData.categoryId !== product.categoryId ||
//         trimmedDesc !== (product.description || "")
//       )
//     })()

//   // =============================================
//   // Render
//   // =============================================
//   return (
//     <Dialog open={open} onOpenChange={handleClose}>
//       <DialogContent className="sm:max-w-lg">
//         <DialogHeader>
//           <DialogTitle className="flex items-center">
//             <Edit className="w-5 h-5 mr-2" />
//             Edit Product
//           </DialogTitle>
//         </DialogHeader>

//         <form onSubmit={handleSubmit} className="space-y-4">
//           {/* Product Name */}
//           <div className="space-y-2">
//             <Label htmlFor="name">
//               Product Name <span className="text-destructive">*</span>
//             </Label>
//             <Input
//               id="name"
//               type="text"
//               value={formData.name}
//               onChange={(e) => handleChange("name", e.target.value)}
//               onBlur={() => handleBlur("name")}
//               placeholder="Enter product name"
//               className={errors.name && touched.name ? "border-destructive" : ""}
//               disabled={updateMutation.isPending}
//             />
//             {errors.name && touched.name && (
//               <p className="text-sm text-destructive">{errors.name}</p>
//             )}
//           </div>

//           {/* Category */}
//           <div className="space-y-2">
//             <Label htmlFor="category">
//               Category <span className="text-destructive">*</span>
//             </Label>
//             <Select
//               value={formData.categoryId}
//               onValueChange={(value) => {
//                 handleChange("categoryId", value)
//                 setTouched((prev) => ({ ...prev, categoryId: true }))
//               }}
//               disabled={updateMutation.isPending || isLoadingCategories}
//             >
//               <SelectTrigger
//                 className={errors.categoryId && touched.categoryId ? "border-destructive" : ""}
//               >
//                 <SelectValue placeholder="Select category" />
//               </SelectTrigger>
//               <SelectContent>
//                 {categories.map((category) => (
//                   <SelectItem key={category.id} value={category.id}>
//                     {category.name}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//             {errors.categoryId && touched.categoryId && (
//               <p className="text-sm text-destructive">{errors.categoryId}</p>
//             )}
//           </div>

//           {/* Description */}
//           <div className="space-y-2">
//             <Label htmlFor="description">Description</Label>
//             <Textarea
//               id="description"
//               value={formData.description}
//               onChange={(e) => handleChange("description", e.target.value)}
//               onBlur={() => handleBlur("description")}
//               placeholder="Enter product description (optional)"
//               className={`min-h-[80px] ${
//                 errors.description && touched.description ? "border-destructive" : ""
//               }`}
//               disabled={updateMutation.isPending}
//             />
//             {errors.description && touched.description && (
//               <p className="text-sm text-destructive">{errors.description}</p>
//             )}
//           </div>

//           {/* Variant Info */}
//           {product && product.hasVariants && (
//             <div className="bg-blue-50 p-3 rounded-lg">
//               <p className="text-sm text-blue-700">
//                 <strong>Info:</strong> This product has {product.variantCount || 0} variant(s).
//                 Manage variants in the SubProducts section.
//               </p>
//             </div>
//           )}

//           {/* Action Buttons */}
//           <div className="flex space-x-3 pt-4">
//             <Button
//               type="button"
//               variant="outline"
//               onClick={handleClose}
//               className="flex-1"
//               disabled={updateMutation.isPending}
//             >
//               Cancel
//             </Button>
//             <Button
//               type="submit"
//               disabled={updateMutation.isPending || !isFormValid || !hasChanges}
//               className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
//             >
//               {updateMutation.isPending ? "Updating..." : "Update Product"}
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   )
// }