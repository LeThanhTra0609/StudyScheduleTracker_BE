import { Response } from 'express';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Schedule } from '../models/Schedule.model';
import { Attendance } from '../models/Attendance.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { io } from '../server';
import { emitToUser } from '../socket/socket.handler';
import { notifyStudentAndParents } from '../services/notification.service';

// Helper: calculate duration in minutes from "HH:mm" strings
const calcDuration = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
};

const getTargetId = (req: AuthRequest): string => req.targetUserId || req.userId!;

// GET /api/schedules
export const getSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, type, status, subjectId, startDate, endDate } = req.query;
    const targetId = getTargetId(req);
    const filter: Record<string, unknown> = { userId: targetId };

    if (date) {
      const d = dayjs(date as string);
      filter.date = {
        $gte: d.startOf('day').toDate(),
        $lte: d.endOf('day').toDate(),
      };
    }
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (subjectId) filter.subjectId = subjectId;
    if (startDate || endDate) {
      filter.date = {
        ...(startDate && { $gte: dayjs(startDate as string).startOf('day').toDate() }),
        ...(endDate && { $lte: dayjs(endDate as string).endOf('day').toDate() }),
      };
    }

    const schedules = await Schedule.find(filter)
      .populate('subjectId', 'name color code')
      .populate('locationId', 'name address meetingLink')
      .sort({ date: 1, startTime: 1 });

    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/schedules/today
export const getTodaySchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = dayjs().startOf('day').toDate();
    const tomorrow = dayjs().endOf('day').toDate();
    const targetId = getTargetId(req);

    const schedules = await Schedule.find({
      userId: targetId,
      date: { $gte: today, $lte: tomorrow },
    })
      .populate('subjectId', 'name color code')
      .populate('locationId', 'name address meetingLink')
      .sort({ startTime: 1 });

    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/schedules/upcoming
export const getUpcomingSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const targetId = getTargetId(req);
    const schedules = await Schedule.find({
      userId: targetId,
      date: { $gte: now },
      status: 'UPCOMING',
    })
      .populate('subjectId', 'name color')
      .populate('locationId', 'name')
      .sort({ date: 1, startTime: 1 })
      .limit(5);

    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/schedules/conflict-check
