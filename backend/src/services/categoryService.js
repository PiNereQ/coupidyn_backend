import pool from '../config/db.js';

export const getFavoriteCategoriesForUser = async (user_id) => {
  try {
    console.log('Fetching favorite categories for user_id:', user_id);
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.name_color,
        c.bg_color
      FROM favorite_categories fc
      JOIN categories c ON fc.category_id = c.id
      WHERE fc.user_id = ? AND c.is_deleted = 0
      ORDER BY c.name;
    `, [ user_id ]);
    return rows;
  } catch (error) {
    console.error('Error in getFavoriteCategoriesForUser service:', error);
    throw error;
  }
};

export const addCategoryToFavorites = async (category_id, user_id) => {
  try {
    const [rows] = await pool.query(
      'SELECT 1 FROM favorite_categories WHERE category_id = ? AND user_id = ?',
      [category_id, user_id]
    );

    if (rows.length > 0) {
      return { alreadySaved: true };
    }

    await pool.query(
      'INSERT INTO favorite_categories (category_id, user_id) VALUES (?, ?)',
      [category_id, user_id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error in addCategoryToFavorites service:', error);
    throw error;
  }
};

export const removeCategoryFromFavorites = async (category_id, user_id) => {
  try {
    const [rows] = await pool.query(
      'SELECT 1 FROM favorite_categories WHERE category_id = ? AND user_id = ?',
      [category_id, user_id]
    );

    if (rows.length === 0) {
      return { notSaved: true };
    }

    await pool.query(
      'DELETE FROM favorite_categories WHERE category_id = ? AND user_id = ?',
      [category_id, user_id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error in removeCategoryFromFavorites service:', error);
    throw error;
  }
};

/**
 * Calculate the user's #1 favourite category from their saved favourites
 * Based on clicks + purchases count
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} The top category with coupons, or null if none
 */
export const getCalculatedFavouriteCategory = async (userId) => {
  try {
    // Get #1 favourite category from user's favourites list, ranked by clicks + purchases
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.name_color,
        c.bg_color,
        COALESCE(interaction_counts.total_interactions, 0) as interaction_count
      FROM favorite_categories fc
      JOIN categories c ON fc.category_id = c.id
      LEFT JOIN (
        SELECT 
          sc.category_id,
          COUNT(DISTINCT cc.id) + COUNT(DISTINCT t.id) * 5 as total_interactions
        FROM shops_categories sc
        JOIN coupons cp ON cp.shop_id = sc.shop_id
        LEFT JOIN coupon_clicks cc ON cc.coupon_id = cp.id AND cc.user_id = ?
        LEFT JOIN transactions t ON t.coupon_id = cp.id AND t.buyer_id = ?
        WHERE cp.is_active = TRUE AND (cp.is_deleted IS NULL OR cp.is_deleted = FALSE)
        GROUP BY sc.category_id
      ) interaction_counts ON interaction_counts.category_id = c.id
      WHERE fc.user_id = ? AND c.is_deleted = 0
      ORDER BY interaction_counts.total_interactions DESC, c.name
      LIMIT 1
    `, [userId, userId, userId]);

    if (rows.length === 0) return null;

    const category = rows[0];
    const coupons = await getTopCouponsFromCategory(category.id, userId, 10);

    return {
      category: {
        id: category.id,
        name: category.name,
        name_color: category.name_color,
        bg_color: category.bg_color
      },
      coupons
    };
  } catch (error) {
    console.error('Error in getCalculatedFavouriteCategory service:', error);
    throw error;
  }
};

/**
 * Get top coupons from a specific category
 * 
 * @param {number} categoryId - Category ID
 * @param {string} userId - User ID (to exclude own coupons and check saves)
 * @param {number} limit - Max coupons to return
 * @returns {Promise<Array>} List of coupons
 */
export const getTopCouponsFromCategory = async (categoryId, userId, limit = 10) => {
  try {
    const [rows] = await pool.query(`
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
      WHERE c.is_active = TRUE
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)
        AND sc.category_id = ?
        AND c.seller_id != ?
      ORDER BY u.reputation DESC, c.created_at DESC
      LIMIT ?
    `, [userId, categoryId, userId, limit]);

    return rows;
  } catch (error) {
    console.error('Error in getTopCouponsFromCategory service:', error);
    throw error;
  }
};

/**
 * Get top coupons from ALL user's favourite categories
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Max coupons to return
 * @returns {Promise<Array>} List of coupons from all favourite categories
 */
export const getTopCouponsFromFavouriteCategories = async (userId, limit = 10) => {
  try {
    const [rows] = await pool.query(`
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
      JOIN favorite_categories fc ON fc.category_id = sc.category_id AND fc.user_id = ?
      WHERE c.is_active = TRUE
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)
        AND c.seller_id != ?
      GROUP BY c.id
      ORDER BY u.reputation DESC, c.created_at DESC
      LIMIT ?
    `, [userId, userId, userId, limit]);

    return rows;
  } catch (error) {
    console.error('Error in getTopCouponsFromFavouriteCategories service:', error);
    throw error;
  }
};

export const searchCategoriesByName = async (searchTerm) => {
  try {
    const term = searchTerm?.trim();

    // for short search terms
    if (term.length < 3) {
      const [rows] = await pool.query(
        `
        SELECT
          id,
          name,
          name_color,
          bg_color
        FROM categories
        WHERE
          is_deleted = FALSE
          AND name LIKE CONCAT('%', ?, '%')
        ORDER BY name
        LIMIT 5`,
        [ term ]
      );

      return rows;
    }

    // main query
    const booleanQuery = term.split(/\s+/).map(w => `${w}*`).join(' ');
    
    const [rows] = await pool.query(`
      SELECT
        id,
        name,
        name_color,
        bg_color,
        (
          MATCH(name) AGAINST (? IN BOOLEAN MODE) * 10
          +
          (LOWER(name) = LOWER(?)) * 100
          +
          (LOWER(name) LIKE CONCAT(LOWER(?), '%')) * 50
        ) AS rank
      FROM categories
      WHERE
        is_deleted = FALSE
        AND MATCH(name) AGAINST (? IN BOOLEAN MODE)
      ORDER BY rank DESC, name
      LIMIT 5`,
      [
        booleanQuery, // relevance
        term,         // exact match boost
        term,         // starts-with boost
        booleanQuery  // WHERE MATCH
      ]);

      // fallback
      if (rows.length === 0) {
        const [fallback] = await pool.query(
          `
          SELECT
            id,
            name,
            name_color,
            bg_color
          FROM categories
          WHERE
            is_deleted = FALSE
            AND name LIKE CONCAT('%', ?, '%')
          ORDER BY name
          LIMIT 5
          `,
          [ term]
        );

        return fallback;
      }
    return rows;
  } catch (error) {
    console.error('Error in searchCategoriesByName service:', error);
    throw error;
  }
};
