// hooks/use-subproduct-mutations.ts
import { useCreate, useUpdate, useDelete } from "./use-mutations";
import type { 
  SubProduct, 
  CreateSubProductInput, 
  UpdateSubProductInput 
} from "@/types/subproduct";

const ENDPOINT = "/api/sub-products";
const QUERY_KEY = ["sub-products"];

export function useCreateSubProduct() {
  return useCreate<SubProduct, CreateSubProductInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Sub-product created successfully",
    errorMessage: "Failed to create sub-product",
  });
}

export function useUpdateSubProduct() {
  return useUpdate<SubProduct, UpdateSubProductInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Sub-product updated successfully",
    errorMessage: "Failed to update sub-product",
  });
}

export function useDeleteSubProduct() {
  return useDelete<null>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Sub-product deleted successfully",
    errorMessage: "Failed to delete sub-product",
  });
}

// import { useMutation, useQueryClient } from "@tanstack/react-query"
// import { toast } from "sonner"
// import { useCreate, useUpdate, useDelete, useToggleStatus } from "./use-mutations"
// import type {
//   SubProduct,
//   CreateSubProductInput,
//   UpdateSubProductInput,
//   ImageUploadResponse,
//   ImageUploadInput,
// } from "@/lib/types/subproduct"

// const ENDPOINT = "/api/sub-products"
// const QUERY_KEY = ["sub-products"]

// // =============================================
// // Create SubProduct
// // =============================================
// export function useCreateSubProduct() {
//   return useCreate<SubProduct, CreateSubProductInput>(ENDPOINT, {
//     queryKey: QUERY_KEY,
//     invalidateQueries: [["products"]], // Also invalidate products
//   })
// }

// // =============================================
// // Update SubProduct
// // =============================================
// export function useUpdateSubProduct() {
//   return useUpdate<SubProduct, UpdateSubProductInput>(ENDPOINT, {
//     queryKey: QUERY_KEY,
//     invalidateQueries: [["products"]],
//   })
// }

// // =============================================
// // Delete SubProduct
// // =============================================
// export function useDeleteSubProduct() {
//   return useDelete<SubProduct>(ENDPOINT, {
//     queryKey: QUERY_KEY,
//     invalidateQueries: [["products"]],
//   })
// }

// // =============================================
// // Toggle SubProduct Status
// // =============================================
// export function useToggleSubProductStatus() {
//   return useToggleStatus<SubProduct>(ENDPOINT, {
//     queryKey: QUERY_KEY,
//   })
// }

// // =============================================
// // Upload Image (Custom Mutation)
// // =============================================
// export function useUploadSubProductImage() {
//   return useMutation({
//     mutationFn: async ({ file, customName }: ImageUploadInput): Promise<ImageUploadResponse> => {
//       const formData = new FormData()
//       formData.append("image", file)

//       if (customName?.trim()) {
//         const sanitizedName = customName
//           .trim()
//           .replace(/\s+/g, "_")
//           .replace(/[^a-z0-9\-_.]/gi, "")
//           .replace(/-+/g, "")
//           .replace(/^-|-$/g, "")
//         formData.append("imageName", sanitizedName)
//       }

//       const response = await fetch("/api/sub-products/upload-image", {
//         method: "POST",
//         body: formData,
//       })

//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}))
//         throw new Error(errorData.error?.message || `Upload failed: ${response.status}`)
//       }

//       const data = await response.json()
//       return data.success ? data.data : data
//     },
//     onSuccess: () => {
//       toast.success("Image uploaded successfully!")
//     },
//     onError: (error: Error) => {
//       console.error("Image upload error:", error)
//       toast.error(error.message || "Failed to upload image")
//     },
//   })
// }