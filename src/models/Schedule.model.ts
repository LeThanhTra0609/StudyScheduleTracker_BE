import mongoose, { Document, Schema } from 'mongoose';

export type ScheduleType = 'ACADEMIC' | 'EXTRA_CLASS';
export type LearningMethod = 'OFFLINE' | 'ONLINE';
export type ScheduleStatus = 'UPCOMING' | 'COMPLETED' | 'ABSENT' | 'EXCUSED' | 'CANCELLED';
export type PaymentMethod = 'PER_SESSION' | 'MONTHLY' | 'COURSE';

export interface ITuitionSetting {
  enabled: boolean;
  paymentMethod: PaymentMethod;
  pricePerSession?: number;
  monthlyFee?: number;
  courseFee?: number;
  chargeOnAbsent: boolean;
}

export interface ISchedule extends Document {
  userId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  locationId?: mongoose.Types.ObjectId;

  type: ScheduleType;
  date: Date;
  startTime: string; // "07:30"
  endTime: string;   // "09:30"
  learningMethod: LearningMethod;
  teacher?: string;
  notes?: string;
  color?: string;
  status: ScheduleStatus;

  // Recurring
  isRecurring: boolean;
  recurringGroupId?: mongoose.Types.ObjectId;
  recurringDays?: number[]; // 0=Sun, 1=Mon ... 6=Sat

  // Tuition (Extra Class only)
  tuition: ITuitionSetting;

  createdAt: Date;
  updatedAt: Date;
}

const TuitionSettingSchema = new Schema<ITuitionSetting>(
  {
    enabled: { type: Boolean, default: false },
    paymentMethod: {
      type: String,
      enum: ['PER_SESSION', 'MONTHLY', 'COURSE'],
      default: 'PER_SESSION',
    },
    pricePerSession: { type: Number, default: 0 },
    monthlyFee: { type: Number, default: 0 },
    courseFee: { type: Number, default: 0 },
    chargeOnAbsent: { type: Boolean, default: false },
  },
  { _id: false }
);

const ScheduleSchema = new Schema<ISchedule>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },

    type: { type: String, enum: ['ACADEMIC', 'EXTRA_CLASS'], required: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    learningMethod: { type: String, enum: ['OFFLINE', 'ONLINE'], default: 'OFFLINE' },
    teacher: { type: String },
    notes: { type: String },
    color: { type: String },
    status: {
      type: String,
      enum: ['UPCOMING', 'COMPLETED', 'ABSENT', 'EXCUSED', 'CANCELLED'],
      default: 'UPCOMING',
    },

    isRecurring: { type: Boolean, default: false },
    recurringGroupId: { type: Schema.Types.ObjectId },
    recurringDays: { type: [Number] },

    tuition: { type: TuitionSettingSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Compound index for conflict detection
ScheduleSchema.index({ userId: 1, date: 1, startTime: 1, endTime: 1 });

export const Schedule = mongoose.model<ISchedule>('Schedule', ScheduleSchema);
