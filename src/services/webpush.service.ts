import webpush from 'web-push';
import { env } from '../config/env';
import { PushSubscription } from '../models/PushSubscription.model';

// Initialize VAPID details
webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  image?: string;
  requireInteraction?: boolean;
  data?: {
    url?: string;
    [key: string]: unknown;
  };
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

export const getVapidPublicKey = (): string => env.VAPID_PUBLIC_KEY;

/**
 * Build the full notification payload string for push delivery
 */
const buildPayloadString = (payload: PushPayload): string => {
  const isUrgent = payload.requireInteraction === true;

  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/pwa-192.png',
    badge: payload.badge || '/pwa-192.png',
    tag: payload.tag || `notif-${Date.now()}`,
    image: payload.image,
    requireInteraction: isUrgent,
    vibrate: isUrgent ? [300, 100, 300, 100, 300] : [200, 100, 200],
    data: payload.data || { url: '/' },
    actions: payload.actions || [
      { action: 'open', title: '📅 Xem lịch học' },
      { action: 'dismiss', title: 'Bỏ qua' },
    ],
    // Timestamp for accurate time display in notification center
    timestamp: Date.now(),
  });
};

/**
 * Send Web Push notification to all active devices of a user
 */
export const sendPushToUser = async (
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> => {
  try {
    const subscriptions = await PushSubscription.find({ userId });
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[WebPush] No push subscriptions found for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    const payloadString = buildPayloadString(payload);

    let sent = 0;
    let failed = 0;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
              },
            },
            payloadString,
            {
              TTL: 86400, // Keep push alive for 24h if device is offline
              urgency: payload.requireInteraction ? 'high' : 'normal',
            }
          );
          sent++;
          console.log(`[WebPush] ✅ Push sent to subscription ${sub._id} for user ${userId}`);
        } catch (error: any) {
          failed++;
          // If subscription is expired or unsubscribed, remove from DB
          if (error.statusCode === 404 || error.statusCode === 410) {
            console.log(`[WebPush] Removing expired subscription for user ${userId}`);
            await PushSubscription.deleteOne({ _id: sub._id });
          } else {
            console.error(`[WebPush] Error sending push:`, error.message);
          }
        }
      })
    );

    console.log(`[WebPush] User ${userId}: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  } catch (error) {
    console.error(`[WebPush] sendPushToUser error:`, error);
    return { sent: 0, failed: 0 };
  }
};

/**
 * Send a test push directly to a specific subscription
 */
export const sendPushToSubscription = async (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<boolean> => {
  try {
    const payloadString = buildPayloadString(payload);
    await webpush.sendNotification(subscription, payloadString, {
      TTL: 3600,
      urgency: 'high',
    });
    return true;
  } catch (error) {
    console.error(`[WebPush] sendPushToSubscription error:`, error);
    return false;
  }
};
