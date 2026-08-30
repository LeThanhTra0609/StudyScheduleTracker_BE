import mongoose, { Document, Schema } from 'mongoose';

export type AttendanceStatus = 'UPCOMING' | 'COMPLETED' | 'ABSENT' | 'EXCUSED' | 'CANCELLED';

export interface IAttendance extends Document {
  scheduleId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  durationMinutes: number;
  notes?: string;
  markedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    scheduleId: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ['UPCOMING', 'COMPLETED', 'ABSENT', 'EXCUSED', 'CANCELLED'],
      required: true,
    },
    durationMinutes: { type: Number, default: 0 },
    notes: { type: String },
    markedAt: { type: Date },
  },
  { timestamps: true }
);

// One attendance record per schedule per date
AttendanceSchema.index({ scheduleId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
