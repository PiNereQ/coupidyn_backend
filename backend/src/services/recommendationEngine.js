import pool from '../config/db.js';
import {
  buildUserPreferenceProfile,
  fetchRecommendationCandidates,
  fetchCategoryMatchedCandidates
} from './userPreferenceService.js';

const CANDIDATE_LIMIT = 1000;
const SIMILAR_USERS_LIMIT = 50;
const MIN_SIMILARITY_THRESHOLD = 0.1;

/**
 * Compute content-based similarity between user preference and a coupon candidate
 * Considers: price proximity, category overlap, channel compatibility, seller reputation
 * 
 * @param {Object} userPrefs - User preference profile
 * @param {Object} candidate - Candidate coupon with all data (flat SQL format)
 * @returns {number} Content-based score [0, 1]
 */
const computeContentScore = (userPrefs, candidate) => {
  let contentScore = 0;
  let componentWeight = 0;

  // 1. Price proximity (normalized difference)
  if (userPrefs.priceRange && userPrefs.priceRange.preferred) {
    const candidatePrice = candidate.price || 0;
    const priceDiff = Math.abs(candidatePrice - userPrefs.priceRange.preferred);
    const maxPrice = Math.max(candidatePrice, userPrefs.priceRange.preferred) || 1;
    const priceSimilarity = Math.max(0, 1 - (priceDiff / maxPrice));
    contentScore += priceSimilarity * 0.35;
    componentWeight += 0.35;
  }

  // 2. Category overlap (Jaccard similarity)
  const candidateCategories = candidate.categories ? candidate.categories.split(',') : [];
  if (userPrefs.preferredCategories && userPrefs.preferredCategories.length > 0 && candidateCategories.length > 0) {
    const userCats = new Set(userPrefs.preferredCategories.map(c => c.name));
    const candidateCats = new Set(candidateCategories);
    
    const intersection = [...candidateCats].filter(cat => userCats.has(cat)).length;
    const union = new Set([...userCats, ...candidateCats]).size;
    const jaccardSimilarity = union > 0 ? intersection / union : 0;
    
    contentScore += jaccardSimilarity * 0.35;
    componentWeight += 0.35;
  }

  // 3. Channel compatibility
  if (userPrefs.shoppingChannelPreference) {
    const userOnlineScore = userPrefs.shoppingChannelPreference.online;
    const userInStoreScore = userPrefs.shoppingChannelPreference.inStore;
    
    let channelMatch = 0;
    if (candidate.works_online && candidate.works_in_store) {
      channelMatch = 1.0;
    } else if (candidate.works_online) {
      channelMatch = userOnlineScore;
    } else if (candidate.works_in_store) {
      channelMatch = userInStoreScore;
    }
    
    contentScore += channelMatch * 0.15;
    componentWeight += 0.15;
  }

  // 4. Seller reputation (normalized 0-100 to 0-1)
  if (candidate.seller_reputation !== null) {
    const reputationScore = Math.min(1, (candidate.seller_reputation || 0) / 100);
    contentScore += reputationScore * 0.15;
    componentWeight += 0.15;
  }

  // Normalize content score
  return componentWeight > 0 ? contentScore / componentWeight : 0;
};

/**
 * Find similar users based on coupon interaction overlap
 */
const findSimilarUsers = async (userId, limit = SIMILAR_USERS_LIMIT) => {
  try {
    const [targetInteractions] = await pool.query(`
      SELECT DISTINCT coupon_id, 
        CASE 
          WHEN source = 'click' THEN 1
          WHEN source = 'save' THEN 2
          WHEN source = 'conversation' THEN 3
          WHEN source = 'transaction' THEN 5
        END as weight
      FROM (
        SELECT coupon_id, 'click' as source FROM coupon_clicks WHERE user_id = ?
        UNION ALL
        SELECT coupon_id, 'save' FROM saves WHERE user_id = ?
        UNION ALL
        SELECT coupon_id, 'conversation' FROM conversations WHERE buyer_id = ? AND is_deleted = FALSE
        UNION ALL
        SELECT coupon_id, 'transaction' FROM transactions WHERE buyer_id = ?
      ) interactions
    `, [userId, userId, userId, userId]);

    if (targetInteractions.length === 0) return [];

    const couponIds = targetInteractions.map(i => i.coupon_id);
    
    const [similarUsers] = await pool.query(`
      SELECT 
        user_id as similar_user_id,
        COUNT(DISTINCT coupon_id) as shared_coupons,
        SUM(weight) as combined_weight
      FROM (
        SELECT user_id, coupon_id, 1 as weight 
        FROM coupon_clicks 
        WHERE coupon_id IN (${couponIds.map(() => '?').join(',')}) 
          AND user_id != ? 
        UNION ALL
        SELECT user_id, coupon_id, 2 
        FROM saves 
        WHERE coupon_id IN (${couponIds.map(() => '?').join(',')}) 
          AND user_id != ?
        UNION ALL
        SELECT buyer_id as user_id, coupon_id, 3 
        FROM conversations 
        WHERE coupon_id IN (${couponIds.map(() => '?').join(',')}) 
          AND buyer_id != ?
          AND is_deleted = FALSE
        UNION ALL
        SELECT buyer_id as user_id, coupon_id, 5 
        FROM transactions 
        WHERE coupon_id IN (${couponIds.map(() => '?').join(',')}) 
          AND buyer_id != ?
      ) all_interactions
      GROUP BY user_id
      ORDER BY combined_weight DESC
      LIMIT ?
    `, [
      ...couponIds, userId,
      ...couponIds, userId,
      ...couponIds, userId,
      ...couponIds, userId,
      limit
    ]);

    if (similarUsers.length === 0) return [];

    const maxWeight = similarUsers[0].combined_weight || 1;
    return similarUsers.map(user => ({
      userId: user.similar_user_id,
      similarityScore: Math.min(1, (user.combined_weight || 0) / maxWeight),
      sharedCoupons: user.shared_coupons
    })).filter(u => u.similarityScore >= MIN_SIMILARITY_THRESHOLD);
  } catch (error) {
    console.error('Error in findSimilarUsers:', error);
    return [];
  }
};

