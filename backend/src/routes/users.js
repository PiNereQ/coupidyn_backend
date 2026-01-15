import express from 'express';
import {
  getAllUsers,
  getUserById,
  addUser,
  disableFirebaseUser,
  verifyUserToken,
  checkIfPhoneNumberIsUsed,
  addPhoneNumberToUser,
  registerFcmToken,
  applyFcmPreferences,
  sendTestNotification,
  blockUser,
  unblockUser,
  getBlockedUsers,
  isUserBlocking,
  isUserBlockedBy,
  getSoldCouponsAmount,
  getPurchasedCouponsAmount,
  changeProfilePicture
} from '../controllers/userController.js';

const router = express.Router();


router.get('/', getAllUsers);
router.post('/', addUser);

router.put('/register-fcm-token/:user_id', registerFcmToken);
router.put('/apply-fcm-preferences/:user_id', applyFcmPreferences);

// router.post('/test-notification/:user_id', sendTestNotification); // just for testing purposes

router.get('/is-phone-number-used', checkIfPhoneNumberIsUsed);



router.get('/:id', getUserById);
router.patch('/:uid/disable', disableFirebaseUser);
router.post('/:uid/verify-token', verifyUserToken);
router.patch('/:uid/add-phone-number', addPhoneNumberToUser);
router.patch('/:uid/change-profile-picture', changeProfilePicture);

router.put('/:uid/blocks/:blocked_uid', blockUser);
router.delete('/:uid/blocks/:blocked_uid', unblockUser);
router.get('/:uid/blocks', getBlockedUsers);
router.get('/:uid/blocks/blocking/:blocked_uid/', isUserBlocking);
router.get('/:uid/blocks/blocked-by/:blocking_uid/', isUserBlockedBy);

router.get('/:uid/sold-coupons-amount', getSoldCouponsAmount);
router.get('/:uid/purchased-coupons-amount', getPurchasedCouponsAmount);

export default router;
