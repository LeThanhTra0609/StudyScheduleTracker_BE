import { Response } from 'express';
import { Payment } from '../models/Payment.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { io } from '../server';
import { emitToUser } from '../socket/socket.handler';

const getTargetId = (req: AuthRequest): string => req.targetUserId || req.userId!;

// GET /api/payments
export const getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const payments = await Payment.find({ userId: targetId })
      .populate('scheduleId', 'type tuition')
      .populate({ path: 'scheduleId', populate: { path: 'subjectId', select: 'name color' } })
      .populate('subjectId', 'name color')
      .sort({ dueDate: 1, createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/payments/summary
export const getPaymentSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const payments = await Payment.find({ userId: targetId });
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);

    const overdueCount = payments.filter(
      p => p.status !== 'PAID' && p.dueDate && new Date(p.dueDate) < now
    ).length;

    const dueSoonCount = payments.filter(
      p => p.status !== 'PAID' && p.dueDate && new Date(p.dueDate) >= now && new Date(p.dueDate) <= in7Days
    ).length;

    const summary = {
      totalAmount: payments.reduce((s, p) => s + p.totalAmount, 0),
      paidAmount: payments.reduce((s, p) => s + p.paidAmount, 0),
      remainingAmount: payments.reduce((s, p) => s + p.remainingAmount, 0),
      unpaidCount: payments.filter(p => p.status === 'UNPAID').length,
      partialCount: payments.filter(p => p.status === 'PARTIAL').length,
      paidCount: payments.filter(p => p.status === 'PAID').length,
      overdueCount,
      dueSoonCount,
    };
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// POST /api/payments
export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const body = req.body;
    const isPaid = body.status === 'PAID';
    const totalAmount = Number(body.totalAmount) || 0;
    const paidAmount = isPaid ? totalAmount : (Number(body.paidAmount) || 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    const payment = await Payment.create({
      ...body,
      userId: targetId,
      totalAmount,
      paidAmount,
      remainingAmount,
      status: isPaid ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID'),
      paidAt: isPaid ? (body.paidAt || new Date()) : undefined,
    });

    const populated = await Payment.findById(payment._id)
      .populate('scheduleId', 'type tuition')
      .populate({ path: 'scheduleId', populate: { path: 'subjectId', select: 'name color' } })
      .populate('subjectId', 'name color');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// PUT /api/payments/:id
export const updatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const payment = await Payment.findOne({ _id: req.params.id, userId: targetId });
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    const body = req.body;
    if (body.totalAmount !== undefined) {
      payment.totalAmount = Number(body.totalAmount);
    }
    if (body.periodLabel !== undefined) payment.periodLabel = body.periodLabel;
    if (body.dueDate !== undefined) payment.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    if (body.subjectId !== undefined) payment.subjectId = body.subjectId;
    if (body.scheduleId !== undefined) payment.scheduleId = body.scheduleId;
    if (body.notes !== undefined) payment.notes = body.notes;

    if (body.status !== undefined) {
      payment.status = body.status;
      if (body.status === 'PAID') {
        payment.paidAmount = payment.totalAmount;
        payment.remainingAmount = 0;
        payment.paidAt = body.paidAt ? new Date(body.paidAt) : (payment.paidAt || new Date());
      } else if (body.status === 'UNPAID') {
        payment.paidAmount = 0;
        payment.remainingAmount = payment.totalAmount;
        payment.paidAt = undefined;
      }
    } else {
      // Recalculate remainingAmount
      payment.remainingAmount = Math.max(0, payment.totalAmount - payment.paidAmount);
    }

    await payment.save();

    const populated = await Payment.findById(payment._id)
      .populate('scheduleId', 'type tuition')
      .populate({ path: 'scheduleId', populate: { path: 'subjectId', select: 'name color' } })
      .populate('subjectId', 'name color');

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// PATCH /api/payments/:id/toggle
export const togglePaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const payment = await Payment.findOne({ _id: req.params.id, userId: targetId });
    if (!payment) {
      res.status(404).json({ success: false, message: 'Khoản học phí không tồn tại' });
      return;
    }

    const wasPaid = payment.status === 'PAID';
    payment.status = wasPaid ? 'UNPAID' : 'PAID';
    payment.paidAmount = wasPaid ? 0 : payment.totalAmount;
    payment.remainingAmount = wasPaid ? payment.totalAmount : 0;
    payment.paidAt = wasPaid ? undefined : new Date();

    await payment.save();

    const populated = await Payment.findById(payment._id)
      .populate('scheduleId', 'type tuition')
      .populate({ path: 'scheduleId', populate: { path: 'subjectId', select: 'name color' } })
      .populate('subjectId', 'name color');

    emitToUser(io, targetId, 'payment:updated', {
      paymentId: payment._id,
      remaining: payment.remainingAmount,
      status: payment.status,
    });

    emitToUser(io, targetId, 'notification:new', {
      type: 'payment',
      message: wasPaid
        ? `Đã đánh dấu Chưa nộp cho khoản "${payment.periodLabel}"`
        : `Đã đánh dấu Đã nộp thành công cho khoản "${payment.periodLabel}"`,
    });

    if (req.userId && req.userId !== targetId) {
      emitToUser(io, req.userId, 'payment:updated', {
        paymentId: payment._id,
        remaining: payment.remainingAmount,
        status: payment.status,
      });
    }

    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// DELETE /api/payments/:id
export const deletePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const payment = await Payment.findOneAndDelete({ _id: req.params.id, userId: targetId });
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }
    res.json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// POST /api/payments/:id/transaction
export const addTransaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const payment = await Payment.findOne({ _id: req.params.id, userId: targetId });
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
      payment.paidAt = new Date(paidAt);
    } else if (payment.paidAmount > 0) {
      payment.status = 'PARTIAL';
    }

    await payment.save();

    emitToUser(io, targetId, 'payment:updated', {
      paymentId: payment._id,
      remaining: payment.remainingAmount,
      status: payment.status,
    });

    emitToUser(io, targetId, 'notification:new', {
      type: 'payment',
      message: `Đã ghi nhận thanh toán ${amount.toLocaleString('vi-VN')} VND`,
    });

    if (req.userId && req.userId !== targetId) {
      emitToUser(io, req.userId, 'payment:updated', {
        paymentId: payment._id,
        remaining: payment.remainingAmount,
        status: payment.status,
      });
    }

    res.json({ success: true, data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};
