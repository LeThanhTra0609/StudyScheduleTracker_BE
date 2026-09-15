import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { Schedule } from '../models/Schedule.model';
import { User, IUser } from '../models/User.model';
import { createAndSendNotification, notifyStudentAndParents } from './notification.service';
import { SentPushLog } from '../models/SentPushLog.model';
import { runDataMaintenance } from './dataRetention.service';

// Configure dayjs with Vietnam timezone (UTC+7)
dayjs.extend(utc);
dayjs.extend(timezone);
const VN_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Cleanup job is now a no-op: SentPushLog uses a MongoDB TTL index (48h)
 * that auto-removes stale entries — no in-memory Set needed.
 */
const cleanupCacheJob = (): void => {
  // TTL index on SentPushLog handles cleanup automatically
  console.log('[Cron] SentPushLog TTL index active — no manual cleanup needed');
};

/**
 * 1. Check upcoming classes every minute
 * Checks schedules starting in X minutes matching each user's reminderTimes preference.
 * Uses a 2-minute window to tolerate cron delays / server restarts.
 */
const checkUpcomingClasses = async (): Promise<void> => {
  try {
    const now = dayjs().tz(VN_TZ);
    const todayStart = now.startOf('day').toDate();
    const todayEnd = now.endOf('day').toDate();
    const currentMinuteOfDay = now.hour() * 60 + now.minute();
    const dateStr = now.format('YYYY-MM-DD');

    // Find all UPCOMING schedules today
    const schedules = await Schedule.find({
      date: { $gte: todayStart, $lte: todayEnd },
      status: 'UPCOMING',
    })
      .populate('subjectId', 'name color code')
      .populate('locationId', 'name address meetingLink')
      .populate('userId', 'name email notificationPreferences');

    for (const schedule of schedules) {
      if (!schedule.userId) continue;
      const user = schedule.userId as unknown as IUser;

      // Check if class reminders are enabled
      const prefs = user.notificationPreferences || { reminderTimes: [30], classReminder: true };
      if (prefs.classReminder === false) continue;

      const [startHour, startMin] = schedule.startTime.split(':').map(Number);
      const scheduleStartMinuteOfDay = startHour * 60 + startMin;
      const minutesRemaining = scheduleStartMinuteOfDay - currentMinuteOfDay;

      // Only evaluate if the class is in the future
      if (minutesRemaining <= 0) continue;

      const reminderTimes = prefs.reminderTimes && prefs.reminderTimes.length > 0
        ? prefs.reminderTimes
        : [30];

      let shouldSend = false;
      let targetM: number = 30;

      // 1. Check exact configured reminder thresholds
      for (const m of reminderTimes) {
        if (minutesRemaining >= m && minutesRemaining < m + 1) {
          shouldSend = true;
          targetM = m;
          break;
        }
      }

      // 2. Short-notice fallback: If class is starting very soon (<= 5 min) and NO reminder has been sent yet today
      if (!shouldSend && minutesRemaining > 0 && minutesRemaining <= 5) {
        const alreadySentAny = await SentPushLog.exists({
          userId: user._id,
          scheduleId: schedule._id,
          dateStr,
        });
        if (!alreadySentAny) {
          shouldSend = true;
          targetM = minutesRemaining;
        }
      }

      if (shouldSend) {
        const scheduleIdStr = schedule._id.toString();
        const userIdStr = user._id.toString();

        // DB-based deduplication: survives server restarts
        try {
          await SentPushLog.create({
            userId: user._id,
            scheduleId: schedule._id,
            reminderMinutes: targetM,
            dateStr,
          });
        } catch (dupErr: any) {
          // E11000 duplicate key = already sent → skip
          if (dupErr?.code === 11000) {
            console.log(`[Cron] Skipped duplicate reminder: ${scheduleIdStr} at -${targetM}min`);
            continue;
          }
          throw dupErr;
        }

        const subjectName = (schedule.subjectId as any)?.name || 'Buổi học';
        const locName = (schedule.locationId as any)?.name ? ` tại ${(schedule.locationId as any).name}` : '';
        const meetingLink = (schedule.locationId as any)?.meetingLink ? ` (Link: ${(schedule.locationId as any).meetingLink})` : '';

        const title = `⏰ Nhắc nhở: Sắp đến giờ học ${subjectName}`;
        const message = `Còn ${minutesRemaining} phút nữa (${schedule.startTime} – ${schedule.endTime}) bạn có lịch học môn ${subjectName}${locName}.${meetingLink}`;

        await notifyStudentAndParents(
          userIdStr,
          {
            title,
            message,
            type: 'reminder',
            link: `/calendar?date=${dateStr}`,
            metadata: {
              scheduleId: scheduleIdStr,
              minutesBefore: minutesRemaining,
              subjectName,
              startTime: schedule.startTime,
              urgent: minutesRemaining <= 15,
            },
          },
          (_parentName, studentName) => ({
            title: `⏰ Nhắc nhở: Con ${studentName} sắp có buổi học`,
            message: `Học sinh ${studentName} có buổi học môn ${subjectName} sau ${minutesRemaining} phút (${schedule.startTime} – ${schedule.endTime})${locName}.`,
          })
        );

        console.log(`[Cron] ✅ Reminder sent: ${subjectName} in ${minutesRemaining}min for user ${userIdStr}`);
      }
    }
  } catch (error) {
    console.error('[Cron] Error in checkUpcomingClasses:', error);
  }
};

