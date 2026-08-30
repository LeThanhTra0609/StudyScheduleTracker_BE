import { Router } from 'express';
import { getStudyStats, getWeeklyStats, getMonthlyStats, getTuitionStats } from '../controllers/stats.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/study', getStudyStats);
router.get('/weekly', getWeeklyStats);
router.get('/monthly', getMonthlyStats);
router.get('/tuition', getTuitionStats);

export default router;
