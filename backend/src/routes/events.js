import express from 'express';
import {
  clickCoupon,
  getCouponClicksController,
  getUserClicksController
} from '../controllers/eventController.js';
import {
  getRecommendations,
  getFullRecommendations,
  getRecommendationDashboard
} from '../controllers/recommendationController.js';
import { computeAndStoreRecommendations } from '../services/recommendationEngine.js';

const router = express.Router();

// Record a coupon click
router.post('/click', clickCoupon);

// Get all clicks for a coupon (analytics)
//router.get('/coupon/:couponId/clicks', getCouponClicksController);

// Get all clicks by current user
//router.get('/my-clicks', getUserClicksController);

// Get personalized coupon recommendations (quick or detailed)
router.get('/recommendations', getRecommendations);

// Get full recommendations with all scoring data (debugging/analytics)
router.get('/recommendations/full', getFullRecommendations);

router.get('/recommendations/dashboard', getRecommendationDashboard);

export default router;

router.post('/compute-recommendations', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ message: 'user_id required' });
    }
    
    const result = await computeAndStoreRecommendations(user_id);
    
    res.json({
      message: 'Recommendations computed successfully',
      ... result
    });
  } catch (error) {
    console.error('Error computing recommendations:', error);
    res.status(500).json({ message: error.message });
  }
});
