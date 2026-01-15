import pool from '../config/db.js';

/**
 * Create a new transaction
 */
export const createTransaction = async ({ couponId, buyerId, sellerId, price }) => {
  try {
    const [result] = await pool.query(
      `INSERT INTO transactions (coupon_id, buyer_id, seller_id, price) 
       VALUES (?, ?, ?, ?)`,
      [couponId, buyerId, sellerId, price]
    );
    return {
      id: result.insertId,
      couponId,
      buyerId,
      sellerId,
      price,
      created_at: new Date(),
    };
  } catch (error) {
    console.error('Error in createTransaction service:', error);
    throw error;
  }
};

/**
 * Get all transactions for a buyer
 */
export const getBuyerTransactions = async (buyerId) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.id,
        t.coupon_id,
        t.buyer_id,
        t.seller_id,
        t.price,
        t.created_at,
        c.description,
        c.code,
        c.discount,
        c.is_discount_percentage,
        c.expiry_date,
        c.shop_id,
        s.name AS shop_name,
        u.username AS seller_username
      FROM transactions t
      JOIN coupons c ON t.coupon_id = c.id
      JOIN shops s ON c.shop_id = s.id
      JOIN users u ON t.seller_id = u.id
      WHERE t.buyer_id = ?
      ORDER BY t.created_at DESC
    `, [buyerId]);
    return rows;
  } catch (error) {
    console.error('Error in getBuyerTransactions service:', error);
    throw error;
  }
};

/**
 * Get all transactions for a seller
 */
export const getSellerTransactions = async (sellerId) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.id,
        t.coupon_id,
        t.buyer_id,
        t.seller_id,
        t.price,
        t.created_at,
        c.description,
        c.code,
        c.discount,
        c.is_discount_percentage,
        c.expiry_date,
        c.shop_id,
        s.name AS shop_name,
        u.username AS buyer_username
      FROM transactions t
      JOIN coupons c ON t.coupon_id = c.id
      JOIN shops s ON c.shop_id = s.id
      JOIN users u ON t.buyer_id = u.id
      WHERE t.seller_id = ?
      ORDER BY t.created_at DESC
    `, [sellerId]);
    return rows;
  } catch (error) {
    console.error('Error in getSellerTransactions service:', error);
    throw error;
  }
};

/**
 * Get a single transaction by ID
 */
export const getTransactionById = async (id) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.id,
        t.coupon_id,
        t.buyer_id,
        t.seller_id,
        t.price,
        t.created_at,
        c.description,
        c.code,
        c.discount,
        c.is_discount_percentage,
        c.expiry_date,
        c.shop_id,
        s.name AS shop_name,
        ub.username AS buyer_username,
        us.username AS seller_username
      FROM transactions t
      JOIN coupons c ON t.coupon_id = c.id
      JOIN shops s ON c.shop_id = s.id
      JOIN users ub ON t.buyer_id = ub.id
      JOIN users us ON t.seller_id = us.id
      WHERE t.id = ?
    `, [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error in getTransactionById service:', error);
    throw error;
  }
};
