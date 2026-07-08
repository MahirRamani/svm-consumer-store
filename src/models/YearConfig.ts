import mongoose, { Schema, type Document } from "mongoose"

export interface IYearConfig extends Document {
  currentYear: string
  yearStartDate: Date
  yearEndDate: Date
  isActive: boolean
  isYearLocked: boolean
  createdBy: mongoose.Types.ObjectId
}

const YearConfigSchema = new Schema<IYearConfig>(
  {
    currentYear: { type: String, required: true },      // "2025-26"
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

YearConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
export const YearConfig = mongoose.models.YearConfig || mongoose.model<IYearConfig>("YearConfig", YearConfigSchema)