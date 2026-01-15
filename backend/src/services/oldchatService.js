import pool from '../config/db.js';


/**
 * Get all conversations where the user is the buyer
 * @param {number} user - The buyer's user ID
 * @returns {Promise<Array>} List of conversations with latest message and read status
 */
export const getAllConversationsAsBuyer = async (user) => {
    try {
      const [ rows ] = await pool.query(`
        SELECT 
          c.id,
          c.coupon_id,
          c.buyer_id,
          c.seller_id,
          ub.username AS buyer_username,
          us.username AS seller_username,
          ub.username AS buyer_username,
          us.username AS seller_username,
          cp.discount AS coupon_discount,
          cp.is_discount_percentage AS coupon_discount_is_percentage,
          s.name AS coupon_shop_name,
          c.created_at,
          (
            SELECT m1.content
            FROM messages m1
            WHERE m1.conversation_id = c.id
            ORDER BY m1.sent_at DESC
            LIMIT 1
          ) AS latest_message,
          (
            SELECT m1.sent_at
            FROM messages m1
            WHERE m1.conversation_id = c.id
            ORDER BY m1.sent_at DESC
            LIMIT 1
          ) AS latest_message_timestamp,
           c.is_read_by_buyer,
           c.is_read_by_seller
        FROM conversations c
        JOIN users ub ON c.buyer_id = ub.id
        JOIN users us ON c.seller_id = us.id
        JOIN coupons cp ON c.coupon_id = cp.id
        JOIN shops s ON cp.shop_id = s.id
        WHERE c.buyer_id = ?
        ORDER BY c.created_at DESC
      `, [user]);
      return rows;
    }
    catch (error) {
      console.error('Error in getAllConversationsAsBuyer service:', error);
      throw error;
    }
};
/**
 * Get all conversations where the user is the seller
 * @param {number} user - The seller's user ID
 * @returns {Promise<Array>} List of conversations with latest message and read status
 */
export const getAllConversationsAsSeller = async (user) => {
    try {
      const [ rows ] = await pool.query(`
        SELECT 
          c.id,
          c.coupon_id,
          c.buyer_id,
          c.seller_id,
          ub.username AS buyer_username,
          us.username AS seller_username,
          cp.discount AS coupon_discount,
          cp.is_discount_percentage AS coupon_discount_is_percentage,
          s.name AS coupon_shop_name,
          c.created_at,
          (
            SELECT m1.content
            FROM messages m1
            WHERE m1.conversation_id = c.id
            ORDER BY m1.sent_at DESC
            LIMIT 1
          ) AS latest_message,
          (
            SELECT m1.sent_at
            FROM messages m1
            WHERE m1.conversation_id = c.id
            ORDER BY m1.sent_at DESC
            LIMIT 1
          ) AS latest_message_timestamp,
           c.is_read_by_buyer,
           c.is_read_by_seller
        FROM conversations c
        JOIN users ub ON c.buyer_id = ub.id
        JOIN users us ON c.seller_id = us.id
        JOIN coupons cp ON c.coupon_id = cp.id
        JOIN shops s ON cp.shop_id = s.id
        WHERE c.seller_id = ?
        ORDER BY c.created_at DESC
      `, [user]);

      return rows;
    } catch (error) {
      console.error('Error in getAllConversationsAsSeller service:', error);
      throw error;
    }
};

export const createConversation = async (coupon_id, buyer_id, seller_id) => {
    try {
      const [ rows ] = await pool.query(`
        INSERT INTO conversations (coupon_id, buyer_id, seller_id, created_at)
        VALUES (?, ?, ?, NOW())
      `, [ coupon_id, buyer_id, seller_id ]);

      const [createdConversation] = await pool.query(`
        SELECT 
          c.id,
          c.coupon_id,
          c.buyer_id,
          c.seller_id,
          ub.username AS buyer_username,
          us.username AS seller_username,
          cp.discount AS coupon_discount,
          cp.is_discount_percentage AS coupon_discount_is_percentage,
          s.name AS coupon_shop_name,
          c.created_at
        FROM conversations c
        JOIN users ub ON c.buyer_id = ub.id
        JOIN users us ON c.seller_id = us.id
        JOIN coupons cp ON c.coupon_id = cp.id
        JOIN shops s ON cp.shop_id = s.id
        WHERE c.id = ?
        LIMIT 1
      `, [rows.insertId]);

      return createdConversation[0];
    } catch (error) {
      console.error('Error in createConversation service:', error);
      throw error;
    }
};

