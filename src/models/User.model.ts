import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'PARENT' | 'STUDENT';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  avatar?: string;
  role: UserRole;
  linkCode?: string;
  children: mongoose.Types.ObjectId[];
  parents: mongoose.Types.ObjectId[];
  notificationPreferences: {
    reminderTimes: number[]; // minutes before class
    emailNotifications: boolean;
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
    role: { type: String, enum: ['PARENT', 'STUDENT'], default: 'STUDENT' },
    linkCode: { type: String, unique: true, sparse: true, trim: true },
    children: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    parents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    notificationPreferences: {
      reminderTimes: { type: [Number], default: [30] },
      emailNotifications: { type: Boolean, default: false },
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
