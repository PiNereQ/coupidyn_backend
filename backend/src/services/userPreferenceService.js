import pool from '../config/db.js';

/**
 * Build a dynamic user preference profile from high-value implicit feedback
 * Uses weighted implicit signals: clicks, saves, conversations, transactions
 * Extracts price ranges, preferred categories, and shopping channel preferences
 * 
 * @param {string} userId - The user ID to build preferences for
 * @returns {Promise<Object>} Normalized user preference object (read-only)
 */
export const buildUserPreferenceProfile = async (userId) => {
  try {
    // Fetch all interactions with their weights
    const [interactions] = await pool.query(
      `
      SELECT 
        c.id as coupon_id,
        c.price as listing_price,
        c.works_online,
        c.works_in_store,
        u.reputation as seller_reputation,
        COALESCE(cc.weight, 0) as click_weight,
        COALESCE(sv.weight, 0) as save_weight,
        COALESCE(conv.weight, 0) as conversation_weight,
        COALESCE(t.weight, 0) as transaction_weight
      FROM coupons c
      LEFT JOIN users u ON c.seller_id = u.id
      LEFT JOIN (
        SELECT coupon_id, 1 as weight FROM coupon_clicks WHERE user_id = ?
      ) cc ON c.id = cc.coupon_id
      LEFT JOIN (
        SELECT coupon_id, 2 as weight FROM saves WHERE user_id = ?
      ) sv ON c.id = sv.coupon_id
      LEFT JOIN (
        SELECT coupon_id, 3 as weight FROM conversations WHERE buyer_id = ? AND is_deleted = FALSE
      ) conv ON c.id = conv.coupon_id
      LEFT JOIN (
        SELECT coupon_id, 5 as weight FROM transactions WHERE buyer_id = ?
      ) t ON c.id = t.coupon_id
      WHERE (cc.weight IS NOT NULL OR sv.weight IS NOT NULL OR conv.weight IS NOT NULL OR t.weight IS NOT NULL)
      AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)
      `,
      [userId, userId, userId, userId]
    );

    // If no interactions found, return neutral profile
    if (interactions.length === 0) {
      return {
        userId,
        preferenceStrength: 0,
        priceRange: null,
        preferredCategories: [],
        shoppingChannelPreference: null,
        averageSellerReputation: null,
        interactionCount: 0,
        totalWeightedScore: 0,
        lastUpdated: new Date().toISOString()
      };
    }

    // Calculate weights and aggregate data
    let totalWeight = 0;
    let totalPrice = 0;
    let priceCount = 0;
    let onlinePreference = 0;
    let inStorePreference = 0;
    let reputationSum = 0;
    let reputationCount = 0;
    const couponIds = new Set();

    interactions.forEach(interaction => {
      const weight = interaction.click_weight + interaction.save_weight + 
                    interaction.conversation_weight + interaction.transaction_weight;
      
      if (weight > 0) {
        totalWeight += weight;
        couponIds.add(interaction.coupon_id);

        // Price range
        if (interaction.listing_price) {
          totalPrice += interaction.listing_price * weight;
          priceCount += weight;
        }

        // Shopping channel preference
        if (interaction.works_online) onlinePreference += weight;
        if (interaction.works_in_store) inStorePreference += weight;

        // Seller reputation
        if (interaction.seller_reputation !== null) {
          reputationSum += interaction.seller_reputation * weight;
          reputationCount += weight;
        }
      }
    });

    // Fetch shop categories for interacted coupons
    const categoryWeights = {};
    if (couponIds.size > 0) {
      const couponIdList = Array.from(couponIds);
      const [categoryResults] = await pool.query(
        `
        SELECT 
          c.id as category_id,
          cat.name as category_name,
          COUNT(*) as frequency
        FROM coupons c
        LEFT JOIN shops_categories sc ON c.shop_id = sc.shop_id
        LEFT JOIN categories cat ON sc.category_id = cat.id
        WHERE c.id IN (${couponIdList.map(() => '?').join(',')})
        AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)
        GROUP BY c.shop_id, cat.id, cat.name
        `,
        couponIdList
      );

      // Build weighted category preferences
      categoryResults.forEach(row => {
        if (row.category_name) {
          if (!categoryWeights[row.category_name]) {
            categoryWeights[row.category_name] = 0;
          }
          categoryWeights[row.category_name] += row.frequency;
        }
      });
    }

    // Compute normalized metrics
    const preferredPrice = priceCount > 0 ? totalPrice / priceCount : null;
    const priceRange = preferredPrice ? {
      preferred: parseFloat(preferredPrice.toFixed(2)),
      min: null,
      max: null
    } : null;

    // Sort categories by frequency
    const preferredCategories = Object.entries(categoryWeights)
      .sort((a, b) => b[1] - a[1])
      .map(([name, weight]) => ({
        name,
        weight: parseFloat((weight / Math.max(1, totalWeight)).toFixed(3))
      }));

    // Determine shopping channel preference
    const totalChannelWeights = onlinePreference + inStorePreference;
    const shoppingChannelPreference = totalChannelWeights > 0 ? {
      online: parseFloat((onlinePreference / totalChannelWeights).toFixed(3)),
      inStore: parseFloat((inStorePreference / totalChannelWeights).toFixed(3)),
      preferred: onlinePreference > inStorePreference ? 'online' : inStorePreference > onlinePreference ? 'in-store' : 'both'
    } : null;

    // Average seller reputation
    const averageSellerReputation = reputationCount > 0 ? 
      parseFloat((reputationSum / reputationCount).toFixed(1)) : null;

    // Build final preference profile
    const userPreferences = {
      userId,
      preferenceStrength: parseFloat((totalWeight / Math.max(1, interactions.length)).toFixed(2)),
      priceRange,
      preferredCategories: preferredCategories.slice(0, 10), // Top 10 categories
      shoppingChannelPreference,
      averageSellerReputation,
      interactionCount: couponIds.size,
      totalWeightedScore: totalWeight,
      lastUpdated: new Date().toISOString()
    };

    // Return read-only object
    return Object.freeze(userPreferences);
  } catch (error) {
    console.error('Error in buildUserPreferenceProfile service:', error);
    throw error;
  }
};

