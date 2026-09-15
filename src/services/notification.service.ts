import mongoose from 'mongoose';
import { io } from '../server';
import { emitToUser } from '../socket/socket.handler';
import { Notification, NotificationType, INotification } from '../models/Notification.model';
import { User } from '../models/User.model';
import { sendPushToUser, PushPayload } from './webpush.service';

export interface CreateNotificationParams {
  userId: string | mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  metadata?: Record<string, unknown>;
  sendPush?: boolean;
}

/**
 * Dispatch notification through all channels:
 * 1. MongoDB collection (persistence)
 * 2. Socket.IO (realtime in-app)
 * 3. Web Push API (browser & OS system push)
 */
export const createAndSendNotification = async (
  params: CreateNotificationParams
): Promise<INotification> => {
  const userIdStr = params.userId.toString();

  // 1. Save to MongoDB
  const notification = await Notification.create({
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    link: params.link,
    metadata: params.metadata,
    read: false,
  });

  // 2. Emit real-time via Socket.IO
  emitToUser(io, userIdStr, 'notification:new', {
    id: notification._id,
    _id: notification._id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    link: notification.link,
    read: false,
    createdAt: notification.createdAt,
    metadata: notification.metadata,
  });

  // If it's a schedule reminder, also emit reminder:upcoming for specialized handling
  if (params.type === 'reminder' && params.metadata?.scheduleId) {
    emitToUser(io, userIdStr, 'reminder:upcoming', {
      scheduleId: params.metadata.scheduleId,
      minutesBefore: params.metadata.minutesBefore || 0,
      subject: params.metadata.subjectName || params.title,
      startTime: params.metadata.startTime,
      notificationId: notification._id,
    });
  }

  // 3. Send Web Push if enabled (default true)
  if (params.sendPush !== false) {
    const isUrgentReminder = params.type === 'reminder';
    const urgentMinutes = typeof params.metadata?.minutesBefore === 'number'
      ? params.metadata.minutesBefore as number
      : null;
    // Reminders ≤15 min before class → requireInteraction (stays on screen until tapped)
    const requireInteraction = isUrgentReminder && (urgentMinutes === null || urgentMinutes <= 15);

    const pushPayload: PushPayload = {
      title: params.title,
      body: params.message,
      requireInteraction,
      data: {
        url: params.link || '/calendar',
        notificationId: notification._id.toString(),
        type: params.type,
        urgent: requireInteraction,
        scheduleId: params.metadata?.scheduleId as string | undefined,
      },
      actions: isUrgentReminder
        ? [
            { action: 'open', title: '📅 Xem lịch học' },
            { action: 'dismiss', title: 'Bỏ qua' },
          ]
        : undefined,
    };
    sendPushToUser(userIdStr, pushPayload).catch((err) => {
      console.error(`[NotificationService] Push delivery failed for user ${userIdStr}:`, err);
    });
  }

  return notification;
};

/**
 * Helper: Notify a student and also notify their linked parents
 */
export const notifyStudentAndParents = async (
  studentId: string | mongoose.Types.ObjectId,
  studentNotification: Omit<CreateNotificationParams, 'userId'>,
  parentMessageModifier?: (parentName: string, studentName: string) => { title: string; message: string }
): Promise<void> => {
  try {
    const student = await User.findById(studentId).populate('parents', 'name email notificationPreferences');
    if (!student) return;

    // Send to student
    await createAndSendNotification({
      ...studentNotification,
      userId: studentId,
    });

    // Send to linked parents
    if (student.parents && student.parents.length > 0) {
      for (const parent of student.parents as any[]) {
        let parentTitle = studentNotification.title;
        let parentMsg = `[Học sinh ${student.name}]: ${studentNotification.message}`;

        if (parentMessageModifier) {
          const modified = parentMessageModifier(parent.name, student.name);
          parentTitle = modified.title;
          parentMsg = modified.message;
        }

        await createAndSendNotification({
          ...studentNotification,
          userId: parent._id,
          title: parentTitle,
          message: parentMsg,
        });
      }
    }
  } catch (error) {
    console.error('[NotificationService] notifyStudentAndParents error:', error);
  }
};
