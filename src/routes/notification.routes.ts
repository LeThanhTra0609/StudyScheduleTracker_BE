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

// Public endpoint (no auth needed for Service Worker or unauthenticated handshake)
router.get('/vapid-public-key', getVapidKey);

// All other notification routes require authentication
router.use(authenticate);

router.get('/', getNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.delete('/clear-all', clearAllNotifications);
router.delete('/:id', deleteNotification);

// Web Push endpoints (authenticated)
router.post('/push-subscribe', subscribePush);
router.post('/push-unsubscribe', unsubscribePush);
router.post('/test-push', testPushNotification);

export default router;
