import { Response } from 'express';
import { Payment } from '../models/Payment.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { io } from '../server';
import { emitToUser } from '../socket/socket.handler';

// GET /api/payments
export const getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await Payment.find({ userId: req.userId })
      .populate('scheduleId', 'type tuition')
      .populate({ path: 'scheduleId', populate: { path: 'subjectId', select: 'name color' } })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/payments/summary
export const getPaymentSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await Payment.find({ userId: req.userId });
    const summary = {
      totalAmount: payments.reduce((s, p) => s + p.totalAmount, 0),
      paidAmount: payments.reduce((s, p) => s + p.paidAmount, 0),
      remainingAmount: payments.reduce((s, p) => s + p.remainingAmount, 0),
      unpaidCount: payments.filter(p => p.status === 'UNPAID').length,
      partialCount: payments.filter(p => p.status === 'PARTIAL').length,
      paidCount: payments.filter(p => p.status === 'PAID').length,
    };
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// POST /api/payments
export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await Payment.create({ ...req.body, userId: req.userId });
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// PUT /api/payments/:id
export const updatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await Payment.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }
    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// POST /api/payments/:id/transaction
export const addTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, userId: req.userId });
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    const { amount, paidAt, method, notes } = req.body;
    payment.transactions.push({ amount, paidAt: new Date(paidAt), method, notes });
    payment.paidAmount += amount;
    payment.remainingAmount = payment.totalAmount - payment.paidAmount;

    // Auto-update status
    if (payment.paidAmount >= payment.totalAmount) {
      payment.status = 'PAID';
    } else if (payment.paidAmount > 0) {
      payment.status = 'PARTIAL';
    }

    await payment.save();

    emitToUser(io, req.userId!, 'payment:updated', {
      paymentId: payment._id,
      remaining: payment.remainingAmount,
      status: payment.status,
    });

    emitToUser(io, req.userId!, 'notification:new', {
      type: 'payment',
      message: `Đã ghi nhận thanh toán ${amount.toLocaleString('vi-VN')} VND`,
    });

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};
