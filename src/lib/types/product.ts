import type { BaseEntity, CategoryInfo } from "@/types"

// =============================================
// Product Entity
// =============================================
export interface Product extends BaseEntity {
  name: string
  description?: string
  categoryId: string
  category?: CategoryInfo | null
  priority: number
  isActive: boolean
  hasVariants: boolean
  variantCount?: number
}

// =============================================
// Product Input Types
// =============================================
export interface CreateProductInput {
  name: string
  categoryId: string
  description?: string
  hasVariants?: boolean
  priority?: number
}

export interface UpdateProductInput {
  id: string
  name?: string
  categoryId?: string
  description?: string
  hasVariants?: boolean
  isActive?: boolean
  priority?: number
}




// import type { BaseEntity, CategoryInfo } from "@/types"

// // =============================================
// // Product Entity
// // =============================================
// export interface Product extends BaseEntity {
//   name: string
//   description?: string
//   categoryId: string
//   category?: CategoryInfo | null
//   priority: number
//   isActive: boolean
//   hasVariants: boolean
//   variantCount?: number
// }

// // =============================================
// // Product DTOs
// // =============================================
// export type CreateProductDto = Omit<
//   Product,
//   "id" | "isActive" | "createdAt" | "updatedAt" | "category" | "variantCount" | "priority"
// > & {
//   priority?: number
//   hasVariants?: boolean
// }

// export type UpdateProductDto = Partial<
//   Omit<CreateProductDto, "categoryId">
// > & {
//   id: string
//   categoryId?: string
//   isActive?: boolean
// }

// // Alternative: More explicit input types
// export interface CreateProductInput {
//   name: string
//   categoryId: string
//   description?: string
//   hasVariants?: boolean
//   priority?: number
// }

// export interface UpdateProductInput {
//   id: string
//   name?: string
//   categoryId?: string
//   description?: string
//   hasVariants?: boolean
//   isActive?: boolean
//   priority?: number
// }