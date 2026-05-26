import mongoose, { Schema, type Document } from "mongoose"

export interface IStudent extends Document {
  rollNumber: string
  id: string
  name: string
  mobileNo?: string
  standard: string
  year: string
  balance: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const StudentSchema = new Schema<IStudent>(
  {
    rollNumber: {
      type: String,
      required: true,
      trim: true,
    },
    id: {
      type: String,
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
      type: String,
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
// StudentSchema.index({ rollNumber: 1 })
// StudentSchema.index({ name: 1 })
StudentSchema.index({ isActive: 1 })
StudentSchema.index({ standard: 1 })
StudentSchema.index({ year: 1 })

export const Student = mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema)