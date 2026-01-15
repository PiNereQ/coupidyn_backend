import pool from '../config/db.js';

/**
 * Retrieve all shops with their aggregated categories and location counts.
 *
 * @returns {Promise<Array<object>>} A list of shops and related metadata.
 */
export const getAllShops = async () => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.name_color,
        s.bg_color,
        s.is_deleted,
        s.created_at,
        s.updated_at,
        GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') AS categories,
        COUNT(DISTINCT sl.id) AS location_count
      FROM shops s
      LEFT JOIN shops_categories sc ON s.id = sc.shop_id
      LEFT JOIN categories c ON sc.category_id = c.id
      LEFT JOIN shop_locations sl ON s.id = sl.shop_id
      WHERE s.is_deleted = 0
      GROUP BY s.id, s.name, s.name_color, s.bg_color, s.is_deleted, s.created_at, s.updated_at
      ORDER BY s.id
    `);
    return rows;
  } catch (error) {
    console.error('Error in getAllShops service:', error);
    throw error;
  }
};

/**
 * Retrieve a single shop by its ID, including categories and locations.
 *
 * @param {number|string} id - Unique identifier of the shop.
 * @returns {Promise<object|null>} The shop with categories and locations, or null if not found.
 */
export const getShopById = async (id) => {
  try {
    // Get shop basic info with categories
    const [shopRows] = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.name_color,
        s.bg_color,
        s.is_deleted,
        s.created_at,
        s.updated_at,
        GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ', ') AS categories
      FROM shops s
      LEFT JOIN shops_categories sc ON s.id = sc.shop_id
      LEFT JOIN categories c ON sc.category_id = c.id
      WHERE s.id = ? AND s.is_deleted = 0
      GROUP BY s.id, s.name, s.name_color, s.bg_color, s.is_deleted, s.created_at, s.updated_at
    `, [id]);

    if (shopRows.length === 0) return null;

    const shop = shopRows[0];

    // Get shop locations
    const [locations] = await pool.query(`
      SELECT id, latitude, longitude, created_at
      FROM shop_locations
      WHERE shop_id = ? AND is_deleted = 0
      ORDER BY id
    `, [id]);

    shop.locations = locations;

    return shop;
  } catch (error) {
    console.error('Error in getShopById service:', error);
    throw error;
  }
};

/**
 * Retrieve shop locations that fall within the specified geographic bounds.
 *
 * @param {number} north - Northern latitude boundary.
 * @param {number} west - Western longitude boundary.
 * @param {number} south - Southern latitude boundary.
 * @param {number} east - Eastern longitude boundary.
 * @returns {Promise<Array<object>>} A list of shop location records within the bounds.
 */
export const getShopLocationsInBounds = async (north, west, south, east) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT
        sl.id,
        sl.shop_id,
        sl.latitude,
        sl.longitude,
        s.name AS shop_name
      FROM shop_locations sl
      JOIN shops s ON sl.shop_id = s.id
      JOIN coupons c ON s.id = c.shop_id
      WHERE sl.latitude <= ?
        AND sl.latitude >= ?
        AND sl.longitude >= ?
        AND sl.longitude <= ?
        AND sl.is_deleted = 0
        AND c.is_active = 1;
    `, [north, south, west, east]);

    return rows;
  } catch (error) {
    console.error('Error in getShopsInBounds service:', error);
    throw error;
  }
};


/**
 * Add a new shop.
 *
 * @param {{ name: string, name_color?: string, bg_color?: string }} params - Shop creation parameters.
 * @param {string} params.name - Display name of the shop.
 * @param {string} [params.name_color='#000000'] - Optional text color associated with the shop name.
 * @param {string} [params.bg_color='#FFFFFF'] - Optional background color associated with the shop.
 * @returns {Promise<object>} The newly created shop record.
 */
export const addShop = async ({ name, name_color = '#000000', bg_color = '#FFFFFF' }) => {
  try {
    const [result] = await pool.query(
      'INSERT INTO shops (name, name_color, bg_color) VALUES (?, ?, ?)',
      [name, name_color, bg_color]
    );

    const [newShop] = await pool.query(
      'SELECT * FROM shops WHERE id = ?',
      [result.insertId]
    );

    return newShop[0];
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Shop name already exists');
    }
    console.error('Error in addShop service:', error);
    throw error;
  }
};


export const getFavoriteShopsForUser = async (user_id) => {
  try {
    console.log('Fetching favorite shops for user_id:', user_id);
    const [rows] = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.name_color,
        s.bg_color
      FROM favorite_shops fs
      JOIN shops s ON fs.shop_id = s.id
      WHERE fs.user_id = ? AND s.is_deleted = 0
      ORDER BY s.name;
    `, [ user_id ]);
    return rows;
  } catch (error) {
    console.error('Error in getFavoriteShopsForUser service:', error);
    throw error;
  }
};

