import { Router } from 'express';
import { linkChild, unlinkChild, getChildren } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/link-child', linkChild);
router.delete('/unlink-child/:studentId', unlinkChild);
router.get('/children', getChildren);

export default router;
