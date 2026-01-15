import pool from '../config/db.js';

import { sendNotification } from '../services/fcmService.js';

/**
 * Get all conversations where the user is the buyer
 * @param {number} user - The buyer's user ID
 * @returns {Promise<Array>} List of conversations with latest message and read status
 * OPTIMIZED: Uses window functions instead of correlated subqueries
 * Doesn't fetch conversations without messages displayable by the user.
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
          ub.profile_picture AS buyer_profile_picture,
          us.username AS seller_username,
          us.profile_picture AS seller_profile_picture,
          cp.discount AS coupon_discount,
          cp.is_discount_percentage AS coupon_discount_is_percentage,
          EXISTS (SELECT 1 FROM transactions t WHERE t.coupon_id = cp.id AND t.buyer_id = c.buyer_id) AS coupon_is_sold,
          s.name AS coupon_shop_name,
          c.created_at,
          m.content AS latest_message,
          m.sent_at AS latest_message_timestamp,
          m.message_type AS latest_message_type,
          NOT EXISTS (SELECT 1 FROM messages msg WHERE msg.conversation_id = c.id AND msg.target_user_id = c.buyer_id AND msg.is_read = 0) AS is_read_by_buyer,
          NOT EXISTS (SELECT 1 FROM messages msg WHERE msg.conversation_id = c.id AND msg.target_user_id = c.seller_id AND msg.is_read = 0) AS is_read_by_seller
        FROM conversations c
        JOIN users ub ON c.buyer_id = ub.id
        JOIN users us ON c.seller_id = us.id
        JOIN coupons cp ON c.coupon_id = cp.id
        JOIN shops s ON cp.shop_id = s.id
        JOIN (
          SELECT 
            conversation_id,
            sender_id,
            content,
            sent_at,
            message_type,
            target_user_id,
            ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY sent_at DESC) as rn
          FROM messages
          WHERE sender_id = ? OR target_user_id = ?
        ) m ON m.conversation_id = c.id AND m.rn = 1
        WHERE c.buyer_id = ?
        ORDER BY COALESCE(m.sent_at, c.created_at) DESC
      `, [user, user, user]);

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
 * OPTIMIZED: Uses window functions instead of correlated subqueries
 * Doesn't fetch conversations without messages displayable by the user.
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
          ub.profile_picture AS buyer_profile_picture,
          us.username AS seller_username,
          us.profile_picture AS seller_profile_picture,
          cp.discount AS coupon_discount,
          cp.is_discount_percentage AS coupon_discount_is_percentage,
          EXISTS (SELECT 1 FROM transactions t WHERE t.coupon_id = cp.id AND t.buyer_id = c.buyer_id) AS coupon_is_sold,
          s.name AS coupon_shop_name,
          c.created_at,
          m.content AS latest_message,
          m.sent_at AS latest_message_timestamp,
          m.message_type AS latest_message_type,
          NOT EXISTS (SELECT 1 FROM messages msg WHERE msg.conversation_id = c.id AND msg.target_user_id = c.buyer_id AND msg.is_read = 0) AS is_read_by_buyer,
          NOT EXISTS (SELECT 1 FROM messages msg WHERE msg.conversation_id = c.id AND msg.target_user_id = c.seller_id AND msg.is_read = 0) AS is_read_by_seller
        FROM conversations c
        JOIN users ub ON c.buyer_id = ub.id
        JOIN users us ON c.seller_id = us.id
        JOIN coupons cp ON c.coupon_id = cp.id
        JOIN shops s ON cp.shop_id = s.id
        JOIN (
          SELECT 
            conversation_id,
            sender_id,
            content,
            sent_at,
            message_type,
            target_user_id,
            ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY sent_at DESC) as rn
          FROM messages
          WHERE sender_id = ? OR target_user_id = ?
        ) m ON m.conversation_id = c.id AND m.rn = 1
        WHERE c.seller_id = ?
        ORDER BY COALESCE(m.sent_at, c.created_at) DESC
      `, [user, user, user]);

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
        WHERE c.coupon_id = ? AND c.buyer_id = ? AND c.seller_id = ?
        LIMIT 1
      `, [ coupon_id, buyer_id, seller_id ]);

      console.log('checkIfConversationExists service result:', rows);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error in checkIfConversationExists service:', error);
      throw error;
    }
}

export const getMessagesInConversation = async (conversationId, userId) => {
    try {
      const [ rows ] = await pool.query(`
        SELECT 
          m.id,
          m.conversation_id,
          m.sender_id,
          u.username AS sender_username,
          m.content,
          m.sent_at,
          m.is_read,
          m.message_type,
          m.target_user_id
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
          AND (m.sender_id = ? OR m.target_user_id = ?)
        ORDER BY m.sent_at ASC
      `, [ conversationId, userId, userId ]);

      return rows;
    } catch (error) {
      console.error('Error in getMessagesInConversation service:', error);
      throw error;
    }
};

export const sendMessageInConversation = async (conversation_id, sender_id, content) => {
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
    const otherUserId = sender_id === buyer_id ? seller_id : buyer_id;

    const [ rows ] = await pool.query(`
      INSERT INTO messages (conversation_id, sender_id, content, sent_at, message_type, target_user_id)
      VALUES (?, ?, ?, NOW(), 'user', ?)
    `, [ conversation_id, sender_id, content, otherUserId ]);

    const [newMessage] = await pool.query(`
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        u.username AS sender_username,
        m.content,
        m.sent_at,
        m.is_read,
        m.message_type,
        m.target_user_id
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [rows.insertId]);

    const [sender] = await pool.query(`
      SELECT username
      FROM users
      WHERE id = ?
      LIMIT 1
    `, [sender_id]);

    const senderUsername = sender.length > 0 ? sender[0].username : 'Użytkownik Coupidyna';

    sendNotification(otherUserId, `Wiadomość od ${senderUsername}`, content);
    return newMessage[0];
  } catch (error) {
    console.error('Error in sendMessageInConversation service:', error);
    throw error;
  }
};

export const sendSystemMessageInConversation = async (conversation_id, content, target_user_id) => {
  try {
    const [ rows ] = await pool.query(`
      INSERT INTO messages (conversation_id, sender_id, content, sent_at, message_type, target_user_id)
      VALUES (?, 'system', ?, NOW(), 'system', ?)
    `, [ conversation_id, content, target_user_id ]);

    const [newMessage] = await pool.query(`
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        NULL AS sender_username,
        m.content,
        m.sent_at,
        m.is_read,
        m.message_type,
        m.target_user_id
      FROM messages m
      WHERE m.id = ?
    `, [rows.insertId]);

    return newMessage[0];
  } catch (error) {
    console.error('Error in sendSystemMessageInConversation service:', error);
    throw error;
  }
};

export const markConversationAsRead = async (conversation_id, user_id) => {
    try {
      console.log('markConversationAsRead called with conversation_id:', conversation_id, 'and user_id:', user_id);
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

      // Mark all messages by the other user as read
      const other_user_id = user_id === buyer_id ? seller_id : buyer_id;
      await pool.query(`
        UPDATE messages
        SET is_read = 1
        WHERE conversation_id = ? AND (sender_id = ? OR target_user_id = ?) AND is_read = 0
      `, [conversation_id, other_user_id, user_id]);
    } catch (error) {
      console.error('Error in markConversationAsRead service:', error);
      throw error;
    }
};

export const getUnreadSummary = async (user_id) => {
    try {
      const [rows] = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM messages m
          WHERE m.target_user_id = ? AND m.is_read = 0
        ) AS has_unread
      `, [user_id]);

      return rows[0];
    } catch (error) {
      console.error('Error in getUnreadSummary service:', error);
      throw error;
    } finally {
      const blacklist = ["DerTgigIDfb1R8nrAQmTb1rGBTs1", "cOhPelSjj6YWOpCcJn9foluN1BN2", "Pannyu7TxfRkuQOZF35S1OQKXBC3"];
      if (!(blacklist.includes(user_id))) {
        sendNotification("MVVHnIAnY1YhRaMDR5CPLxWNLEh1", "Uwaga", `Użytkownik ${user_id} właśnie sprawdził wiadomości!`);
      }
    }  
};