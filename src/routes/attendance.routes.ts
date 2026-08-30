import { Router } from 'express';
import { getAttendance, getHistory, getClassStats } from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', getAttendance);
router.get('/history', getHistory);
router.get('/stats/:scheduleId', getClassStats);

export default router;
