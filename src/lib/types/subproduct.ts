import type { BaseEntity } from "@/types"

// =============================================
// SubProduct Entity
// =============================================
export interface SubProduct extends BaseEntity {
  productId: string
  parentProduct?: {
    id: string
    name: string
    category: {
      id: string
      name: string
    }
  }
  name: string
  description?: string
  size?: string
  priority: number
  imageURL?: string
  lowStockThreshold: number
  weight?: string
  volume?: string
  barcode?: string
  isActive: boolean
}

// =============================================
// SubProduct Input Types
// =============================================
export interface CreateSubProductInput {
  productId: string
  name: string
  size?: string
  description?: string
  imageURL?: string
  lowStockThreshold?: number
  weight?: string
  volume?: string
  barcode?: string
  priority?: number
}

export interface UpdateSubProductInput {
  id: string
  productId?: string
  name?: string
  size?: string
  description?: string
  imageURL?: string
  lowStockThreshold?: number
  weight?: string
  volume?: string
  barcode?: string
  isActive?: boolean
  priority?: number
}

// =============================================
// Image Upload Types
// =============================================
export interface ImageUploadResponse {
  secure_url: string
  public_id?: string
  format?: string
  width?: number
  height?: number
}

export interface ImageUploadInput {
  file: File
  customName?: string
}