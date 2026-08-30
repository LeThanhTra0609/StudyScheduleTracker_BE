import { Response } from 'express';
import dayjs from 'dayjs';
import { Attendance } from '../models/Attendance.model';
import { Schedule } from '../models/Schedule.model';
import { Payment } from '../models/Payment.model';
import { AuthRequest } from '../middleware/auth.middleware';

// GET /api/stats/study
export const getStudyStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const records = await Attendance.find({ userId: req.userId });
    const stats = {
      total: records.length,
      completed: records.filter(r => r.status === 'COMPLETED').length,
      absent: records.filter(r => r.status === 'ABSENT').length,
      upcoming: records.filter(r => r.status === 'UPCOMING').length,
      cancelled: records.filter(r => r.status === 'CANCELLED').length,
      totalMinutes: records
        .filter(r => r.status === 'COMPLETED')
        .reduce((s, r) => s + (r.durationMinutes || 0), 0),
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/stats/weekly
export const getWeeklyStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const startOfWeek = dayjs().startOf('week').toDate();
    const endOfWeek = dayjs().endOf('week').toDate();

    const records = await Attendance.find({
      userId: req.userId,
      date: { $gte: startOfWeek, $lte: endOfWeek },
    });

    const stats = {
      completed: records.filter(r => r.status === 'COMPLETED').length,
      absent: records.filter(r => r.status === 'ABSENT').length,
      upcoming: records.filter(r => r.status === 'UPCOMING').length,
      totalMinutes: records
        .filter(r => r.status === 'COMPLETED')
        .reduce((s, r) => s + (r.durationMinutes || 0), 0),
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/stats/monthly?month=9&year=2026
export const getMonthlyStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const month = parseInt(req.query.month as string) || dayjs().month() + 1;
    const year = parseInt(req.query.year as string) || dayjs().year();

    const start = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const end = dayjs(`${year}-${month}-01`).endOf('month').toDate();

    const records = await Attendance.find({
      userId: req.userId,
      date: { $gte: start, $lte: end },
    }).populate({
      path: 'scheduleId',
      select: 'subjectId',
      populate: { path: 'subjectId', select: 'name color' },
    });

    // Group by subject
    const bySubject: Record<string, { name: string; color: string; completed: number; totalMinutes: number }> = {};
    for (const r of records) {
      const sched = r.scheduleId as any;
      const subject = sched?.subjectId;
      if (!subject) continue;
      const key = subject._id.toString();
      if (!bySubject[key]) {
        bySubject[key] = { name: subject.name, color: subject.color, completed: 0, totalMinutes: 0 };
      }
      if (r.status === 'COMPLETED') {
        bySubject[key].completed++;
        bySubject[key].totalMinutes += r.durationMinutes || 0;
      }
    }

    res.json({ success: true, data: { month, year, bySubject: Object.values(bySubject) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/stats/tuition
export const getTuitionStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await Payment.find({ userId: req.userId }).populate({
      path: 'scheduleId',
      populate: { path: 'subjectId', select: 'name color' },
    });

    const total = payments.reduce((s, p) => s + p.totalAmount, 0);
    const paid = payments.reduce((s, p) => s + p.paidAmount, 0);
    const remaining = payments.reduce((s, p) => s + p.remainingAmount, 0);

    res.json({ success: true, data: { total, paid, remaining, payments } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};
