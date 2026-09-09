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
  data?: {
    url?: string;
    [key: string]: unknown;
  };
}

export const getVapidPublicKey = (): string => env.VAPID_PUBLIC_KEY;

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
      return { sent: 0, failed: 0 };
    }

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons.svg',
      badge: payload.badge || '/favicon.svg',
      tag: payload.tag || `notif-${Date.now()}`,
      data: payload.data || { url: '/' },
    });

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
            payloadString
          );
          sent++;
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
    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons.svg',
      badge: payload.badge || '/favicon.svg',
      tag: payload.tag || `test-${Date.now()}`,
      data: payload.data || { url: '/' },
    });

    await webpush.sendNotification(subscription, payloadString);
    return true;
  } catch (error) {
    console.error(`[WebPush] sendPushToSubscription error:`, error);
    return false;
  }
};
