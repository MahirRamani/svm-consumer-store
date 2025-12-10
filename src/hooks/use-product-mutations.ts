// hooks/use-product-mutations.ts
import { useCreate, useUpdate, useDelete } from "./use-mutations";
import type { 
  Product, 
  CreateProductInput, 
  UpdateProductInput 
} from "@/types/product";

const ENDPOINT = "/api/products";
const QUERY_KEY = ["products"];

export function useCreateProduct() {
  return useCreate<Product, CreateProductInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Product created successfully",
    errorMessage: "Failed to create product",
  });
}

export function useUpdateProduct() {
  return useUpdate<Product, UpdateProductInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Product updated successfully",
    errorMessage: "Failed to update product",
  });
}

export function useDeleteProduct() {
  return useDelete<null>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Product deleted successfully",
    errorMessage: "Failed to delete product",
  });
}






// import { useCreate, useUpdate, useDelete, useToggleStatus } from "./use-mutations"
// import type { Product, CreateProductInput, UpdateProductInput } from "@/lib/types/product"

// const ENDPOINT = "/api/products"
// const QUERY_KEY = ["products"]

// // =============================================
// // Create Product
// // =============================================
// export function useCreateProduct() {
//   return useCreate<Product, CreateProductInput>(ENDPOINT, {
//     queryKey: QUERY_KEY,
//     invalidateQueries: [["dashboard-stats"]], // Also invalidate dashboard
//   })
// }

// // =============================================
// // Update Product
// // =============================================
// export function useUpdateProduct() {
//   return useUpdate<Product, UpdateProductInput>(ENDPOINT, {
//     queryKey: QUERY_KEY,
//   })
// }

// // =============================================
// // Delete Product
// // =============================================
// export function useDeleteProduct() {
//   return useDelete<Product>(ENDPOINT, {
//     queryKey: QUERY_KEY,
//     invalidateQueries: [["dashboard-stats"]],
//   })
// }

// // =============================================
// // Toggle Product Status
// // =============================================
// export function useToggleProductStatus() {
//   return useToggleStatus<Product>(ENDPOINT, {
//     queryKey: QUERY_KEY,
//   })
// }


// // import { useCreate, useUpdate, useDelete, useToggleStatus } from "./use-mutations"
// // import type { Product, CreateProductInput, UpdateProductInput } from "@/lib/types/product"

// // const ENDPOINT = "/api/products"
// // const QUERY_KEY = ["products"]

// // // =============================================
// // // Create Product
// // // =============================================
// // export function useCreateProduct() {
// //   return useCreate<Product, CreateProductInput>(ENDPOINT, {
// //     queryKey: QUERY_KEY,
// //     invalidateQueries: [["dashboard-stats"]], // Also invalidate dashboard
// //   })
// // }

// // // =============================================
// // // Update Product
// // // =============================================
// // export function useUpdateProduct() {
// //   return useUpdate<Product, UpdateProductInput>(ENDPOINT, {
// //     queryKey: QUERY_KEY,
// //   })
// // }

// // // =============================================
// // // Delete Product
// // // =============================================
// // export function useDeleteProduct() {
// //   return useDelete<Product>(ENDPOINT, {
// //     queryKey: QUERY_KEY,
// //     invalidateQueries: [["dashboard-stats"]],
// //   })
// // }

// // // =============================================
// // // Toggle Product Status
// // // =============================================
// // export function useToggleProductStatus() {
// //   return useToggleStatus<Product>(ENDPOINT, {
// //     queryKey: QUERY_KEY,
// //   })
// // }