export const checkConflict = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, startTime, endTime, excludeId } = req.query;
    const targetId = getTargetId(req);

    const d = dayjs(date as string);
    const filter: Record<string, unknown> = {
      userId: targetId,
      date: { $gte: d.startOf('day').toDate(), $lte: d.endOf('day').toDate() },
      status: { $nin: ['CANCELLED'] },
      $or: [
        // New schedule starts during an existing one
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      ],
    };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    const conflicts = await Schedule.find(filter).populate('subjectId', 'name');
    res.json({ success: true, hasConflict: conflicts.length > 0, conflicts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// GET /api/schedules/:id
export const getScheduleById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const schedule = await Schedule.findOne({ _id: req.params.id, userId: targetId })
      .populate('subjectId')
      .populate('locationId');

    if (!schedule) {
      res.status(404).json({ success: false, message: 'Schedule not found' });
      return;
    }
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// POST /api/schedules
export const createSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const { isRecurring, recurringDays, recurringEndDate, recurringStartDate, ...scheduleData } = req.body;

    if (isRecurring && recurringDays?.length) {
      // Validate required recurring fields
      if (!recurringEndDate) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn ngày kết thúc lặp lại' });
        return;
      }

      const start = dayjs(recurringStartDate || scheduleData.date);
      const end = dayjs(recurringEndDate);

      if (!start.isValid() || !end.isValid()) {
        res.status(400).json({ success: false, message: 'Ngày bắt đầu hoặc ngày kết thúc không hợp lệ' });
        return;
      }

      if (end.isBefore(start, 'day')) {
        res.status(400).json({ success: false, message: 'Ngày kết thúc lặp phải sau ngày bắt đầu' });
        return;
      }

      // Safety: limit to max 365 days to prevent excessive inserts
      const diffDays = end.diff(start, 'day');
      if (diffDays > 365) {
        res.status(400).json({ success: false, message: 'Khoảng thời gian lặp không được quá 365 ngày' });
        return;
      }

      // Bulk create instances for each occurrence
      const groupId = new mongoose.Types.ObjectId();
      const instances = [];
      let current = start;

      while (current.isBefore(end) || current.isSame(end, 'day')) {
        if (recurringDays.includes(current.day())) {
          instances.push({
            ...scheduleData,
            userId: targetId,
            date: current.toDate(),
            isRecurring: true,
            recurringGroupId: groupId,
            recurringDays,
            status: 'UPCOMING',
          });
        }
        current = current.add(1, 'day');
      }

      if (instances.length === 0) {
        res.status(400).json({ success: false, message: 'Không có ngày nào khớp với lịch lặp. Hãy kiểm tra lại ngày trong tuần đã chọn.' });
        return;
      }

      const created = await Schedule.insertMany(instances);
      res.status(201).json({ success: true, data: created, count: created.length });
    } else {
      const schedule = await Schedule.create({ ...scheduleData, userId: targetId, status: 'UPCOMING' });
      res.status(201).json({ success: true, data: schedule });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// PUT /api/schedules/:id
export const updateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const schedule = await Schedule.findOneAndUpdate(
      { _id: req.params.id, userId: targetId },
      req.body,
      { new: true, runValidators: true }
    ).populate('subjectId', 'name color').populate('locationId', 'name');

    if (!schedule) {
      res.status(404).json({ success: false, message: 'Schedule not found' });
      return;
    }

    emitToUser(io, targetId, 'schedule:updated', { scheduleId: schedule._id, action: 'updated', schedule });
    if (req.userId && req.userId !== targetId) {
      emitToUser(io, req.userId, 'schedule:updated', { scheduleId: schedule._id, action: 'updated', schedule });
    }
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// DELETE /api/schedules/:id
export const deleteSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const schedule = await Schedule.findOneAndDelete({ _id: req.params.id, userId: targetId });
    if (!schedule) {
      res.status(404).json({ success: false, message: 'Schedule not found' });
      return;
    }
    emitToUser(io, targetId, 'schedule:updated', { scheduleId: schedule._id, action: 'deleted' });
    if (req.userId && req.userId !== targetId) {
      emitToUser(io, req.userId, 'schedule:updated', { scheduleId: schedule._id, action: 'deleted' });
    }
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// DELETE /api/schedules/recurring/:groupId
export const deleteRecurringSeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const result = await Schedule.deleteMany({
      recurringGroupId: req.params.groupId,
      userId: targetId,
    });
    res.json({ success: true, message: `Deleted ${result.deletedCount} schedules` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// DELETE /api/schedules/past  — xóa tất cả lịch trước hôm nay
export const deletePastSchedules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const todayStart = dayjs().startOf('day').toDate();
    const result = await Schedule.deleteMany({
      userId: targetId,
      date: { $lt: todayStart },
    });
    res.json({ success: true, deletedCount: result.deletedCount, message: `Đã xóa ${result.deletedCount} lịch học quá khứ` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

// PATCH /api/schedules/:id/attendance
export const markAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetId = getTargetId(req);
    const { status, notes } = req.body;
    const schedule = await Schedule.findOne({ _id: req.params.id, userId: targetId });

    if (!schedule) {
      res.status(404).json({ success: false, message: 'Schedule not found' });
      return;
    }

    // Update schedule status
    schedule.status = status;
    await schedule.save();

    // Upsert attendance record
    const durationMinutes = calcDuration(schedule.startTime, schedule.endTime);
    const attendance = await Attendance.findOneAndUpdate(
      { scheduleId: schedule._id, date: schedule.date },
      {
        scheduleId: schedule._id,
        userId: targetId,
        date: schedule.date,
        status,
        durationMinutes: status === 'COMPLETED' ? durationMinutes : 0,
        notes,
        markedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Emit real-time events
    emitToUser(io, targetId, 'attendance:marked', {
      scheduleId: schedule._id,
      status,
      attendance,
    });

    const subjectName = (schedule.subjectId as any)?.name || 'buổi học';
    const statusTextMap: Record<string, string> = {
      COMPLETED: 'Có mặt',
      ABSENT: 'Vắng mặt',
      EXCUSED: 'Có phép',
      CANCELLED: 'Đã hủy',
    };
    const readableStatus = statusTextMap[status] || status;

    await notifyStudentAndParents(
      targetId,
      {
        title: `Điểm danh môn ${subjectName}`,
        message: `Buổi học ngày ${dayjs(schedule.date).format('DD/MM/YYYY')} (${schedule.startTime}) đã được điểm danh: ${readableStatus}.`,
        type: 'attendance',
        link: '/attendance',
        metadata: { scheduleId: schedule._id.toString(), status },
      },
      (parentName, studentName) => ({
        title: `Điểm danh: Học sinh ${studentName}`,
        message: `Buổi học môn ${subjectName} ngày ${dayjs(schedule.date).format('DD/MM/YYYY')} của ${studentName} đã được điểm danh: ${readableStatus}.`,
      })
    );

    if (req.userId && req.userId !== targetId) {
      emitToUser(io, req.userId, 'attendance:marked', {
        scheduleId: schedule._id,
        status,
        attendance,
      });
    }

    res.json({ success: true, data: { schedule, attendance } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};
