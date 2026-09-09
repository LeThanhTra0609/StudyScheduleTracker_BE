import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  getVapidKey,
  subscribePush,
  unsubscribePush,
  testPushNotification,
} from '../controllers/notification.controller';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

router.get('/', getNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.delete('/clear-all', clearAllNotifications);
router.delete('/:id', deleteNotification);

// Web Push endpoints
router.get('/vapid-public-key', getVapidKey);
router.post('/push-subscribe', subscribePush);
router.post('/push-unsubscribe', unsubscribePush);
router.post('/test-push', testPushNotification);

export default router;
