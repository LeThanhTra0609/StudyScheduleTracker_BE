import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType =
  | 'reminder'
  | 'attendance'
  | 'schedule_change'
  | 'payment'
  | 'family'
  | 'info';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['reminder', 'attendance', 'schedule_change', 'payment', 'family', 'info'],
      default: 'info',
    },
    link: { type: String, trim: true },
    read: { type: Boolean, default: false, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Compound indexes for fast filtered & sorted notification queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
