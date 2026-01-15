import {
  recordCouponClick as recordCouponClickService,
  getCouponClicks as getCouponClicksService,
  getUserClicks as getUserClicksService
} from '../services/eventService.js';
import { verifyAuthorizationWithUserId } from '../services/authService.js';


/**
 * Controller: Record a coupon click event
 * Expects Authorization header with Bearer token
 * Request body contains: couponId
 */
export const clickCoupon = async (req, res) => {
  try {
    const { user_id } = req.query;
    const { couponId } = req.body || {};
    const authHeader = req.get('authorization');

    if (!couponId) {
      return res.status(400).json({ message: 'couponId is required' });
    }
    if (!authHeader) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    if (!user_id) {
      return res.status(401).json({ message: 'Missing User Id' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);
    // Record the click
    const clickRecord = await recordCouponClickService(user_id, couponId);

    if (clickRecord) {
      return res.status(201).json({
        message: 'Click recorded successfully',
        data: clickRecord
      });
    } else {
      return res.status(200).json({
        message: 'Click already recorded for this coupon',
        data: null
      });
    }
  } catch (error) {
    console.error('Error in clickCoupon controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Controller: Get all clicks for a coupon (analytics)
 */
export const getCouponClicksController = async (req, res) => {
  try {
    const { couponId, user_id } = req.params;
    const authHeader = req.get('authorization');
    if (!couponId) {
      return res.status(400).json({ message: 'couponId is required' });
    }
    if (!authHeader) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    if (!user_id) {
      return res.status(401).json({ message: 'Missing User Id' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);

    const clicks = await getCouponClicksService(couponId);
    res.json({ data: clicks });
  } catch (error) {
    console.error('Error in getCouponClicksController:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * Controller: Get all clicks by a user
 */
export const getUserClicksController = async (req, res) => {
  try {
    const { user_id } = req.params;
    const authHeader = req.get('authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    if (!user_id) {
      return res.status(401).json({ message: 'Missing User Id' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);

    const clicks = await getUserClicksService(userId);
    res.json({ data: clicks });
  } catch (error) {
    console.error('Error in getUserClicksController:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