/**
 * Get preference profile for a user (cached version for quick access)
 */
export const getUserPreferences = async (userId) => {
  try {
    return await buildUserPreferenceProfile(userId);
  } catch (error) {
    console.error('Error in getUserPreferences service:', error);
    throw error;
  }
};

/**
 * Compare two users' preference profiles for recommendation purposes
 * Returns similarity score (0-1) based on category and channel preferences
 */
export const compareUserPreferences = async (userId1, userId2) => {
  try {
    const [profile1, profile2] = await Promise.all([
      buildUserPreferenceProfile(userId1),
      buildUserPreferenceProfile(userId2)
    ]);

    if (!profile1.preferredCategories.length || !profile2.preferredCategories.length) {
      return 0;
    }

    // Calculate category overlap
    const categories1 = new Set(profile1.preferredCategories.map(c => c.name));
    const categories2 = new Set(profile2.preferredCategories.map(c => c.name));
    
    const intersection = [...categories1].filter(c => categories2.has(c)).length;
    const union = new Set([...categories1, ...categories2]).size;
    const categoryOverlap = union > 0 ? intersection / union : 0;

    // Calculate channel preference similarity
    let channelSimilarity = 0;
    if (profile1.shoppingChannelPreference && profile2.shoppingChannelPreference) {
      const onlineDiff = Math.abs(
        profile1.shoppingChannelPreference.online - profile2.shoppingChannelPreference.online
      );
      channelSimilarity = 1 - onlineDiff;
    }

    // Price range similarity
    let priceSimilarity = 0;
    if (profile1.priceRange && profile2.priceRange) {
      const priceDiff = Math.abs(
        profile1.priceRange.preferred - profile2.priceRange.preferred
      );
      const maxPrice = Math.max(profile1.priceRange.preferred, profile2.priceRange.preferred);
      priceSimilarity = 1 - Math.min(1, priceDiff / maxPrice);
    }

    // Combined similarity score
    const similarity = (categoryOverlap * 0.5 + channelSimilarity * 0.25 + priceSimilarity * 0.25);

    return parseFloat(similarity.toFixed(3));
  } catch (error) {
    console.error('Error in compareUserPreferences service:', error);
    throw error;
  }
};

/**
 * Fetch candidate coupons for recommendation engine
 * Returns only active, non-deleted coupons with all data needed for ranking
 * Uses fixed upper bound to ensure scalability (no memory overload)
 * 
 * @param {Object} options - Query options
 * @param {string} options.excludeUserId - Exclude coupons already interacted with by this user (optional)
 * @param {number} options.limit - Maximum candidates to fetch (default: 1000)
 * @param {string} options.sortBy - Sort field: 'recent' or 'popular' (default: 'recent')
 * @returns {Promise<Array>} Array of candidate coupons with full data for ranking
 */
