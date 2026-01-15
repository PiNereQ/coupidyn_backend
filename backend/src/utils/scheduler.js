import cron from 'node-cron';
import { deactivateExpiredCoupons } from '../services/couponService.js';
import { sendExpiryReminders } from '../services/fcmService.js';

/**
 * Schedule daily task to deactivate expired coupons at 23:55
 */
export const initializeScheduler = () => {
  // Run every day at 23:55 (11:55 PM)
  // Cron format: minute hour day month day_of_week
  // 55 23 * * * = every day at 23:55

  const task = cron.schedule('55 23 * * *', async () => {
    console.log('⏰ Running scheduled task: Deactivating expired coupons...');
    try {
      const result = await deactivateExpiredCoupons();
      console.log(`✅ Scheduled task completed: ${result.deactivatedCount} coupons deactivated`);
    } catch (error) {
      console.error('❌ Error in scheduled task:', error);
    }
  });

  console.log('📅 Scheduler initialized: Daily coupon expiry check scheduled for 23:55');
  return task;
};

export const initializeExpiryReminderScheduler = () => {
  // Run every day at 9:00 AM
  const task = cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Running scheduled task: Sending expiry reminders...');
    try {
      const result = await sendExpiryReminders();
      console.log(`✅ Scheduled task completed: ${result.remindersSent} reminders sent`);
    } catch (error) {
      console.error('❌ Error in scheduled task:', error);
    }
  });

  console.log('📅 Scheduler initialized: Daily expiry reminder check scheduled for 23:55');
  return task;
};
