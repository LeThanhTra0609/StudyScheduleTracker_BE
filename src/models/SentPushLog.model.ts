import mongoose, { Document, Schema } from 'mongoose';

export interface ISentPushLog extends Document {
  userId: mongoose.Types.ObjectId;
  scheduleId: mongoose.Types.ObjectId;
  reminderMinutes: number;
  dateStr: string; // YYYY-MM-DD
  sentAt: Date;
}

const SentPushLogSchema = new Schema<ISentPushLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  scheduleId: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true },
  reminderMinutes: { type: Number, required: true },
  dateStr: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});

// Compound unique: one reminder log per schedule per user per day per timing
SentPushLogSchema.index(
  { userId: 1, scheduleId: 1, reminderMinutes: 1, dateStr: 1 },
  { unique: true }
);

// Auto-delete after 48 hours (TTL index — prevents unbounded growth)
SentPushLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 172800 });

export const SentPushLog = mongoose.model<ISentPushLog>('SentPushLog', SentPushLogSchema);
