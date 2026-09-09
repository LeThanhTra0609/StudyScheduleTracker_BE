import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'PARENT' | 'STUDENT';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  avatar?: string;
  phone?: string;
  bio?: string;
  role: UserRole;
  linkCode?: string;
  children: mongoose.Types.ObjectId[];
  parents: mongoose.Types.ObjectId[];
  notificationPreferences: {
    reminderTimes: number[]; // minutes before class
    emailNotifications: boolean;
    classReminder?: boolean;
    dailyReminder?: boolean;
    dailyReminderTime?: string;
    advanceDayReminder?: boolean;
    advanceDayReminderTime?: string;
    attendanceAlerts?: boolean;
    scheduleChangeAlerts?: boolean;
    paymentDueAlerts?: boolean;
    soundEnabled?: boolean;
  };
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatar: { type: String },
    phone: { type: String, trim: true },
    bio: { type: String, trim: true },
    role: { type: String, enum: ['PARENT', 'STUDENT'], default: 'STUDENT' },
    linkCode: { type: String, unique: true, sparse: true, trim: true },
    children: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    parents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    notificationPreferences: {
      reminderTimes: { type: [Number], default: [30] },
      emailNotifications: { type: Boolean, default: false },
      classReminder: { type: Boolean, default: true },
      dailyReminder: { type: Boolean, default: true },
      dailyReminderTime: { type: String, default: '07:00' },
      advanceDayReminder: { type: Boolean, default: true },
      advanceDayReminderTime: { type: String, default: '20:00' },
      attendanceAlerts: { type: Boolean, default: true },
      scheduleChangeAlerts: { type: Boolean, default: true },
      paymentDueAlerts: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
