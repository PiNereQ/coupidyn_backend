import pool from '../config/db.js';

export const addRating = async (conversation_id, rated_user_id, rating_user_id, rated_user_is_seller, rating_stars, rating_value, rating_comment) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Find transaction_id from conversation_id
    const [transactionRows] = await connection.query(
      `SELECT t.id FROM transactions t 
       JOIN conversations c ON t.coupon_id = c.coupon_id AND t.buyer_id = c.buyer_id AND t.seller_id = c.seller_id 
       WHERE c.id = ?`,
      [conversation_id]
    );
    if (transactionRows.length === 0) {
      await connection.rollback();
      throw new Error('Transaction not found for the given conversation');
    }
    const transaction_id = transactionRows[0].id;

    // Check for existing rating
    const [existing] = await connection.query(
      `SELECT id FROM ratings WHERE transaction_id = ? AND rated_user_id = ? AND rating_user_id = ?`,
      [transaction_id, rated_user_id, rating_user_id]
    );
    if (existing.length > 0) {
      await connection.rollback();
      return { message: 'Rating already exists for this transaction and users.' };
    }

    // Insert the rating
    const [result] = await connection.query(
      `INSERT INTO ratings(
        transaction_id,
        rated_user_id,
        rating_user_id,
        rated_user_is_seller,
        rating_stars,
        rating_value,
        rating_comment
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ transaction_id,
        rated_user_id,
        rating_user_id,
        rated_user_is_seller,
        rating_stars,
        rating_value,
        rating_comment ]
    );

    // Calculate weighted mean for reputation
    // new: 5 most recent ratings, old: the rest
    const [recentRows] = await connection.query(
      `SELECT rating_value FROM ratings WHERE rated_user_id = ? ORDER BY id DESC LIMIT 5`,
      [rated_user_id]
    );
    const [oldRows] = await connection.query(
      `SELECT rating_value FROM ratings WHERE rated_user_id = ? ORDER BY id DESC LIMIT 100000 OFFSET 5`,
      [rated_user_id]
    );
    const sum_new = recentRows.reduce((sum, r) => sum + r.rating_value, 0);
    const amount_new = recentRows.length;
    const sum_old = oldRows.reduce((sum, r) => sum + r.rating_value, 0);
    const amount_old = oldRows.length;
    let reputation = null;
    if (amount_new + amount_old > 3) {
      reputation = Math.round((sum_new * 2 + sum_old * 1) / (amount_new * 2 + amount_old * 1));
    }
    await connection.query(
      `UPDATE users
      SET reputation = ?
      WHERE id = ?`,
      [reputation, rated_user_id]
    );

    const rating_id = result.insertId;

    const [newRating] = await connection.query(
      `SELECT * FROM ratings WHERE id = ?`,
      [rating_id]
    );

    await connection.commit();
    return newRating[0];
  } catch (error) {
    console.error('Error in addRating service:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export const getRatingsForUser = async (user_id) => {
  const connection = await pool.getConnection();

  try {
    const [ratings] = await connection.query(
      `SELECT * FROM ratings WHERE rated_user_id = ? ORDER BY id DESC`,
      [user_id]
    );
    return ratings;
  } catch (error) {
    console.error('Error in getRatingsForUser service:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export const ratingExistsByBuyerForConversation = async (user_id, conversation_id) => {
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.query(
      `SELECT r.id
      FROM ratings r
      JOIN transactions t ON r.transaction_id = t.id
      JOIN conversations c ON t.coupon_id = c.coupon_id AND t.buyer_id = c.buyer_id
      WHERE r.rating_user_id = ? AND c.id = ?`,
      [user_id, conversation_id]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Error in ratingExistsByBuyerForConversation service:', error);
    throw error;
  } finally {
    connection.release();
  }
};

export const ratingExistsBySellerForConversation = async (user_id, conversation_id) => {
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.query(
      `SELECT r.id
      FROM ratings r
      JOIN transactions t ON r.transaction_id = t.id
      JOIN conversations c ON t.coupon_id = c.coupon_id AND t.seller_id = c.seller_id AND t.buyer_id = c.buyer_id
      WHERE r.rating_user_id = ? AND c.id = ?`,
      [user_id, conversation_id]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Error in ratingExistsByBuyerForConversation service:', error);
    throw error;
  } finally {
    connection.release();
  }
};