/**
 * Compute collaborative scores for ALL candidates in ONE query
 */
const computeCollaborativeScoresBatch = async (candidates, similarUsers) => {
  if (similarUsers.length === 0) {
    return new Map(candidates.map(c => [c.id, 0]));
  }
  
  try {
    const couponIds = candidates.map(c => c.id);
    const userIds = similarUsers.map(u => u.userId);
    
    const [results] = await pool.query(`
      SELECT 
        coupon_id,
        COUNT(DISTINCT user_id) as interaction_count
      FROM (
        SELECT coupon_id, user_id FROM coupon_clicks 
        WHERE coupon_id IN (${couponIds.map(() => '?').join(',')}) 
          AND user_id IN (${userIds.map(() => '?').join(',')})
        UNION
        SELECT coupon_id, user_id FROM saves 
        WHERE coupon_id IN (${couponIds.map(() => '?').join(',')}) 
          AND user_id IN (${userIds.map(() => '?').join(',')})
        UNION
        SELECT coupon_id, buyer_id as user_id FROM conversations 
        WHERE coupon_id IN (${couponIds.map(() => '?').join(',')}) 
          AND buyer_id IN (${userIds.map(() => '?').join(',')}) 
          AND is_deleted = FALSE
        UNION
        SELECT coupon_id, buyer_id as user_id FROM transactions 
        WHERE coupon_id IN (${couponIds.map(() => '?').join(',')}) 
          AND buyer_id IN (${userIds.map(() => '?').join(',')})
      ) interactions
      GROUP BY coupon_id
    `, [
      ...couponIds, ...userIds,
      ...couponIds, ...userIds,
      ...couponIds, ...userIds,
      ...couponIds, ...userIds
    ]);
    
    const collaborativeMap = new Map(
      results.map(r => [
        r.coupon_id,
        Math.min(1, (r.interaction_count || 0) / similarUsers.length)
      ])
    );
    
    candidates.forEach(c => {
      if (!collaborativeMap.has(c.id)) {
        collaborativeMap.set(c.id, 0);
      }
    });
    
    return collaborativeMap;
  } catch (error) {
    console.error('Error in computeCollaborativeScoresBatch:', error);
    return new Map(candidates.map(c => [c.id, 0]));
  }
};

/**
 * Compute popularity scores for ALL candidates in ONE query
 */
const computePopularityScoresBatch = async (candidates) => {
  try {
    const couponIds = candidates.map(c => c.id);
    
    const [results] = await pool.query(`
      SELECT 
        coupon_id,
        (COALESCE(click_count, 0) * 1 + 
         COALESCE(save_count, 0) * 2 + 
         COALESCE(conv_count, 0) * 3 + 
         COALESCE(trans_count, 0) * 5) as total_interactions
      FROM (
        SELECT c.id as coupon_id,
          (SELECT COUNT(*) FROM coupon_clicks WHERE coupon_id = c.id) as click_count,
          (SELECT COUNT(*) FROM saves WHERE coupon_id = c.id) as save_count,
          (SELECT COUNT(*) FROM conversations WHERE coupon_id = c.id AND is_deleted = FALSE) as conv_count,
          (SELECT COUNT(*) FROM transactions WHERE coupon_id = c.id) as trans_count
        FROM coupons c
        WHERE c.id IN (${couponIds.map(() => '?').join(',')})
      ) stats
    `, couponIds);
    
    const popularityMap = new Map(
      results.map(r => [
        r.coupon_id, 
        Math.min(1, (r.total_interactions || 0) / 500)
      ])
    );
    
    return popularityMap;
  } catch (error) {
    console.error('Error in computePopularityScoresBatch:', error);
    return new Map();
  }
};

