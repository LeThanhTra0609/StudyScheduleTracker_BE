import dayjs from 'dayjs';
import { Notification } from '../models/Notification.model';
import { PushSubscription } from '../models/PushSubscription.model';

export interface CleanupResult {
  readNotificationsDeleted: number;
  oldNotificationsDeleted: number;
  staleSubscriptionsDeleted: number;
  durationMs: number;
}

/**
 * Data retention service to prevent unbounded database growth.
 * Runs on a schedule to prune old, transient data.
 */
export const runDataMaintenance = async (): Promise<CleanupResult> => {
  const startTime = Date.now();
  console.log('[DataRetention] Starting automated database maintenance...');

  const now = dayjs();
  const thirtyDaysAgo = now.subtract(30, 'day').toDate();
  const sixtyDaysAgo = now.subtract(60, 'day').toDate();
  const ninetyDaysAgo = now.subtract(90, 'day').toDate();

  let readNotificationsDeleted = 0;
  let oldNotificationsDeleted = 0;
  let staleSubscriptionsDeleted = 0;

  try {
    // 1. Delete read notifications older than 30 days
    const readRes = await Notification.deleteMany({
      read: true,
      createdAt: { $lt: thirtyDaysAgo },
    });
    readNotificationsDeleted = readRes.deletedCount || 0;

    // 2. Delete any notifications older than 60 days (even if unread)
    const oldRes = await Notification.deleteMany({
      createdAt: { $lt: sixtyDaysAgo },
    });
    oldNotificationsDeleted = oldRes.deletedCount || 0;

    // 3. Delete stale push subscriptions with no updates for > 90 days
    const subRes = await PushSubscription.deleteMany({
      updatedAt: { $lt: ninetyDaysAgo },
    });
    staleSubscriptionsDeleted = subRes.deletedCount || 0;

    const durationMs = Date.now() - startTime;

    console.log(
      `[DataRetention] ✅ Maintenance complete in ${durationMs}ms: ` +
      `${readNotificationsDeleted} read notifs pruned, ` +
      `${oldNotificationsDeleted} expired notifs pruned, ` +
      `${staleSubscriptionsDeleted} dead push subscriptions pruned.`
    );

    return {
      readNotificationsDeleted,
      oldNotificationsDeleted,
      staleSubscriptionsDeleted,
      durationMs,
    };
  } catch (error) {
    console.error('[DataRetention] ❌ Error during data maintenance:', error);
    return {
      readNotificationsDeleted,
      oldNotificationsDeleted,
      staleSubscriptionsDeleted,
      durationMs: Date.now() - startTime,
    };
  }
};
