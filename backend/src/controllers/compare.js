import {
  generateRecommendations,
  getQuickRecommendations,
  getDetailedRecommendations
} from '../services/recommendationEngine.js';
import { getUidFromToken, verifyAuthorizationWithUserId } from '../services/authService.js';
import { getFavoriteCategoriesForUser } from '../services/categoryService.js';
import { getFavoriteShopsForUser } from '../services/shopService.js';

/**
 * Controller: Get personalized coupon recommendations for authenticated user
 * Expects Authorization header with Bearer token
 * Query params: limit (default 20), detail (quick|detailed, default quick)
 */
export const getRecommendations = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};

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
      userId,
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
 * Returns favorite category, favorite shop, and top 10 recommended coupons in one response
 * 
 * Expects: Authorization header + user_id query param
 * 
 * Response structure:
 * {
 *   favouriteCategory: { id, name, name_color, bg_color } | null,
 *   favouriteShop: { id, name, name_color, bg_color } | null,
 *   topRecommendedCoupons: [ ...up to 10 coupons with scores... ]
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

    // Fetch all data in parallel for better performance
    const [favouriteCategories, favouriteShops, recommendations] = await Promise.all([
      getFavoriteCategoriesForUser(user_id),
      getFavoriteShopsForUser(user_id),
      getDetailedRecommendations(user_id, 10)
    ]);

    const favouriteCategory = favouriteCategories.length > 0 ? favouriteCategories[0] : null;
    const favouriteShop = favouriteShops.length > 0 ? favouriteShops[0] : null;

    return res.status(200).json({
      favouriteCategory,
      allFavouriteCategories: favouriteCategories,
      favouriteShop,
      allFavouriteShops: favouriteShops,
      topRecommendedCoupons: recommendations
    });
  } catch (error) {
    console.error('Error in getRecommendationDashboard controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



