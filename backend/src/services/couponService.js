import pool from '../config/db.js';

import {
  sendSystemMessageInConversation,
  checkIfConversationExists,
  createConversation
} from './chatService.js';

import {getFcmPreferences} from './fcmService.js';

const _orderByOptions = {
  'price+asc': 'c.price ASC',
  'price+desc': 'c.price DESC',
  'listing+desc': 'c.created_at DESC',
  'listing+asc': 'c.created_at ASC',
  'rep+desc': 'u.reputation DESC',
  'rep+asc': 'u.reputation ASC',
  'expiry+asc': 'CASE WHEN c.expiry_date IS NULL THEN 1 ELSE 0 END, c.expiry_date ASC',
  'expiry+desc': 'CASE WHEN c.expiry_date IS NULL THEN 0 ELSE 1 END, c.expiry_date DESC',
  'purchase+asc': 't.created_at ASC',
  'purchase+desc': 't.created_at DESC',
  'save+asc': 'sc.saved_at ASC',
  'save+desc': 'sc.saved_at DESC',
};

const _whereOptions = ( key, value ) => {
  console.log('Generating where clause for key:', key, 'with value:', value);
  switch (key) {
    case 'type':
      return `c.is_discount_percentage = ${value == 'percent' ? '1' : '0'}`;
    case 'min_price':
      return `c.price >= ${value}`;
    case 'max_price':
      return `c.price <= ${value}`;
    case 'min_rep':
      return `u.reputation >= ${value}`;
    case 'used':
      return `EXISTS (SELECT 1 FROM uses us WHERE us.coupon_id = c.id AND us.user_id = ? ) = ${value == 'yes' ? 1 : 0}`;
    case 'status':
      return `c.is_active = ${value == 'active' ? 1 : 0} AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())`;
    case 'shop_id':
      return `c.shop_id = ${value}`;
    case 'category_id':
      return `EXISTS (
        SELECT 1 FROM shops_categories sc
        WHERE sc.shop_id = c.shop_id AND sc.category_id = ${value}
      )`;
    default:
      return '1 = 1';
  }
}

