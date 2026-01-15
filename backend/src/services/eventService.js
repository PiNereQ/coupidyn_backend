import pool from '../config/db.js';

/**
 * Record a coupon click event for a user
 */
export const recordCouponClick = async (userId, couponId) => {
  try {
    const [result] = await pool.query(
      'INSERT INTO coupon_clicks (user_id, coupon_id) VALUES (?, ?)',
      [userId, couponId]
    );

    // If insert was successful, fetch and return the record
    if (result.affectedRows > 0) {
      const [rows] = await pool.query(
        'SELECT * FROM coupon_clicks WHERE id = ?',
        [result.insertId]
      );
      return rows[0] || null;
    }

    return null;
  } catch (error) {
    // Handle duplicate entry error gracefully
    if (error.code === 'ER_DUP_ENTRY') {
      // User has already clicked this coupon - this is expected behavior
      return null;
    }
    console.error('Error in recordCouponClick service:', error);
    throw error;
  }
};

/**
 * Get all clicks for a specific coupon (for analytics/recommendations)
 */
export const getCouponClicks = async (couponId) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM coupon_clicks WHERE coupon_id = ? ORDER BY clicked_at DESC',
      [couponId]
    );
    return rows;
  } catch (error) {
    console.error('Error in getCouponClicks service:', error);
    throw error;
  }
};

/**
 * Get all clicks by a specific user (for user profile/history)
 */
export const getUserClicks = async (userId) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM coupon_clicks WHERE user_id = ? ORDER BY clicked_at DESC',
      [userId]
    );
    return rows;
  } catch (error) {
    console.error('Error in getUserClicks service:', error);
    throw error;
  }
};
