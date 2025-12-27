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