const _buildCursorCondition = (sort, cursor) => {
  if (!cursor) return { sql: '', params: [] };

  switch (sort) {
    case 'price+desc':
      return {
        sql: 'AND (c.price < ? OR (c.price = ? AND c.id < ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };

    case 'price+asc':
      return {
        sql: 'AND (c.price > ? OR (c.price = ? AND c.id > ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };

    case 'listing+asc':
      return {
        sql: 'AND (c.created_at > ? OR (c.created_at = ? AND c.id > ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };

    case 'rep+desc':
      return {
        sql: 'AND (u.reputation < ? OR (u.reputation = ? AND c.id < ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };

    case 'rep+asc':
      return {
        sql: 'AND (u.reputation > ? OR (u.reputation = ? AND c.id > ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };

    case 'purchase+asc':
      return {
        sql: 'AND (t.created_at > ? OR (t.created_at = ? AND c.id > ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };

    case 'purchase+desc':
      return {
        sql: 'AND (t.created_at < ? OR (t.created_at = ? AND c.id < ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };

    case 'save+asc':
      return {
        sql: 'AND (sc.saved_at > ? OR (sc.saved_at = ? AND c.id > ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };

    case 'save+desc':
      return {
        sql: 'AND (sc.saved_at < ? OR (sc.saved_at = ? AND c.id < ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };

    default: // listing+desc or expiry
      return {
        sql: 'AND (c.created_at < ? OR (c.created_at = ? AND c.id < ?))',
        params: [cursor.value, cursor.value, cursor.id],
      };
  }
};

/**
 * Add a new coupon and automatically create a listing for it
 */
export const addCoupon = async ({ description, price, discount, is_discount_percentage = false, expiry_date = null, code, is_active = true, is_multiple_use = false, has_limits = false, works_in_store = true, works_online = true, shop_id = null, seller_id = null }) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Insert the coupon
    const [result] = await connection.query(
      `INSERT INTO coupons(
        description,
        price,
        discount,
        is_discount_percentage,
        expiry_date,
        code,
        is_active,
        is_multiple_use,
        has_limits,
        works_in_store,
        works_online,
        shop_id,
        seller_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [description, price, discount, is_discount_percentage, expiry_date, code, is_active, is_multiple_use, has_limits, works_in_store, works_online, shop_id, seller_id]
    );

    const coupon_id = result.insertId;

    // Get the new coupon
    const [newCoupon] = await connection.query(
      'SELECT * FROM coupons WHERE id = ?',
      [coupon_id]
    );
    await connection.commit();
    return newCoupon[0];
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Coupon code already exists');
    }
    console.error('Error in addCoupon service:', error);
    throw error;
  } finally {
    connection.release();
  }
};


/**
 * Coupons OWNED by a user
 */
export const getBoughtCoupons = async (owner_id, sort, type, used, shop_id, limit = 20, cursor = null) => {
  try {
    limit = Math.min(parseInt(limit, 10) || 20, 100);

    const orderByClause = _orderByOptions[sort] || 'c.created_at DESC';
    const whereClauses = [];
    const whereParams = [];

    if (type !== undefined && type != 'any') {
      whereClauses.push(_whereOptions('type', type));
    }
    if (used !== undefined && used != 'any') {
      whereClauses.push(_whereOptions('used', used));
      whereParams.push(owner_id);
    }
    if (shop_id !== undefined) {
      whereClauses.push(_whereOptions('shop_id', shop_id));
    }

    const cursorCondition = _buildCursorCondition(sort, cursor);

    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.discount,
        c.is_discount_percentage,
        c.price,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.description,
        s.id as shop_id,
        s.name as shop_name,
        s.name_color as shop_name_color,
        s.bg_color as shop_bg_color,
        c.seller_id as seller_id,
        u.username as seller_username,
        u.profile_picture as seller_profile_picture,
        u.reputation as seller_reputation,
        u.join_date as seller_join_date,
        c.is_active,
        c.created_at as listing_date,
        t.id as transaction_id,
        t.created_at as purchase_date,
        EXISTS (
          SELECT 1 FROM uses us WHERE us.coupon_id = c.id AND us.user_id = ?
        ) AS is_used,
        c.code
      FROM coupons c
      JOIN shops s ON c.shop_id = s.id
      JOIN users u ON c.seller_id = u.id
      JOIN transactions t ON c.id = t.coupon_id
      WHERE t.buyer_id = ?
        AND (c.is_deleted IS NULL OR c.is_deleted = false)
        ${whereClauses.length ? 'AND ' + whereClauses.join(' AND ') : ''}
        ${cursorCondition.sql}
      ORDER BY ${orderByClause}, c.id DESC
      `, [ owner_id, owner_id, ...whereParams, ...cursorCondition.params, limit + 1 ],
    );
    
    let nextCursor = null;
    const hasNextPage = rows.length > limit;

    if (hasNextPage) {
      const last = rows.pop();

      nextCursor = {
        value:
          sort?.startsWith('price')
            ? last.price
            : last.listing_date,
        id: last.id,
      };
    }

    return {
      data: rows,
      nextCursor,
    };
  } catch (error) {
    console.error('Error in getBoughtCoupons service:', error);
    throw error;
  }
};

export const getBoughtCouponById = async (coupon_id, owner_id) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.discount,
        c.is_discount_percentage,
        c.price,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.description,
        s.id as shop_id,
        s.name as shop_name,
        s.name_color as shop_name_color,
        s.bg_color as shop_bg_color,
        c.seller_id as seller_id,
        u.username as seller_username,
        u.profile_picture as seller_profile_picture,
        u.reputation as seller_reputation,
        u.join_date as seller_join_date,
        c.is_active,
        c.created_at as listing_date,
        t.id as transaction_id,
        t.created_at as purchase_date,
        EXISTS (
          SELECT 1 FROM uses us WHERE us.coupon_id = c.id AND us.user_id = ?
        ) AS is_used,
        c.code
      FROM coupons c
      JOIN shops s ON c.shop_id = s.id
      JOIN users u ON c.seller_id = u.id
      JOIN transactions t ON c.id = t.coupon_id
      WHERE c.id = ? AND t.buyer_id = ?
        AND (c.is_deleted IS NULL OR c.is_deleted = false)`,
      [ owner_id, coupon_id, owner_id ]
    );
    if (!rows[0]) {
        const err = new Error('Coupon not found or not owned by user');
        err.status = 404;
        throw err;
    }
    return rows[0];
  } catch (error) {
    console.error('Error in getBoughtCouponById service:', error);
    throw error;
  }
};

export const useBoughtCoupon = async (coupon_id, user_id) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if the coupon has already been used by this user
    const [existingUses] = await connection.query(
      'SELECT 1 FROM uses WHERE coupon_id = ? AND user_id = ?',
      [coupon_id, user_id]
    );

    if (existingUses.length > 0) {
      return { alreadyUsed: true };
    }

    // Mark the coupon as used
    await connection.query(
      'INSERT INTO uses (coupon_id, user_id, used_at) VALUES (?, ?, NOW())',
      [coupon_id, user_id]
    );
    
    // Check if conversation exists between user and seller (get seller_id from coupon)
    // If not, create one
    const seller_id = await connection.query(
      'SELECT seller_id FROM coupons WHERE id = ?',
      [coupon_id]
    ).then(([rows]) => rows[0]?.seller_id);

    if (!seller_id) {
      throw new Error('Seller not found for this coupon');
    }
    
    var conversation_id = null;

    const [result] = await connection.query(`
        SELECT 
          id,
          coupon_id,
          buyer_id,
          seller_id
        FROM conversations
        WHERE coupon_id = ? AND buyer_id = ? AND seller_id = ?
        LIMIT 1
      `, [ coupon_id, user_id, seller_id ]);

    if (result.length === 0) {
      const [ conversation ] = await pool.query(`
        INSERT INTO conversations (coupon_id, buyer_id, seller_id, created_at)
        VALUES (?, ?, ?, NOW())
      `, [ coupon_id, user_id, seller_id ]);

      const [createdConversation] = await pool.query(`
        SELECT 
          c.id
        FROM conversations c
        WHERE c.id = ?
        LIMIT 1
      `, [conversation.insertId]);

      conversation_id = createdConversation[0].id;
    } else {
      conversation_id = result[0].id;
    }
      
    // Send system message to buyer to request rating
    const [ buyerMessageRows ] = await pool.query(`
      INSERT INTO messages (conversation_id, sender_id, content, sent_at, message_type, target_user_id)
      VALUES (?, NULL, ?, NOW(), 'system', ?)
    `, [ conversation_id, 'rating_request_for_buyer', user_id ]);

    // Send system message to seller to request rating
    const [ sellerMessageRows ] = await pool.query(`
      INSERT INTO messages (conversation_id, sender_id, content, sent_at, message_type, target_user_id)
      VALUES (?, NULL, ?, NOW(), 'system', ?)
    `, [ conversation_id, 'rating_request_for_seller', seller_id ]);

    
    
    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    console.error('Error in useBoughtCoupon service:', error);
    throw error;
  } finally {
    connection.release();
    
      try {
        const buyerPreferences = await getFcmPreferences(user_id);
        if (buyerPreferences.chat_notifications_disabled) {
          console.log(`User ${user_id} has disabled coupon notifications. Skipping reminder.`);
        } else {
          const title = 'Oceń sprzedającego!';
          const body = `Jak poszło z wykorzystaniem kuponu? Oceń swojego sprzedającego.`;
          const data = {};
          await sendNotification(user_id, title, body, data);
        }
      } catch (error) {
        console.error('Error sending coupon use notification to buyer:', error);
      }

      try {
        const sellerPreferences = await getFcmPreferences(seller_id);
        if (sellerPreferences.chat_notifications_disabled) { 
          console.log(`User ${seller_id} has disabled coupon notifications. Skipping reminder.`);
          return;
        } else {
          const title = 'Ktoś użył sprzedany przez Ciebie kupon!';
          const body = `Oceń swojego kupującego.`;
          const data = {};
          await sendNotification(seller_id, title, body, data);
        }
      } catch (error) {
        console.error('Error sending coupon use notification to seller:', error);
      }
    

    
  }
};



/**
 * Coupons LISTED by a user
 */

export const getListedCoupons = async (
  seller_id,
  sort,
  type,
  status,
  shop_id,
  limit = 20,
  cursor = null
) => {
  try {
    limit = Math.min(parseInt(limit, 10) || 20, 100);

    const orderByClause = _orderByOptions[sort] || 'c.created_at DESC';
    const whereClauses = [];

    if (type !== undefined && type !== 'any') {
      whereClauses.push(_whereOptions('type', type));
    }

    if (status !== undefined && status !== 'any') {
      whereClauses.push(_whereOptions('status', status));
    }

    if (shop_id !== undefined) {
      whereClauses.push(_whereOptions('shop_id', shop_id));
    }

    const cursorCondition = _buildCursorCondition(sort, cursor);

    const params = [seller_id, ...cursorCondition.params, limit + 1];

    const [rows] = await pool.query(
      `
      SELECT
        c.id,
        c.discount,
        c.is_discount_percentage,
        c.price,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.description,
        s.id as shop_id,
        s.name as shop_name,
        s.name_color as shop_name_color,
        s.bg_color as shop_bg_color,
        c.is_active,
        c.created_at as listing_date,
        c.is_multiple_use,
        c.code
      FROM coupons c
      JOIN shops s ON c.shop_id = s.id
      WHERE c.seller_id = ?
        AND (c.is_deleted IS NULL OR c.is_deleted = false)
        ${whereClauses.length ? 'AND ' + whereClauses.join(' AND ') : ''}
        ${cursorCondition.sql}
      ORDER BY ${orderByClause}, c.id DESC
      LIMIT ?
      `,
      params
    );

    let nextCursor = null;
    const hasNextPage = rows.length > limit;

    if (hasNextPage) {
      const last = rows.pop();

      nextCursor = {
        value:
          sort?.startsWith('price')
            ? last.price
            : last.listing_date,
        id: last.id,
      };
    }

    return {
      data: rows,
      nextCursor,
    };
  } catch (error) {
    console.error('Error in getListedCoupons service:', error);
    throw error;
  }
};

export const getListedCouponById = async (coupon_id, seller_id) => {
  try {
    console.log('Fetching listed coupon with id:', coupon_id, 'for seller_id:', seller_id);
    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.discount,
        c.is_discount_percentage,
        c.price,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.description,
        s.id as shop_id,
        s.name as shop_name,
        s.name_color as shop_name_color,
        s.bg_color as shop_bg_color,
        c.is_active,
        c.created_at as listing_date,
        c.is_multiple_use,
        c.code
       FROM coupons c
       JOIN shops s ON c.shop_id = s.id
       WHERE c.id = ? AND c.seller_id = ?
         AND (c.is_deleted IS NULL OR c.is_deleted = false)`,
      [ coupon_id, seller_id ]
    );
    if (!rows[0]) {
      throw new Error('Coupon not found or seller_id is incorrect');
    }
    return rows[0];
  } catch (error) {
    console.error('Error in getListedCouponById service:', error);
    throw error;
  }
};



/**
 * Other available for user
 */
export const getAvailableForPurchaseList = async (user_id, sort, type, min_price, max_price, min_rep, shop_id, category_id, limit = 20, cursor = null) => {
  try {
    limit = Math.min(parseInt(limit, 10) || 20, 100);

    const orderByClause = _orderByOptions[sort] || 'c.created_at DESC';
    const whereClauses = [];

    if (type !== undefined && type != 'any') {
      whereClauses.push(_whereOptions('type', type));
    }
    if (min_price !== undefined) {
      whereClauses.push(_whereOptions('min_price', min_price));
    }
    if (max_price !== undefined) {
      whereClauses.push(_whereOptions('max_price', max_price));
    }
    if (min_rep !== undefined && min_rep > 0) {
      whereClauses.push(_whereOptions('min_rep', min_rep));
    }
    if (shop_id !== undefined) {
      whereClauses.push(_whereOptions('shop_id', shop_id));
    }
    if (category_id !== undefined) {
      whereClauses.push(_whereOptions('category_id', category_id));
    }

    const params = [user_id, user_id, user_id];

    const cursorCondition = _buildCursorCondition(sort, cursor);

    const [rows] = await pool.query(
      `SELECT
      c.id,
      c.discount,
      c.is_discount_percentage,
      c.price,
      c.has_limits,
      c.works_online,
      c.works_in_store,
      c.expiry_date,
      c.description,
      s.id as shop_id,
      s.name as shop_name,
      s.name_color as shop_name_color,
      s.bg_color as shop_bg_color,
      c.seller_id as seller_id,
      u.username as seller_username,
      u.profile_picture as seller_profile_picture,
      u.reputation as seller_reputation,
      u.join_date as seller_join_date,
      c.is_active,
      c.created_at as listing_date,
      EXISTS (
        SELECT 1 FROM saves sv WHERE sv.coupon_id = c.id AND sv.user_id = ?
      ) AS is_saved
      FROM coupons c
      JOIN shops s ON c.shop_id = s.id
      JOIN users u ON c.seller_id = u.id
      WHERE c.is_active = true 
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND (c.is_deleted IS NULL OR c.is_deleted = false)
        AND c.seller_id != ?
        AND NOT EXISTS (
          SELECT 1
          FROM transactions t
          WHERE t.coupon_id = c.id
            AND t.buyer_id = ?
        )
        ${whereClauses.length ? 'AND ' + whereClauses.join(' AND ') : ''}
        ${cursorCondition.sql}
      ORDER BY ${orderByClause}, c.id DESC
      LIMIT ?`,
      [ ...params, ...cursorCondition.params, limit + 1 ]
    );

    let nextCursor = null;
    let hasNextPage = rows.length > limit;

    if (hasNextPage) {
      const last = rows.pop();

      nextCursor = {
        value:
          sort?.startsWith('price')
            ? last.price
            : last.listing_date,
        id: last.id,
      };
    }

    return {
      data: rows,
      nextCursor,
    };

  } catch (error) {
    console.error('Error in getAvailableForPurchaseList service:', error);
    throw error;
  }
};

export const getAvailableForPurchase = async (coupon_id, user_id) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.discount,
        c.is_discount_percentage,
        c.price,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.description,
        s.id as shop_id,
        s.name as shop_name,
        s.name_color as shop_name_color,
        s.bg_color as shop_bg_color,
        c.seller_id as seller_id,
        u.username as seller_username,
        u.profile_picture as seller_profile_picture,
        u.reputation as seller_reputation,
        u.join_date as seller_join_date,
        c.is_active,
        c.created_at as listing_date,
        EXISTS (
          SELECT 1 FROM saves sv WHERE sv.coupon_id = c.id AND sv.user_id = ?
        ) AS is_saved
      FROM coupons c
      JOIN shops s ON c.shop_id = s.id
      JOIN users u ON c.seller_id = u.id
      WHERE c.id = ?
      AND (c.is_deleted IS NULL OR c.is_deleted = false)`,
      [user_id, coupon_id]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error in getAvailableForPurchase service:', error);
    throw error;
  }
};

export const getAvailableForPurchaseByShop = async (shop_id, user_id) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.discount,
        c.is_discount_percentage,
        c.price,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.description,
        s.id as shop_id,
        s.name as shop_name,
        s.name_color as shop_name_color,
        s.bg_color as shop_bg_color,
        c.seller_id as seller_id,
        u.username as seller_username,
        u.profile_picture as seller_profile_picture,
        u.reputation as seller_reputation,
        u.join_date as seller_join_date,
        c.is_active,
        c.created_at as listing_date,
        EXISTS (
          SELECT 1 FROM saves sv WHERE sv.coupon_id = c.id AND sv.user_id = ?
        ) AS is_saved
      FROM coupons c
      JOIN shops s ON c.shop_id = s.id
      JOIN users u ON c.seller_id = u.id
      WHERE c.is_active = true 
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND (c.is_deleted IS NULL OR c.is_deleted = false)
        AND c.shop_id = ?`,
      [user_id, shop_id]
    );
    return rows;
  } catch (error) {
    console.error('Error in getAvailableForPurchaseByShop service:', error);
    throw error;
  }
};

export const getAvailableForPurchaseByCategory = async (category_id, user_id) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.discount,
        c.is_discount_percentage,
        c.price,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.description,
        s.id as shop_id,
        s.name as shop_name,
        s.name_color as shop_name_color,
        s.bg_color as shop_bg_color,
        c.seller_id as seller_id,
        u.username as seller_username,
        u.profile_picture as seller_profile_picture,
        u.reputation as seller_reputation,
        u.join_date as seller_join_date,
        c.is_active,
        c.created_at as listing_date,
        EXISTS (
          SELECT 1 FROM saves sv WHERE sv.coupon_id = c.id AND sv.user_id = ?
        ) AS is_saved
      FROM coupons c
      JOIN shops s ON c.shop_id = s.id
      JOIN users u ON c.seller_id = u.id
      JOIN shops_categories sc ON s.id = sc.shop_id
      WHERE c.is_active = true 
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND (c.is_deleted IS NULL OR c.is_deleted = false)
        AND sc.category_id = ?`,
      [user_id, category_id]
    );
    return rows;
  } catch (error) {
    console.error('Error in getAvailableForPurchaseByCategory service:', error);
    throw error;
  }
};

/** Saved coupons
 */

export const getSavedList = async (user_id, sort, type, min_price, max_price, min_rep, shop_id, category_id, limit = 20, cursor = null) => {
  try {
    
    limit = Math.min(parseInt(limit, 10) || 20, 100);

    const orderByClause = _orderByOptions[sort] || 'c.created_at DESC';
    const whereClauses = [];

    if (type !== undefined && type != 'any') {
      whereClauses.push(_whereOptions('type', type));
    }
    if (min_price !== undefined) {
      whereClauses.push(_whereOptions('min_price', min_price));
    }
    if (max_price !== undefined) {
      whereClauses.push(_whereOptions('max_price', max_price));
    }
    if (min_rep !== undefined && min_rep > 0) {
      whereClauses.push(_whereOptions('min_rep', min_rep));
    }
    if (shop_id !== undefined) {
      whereClauses.push(_whereOptions('shop_id', shop_id));
    }
    if (category_id !== undefined) {
      whereClauses.push(_whereOptions('category_id', category_id));
    }
    console.log('Where clauses for getSavedList:', whereClauses);
    

    const params = [user_id, user_id];
    console.log('Params for getSavedList:', params);

    const cursorCondition = _buildCursorCondition(sort, cursor);

    const [rows] = await pool.query(
      `SELECT
        c.id,
        c.discount,
        c.is_discount_percentage,
        c.price,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.description,
        s.id as shop_id,
        s.name as shop_name,
        s.name_color as shop_name_color,
        s.bg_color as shop_bg_color,
        c.seller_id as seller_id,
        u.username as seller_username,
        u.profile_picture as seller_profile_picture,
        u.reputation as seller_reputation,
        u.join_date as seller_join_date,
        c.is_active,
        c.created_at as listing_date,
        EXISTS (
          SELECT 1 FROM saves sv WHERE sv.coupon_id = c.id AND sv.user_id = ?
        ) AS is_saved
      FROM coupons c
      JOIN shops s ON c.shop_id = s.id
      JOIN users u ON c.seller_id = u.id
      JOIN saves sc ON c.id = sc.coupon_id
      WHERE c.is_active = true 
        AND sc.user_id = ?
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND (c.is_deleted IS NULL OR c.is_deleted = false)
        ${whereClauses.length ? 'AND ' + whereClauses.join(' AND ') : ''}
        ${cursorCondition.sql}
      ORDER BY ${orderByClause}, c.id DESC
      LIMIT ?`,
      [ ...params, ...cursorCondition.params, limit + 1 ]
    );

    let nextCursor = null;
    let hasNextPage = rows.length > limit;

    if (hasNextPage) {
      const last = rows.pop();

      nextCursor = {
        value:
          sort?.startsWith('price')
            ? last.price
            : last.listing_date,
        id: last.id,
      };
    }

    return {
      data: rows,
      nextCursor,
    };

  } catch (error) {
    console.error('Error in getSavedList service:', error);
    throw error;
  }
}

export const addCouponToSaved = async (coupon_id, user_id) => {
  try {
    const [rows] = await pool.query(
      'SELECT 1 FROM saves WHERE coupon_id = ? AND user_id = ?',
      [coupon_id, user_id]
    );

    if (rows.length > 0) {
      return { alreadySaved: true };
    }

    await pool.query(
      'INSERT INTO saves (coupon_id, user_id) VALUES (?, ?)',
      [coupon_id, user_id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error in addCouponToSaved service:', error);
    throw error;
  }
};

export const removeCouponFromSaved = async (coupon_id, user_id) => {
  try {

    const [rows] = await pool.query(
      'SELECT 1 FROM saves WHERE coupon_id = ? AND user_id = ?',
      [coupon_id, user_id]
    );
    console.log('Found saved entry rows:', rows);

    if (rows.length === 0) {

      return { notSaved: true };
    }


    await pool.query(
      'DELETE FROM saves WHERE coupon_id = ? AND user_id = ?',
      [coupon_id, user_id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error in removeCouponFromSaved service:', error);
    throw error;
  }
};




/**
 * Deactivate all coupons with expiry date today or earlier (automatic daily task)
 */
export const deactivateExpiredCoupons = async () => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const [result] = await pool.query(
      `UPDATE coupons 
       SET is_active = 0 
       WHERE DATE(expiry_date) <= ? AND is_deleted = 0`,
      [today]
    );
    
    console.log(`✅ Deactivated ${result.affectedRows} expired coupons`);
    return { success: true, deactivatedCount: result.affectedRows };
  } catch (error) {
    console.error('Error in deactivateExpiredCoupons service:', error);
    throw error;
  }
};




export const deactivateCoupon = async (coupon_id, is_multiple_use) => {
  try {

    const [rows] = await pool.query(
      'SELECT is_multiple_use FROM coupons WHERE id = ?',
      [coupon_id]
    );

    if (rows.length === 0) {
      throw new Error('Coupon not found');
    }
    const isMultiUse = rows[0].is_multiple_use == 1;

    console.log('Deactivating coupon id:', coupon_id, 'is_multiple_use:', isMultiUse);
    if (!isMultiUse) {
      await pool.query(
        'UPDATE coupons SET is_active = 0 WHERE id = ?',
        [coupon_id]
      );
      console.log(`✅ Deactivated coupon id ${coupon_id} (is_multiple_use: ${isMultiUse})`);
    } else {
      console.log('Coupon is multiple use, skipping deactivation of is_active');
    }

    return { success: true, deactivated: !isMultiUse };
  } catch (error) {
    console.error('Error in deactivateCoupon service:', error);
    throw error;
  }
};

export const deleteCoupon = async (coupon_id) => {
  try {
    await pool.query(
      'UPDATE coupons SET is_deleted = 1, is_active = 0 WHERE id = ?',
      [coupon_id]
    );
    return { success: true };
  } catch (error) {
    console.error('Error in deleteCoupon service:', error);
    throw error;
  }
};

/**
 * Temporarily block a coupon (set is_active to 0) during payment process
 * This prevents other users from attempting to buy while payment is processing
 */
export const blockCouponTemporarily = async (coupon_id) => {
  try {
    await pool.query(
      'UPDATE coupons SET is_blocked_for_payment = 1 WHERE id = ?',
      [coupon_id]
    );
    return { success: true };
  } catch (error) {
    console.error('Error in blockCouponTemporarily service:', error);
    throw error;
  }
};

/**
 * Unblock a listing if payment fails (restore is_active to 1)
 */
export const unblockCouponAfterFailure = async (coupon_id) => {
  try {
    await pool.query(
      'UPDATE coupons SET is_blocked_for_payment = 0 WHERE id = ?',
      [coupon_id]
    );
    return { success: true };
  } catch (error) {
    console.error('Error in unblockCouponAfterFailure service:', error);
    throw error;
  }
};

/**
 * Check if a coupon is available for purchase
 * @param {number} coupon_id - The coupon ID to check
 * @returns {Promise<boolean>} True if coupon is available, false otherwise
 */
export const isAvailable = async (coupon_id) => {
  try {
    const [rows] = await pool.query(
      `SELECT 1 FROM coupons c
       WHERE c.id = ?
         AND c.is_active = 1
         AND (c.is_deleted IS NULL OR c.is_deleted = 0)
         AND (c.is_blocked_for_payment IS NULL OR c.is_blocked_for_payment = 0)
         AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
         AND (c.is_multiple_use = 1 OR NOT EXISTS (
           SELECT 1 FROM transactions WHERE coupon_id = c.id
         ))
       LIMIT 1`,
      [coupon_id]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Error in isAvailable service:', error);
    throw error;
  }
};


/**
 * Get personalized coupon feed with cursor-based pagination
 * Filters out already clicked and purchased coupons
 * 
 * @param {string} userId - The user ID to get feed for
 * @param {number} limit - Number of items per page (default: 20)
 * @param {string} [cursor] - Base64 encoded cursor for pagination
 * @returns {Promise<Object>} Object with items, nextCursor, and hasMore
 */
export const getCouponFeed = async (userId, limit = 20, cursor = undefined) => {
  try {
    let offset = 0;
    
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        offset = decoded.offset || 0;
      } catch (error) {
        console.error('Error decoding cursor:', error);
      }
    }

    // Use precomputed recommendations from user_recommendations table
    let recommendations = await getTopRecommendations(userId, limit, offset);

    // Get clicked coupons (to boost their score)
    const [clickedCoupons] = await pool.query(
      'SELECT coupon_id, COUNT(*) as click_count FROM coupon_clicks WHERE user_id = ? GROUP BY coupon_id',
      [userId]
    );
    
    // Only exclude purchased coupons (not clicked ones!)
    const [seenTransactions] = await pool.query(
      'SELECT coupon_id FROM transactions WHERE buyer_id = ?',
      [userId]
    );

    const purchasedIds = new Set(seenTransactions.map(t => t.coupon_id));
    const clickedMap = new Map(clickedCoupons.map(c => [c.coupon_id, c.click_count]));

    // Filter out purchased, boost clicked
    recommendations = recommendations
      .filter(r => !purchasedIds.has(r.coupon_id))
      .map(r => {
        const clickCount = clickedMap.get(r.coupon_id) || 0;
        // Boost score by 0.1 per click (max 0.3 boost)
        const clickBoost = Math.min(0.3, clickCount * 0.1);
        return {
          ...r,
          score: (parseFloat(r.score) + clickBoost).toFixed(4),
          was_clicked: clickCount > 0
        };
      })
      .sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

    const nextCursor = Buffer.from(JSON.stringify({
      offset: offset + recommendations.length
    })).toString('base64');

    const hasMore = recommendations.length === limit;

    return {
      items: recommendations,
      nextCursor,
      hasMore
    };
  } catch (error) {
    console.error('Error in getCouponFeed service:', error);
    throw error;
  }
};

/**
 * Helper: Fetch top-N recommendations with precomputed scores
 * 
 * @param {string} userId - The user ID
 * @param {number} limit - Limit of results
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} Array of coupon recommendations with scores
 */

        // c.id,
        // c.discount,
        // c.is_discount_percentage,
        // c.price,
        // c.has_limits,
        // c.works_online,
        // c.works_in_store,
        // c.expiry_date,
        // c.description,
        // s.id as shop_id,
        // s.name as shop_name,
        // s.name_color as shop_name_color,
        // s.bg_color as shop_bg_color,
        // c.seller_id as seller_id,
        // u.username as seller_username,
        // u.reputation as seller_reputation,
        // u.join_date as seller_join_date,
        // c.is_active,
        // c.created_at as listing_date,
const getTopRecommendations = async (userId, limit, offset) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        c.id,
        c.discount,
        c.is_discount_percentage,
        c.price,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.description,
        s.id as shop_id,
        s.name as shop_name,
        s.name_color as shop_name_color,
        s.bg_color as shop_bg_color,
        c.seller_id as seller_id,
        u.username as seller_username,
        u.profile_picture as seller_profile_picture,
        u.reputation as seller_reputation,
        u.join_date as seller_join_date,
        c.is_active,
        c.created_at as listing_date,
        GROUP_CONCAT(cat.name SEPARATOR ',') as categories,
        COALESCE(rr.score, 0) as score
      FROM coupons c
      LEFT JOIN user_recommendations rr ON c.id = rr.coupon_id AND rr.user_id = ? 
      JOIN users u ON c.seller_id = u.id
      JOIN shops s ON c. shop_id = s.id
      LEFT JOIN shops_categories sc ON s.id = sc.shop_id
      LEFT JOIN categories cat ON sc.category_id = cat.id
      WHERE c.is_active = 1 
        AND (c.is_deleted IS NULL OR c.is_deleted = 0)
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND (c.is_multiple_use = 1 OR NOT EXISTS (
          SELECT 1 FROM transactions WHERE coupon_id = c.id
        ))
      GROUP BY c.id, c.shop_id, c. price, c.discount, c. is_discount_percentage, 
               c.is_multiple_use, c.works_online, c.code, c.description, c.expiry_date, 
               c.created_at, u.id, u.username, u.reputation, s.id, s.name, s.name_color, 
               s. bg_color, rr.score
      ORDER BY COALESCE(rr.score, 0) DESC
      LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    return rows;
  } catch (error) {
    console.error('Error in getTopRecommendations service:', error);
    throw error;
  }
};

export const getSoldCouponsAmount = async (seller_id) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as sold_count
       FROM transactions t
       JOIN coupons c ON t.coupon_id = c.id
       WHERE c.seller_id = ?`,
      [seller_id]
    );
    return rows[0]?.sold_count || 0;
  } catch (error) {
    console.error('Error in getSoldCouponsAmount service:', error);
    throw error;
  }
};

export const getPurchasedCouponsAmount = async (buyer_id) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as purchased_count
       FROM transactions t
       WHERE t.buyer_id = ?`,
      [buyer_id]
    );
    return rows[0]?.purchased_count || 0;
  } catch (error) {
    console.error('Error in getPurchasedCouponsAmount service:', error);
    throw error;
  }
};