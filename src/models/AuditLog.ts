import mongoose, { Schema } from 'mongoose'

export interface IAuditLog {
  action: string
  entity: string
  entityId: mongoose.Types.ObjectId
  before: Schema.Types.Mixed
  after: Schema.Types.Mixed
  performedBy: mongoose.Types.ObjectId
  reason: string
  year: string
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: ["STUDENT_CREATED", "ROLL_NUMBER_UPDATE", "YEAR_START", "YEAR_CHANGE", "YEAR_END", "STATUS_CHANGE"],
      required: true,
      index: true,
    },
    entity: {
      type: String,
      enum: ["Student", "ConsumerYearConfig"],
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    before: { type: Schema.Types.Mixed, required: true },   // snapshot before change
    after: { type: Schema.Types.Mixed, required: true },    // snapshot after change
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: { type: String, trim: true },
    year: { type: String, required: true },                 // which academic year
  },
  {
    timestamps: true,
    collection: "audit_logs",
  }
)

AuditLogSchema.index({ entityId: 1, action: 1 })
AuditLogSchema.index({ year: 1 })

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema)