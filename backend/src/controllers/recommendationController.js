import {
  generateRecommendations,
  getQuickRecommendations,
  getDetailedRecommendations
} from '../services/recommendationEngine.js';
import { getUidFromToken, verifyAuthorizationWithUserId } from '../services/authService.js';
import { 
  getFavoriteCategoriesForUser,
  getCalculatedFavouriteCategory,
  getTopCouponsFromFavouriteCategories
} from '../services/categoryService.js';
import { 
  getFavoriteShopsForUser,
  getCalculatedFavouriteShop,
  getTopCouponsFromFavouriteShops
} from '../services/shopService.js';
import pool from '../config/db.js';


/**
 * Controller: Get personalized coupon recommendations for authenticated user
 * Expects Authorization header with Bearer token
 * Query params: limit (default 20), detail (quick|detailed, default quick)
 */
export const getRecommendations = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    console.log('getRecommendations called with user_id:', user_id);

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);

    const { limit = '20', detail = 'quick' } = req.query;

    // Validate and parse limit
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ 
        message: 'limit must be a number between 1 and 100' 
      });
    }

    // Validate detail parameter
    if (!['quick', 'detailed'].includes(detail)) {
      return res.status(400).json({ 
        message: "detail must be either 'quick' or 'detailed'" 
      });
    }

    // Get recommendations based on detail level
    let recommendations;
    try {
      if (detail === 'detailed') {
        recommendations = await getDetailedRecommendations(user_id, parsedLimit);
      } else {
        recommendations = await getQuickRecommendations(user_id, parsedLimit);
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return res.status(500).json({ message: 'Error generating recommendations' });
    }

    return res.status(200).json({
      message: 'Recommendations generated successfully',
      userId: user_id,
      count: recommendations.length,
      limit: parsedLimit,
      detail,
      data: recommendations
    });
  } catch (error) {
    console.error('Error in getRecommendations controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Controller: Get full recommendations with all scoring data (for debugging/analytics)
 * Expects Authorization header with Bearer token
 * Query params: limit (default 20)
 */
export const getFullRecommendations = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { limit = '20' } = req.query;

    // Validate Authorization header
    if (!authHeader) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }

    const lower = authHeader.toLowerCase();
    if (!lower.startsWith('bearer ')) {
      return res.status(401).json({ message: 'Authorization header must be in the format: Bearer <token>' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ message: 'Missing bearer token' });
    }

    // Verify token and get user ID
    let userId;
    try {
      userId = await getUidFromToken(token);
    } catch (err) {
      console.error('Error verifying token in getFullRecommendations controller:', err);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Validate and parse limit
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ 
        message: 'limit must be a number between 1 and 100' 
      });
    }

    // Get full recommendations
    let recommendations;
    try {
      recommendations = await generateRecommendations(userId, { 
        limit: parsedLimit 
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return res.status(500).json({ message: 'Error generating recommendations' });
    }

    return res.status(200).json({
      message: 'Full recommendations generated successfully',
      userId,
      count: recommendations.length,
      limit: parsedLimit,
      data: recommendations
    });
  } catch (error) {
    console.error('Error in getFullRecommendations controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


/**
 * Controller: Get personalized recommendation dashboard
 * Returns favorite category (calculated), favorite shop (calculated), and coupons from each
 * 
 * Expects: Authorization header + user_id query param
 * 
 * Response structure:
 * {
 *   favouriteCategory: { category: {...}, coupons: [...top 10 from calculated #1 category] } | null,
 *   allFavouriteCategories: [...top 10 coupons from ALL favourite categories],
 *   favouriteShop: { shop: {...}, coupons: [...top 10 from calculated #1 shop] } | null,
 *   allFavouriteShops: [...top 10 coupons from ALL favourite shops],
 *   topRecommendedCoupons: [ ...up to 10 coupons from recommendation engine... ]
 * }
 */
export const getRecommendationDashboard = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!authHeader) {
      return res.status(401).json({ message: 'Authorization header is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    // 🔹 POBRANIE KUPIONYCH KUPONÓW
    let purchasedCouponIds = new Set();
    try {
      const [rows] = await pool.query(
        'SELECT DISTINCT coupon_id FROM transactions WHERE buyer_id = ?',
        [user_id]
      );
      purchasedCouponIds = new Set(rows.map(r => String(r.coupon_id)));
    } catch (dbError) {
      console.error('Error fetching purchased coupons:', dbError);
    }

    // 🔹 FETCH WSZYSTKIEGO RÓWNOLEGLE
    const [
      calculatedFavouriteCategory,
      allFavouriteCategoriesCoupons,
      calculatedFavouriteShop,
      allFavouriteShopsCoupons,
      recommendations
    ] = await Promise.all([
      getCalculatedFavouriteCategory(user_id),
      getTopCouponsFromFavouriteCategories(user_id, 10),
      getCalculatedFavouriteShop(user_id),
      getTopCouponsFromFavouriteShops(user_id, 10),
      getDetailedRecommendations(user_id, 10)
    ]);

    // 🔹 Uniwersalny filtr kupionych kuponów
    const filterPurchased = (coupons, sourceName = 'unknown') => {
      if (!Array.isArray(coupons)) return coupons;

      const filteredOut = [];

      const result = coupons.filter(c => {
        const couponId = String(
          c.coupon_id ??
          c.couponId ??
          c.id ??
          (c.coupon && c.coupon.id) ??
          (c.coupon && c.coupon.coupon_id)
        );

        const isPurchased = purchasedCouponIds.has(couponId);

        if (isPurchased) filteredOut.push(couponId);

        return !isPurchased;
      });

      if (filteredOut.length > 0) {
        console.log(
          `[DASHBOARD FILTER] user=${user_id} source=${sourceName} filtered_count=${filteredOut.length} filtered_ids=${filteredOut.join(',')}`
        );
      }

      return result;
    };

    // 🔹 Filtrowanie kuponów w calculatedFavouriteCategory i calculatedFavouriteShop
    if (calculatedFavouriteCategory?.coupons) {
      calculatedFavouriteCategory.coupons = filterPurchased(
        calculatedFavouriteCategory.coupons,
        'calculated_favourite_category'
      );
    }

    if (calculatedFavouriteShop?.coupons) {
      calculatedFavouriteShop.coupons = filterPurchased(
        calculatedFavouriteShop.coupons,
        'calculated_favourite_shop'
      );
    }

    // 🔹 Filtrowanie pozostałych list
    const filteredFavouriteCategories = filterPurchased(allFavouriteCategoriesCoupons, 'favourite_categories');
    const filteredFavouriteShops = filterPurchased(allFavouriteShopsCoupons, 'favourite_shops');
    const filteredRecommendations = filterPurchased(recommendations, 'recommendations');

    return res.status(200).json({
      favouriteCategory: calculatedFavouriteCategory,
      allFavouriteCategories: filteredFavouriteCategories,
      favouriteShop: calculatedFavouriteShop,
      allFavouriteShops: filteredFavouriteShops,
      topRecommendedCoupons: filteredRecommendations
    });

  } catch (error) {
    console.error('Error in getRecommendationDashboard controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};



