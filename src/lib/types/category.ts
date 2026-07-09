import type { BaseEntity } from '@/types'

// =============================================
// Category Entity
// =============================================
export interface Category extends BaseEntity {
  name: string
  description?: string
  priority: number
  isActive: boolean
}

// =============================================
// Category DTOs
// =============================================
export type CreateCategoryDto = Omit<Category, "id" | "isActive" | "createdAt" | "updatedAt"> & {
  priority?: number // Make optional for create
}

export type UpdateCategoryDto = Partial<CreateCategoryDto> & {
  id: string
  isActive?: boolean
}

// Alternative: More explicit input types
export interface CreateCategoryInput {
  name: string
  description?: string
  priority?: number
}

export interface UpdateCategoryInput {
  id: string
  name?: string
  description?: string
  priority?: number
  isActive?: boolean
}