/**
 * Get personalized coupon recommendations for a user
 * Returns coupons in the same flat format as other API endpoints
 */
export const generateRecommendations = async (userId, options = {}) => {
  const { limit = 20, useCategoryFilter = true } = options;

  try {
    const userPrefs = await buildUserPreferenceProfile(userId);

    const [purchasedRows] = await pool.query(
      'SELECT DISTINCT coupon_id FROM transactions WHERE buyer_id = ?',
      [userId]
    );

    const purchasedCouponIds = new Set(
      purchasedRows.map(r => Number(r.coupon_id))
    );

    
    let candidates = [];
    if (useCategoryFilter && userPrefs.preferredCategories.length > 0) {
      candidates = await fetchCategoryMatchedCandidates(userId, CANDIDATE_LIMIT);
    } else {
      candidates = await fetchRecommendationCandidates({
        excludeUserId: userId,
        limit: CANDIDATE_LIMIT,
        sortBy: 'recent'
      });
    }

    if (candidates.length === 0) {
      candidates = await fetchRecommendationCandidates({
        excludeUserId: userId,
        limit: CANDIDATE_LIMIT
      });
    }

    candidates = candidates.filter(
      c => !purchasedCouponIds.has(Number(c.id))
    );

    const similarUsers = await findSimilarUsers(userId);

    const popularityMap = await computePopularityScoresBatch(candidates);
    const collaborativeMap = await computeCollaborativeScoresBatch(candidates, similarUsers);

    // Score all candidates - keep flat format from SQL
    const scoredCandidates = candidates.map((candidate) => {
      const contentScore = computeContentScore(userPrefs, candidate);
      const collaborativeScore = collaborativeMap.get(candidate.id) || 0;
      const popularityScore = popularityMap.get(candidate.id) || 0;
      const sellerRepScore = Math.min(1, (candidate.seller_reputation || 0) / 100);

      const finalScore =
        0.45 * contentScore +
        0.30 * collaborativeScore +
        0.15 * sellerRepScore +
        0.10 * popularityScore;

      // Return in same flat format as other endpoints
      return {
        ...candidate,
        scores: {
          contentBased: parseFloat(contentScore.toFixed(3)),
          collaborative: parseFloat(collaborativeScore.toFixed(3)),
          sellerReputation: parseFloat(sellerRepScore.toFixed(3)),
          popularity: parseFloat(popularityScore.toFixed(3)),
          final: parseFloat(finalScore.toFixed(3))
        }
      };
    });

    const recommendations = scoredCandidates
      .sort((a, b) => b.scores.final - a.scores.final)
      .slice(0, limit);

    return recommendations;
  } catch (error) {
    console.error('Error in generateRecommendations:', error);
    throw error;
  }
};

/**
 * Get lightweight recommendations (scores only, minimal data)
 */
export const getQuickRecommendations = async (userId, limit = 10) => {
  try {
    const recommendations = await generateRecommendations(userId, {
      limit: limit * 2,
      useCategoryFilter: true
    });

    return recommendations.slice(0, limit).map(rec => ({
      id: rec.id,
      code: rec.code,
      finalScore: rec.scores.final,
      discount: rec.discount,
      price: rec.price
    }));
  } catch (error) {
    console.error('Error in getQuickRecommendations:', error);
    throw error;
  }
};

/**
 * Get detailed recommendations - returns same format as other coupon endpoints
 */
export const getDetailedRecommendations = async (userId, limit = 10) => {
  try {
    const recommendations = await generateRecommendations(userId, {
      limit: limit * 2,
      useCategoryFilter: true
    });

    return recommendations.slice(0, limit);
  } catch (error) {
    console.error('Error in getDetailedRecommendations:', error);
    throw error;
  }
};

/**
 * Compute and store recommendations for a user in the database
 */
export const computeAndStoreRecommendations = async (userId) => {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 Computing recommendations for user ${userId}...`);
    
    const recommendations = await generateRecommendations(userId, { limit: 100 });
    
    if (recommendations.length === 0) {
      console.log(`ℹ️ No recommendations for user ${userId}`);
      return { success: true, count: 0, duration: Date.now() - startTime };
    }
    
    await pool.query('DELETE FROM user_recommendations WHERE user_id = ?', [userId]);
    
    const values = recommendations.map(rec => [userId, rec.id, rec.scores.final]);
    await pool.query('INSERT INTO user_recommendations (user_id, coupon_id, score) VALUES ?', [values]);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Stored ${recommendations.length} recommendations for user ${userId} in ${duration}ms`);
    
    return { success: true, count: recommendations.length, duration };
  } catch (error) {
    console.error(`❌ Error for user ${userId}:`, error);
    throw error;
  }
};