export const addShopToFavorites = async (shop_id, user_id) => {
  try {
    const [rows] = await pool.query(
      'SELECT 1 FROM favorite_shops WHERE shop_id = ? AND user_id = ?',
      [shop_id, user_id]
    );

    if (rows.length > 0) {
      return { alreadySaved: true };
    }

    await pool.query(
      'INSERT INTO favorite_shops (shop_id, user_id) VALUES (?, ?)',
      [shop_id, user_id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error in addShopToFavorites service:', error);
    throw error;
  }
};

export const removeShopFromFavorites = async (shop_id, user_id) => {
  try {
    const [rows] = await pool.query(
      'SELECT 1 FROM favorite_shops WHERE shop_id = ? AND user_id = ?',
      [shop_id, user_id]
    );

    if (rows.length === 0) {
      return { notSaved: true };
    }

    await pool.query(
      'DELETE FROM favorite_shops WHERE shop_id = ? AND user_id = ?',
      [shop_id, user_id]
    );

    return { success: true };
  } catch (error) {
    console.error('Error in removeShopFromFavorites service:', error);
    throw error;
  }
};

export const searchShopsByName = async (searchTerm) => {
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
        FROM shops
        WHERE
          is_deleted = FALSE
          AND name LIKE CONCAT('%', ?, '%')
        ORDER BY name
        LIMIT 20`,
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
      FROM shops
      WHERE
        is_deleted = FALSE
        AND MATCH(name) AGAINST (? IN BOOLEAN MODE)
      ORDER BY rank DESC, name
      LIMIT 20`,
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
          FROM shops
          WHERE
            is_deleted = FALSE
            AND name LIKE CONCAT('%', ?, '%')
          ORDER BY name
          LIMIT 20
          `,
          [ term]
        );

        return fallback;
      }
    return rows;
  } catch (error) {
    console.error('Error in searchShopsByName service:', error);
    throw error;
  }
};

export const getShopsByCategory = async (category_id) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.name_color,
        s.bg_color
      FROM shops s
      JOIN shops_categories sc ON s.id = sc.shop_id
      WHERE
        sc.category_id = ?
        AND s.is_deleted = FALSE
      ORDER BY s.name
    `, [ category_id ]);

    return rows;
  } catch (error) {
    console.error('Error in getShopsByCategory service:', error);
    throw error;
  }
};
/**
 * Calculate the user's #1 favourite shop from their saved favourites
 * Based on clicks + purchases count
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} The top shop with coupons, or null if none
 */
export const getCalculatedFavouriteShop = async (userId) => {
  try {
    // Get #1 favourite shop from user's favourites list, ranked by clicks + purchases
    const [rows] = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.name_color,
        s.bg_color,
        COALESCE(interaction_counts.total_interactions, 0) as interaction_count
      FROM favorite_shops fs
      JOIN shops s ON fs.shop_id = s.id
      LEFT JOIN (
        SELECT 
          cp.shop_id,
          COUNT(DISTINCT cc.id) + COUNT(DISTINCT t.id) * 5 as total_interactions
        FROM coupons cp
        LEFT JOIN coupon_clicks cc ON cc.coupon_id = cp.id AND cc.user_id = ?
        LEFT JOIN transactions t ON t.coupon_id = cp.id AND t.buyer_id = ?
        WHERE cp.is_active = TRUE AND (cp.is_deleted IS NULL OR cp.is_deleted = FALSE)
        GROUP BY cp.shop_id
      ) interaction_counts ON interaction_counts.shop_id = s.id
      WHERE fs.user_id = ? AND s.is_deleted = 0
      ORDER BY interaction_counts.total_interactions DESC, s.name
      LIMIT 1
    `, [userId, userId, userId]);

    if (rows.length === 0) return null;

    const shop = rows[0];
    const coupons = await getTopCouponsFromShop(shop.id, userId, 10);

    return {
      shop: {
        id: shop.id,
        name: shop.name,
        name_color: shop.name_color,
        bg_color: shop.bg_color
      },
      coupons
    };
  } catch (error) {
    console.error('Error in getCalculatedFavouriteShop service:', error);
    throw error;
  }
};

/**
 * Get top coupons from a specific shop
 * 
 * @param {number} shopId - Shop ID
 * @param {string} userId - User ID (to exclude own coupons and check saves)
 * @param {number} limit - Max coupons to return
 * @returns {Promise<Array>} List of coupons
 */
export const getTopCouponsFromShop = async (shopId, userId, limit = 10) => {
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
      WHERE c.is_active = TRUE
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)
        AND c.shop_id = ?
        AND c.seller_id != ?
      ORDER BY u.reputation DESC, c.created_at DESC
      LIMIT ?
    `, [userId, shopId, userId, limit]);

    return rows;
  } catch (error) {
    console.error('Error in getTopCouponsFromShop service:', error);
    throw error;
  }
};

/**
 * Get top coupons from ALL user's favourite shops
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Max coupons to return
 * @returns {Promise<Array>} List of coupons from all favourite shops
 */
export const getTopCouponsFromFavouriteShops = async (userId, limit = 10) => {
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
      JOIN favorite_shops fs ON fs.shop_id = s.id AND fs.user_id = ?
      WHERE c.is_active = TRUE
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)
        AND c.seller_id != ?
      ORDER BY u.reputation DESC, c.created_at DESC
      LIMIT ?
    `, [userId, userId, userId, limit]);

    return rows;
  } catch (error) {
    console.error('Error in getTopCouponsFromFavouriteShops service:', error);
    throw error;
  }
};


export const suggestNewShop = async (userId, shopName, additionalInfo) => {
  try {
    const [result] = await pool.query(
      'INSERT INTO shop_suggestions (user_id, shop_name, additional_info) VALUES (?, ?, ?)',
      [userId, shopName, additionalInfo]
    );

    return { success: true, suggestionId: result.insertId };
  } catch (error) {
    console.error('Error in suggestNewShop service:', error);
    throw error;
  }
};