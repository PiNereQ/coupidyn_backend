import pool from '../config/db.js';

/**
 * Get all active listings with coupon and seller details
 */
// export const getAllListings = async () => {
//   try {
//     const [rows] = await pool.query(`
//       SELECT 
//         l.*,
//         c.description,
//         c.discount,
//         c.is_discount_percentage,
//         c.expiry_date,
//         c.code,
//         c.shop_id,
//         u.username AS seller_username
//       FROM listings l
//       JOIN coupons c ON l.coupon_id = c.id
//       JOIN users u ON l.seller_id = u.id
//       WHERE l.is_active = 1 AND l.is_deleted = 0 AND c.is_deleted = 0
//       ORDER BY l.created_at DESC
//     `);
//     return rows;
//   } catch (error) {
//     console.error('Error in getAllListings service:', error);
//     throw error;
//   }
// };

/**
 * Get all active listings (both listing and coupon must be active, not expired)
 */
// export const getAllActiveListings = async () => {
//   try {
//     const [rows] = await pool.query(`
//       SELECT 
//         l.*,
//         c.description,
//         c.discount,
//         c.is_discount_percentage,
//         c.expiry_date,
//         c.code,
//         c.shop_id,
//         u.username AS seller_username
//       FROM listings l
//       JOIN coupons c ON l.coupon_id = c.id
//       JOIN users u ON l.seller_id = u.id
//       WHERE l.is_active = 1 AND l.is_deleted = 0 AND c.is_active = 1 AND c.is_deleted = 0
//       ORDER BY l.created_at DESC
//     `);
//     return rows;
//   } catch (error) {
//     console.error('Error in getAllActiveListings service:', error);
//     throw error;
//   }
// };

/**
 * Get a single listing by ID with full details
 */
// export const getListingById = async (id) => {
//   try {
//     const [rows] = await pool.query(`
//       SELECT 
//         l.*,
//         c.description,
//         c.discount,
//         c.is_discount_percentage,
//         c.expiry_date,
//         c.code,
//         c.shop_id,
//         c.works_in_store,
//         c.works_online,
//         u.username AS seller_username,
//         u.email AS seller_email
//       FROM listings l
//       JOIN coupons c ON l.coupon_id = c.id
//       JOIN users u ON l.seller_id = u.id
//       WHERE l.id = ? AND l.is_deleted = 0
//     `, [id]);
//     return rows[0] || null;
//   } catch (error) {
//     console.error('Error in getListingById service:', error);
//     throw error;
//   }
// };

/**
 * Create a listing for a coupon (called automatically when coupon is added)
 */
// export const createListing = async ({ coupon_id, seller_id, price, is_multiple_use = false }) => {
//   try {
//     const [result] = await pool.query(
//       'INSERT INTO listings (coupon_id, seller_id, price, is_multiple_use, is_active) VALUES (?, ?, ?, ?, ?)',
//       [coupon_id, seller_id, price, is_multiple_use, true]
//     );

//     const [newListing] = await pool.query(
//       'SELECT * FROM listings WHERE id = ?',
//       [result.insertId]
//     );

//     return newListing[0];
//   } catch (error) {
//     console.error('Error in createListing service:', error);
//     throw error;
//   }
// };

/**
 * Deactivate a coupon after purchase (unless is_multiple_use is true)
 */