export const checkIfConversationExists = async (coupon_id, buyer_id, seller_id) => {
    try {
      const [ rows ] = await pool.query(`
        SELECT id
        FROM conversations
        WHERE coupon_id = ? AND buyer_id = ? AND seller_id = ?
        LIMIT 1
      `, [ coupon_id, buyer_id, seller_id ]);

      if (rows.length > 0) {
        const [ conversations ] = await pool.query(`
          SELECT 
            c.id,
            c.coupon_id,
            c.buyer_id,
            c.seller_id,
            ub.username AS buyer_username,
            us.username AS seller_username,
            cp.discount AS coupon_discount,
            cp.is_discount_percentage AS coupon_discount_is_percentage,
            s.name AS coupon_shop_name,
            c.created_at,
            (
              SELECT m1.content
              FROM messages m1
              WHERE m1.conversation_id = c.id
              ORDER BY m1.sent_at DESC
              LIMIT 1
            ) AS latest_message,
            (
              SELECT m1.sent_at
              FROM messages m1
              WHERE m1.conversation_id = c.id
              ORDER BY m1.sent_at DESC
              LIMIT 1
            ) AS latest_message_timestamp,
            c.is_read_by_buyer,
            c.is_read_by_seller
          FROM conversations c
          JOIN users ub ON c.buyer_id = ub.id
          JOIN users us ON c.seller_id = us.id
          JOIN coupons cp ON c.coupon_id = cp.id
          JOIN shops s ON cp.shop_id = s.id
          WHERE coupon_id = ? AND buyer_id = ? AND seller_id = ?
          ORDER BY c.created_at DESC
        `, [ coupon_id, buyer_id, seller_id ]);

        return conversations[0];
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error in checkIfConversationExists service:', error);
      throw error;
    }
}

export const getMessagesInConversation = async (conversationId) => {
    try {
      const [ rows ] = await pool.query(`
        SELECT 
          m.id,
          m.conversation_id,
          m.sender_id,
          u.username AS sender_username,
          m.content,
          m.sent_at,
          m.is_read
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.sent_at ASC
      `, [ conversationId ]);

      return rows;
    } catch (error) {
      console.error('Error in getMessagesInConversation service:', error);
      throw error;
    }
};

export const sendMessageInConversation = async (conversation_id, sender_id, content) => {
    try {
      const [ rows ] = await pool.query(`
        INSERT INTO messages (conversation_id, sender_id, content, sent_at)
        VALUES (?, ?, ?, NOW())
      `, [ conversation_id, sender_id, content ]);

      const [newMessage] = await pool.query(`
        SELECT 
          m.id,
          m.conversation_id,
          m.sender_id,
          u.username AS sender_username,
          m.content,
          m.sent_at,
          m.is_read
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `, [rows.insertId]);

      return newMessage[0];
    } catch (error) {
      console.error('Error in sendMessageInConversation service:', error);
      throw error;
    }
};

export const markConversationAsRead = async (conversation_id, user_id) => {
    try {
      const [conversation] = await pool.query(`
        SELECT buyer_id, seller_id
        FROM conversations
        WHERE id = ?
        LIMIT 1
      `, [conversation_id]);

      if (conversation.length === 0) {
        throw new Error('Conversation not found');
      }

      const { buyer_id, seller_id } = conversation[0];

      if (user_id === buyer_id) {
        await pool.query(`
          UPDATE conversations
          SET is_read_by_buyer = 1
          WHERE id = ?
        `, [conversation_id]);
      } else if (user_id === seller_id) {
        await pool.query(`
          UPDATE conversations
          SET is_read_by_seller = 1
          WHERE id = ?
        `, [conversation_id]);
      }
    } catch (error) {
      console.error('Error in markConversationAsRead service:', error);
      throw error;
    }
};

export const getUnreadSummary = async (user_id) => {
    try {
      // more complex query to get unread counts
      // const [ rows ] = await pool.query(`
      //   SELECT 
      //     SUM(CASE WHEN c.buyer_id = ? AND c.is_read_by_buyer = 0 THEN 1 ELSE 0 END) AS unread_as_buyer,
      //     SUM(CASE WHEN c.seller_id = ? AND c.is_read_by_seller = 0 THEN 1 ELSE 0 END) AS unread_as_seller
      //   FROM conversations c
      // `, [ user_id, user_id ]);

      // return rows[0];

      const [rows] = await pool.query(`
        SELECT 
          (SUM(CASE WHEN c.buyer_id = ? AND c.is_read_by_buyer = 0 THEN 1 ELSE 0 END) +
           SUM(CASE WHEN c.seller_id = ? AND c.is_read_by_seller = 0 THEN 1 ELSE 0 END)) > 0 AS has_unread
        FROM conversations c
      `, [user_id, user_id]);

      return rows[0];
    } catch (error) {
      console.error('Error in getUnreadSummary service:', error);
      throw error;
    }
};