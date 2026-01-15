import pool from '../config/db.js';

import admin from '../config/firebase.js';

export const registerFcmToken = async (user_id, fcm_token) => {
  const connection = await pool.getConnection();
  var pendingMessages = [];
  try {
    await connection.query(
      `INSERT INTO fcm_tokens (user_id, token)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
        token = VALUES(token),
        updated_at = CURRENT_TIMESTAMP`,
      [user_id, fcm_token]);

    pendingMessages = await connection.query(
      `SELECT id, message_title, message_body, data_payload FROM pending_fcm_messages WHERE user_id = ?`,
      [user_id]);
    
  } catch (error) {
    console.error('Error adding/updating FCM token:', error);
    throw error;
  } finally {
    for (const msg of pendingMessages) {
      await sendNotification(
        user_id,
        msg.title,
        msg.body,
        msg.data
      );
    }

    if (pendingMessages.length > 0) {
      await connection.query(
        `DELETE FROM pending_fcm_messages WHERE user_id = ?`,
        [user_id]);
    }

    connection.release();
  }
};

export const sendNotification = async (user_id, title, body, data = {}) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT token FROM fcm_tokens WHERE user_id = ?`,
      [user_id]);

    if (rows.length === 0) {
      console.log(`No FCM token found for user_id: ${user_id}`);
      return;
    }

    const fcm_token = rows[0].token;

    const message = {
      token: fcm_token,
      notification: {
        title,
        body,
      },
      data,
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.error(`Error sending notification to user ${user_id}:\n`, error);
    connection.query(
      `INSERT INTO pending_fcm_messages (user_id, message_title, message_body, data_payload)
        VALUES (?, ?, ?, ?)`,
      [user_id, title, body, JSON.stringify(data)]
    );
    console.log('Stored message for later delivery due to error.');
    throw error;
  } finally {
    connection.release();
  }
};

export const applyFcmPreferences = async (user_id, chat_notifications_disabled, coupon_notifications_disabled) => {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      `INSERT INTO fcm_preferences (
          user_id,
          chat_notifications_disabled,
          coupon_notifications_disabled
      )
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        chat_notifications_disabled = VALUES(chat_notifications_disabled),
        coupon_notifications_disabled = VALUES(coupon_notifications_disabled)
      `,
      [user_id, chat_notifications_disabled, coupon_notifications_disabled]);
  } catch (error) {
    console.error('Error updating FCM preferences:', error);
    throw error;
  } finally {
    connection.release();
  }
};

export const getFcmPreferences = async (user_id) => {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT
          chat_notifications_disabled,
          coupon_notifications_disabled
      FROM fcm_preferences
      WHERE user_id = ?`,
      [user_id]);

    if (rows.length === 0) {
      return {
        chat_notifications_disabled: false,
        coupon_notifications_disabled: false
      };
    }

    return rows[0];
  } catch (error) {
    console.error('Error fetching FCM preferences:', error);
    throw error;
  } finally {
    connection.release();
  }
};

export const remindUserAboutUpcomingExpiry = async (user_id, days_left) => {
  const preferences = await getFcmPreferences(user_id);
  if (preferences.coupon_notifications_disabled) {
    console.log(`User ${user_id} has disabled coupon notifications. Skipping reminder.`);
    return;
  }
  const connection = await pool.getConnection();
  let shopName = '';
  try {
    const [rows] = await connection.query(
      `SELECT shop_name FROM shops WHERE user_id = ? LIMIT 1`,
      [user_id]
    );
    if (rows.length > 0) {
      shopName = rows[0].shop_name;
    }
  } catch (error) {
    console.error('Error fetching shop name:', error);
  } finally {
    connection.release();
  }

  const title = '🗓️ Twój kupon niedługo wygaśnie!';
  let body = '';
  if (days_left == 0) {
    body = shopName == '' ? `Twój kupon wygasa dzisiaj. Wykorzystaj go zanim straci ważność!` : `Twój kupon do ${shopName} wygasa dzisiaj. Wykorzystaj go zanim straci ważność!`;
  } else if (days_left == 1) {
    body = shopName == '' ? `Twój kupon wygasa jutro. Wykorzystaj go zanim straci ważność!` : `Twój kupon do ${shopName} wygasa jutro. Wykorzystaj go zanim straci ważność!`;
  } else {
    body = shopName == '' ? `Twój kupon wygasa za ${days_left} dni. Wykorzystaj go zanim straci ważność!` : `Twój kupon do ${shopName} wygasa za ${days_left} dni. Wykorzystaj go zanim straci ważność!`;
  }
  
  const data = {
    type: 'coupon_expiry_reminder',
    days_left: days_left.toString(),
  };

  try {
    await sendNotification(user_id, title, body, data);
  } catch (error) {
    console.error('Error sending expiry reminder notification:', error);
  }
};

export const sendExpiryReminders = async () => {
  const connection = await pool.getConnection();
  let remindersSent = 0;
  try {
    const [rows] = await connection.query(
      `SELECT
        c.id,
        t.buyer_id,
        DATEDIFF(c.expiry_date, CURDATE()) AS days_left
      FROM coupons c
      JOIN transactions t on c.id = t.coupon_id
      WHERE c.is_active = 1
        AND DATEDIFF(c.expiry_date, CURDATE()) IN (0, 1, 3)
        AND NOT EXISTS (SELECT 1 FROM uses u WHERE u.coupon_id = c.id AND u.user_id = t.buyer_id)`
    );

    for (const row of rows) {
      const { user_id, coupon_code, days_left } = row;
      try {
        await remindUserAboutUpcomingExpiry(user_id, days_left);
        remindersSent++;
      } catch (error) {
        console.error(`Error sending reminder for coupon ${coupon_code} to user ${user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error fetching coupons for expiry reminders:', error);
    throw error;
  } finally {
    connection.release();
  }
  return { remindersSent };
};

export const notifyUserAboutCouponDeactivation = async (user_id, coupon_code) => {
  const connection = await pool.getConnection();
  let shopName = '';
  try {
    const [rows] = await connection.query(
      `SELECT shop_name FROM shops WHERE user_id = ? LIMIT 1`,
      [user_id]
    );
    if (rows.length > 0) {
      shopName = rows[0].shop_name;
    }
  } catch (error) {
    console.error('Error fetching shop name:', error);
  } finally {
    connection.release();
  }

  const title = 'Twój kupon niestety wygasł';
  const body = shopName == '' ? `Twój kupon niestety wygasł.` : `Twój kupon do ${shopName} niestety wygasł.`;
  const data = {
    type: 'coupon_deactivation'
  };

  try {
    await sendNotification(user_id, title, body, data);
  } catch (error) {
    console.error('Error sending coupon deactivation notification:', error);
  }
};