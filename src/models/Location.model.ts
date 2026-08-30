import mongoose, { Document, Schema } from 'mongoose';

export interface ILocation extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  address?: string;
  description?: string;
  mapLink?: string;
  meetingLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String },
    description: { type: String },
    mapLink: { type: String },
    meetingLink: { type: String },
  },
  { timestamps: true }
);

export const Location = mongoose.model<ILocation>('Location', LocationSchema);
