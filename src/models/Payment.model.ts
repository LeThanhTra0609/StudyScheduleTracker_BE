import mongoose, { Document, Schema } from 'mongoose';

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface ITransaction {
  amount: number;
  paidAt: Date;
  method: string;
  notes?: string;
}

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  scheduleId: mongoose.Types.ObjectId;
  periodLabel: string;     // "Tháng 9/2026"
  periodStart?: Date;
  periodEnd?: Date;
  totalSessions: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: PaymentStatus;
  transactions: ITransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    amount: { type: Number, required: true },
    paidAt: { type: Date, required: true },
    method: { type: String, default: 'Tiền mặt' },
    notes: { type: String },
  },
  { _id: true }
);

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: 'Schedule', required: true, index: true },
    periodLabel: { type: String, required: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    totalSessions: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['UNPAID', 'PARTIAL', 'PAID'],
      default: 'UNPAID',
    },
    transactions: { type: [TransactionSchema], default: [] },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