export const fetchRecommendationCandidates = async ({ excludeUserId, limit = 1000, sortBy = 'recent' }) => {
  try {
    const orderByClause = sortBy === 'recent' ? 'ORDER BY c.created_at DESC' : '';
    
    const [rows] = await pool.query(
      `
      SELECT 
        c.id,
        c.code,
        c.description,
        c.price,
        c.discount,
        c.is_discount_percentage,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.is_active,
        c.created_at as listing_date,
        sh.id as shop_id,
        sh.name as shop_name,
        sh.name_color as shop_name_color,
        sh.bg_color as shop_bg_color,
        u.id as seller_id,
        u.username as seller_username,
        u.profile_picture as seller_profile_picture,
        u.reputation as seller_reputation,
        u.join_date as seller_join_date,
        GROUP_CONCAT(DISTINCT cat.name SEPARATOR ',') as categories,
        EXISTS (
          SELECT 1 FROM saves sv WHERE sv.coupon_id = c.id AND sv.user_id = ?
        ) AS is_saved
      FROM coupons c
      INNER JOIN users u ON c.seller_id = u.id
      LEFT JOIN shops sh ON c.shop_id = sh.id
      LEFT JOIN shops_categories sc ON c.shop_id = sc.shop_id
      LEFT JOIN categories cat ON sc.category_id = cat.id
      WHERE c.is_active = TRUE
        AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        ${excludeUserId ? `
        AND c.seller_id != ? 
        AND c.id NOT IN (
          SELECT DISTINCT coupon_id FROM coupon_clicks WHERE user_id = ? 
          UNION
          SELECT DISTINCT coupon_id FROM saves WHERE user_id = ?
          UNION
          SELECT DISTINCT coupon_id FROM conversations WHERE buyer_id = ? AND is_deleted = FALSE
          UNION
          SELECT DISTINCT coupon_id FROM transactions WHERE buyer_id = ? 
        )
        ` : ''}
       GROUP BY c.id ${orderByClause} LIMIT ?`,
      excludeUserId 
        ? [excludeUserId, excludeUserId, excludeUserId, excludeUserId, excludeUserId, excludeUserId, limit]
        : [excludeUserId || '', limit]
    );

    return rows;
  } catch (error) {
    console.error('Error in fetchRecommendationCandidates service:', error);
    throw error;
  }
};

/**
 * Fetch candidate coupons by category preference
 * Efficient query that filters candidates matching user's preferred categories
 * 
 * @param {string} userId - User ID to get preferences for
 * @param {number} limit - Maximum candidates to fetch (default: 500)
 * @returns {Promise<Array>} Ranked candidate coupons matching user preferences
 */
export const fetchCategoryMatchedCandidates = async (userId, limit = 1000) => {
  try {
    // Get user's preferred categories
    const userPrefs = await buildUserPreferenceProfile(userId);
    
    if (userPrefs.preferredCategories.length === 0) {
      return [];
    }

    const categoryNames = userPrefs.preferredCategories.map(c => c.name);
    const categoryPlaceholders = categoryNames.map(() => '?').join(',');

    const [rows] = await pool.query(
      `
      SELECT 
        c.id,
        c.code,
        c.description,
        c.price,
        c.discount,
        c.is_discount_percentage,
        c.has_limits,
        c.works_online,
        c.works_in_store,
        c.expiry_date,
        c.is_active,
        c.created_at as listing_date,
        sh.id as shop_id,
        sh.name as shop_name,
        sh.name_color as shop_name_color,
        sh.bg_color as shop_bg_color,
        u.id as seller_id,
        u.username as seller_username,
        u.profile_picture as seller_profile_picture,
        u.reputation as seller_reputation,
        u.join_date as seller_join_date,
        GROUP_CONCAT(DISTINCT cat.name SEPARATOR ',') as categories,
        COUNT(DISTINCT CASE WHEN cat.name IN (${categoryPlaceholders}) THEN cat.id END) as category_match_count,
        EXISTS (
          SELECT 1 FROM saves sv WHERE sv.coupon_id = c.id AND sv.user_id = ?
        ) AS is_saved
      FROM coupons c
      INNER JOIN users u ON c.seller_id = u.id
      LEFT JOIN shops sh ON c.shop_id = sh.id
      LEFT JOIN shops_categories sc ON c.shop_id = sc.shop_id
      LEFT JOIN categories cat ON sc.category_id = cat.id
      WHERE c.is_active = TRUE
        AND (c.is_deleted IS NULL OR c.is_deleted = FALSE)
        AND (c.expiry_date IS NULL OR c.expiry_date >= CURDATE())
        AND c.seller_id != ?
        AND c.id NOT IN (
          SELECT DISTINCT coupon_id FROM coupon_clicks WHERE user_id = ?
          UNION
          SELECT DISTINCT coupon_id FROM saves WHERE user_id = ? 
          UNION
          SELECT DISTINCT coupon_id FROM conversations WHERE buyer_id = ? AND is_deleted = FALSE
          UNION
          SELECT DISTINCT coupon_id FROM transactions WHERE buyer_id = ? 
        )
        AND (cat.name IN (${categoryPlaceholders}) OR cat.id IS NULL)
      GROUP BY c.id
      ORDER BY category_match_count DESC, c.created_at DESC
      LIMIT ? 
    `,
      [...categoryNames, userId, userId, userId, userId, userId, userId, ...categoryNames, limit]
    );

    return rows;
  } catch (error) {
    console.error('Error in fetchCategoryMatchedCandidates service:', error);
    throw error;
  }
};
