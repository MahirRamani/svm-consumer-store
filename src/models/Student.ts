import mongoose, { Schema, type Document } from "mongoose"

export interface IStudent extends Document {
  rollNumber: number
  id: number
  name: string
  mobileNo?: string
  standard: number
  year: string
  balance: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const StudentSchema = new Schema<IStudent>(
  {
    id: {
      type: Number,
      required: true,
      trim: true,
    },
    rollNumber: {
      type: Number,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNo: {
      type: String,
      trim: true,
    },
    standard: {
      type: Number,
      required: true,
      trim: true,
    },
    year: {
      type: String,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Create indexes
// ✅ rollNo unique within a year (can repeat across years)
StudentSchema.index({ rollNumber: 1, year: 1 }, { unique: true, partialFilterExpression: { isActive: true } })

// ✅ id unique within a year (can repeat across years when student leaves)
StudentSchema.index({ id: 1, year: 1 }, { unique: true, partialFilterExpression: { isActive: true } })

StudentSchema.index({ isActive: 1 })
StudentSchema.index({ standard: 1 })
StudentSchema.index({ year: 1 })

export const Student = mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema)