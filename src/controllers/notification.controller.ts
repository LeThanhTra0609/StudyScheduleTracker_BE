import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { Notification } from '../models/Notification.model';
import { PushSubscription } from '../models/PushSubscription.model';
import { getVapidPublicKey, sendPushToUser } from '../services/webpush.service';
import { createAndSendNotification } from '../services/notification.service';

/**
 * GET /api/notifications
 * Get paginated list of user notifications and unread count
 */
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, read: false }),
    ]);

    res.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[NotificationController] getNotifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { read: true },
      { new: true }
    );

    if (!notif) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    const unreadCount = await Notification.countDocuments({ userId, read: false });
    res.json({ success: true, data: notif, unreadCount });
  } catch (error) {
    console.error('[NotificationController] markNotificationRead error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all user notifications as read
 */
export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    await Notification.updateMany({ userId, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('[NotificationController] markAllNotificationsRead error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const result = await Notification.findOneAndDelete({ _id: req.params.id, userId });
    if (!result) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    const unreadCount = await Notification.countDocuments({ userId, read: false });
    res.json({ success: true, message: 'Notification deleted', unreadCount });
  } catch (error) {
    console.error('[NotificationController] deleteNotification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * DELETE /api/notifications
 * Clear all notifications of user
 */
export const clearAllNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    await Notification.deleteMany({ userId });
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('[NotificationController] clearAllNotifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/notifications/vapid-public-key
 * Return VAPID Public Key for client subscription
 */
export const getVapidKey = (_req: AuthRequest, res: Response): void => {
  res.json({ success: true, publicKey: getVapidPublicKey() });
};

/**
 * POST /api/notifications/push-subscribe
 * Save or update browser Push Subscription
 */
export const subscribePush = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { endpoint, keys, userAgent } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ success: false, message: 'Invalid push subscription payload' });
      return;
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId, endpoint, keys, userAgent: userAgent || req.headers['user-agent'] },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Web Push subscription registered successfully' });
  } catch (error) {
    console.error('[NotificationController] subscribePush error:', error);
    res.status(500).json({ success: false, message: 'Failed to save push subscription' });
  }
};

/**
 * POST /api/notifications/push-unsubscribe
 * Remove browser Push Subscription
 */
export const unsubscribePush = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { endpoint } = req.body;

    if (!endpoint) {
      res.status(400).json({ success: false, message: 'Endpoint is required' });
      return;
    }

    await PushSubscription.deleteOne({ userId, endpoint });
    res.json({ success: true, message: 'Web Push subscription removed' });
  } catch (error) {
    console.error('[NotificationController] unsubscribePush error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove push subscription' });
  }
};

/**
 * POST /api/notifications/test-push
 * Send immediate test push notification to user's devices
 */
export const testPushNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const userSubscriptionsCount = await PushSubscription.countDocuments({ userId });

    const notification = await createAndSendNotification({
      userId,
      title: '🔔 Thông báo thử nghiệm thành công!',
      message: 'Hệ thống Web Push và Realtime Notification của StudyScheduleTracker đang hoạt động hoàn hảo trên thiết bị của bạn.',
      type: 'info',
      link: '/notifications',
      sendPush: true,
    });

    res.json({
      success: true,
      message: `Đã phát thông báo thử nghiệm tới ${userSubscriptionsCount} thiết bị đã kết nối.`,
      notification,
      activeDevices: userSubscriptionsCount,
    });
  } catch (error) {
    console.error('[NotificationController] testPushNotification error:', error);
    res.status(500).json({ success: false, message: 'Gửi thông báo thử nghiệm thất bại' });
  }
};