/**
 * 2. Check Daily Morning Briefing (default 07:00 VN time)
 */
const checkDailyBriefing = async (): Promise<void> => {
  try {
    const now = dayjs().tz(VN_TZ);
    const currentTimeStr = now.format('HH:mm');
    const dateStr = now.format('YYYY-MM-DD');
    const todayStart = now.startOf('day').toDate();
    const todayEnd = now.endOf('day').toDate();

    // Find users who have daily reminder configured at this current time
    const users = await User.find({
      $or: [
        { 'notificationPreferences.dailyReminderTime': currentTimeStr, 'notificationPreferences.dailyReminder': { $ne: false } },
        // Fallback default 07:00 if field not set
        { 'notificationPreferences.dailyReminderTime': { $exists: false }, 'notificationPreferences.dailyReminder': { $ne: false } }
      ]
    });

    for (const user of users) {
      // Default to 07:00 if dailyReminderTime is undefined
      const targetTime = user.notificationPreferences?.dailyReminderTime || '07:00';
      if (currentTimeStr !== targetTime) continue;

      // DB-based dedup for daily briefing (sentinel scheduleId = userId, reminderMinutes=0)
      try {
        await SentPushLog.create({
          userId: user._id,
          scheduleId: user._id, // sentinel: no specific schedule
          reminderMinutes: 0,   // 0 = daily morning briefing
          dateStr,
        });
      } catch (dupErr: any) {
        if (dupErr?.code === 11000) continue; // already sent today
        throw dupErr;
      }

      // Find user schedules today
      const todaySchedules = await Schedule.find({
        userId: user._id,
        date: { $gte: todayStart, $lte: todayEnd },
        status: { $nin: ['CANCELLED'] },
      })
        .populate('subjectId', 'name')
        .sort({ startTime: 1 });

      if (todaySchedules.length > 0) {
        const scheduleList = todaySchedules
          .map((s) => `${(s.subjectId as any)?.name || 'Môn học'} (${s.startTime})`)
          .join(', ');

        const title = `🌅 Lịch học hôm nay (${now.format('DD/MM/YYYY')})`;
        const message = `Chào buổi sáng! Hôm nay bạn có ${todaySchedules.length} buổi học: ${scheduleList}. Chúc bạn học tập thật tốt!`;

        await createAndSendNotification({
          userId: user._id.toString(),
          title,
          message,
          type: 'reminder',
          link: `/calendar?date=${dateStr}`,
          metadata: { count: todaySchedules.length, date: dateStr },
        });

        console.log(`[Cron] ✅ Daily briefing sent to user ${user._id}: ${todaySchedules.length} classes`);
      }
    }
  } catch (error) {
    console.error('[Cron] Error in checkDailyBriefing:', error);
  }
};

