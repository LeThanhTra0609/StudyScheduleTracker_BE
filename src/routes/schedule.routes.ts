import { Router } from 'express';
import {
  getSchedules,
  getTodaySchedules,
  getUpcomingSchedules,
  checkConflict,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  deleteRecurringSeries,
  markAttendance,
} from '../controllers/schedule.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', getSchedules);
router.get('/today', getTodaySchedules);
router.get('/upcoming', getUpcomingSchedules);
router.get('/conflict-check', checkConflict);
router.get('/:id', getScheduleById);
router.post('/', createSchedule);
router.put('/:id', updateSchedule);
router.delete('/recurring/:groupId', deleteRecurringSeries);
router.delete('/:id', deleteSchedule);
router.patch('/:id/attendance', markAttendance);

export default router;
