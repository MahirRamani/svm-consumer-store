// hooks/use-category-mutations.ts
import { useCreate, useUpdate, useDelete } from './use-mutations';
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput
} from "@/types/seller/category";

const ENDPOINT = "/api/categories";
const QUERY_KEY = ["categories"];

export function useCreateCategory() {
  return useCreate<Category, CreateCategoryInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Category created successfully",
    errorMessage: "Failed to create category",
  });
}

export function useUpdateCategory() {
  return useUpdate<Category, UpdateCategoryInput>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Category updated successfully",
    errorMessage: "Failed to update category",
  });
}

export function useDeleteCategory() {
  return useDelete<null>(ENDPOINT, {
    queryKey: QUERY_KEY,
    successMessage: "Category deleted successfully",
    errorMessage: "Failed to delete category",
  });
}