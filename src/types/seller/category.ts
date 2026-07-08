// types/category.ts

/** Base API Response Structure (matching your backend) */
// export interface ApiResponse<T> {
//   success: boolean;
//   message?: string;
//   data?: T;
//   error?: {
//     code: string;
//     message: string;
//     details?: Record<string, unknown>;
//   };
//   metadata?: {
//     page?: number;
//     limit?: number;
//     totalCount?: number;
//     totalPages?: number;
//   };
// }

/** Category Entity (as returned from API) */
export interface Category {
  _id: string;
  name: string;
  description?: string;
  priority?: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Categories List Response */
export interface CategoriesResponse {
  categories: Category[];
  totalCount?: number;
  activeCount?: number;
  inactiveCount?: number;
}

/** Create Category Input */
export type CreateCategoryInput = {
  name: string;
  description?: string;
  priority?: number;
};

/** Update Category Input */
export type UpdateCategoryInput = {
  _id: string; // Changed from id to _id
  name?: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
};

/** Filter State */
export interface CategoryFilterState {
  searchTerm: string;
  showInactive: boolean;
}

/** Form Data */
export interface CategoryFormData {
  name: string;
  description: string;
  priority: string;
}

/** Form Errors */
export interface CategoryFormErrors {
  name?: string;
  description?: string;
  priority?: string;
}

// export interface Category {
//     id: string
//     name: string
//     description?: string
//     priority?: number
//     isActive: boolean
//     createdAt: Date
//     updatedAt: Date
// }

// export type CreateCategoryInput = Omit<Category, "id" | "isActive" | "createdAt" | "updatedAt">;

// export type UpdateCategoryInput = Partial<CreateCategoryInput> & { id: string; };