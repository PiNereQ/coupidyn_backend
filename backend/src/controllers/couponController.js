import {
  addCoupon as addCouponService,
  getBoughtCoupons as getBoughtCouponsService,
  getBoughtCouponById as getBoughtCouponByIdService,
  useBoughtCoupon as useBoughtCouponService,
  getListedCoupons as getListedCouponsService,
  getListedCouponById as getListedCouponByIdService,
  deleteCoupon as deleteCouponService,
  getAvailableForPurchaseList as getAvailableForPurchaseListService,
  getAvailableForPurchase as getAvailableForPurchaseService,
  getSavedList as getSavedListService,
  addCouponToSaved as addCouponToSavedService,
  removeCouponFromSaved as removeCouponFromSavedService,
} from '../services/couponService.js';
import { 
  verifyAuthorizationWithUserId,

} from '../services/authService.js';

const isoToMysqlDatetime = (input) => {
  if (!input) return null;
  const d = (input instanceof Date) ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

export const addCoupon = async (req, res) => {
  const authHeader = req.get('authorization');
  const { user_id } = req.query || {};
      if (!user_id) {
        return res.status(400).json({ message: 'user_id is required' });
      }
  await verifyAuthorizationWithUserId(authHeader, user_id);

  try {
    const { description, price, discount, is_discount_percentage, expiry_date, code, is_active, is_multiple_use, has_limits, works_in_store, works_online, shop_id, seller_id } = req.body || {};
    if (!code || !price || !discount) {
      return res.status(400).json({ message: 'code, price, and discount are required' });
    }

    const expiryDateFormatted = isoToMysqlDatetime(expiry_date);


    const newCoupon = await addCouponService({ description, price, discount, is_discount_percentage, expiry_date: expiryDateFormatted, code, is_active, is_multiple_use, has_limits, works_in_store, works_online, shop_id, seller_id });
    res.status(201).json(newCoupon);
  } catch (error) {
    console.error('Error in addCoupon controller:', error);
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};


export const deleteCoupon = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { coupon_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!coupon_id) {
      return res.status(400).json({ message: 'coupon_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    await deleteCouponService(coupon_id);
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error in deactivateCoupon controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


/**
 * Bought Coupons
 */
export const getBoughtByMe = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { coupon_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!coupon_id) {
      return res.status(400).json({ message: 'coupon_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const coupon = await getBoughtCouponByIdService(coupon_id, user_id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.json(coupon);
  } catch (error) {
    console.error('Error in getBoughtByMe controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


export const getBoughtByMeList = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id, sort, type, used, shop_id, limit, cursor_value, cursor_id } = req.query || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const cursor = (cursor_value && cursor_id) ? {value: cursor_value, id: Number(cursor_id) } : undefined;

    const coupons = await getBoughtCouponsService(user_id, sort, type, used, shop_id, limit, cursor);
    res.json(coupons);
  } catch (error) {
    console.error('Error in getBoughtByMeList controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

export const useBoughtCoupon = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { coupon_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!coupon_id) {
      return res.status(400).json({ message: 'coupon_id is required' });
    }
    
    await verifyAuthorizationWithUserId(authHeader, user_id);

    console.log(`Using coupon_id: ${coupon_id} for user_id: ${user_id}`);

    const result = await useBoughtCouponService(coupon_id, user_id);

    if (result.alreadyUsed) {
      return res.status(400).json({ message: 'Coupon has already been used' });
    }

    res.json({ message: 'Coupon used successfully' });
  } catch (error) {
    console.error('Error in useBoughtCoupon controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



/**
 * Listed Coupons
 */
export const getListedByMe = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { coupon_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!coupon_id) {
      return res.status(400).json({ message: 'coupon_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const coupon = await getListedCouponByIdService(coupon_id, user_id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.json(coupon);
  } catch (error) {
    console.error('Error in getListedByMe controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getListedByMeList = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id, sort, type, status, shop_id, limit, cursor_value, cursor_id } = req.query || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const cursor = (cursor_value && cursor_id) ? {value: cursor_value, id: Number(cursor_id) } : undefined;

    const coupons = await getListedCouponsService(user_id, sort, type, status, shop_id, limit, cursor);
    res.json(coupons);
  } catch (error) {
    console.error('Error in getListedByMeList controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


/**
 * Available for Purchase
 */
export const getAvailableForPurchase = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { coupon_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!coupon_id) {
      return res.status(400).json({ message: 'coupon_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const coupon = await getAvailableForPurchaseService(coupon_id, user_id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found or not available for purchase' });
    }
    res.json(coupon);
  } catch (error) {
    console.error('Error in getAvailableForPurchase controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getAvailableForPurchaseList = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id, sort, type, min_price, max_price, min_rep, shop_id, category_id, limit, cursor_value, cursor_id } = req.query || {};
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const cursor = (cursor_value && cursor_id) ? {value: cursor_value, id: Number(cursor_id) } : undefined;

    const coupons = await getAvailableForPurchaseListService(user_id, sort, type, min_price, max_price, min_rep, shop_id, category_id, limit, cursor);
    res.json(coupons);
  } catch (error) {
    console.error('Error in getAvailableForPurchaseList controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


/**
 * Saved by me
 */

export const getSavedByMeList = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id, sort, type, min_price, max_price, min_rep, shop_id, category_id, limit, cursor_value, cursor_id } = req.query || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const cursor = (cursor_value && cursor_id) ? {value: cursor_value, id: Number(cursor_id) } : undefined;

    const coupons = await getSavedListService(user_id, sort, type, min_price, max_price, min_rep, shop_id, category_id, limit, cursor);
    res.json(coupons);
  } catch (error) {
    console.error('Error in getSavedByMeList controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const addCouponToSaved = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { coupon_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!coupon_id) {
      return res.status(400).json({ message: 'coupon_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const result = await addCouponToSavedService(coupon_id, user_id);

    if (result.alreadySaved) {
      return res.status(200).json({ message: 'Coupon already in saved list' });
    }

    res.status(201).json({ message: 'Coupon added to saved list successfully' });
  } catch (error) {
    console.error('Error in addCouponToSaved controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const removeCouponFromSaved = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { coupon_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!coupon_id) {
      return res.status(400).json({ message: 'coupon_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const result = await removeCouponFromSavedService(coupon_id, user_id);

    if (result.notSaved) {
      return res.status(404).json({ message: 'Coupon not found in saved list' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in removeCouponFromSaved controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const isItOwnedByMe = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { coupon_id } = req.params || {};
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!coupon_id) {
      return res.status(400).json({ message: 'coupon_id is required' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);
    const coupon = await getBoughtCouponByIdService(coupon_id, user_id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found or not owned by user' });
    }
    res.json({ owned: true });
  } catch (error) {
    console.error('Error in isItOwnedByMe controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

//RECOMMENDATIONS
import { getCouponFeed as getCouponFeedService } from '../services/couponService.js';

export const getCouponFeed = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const cursor = req.query.cursor || undefined;
    const limit = Number(req.query.limit) || 20;

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);

    const { items, nextCursor, hasMore } = await getCouponFeedService(
      user_id,
      limit,
      cursor
    );

    res.json({ items, cursor: nextCursor, hasMore });
  } catch (error) {
    console.error('Error in getCouponFeed controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};