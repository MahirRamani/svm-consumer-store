import mongoose, { Schema, type Document } from 'mongoose'

export interface IConsumerYearConfig extends Document {
  consumerYear: string
  yearStartDate: Date
  yearEndDate: Date
  isActive: boolean
  isYearLocked: boolean
  createdBy: mongoose.Types.ObjectId
}

const ConsumerYearConfigSchema = new Schema<IConsumerYearConfig>(
  {
    consumerYear: { type: String, required: true },      // "2025-26"
    yearStartDate: { type: Date, required: true },
    yearEndDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    isYearLocked: { type: Boolean, default: false },    // lock txns after year end
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
    collection: "year_configs",
  }
)

ConsumerYearConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
export const ConsumerYearConfig = mongoose.models.ConsumerYearConfig || mongoose.model<IConsumerYearConfig>("ConsumerYearConfig", ConsumerYearConfigSchema)