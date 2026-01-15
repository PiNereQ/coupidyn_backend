import express from 'express';
import {
  addCoupon,
  getBoughtByMe,
  getBoughtByMeList,
  useBoughtCoupon,
  getListedByMe,
  getListedByMeList,
  getAvailableForPurchase,
  getAvailableForPurchaseList,
  getSavedByMeList,
  addCouponToSaved,
  removeCouponFromSaved,
  deleteCoupon,
  isItOwnedByMe,
  getCouponFeed
} from '../controllers/couponController.js';

const router = express.Router();

router.delete('/:coupon_id', deleteCoupon);

router.get('/owned', getBoughtByMeList);
router.get('/owned/:coupon_id', getBoughtByMe);
router.post('/owned/:coupon_id/use', useBoughtCoupon);
router.get('/listed', getListedByMeList);
router.get('/listed/:coupon_id', getListedByMe);
router.get('/available', getAvailableForPurchaseList);
router.get('/available/:coupon_id', getAvailableForPurchase);
router.get('/:coupon_id/isOwned', isItOwnedByMe);

router.get('/feed', getCouponFeed);

router.get('/saved', getSavedByMeList);
router.post('/saved/:coupon_id', addCouponToSaved);
router.delete('/saved/:coupon_id', removeCouponFromSaved);

router.post('/', addCoupon);



export default router;