/**
 * 3. Check Advance Evening Reminder (default 20:00 VN time)
 */
const checkAdvanceEveningReminder = async (): Promise<void> => {
  try {
    const now = dayjs().tz(VN_TZ);
    const currentTimeStr = now.format('HH:mm');
    const dateStr = now.format('YYYY-MM-DD');
    const tomorrow = now.add(1, 'day');
    const tomorrowStart = tomorrow.startOf('day').toDate();
    const tomorrowEnd = tomorrow.endOf('day').toDate();
    const tomorrowDateStr = tomorrow.format('YYYY-MM-DD');

    const users = await User.find({
      $or: [
        { 'notificationPreferences.advanceDayReminderTime': currentTimeStr, 'notificationPreferences.advanceDayReminder': { $ne: false } },
        { 'notificationPreferences.advanceDayReminderTime': { $exists: false }, 'notificationPreferences.advanceDayReminder': { $ne: false } }
      ]
    });

    for (const user of users) {
      const targetTime = user.notificationPreferences?.advanceDayReminderTime || '20:00';
      if (currentTimeStr !== targetTime) continue;

      // DB-based dedup for evening reminder (reminderMinutes=9999 = evening sentinel)
      try {
        await SentPushLog.create({
          userId: user._id,
          scheduleId: user._id, // sentinel: no specific schedule
          reminderMinutes: 9999, // 9999 = evening advance reminder
          dateStr,
        });
      } catch (dupErr: any) {
        if (dupErr?.code === 11000) continue; // already sent today
        throw dupErr;
      }

      const tomorrowSchedules = await Schedule.find({
        userId: user._id,
        date: { $gte: tomorrowStart, $lte: tomorrowEnd },
        status: { $nin: ['CANCELLED'] },
      })
        .populate('subjectId', 'name')
        .sort({ startTime: 1 });

      if (tomorrowSchedules.length > 0) {
        const scheduleList = tomorrowSchedules
          .map((s) => `${(s.subjectId as any)?.name || 'Môn học'} (${s.startTime})`)
          .join(', ');

        const title = `🌙 Chuẩn bị lịch học ngày mai (${tomorrow.format('DD/MM')})`;
        const message = `Ngày mai bạn có ${tomorrowSchedules.length} buổi học: ${scheduleList}. Hãy chuẩn bị bài vở và hoàn thành bài tập về nhà nhé!`;

        await createAndSendNotification({
          userId: user._id.toString(),
          title,
          message,
          type: 'reminder',
          link: `/calendar?date=${tomorrowDateStr}`,
          metadata: { count: tomorrowSchedules.length, date: tomorrowDateStr },
        });

        console.log(`[Cron] ✅ Evening advance sent to user ${user._id}: ${tomorrowSchedules.length} classes tomorrow`);
      }
    }
  } catch (error) {
    console.error('[Cron] Error in checkAdvanceEveningReminder:', error);
  }
};

/**
 * Initialize all automated Cron jobs
 */
export const initCronJobs = (): void => {
  console.log('⏰ Initializing Study Schedule Notification Cron Engine (Timezone: Asia/Ho_Chi_Minh)...');

  cleanupCacheJob();

  // Run initial data maintenance check at startup
  runDataMaintenance().catch((err) => console.error('[Cron] Initial data maintenance error:', err));

  // Run every minute: * * * * *
  cron.schedule('* * * * *', async () => {
    await checkUpcomingClasses();
    await checkDailyBriefing();
    await checkAdvanceEveningReminder();
  });

  // Run data retention maintenance daily at 03:00 AM VN time (0 3 * * *)
  cron.schedule('0 3 * * *', async () => {
    console.log('[Cron] 🧹 Running scheduled daily data maintenance (03:00 AM)...');
    await runDataMaintenance();
  });

  console.log('✅ Cron Engine active: Scanning upcoming classes every minute & Daily data maintenance at 03:00 AM.');
};
