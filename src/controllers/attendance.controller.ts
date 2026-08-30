import { Response } from 'express';
import { Attendance } from '../models/Attendance.model';
import { Schedule } from '../models/Schedule.model';
import { AuthRequest } from '../middleware/auth.middleware';

// GET /api/attendance
export const getAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { subjectId, startDate, endDate, status } = req.query;
    const filter: Record<string, unknown> = { userId: req.userId };

    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.date = {
        ...(startDate && { $gte: new Date(startDate as string) }),
        ...(endDate && { $lte: new Date(endDate as string) }),
      };
    }

    if (subjectId) {
      const scheduleIds = await Schedule.find({ userId: req.userId, subjectId: subjectId as string }).distinct('_id');
      filter.scheduleId = { $in: scheduleIds };
    }

    const records = await Attendance.find(filter)
      .populate({
        path: 'scheduleId',
        select: 'subjectId type startTime endTime',
        populate: { path: 'subjectId', select: 'name color' },
      })
      .sort({ date: -1 });
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/attendance/history
export const getHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const records = await Attendance.find({
      userId: req.userId,
      status: { $ne: 'UPCOMING' },
    })
      .populate({
        path: 'scheduleId',
        select: 'subjectId startTime endTime type',
        populate: { path: 'subjectId', select: 'name color' },
      })
      .sort({ date: -1 })
      .limit(100);

    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/attendance/stats/:scheduleId (for recurring group / single schedule)
export const getClassStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { scheduleId } = req.params;

    // Find all schedules in same recurring group or just this schedule
    const schedule = await Schedule.findOne({ _id: scheduleId, userId: req.userId });
    if (!schedule) {
      res.status(404).json({ success: false, message: 'Schedule not found' });
      return;
    }

    const scheduleIds = schedule.recurringGroupId
      ? await Schedule.find({ recurringGroupId: schedule.recurringGroupId }).distinct('_id')
      : [schedule._id];

    const records = await Attendance.find({ scheduleId: { $in: scheduleIds } });

    const stats = {
      total: records.length,
      completed: records.filter(r => r.status === 'COMPLETED').length,
      absent: records.filter(r => r.status === 'ABSENT').length,
      excused: records.filter(r => r.status === 'EXCUSED').length,
      cancelled: records.filter(r => r.status === 'CANCELLED').length,
      upcoming: records.filter(r => r.status === 'UPCOMING').length,
      totalMinutes: records.reduce((sum, r) => sum + (r.durationMinutes || 0), 0),
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};
