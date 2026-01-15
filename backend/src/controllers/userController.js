import {
  getAllUsers as getAllUsersService,
  getUserById as getUserByIdService,
  addUser as addUserService,
  disableFirebaseUser as disableFirebaseUserService,
  checkIfPhoneNumberIsUsed as checkIfPhoneNumberIsUsedService,
  addPhoneNumberToUser as addPhoneNumberToUserService,
  blockUser as blockUserService,
  unblockUser as unblockUserService,
  getBlockedUsers as getBlockedUsersService,
  isUserBlocking as isUserBlockingService,
  isUserBlockedBy as isUserBlockedByService,
  changeProfilePicture as changeProfilePictureService
} from '../services/userService.js';

import {
  registerFcmToken as registerFcmTokenService, 
  sendNotification as sendNotificationService,
  applyFcmPreferences as applyFcmPreferencesService
} from '../services/fcmService.js';



import {
  getSoldCouponsAmount as getSoldCouponsAmountService,
  getPurchasedCouponsAmount as getPurchasedCouponsAmountService
} from '../services/couponService.js';

import { verifyAuthorizationWithUserId } from '../services/authService.js';


// Helper: convert ISO 8601 (with T and Z) or Date to MySQL DATETIME 'YYYY-MM-DD HH:MM:SS'
const isoToMysqlDatetime = (input) => {
  if (!input) return null;
  const d = (input instanceof Date) ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Controller: handles HTTP layer and delegates business logic to services.
 */
export const getAllUsers = async (_req, res) => {
  try {
    console.log('📥 GET /users request received');
    const users = await getAllUsersService();
    console.log('📤 Sending response with users');
    res.json(users);
  } catch (error) {
    console.error('❌ Error in getAllUsers controller:', error);
    res.status(500).json({ 
      message: 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.get('authorization');
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);
    const user = await getUserByIdService(id);
    if (user) {
      if (id !== user_id) {
        user.email = '';
        user.chat_notifications_disabled = null;
        user.coupon_notifications_disabled = null;
        user.terms_accepted = null;
        user.terms_version = null;
        user.terms_accepted_at = null;
        user.privacy_accepted = null;
        user.privacy_version = null;
        user.privacy_accepted_at = null;
      }
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error in getUserById controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const addUser = async (req, res) => {
  try {
    const { 
      id,
      email,
      username,
      joinDate,
      termsAccepted,
      termsVersionAccepted,
      termsAcceptedAt,
      privacyPolicyAccepted,
      privacyPolicyVersionAccepted,
      privacyPolicyAcceptedAt
    } = req.body || {};

    // Convert and validate datetime fields (accept ISO strings or Date objects)
    const joinDateFormatted = isoToMysqlDatetime(joinDate);
    const termsAcceptedAtFormatted = isoToMysqlDatetime(termsAcceptedAt);
    const privacyPolicyAcceptedAtFormatted = isoToMysqlDatetime(privacyPolicyAcceptedAt);

    if (
      !id ||
      !email ||
      !username ||
      termsAccepted === undefined ||
      !termsVersionAccepted ||
      privacyPolicyAccepted === undefined ||
      !privacyPolicyVersionAccepted ||
      !joinDateFormatted ||
      !termsAcceptedAtFormatted ||
      !privacyPolicyAcceptedAtFormatted
    ) {
      return res.status(400).json({ 
        message: 'Missing or invalid required fields: id, email, username, joinDate, termsAccepted, termsVersionAccepted, termsAcceptedAt, privacyPolicyAccepted, privacyPolicyVersionAccepted, privacyPolicyAcceptedAt' 
      });
    }

    const newUser = await addUserService({ 
      id,
      email, 
      username, 
      joinDate: joinDateFormatted,
      termsAccepted, 
      termsVersionAccepted, 
      termsAcceptedAt: termsAcceptedAtFormatted,
      privacyPolicyAccepted, 
      privacyPolicyVersionAccepted, 
      privacyPolicyAcceptedAt: privacyPolicyAcceptedAtFormatted
    });
    res.status(201).json(newUser);
  } catch (error) {
    if (error.message === 'Username already exists') {
      return res.status(409).json({ message: 'Username already exists' });
    }
    console.error('Error in addUser controller:', error);
    res.status(500).json({ message: 'Internal Server Error here', error});
  } finally {
    sendNotificationService("MVVHnIAnY1YhRaMDR5CPLxWNLEh1", "Uwaga", `Utworzono użytkownika ${username} z id: ${id}!`);
  }
};

export const disableFirebaseUser = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).json({ message: 'Missing uid parameter' });
    }

    await verifyAuthorizationWithUserId(authHeader, uid);

    const result = await disableFirebaseUserService(uid);

    return res.status(200).json({
      message: 'User disabled in Firebase',
      user: result.uid,
    });
  } catch (error) {
    console.error('❌ Error in disableFirebaseUser controller:', error);
    return res.status(500).json({ message: '1234', details: error.message});
  }
};

export const checkIfPhoneNumberIsUsed = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id, phone_number } = req.query;
    console.log('Checking phone number:', phone_number, 'for user_id:', user_id);

    var is_used = true;
    if (!phone_number) {
      return res.status(400).json({ message: 'Missing phoneNumber parameter' });
    }
     console.log('phone_number parameter is present:', phone_number);
    
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    console.log('user_id parameter is present:', user_id);

    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }
    console.log('Authorization header is present');

    await verifyAuthorizationWithUserId(authHeader, user_id);
    console.log('Authorization verified for user_id:', user_id);

    is_used = await checkIfPhoneNumberIsUsedService(phone_number);
    console.log(`Phone number ${phone_number} is used:`, is_used);

    return res.status(200).json({
      phone_number: phone_number,
      is_used,
    });
  } catch (error) {
    console.error('❌ Error in checkIfPhoneNumberIsUsed controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const addPhoneNumberToUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const { phone_number } = req.body;
    const authHeader = req.get('authorization');
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);

    if (!uid) {
      return res.status(400).json({ message: 'Missing uid parameter' });
    }

    if (!phone_number) {
      return res.status(400).json({ message: 'Missing phoneNumber in request body' });
    }

    const isUsed = await checkIfPhoneNumberIsUsedService(phone_number);
    if (isUsed) {
      return res.status(409).json({ message: 'Phone number is already in use' });
    }

    await addPhoneNumberToUserService(uid, phone_number);

    return res.status(200).json({
      message: 'Phone number added to user',
      uid,
      phoneNumber: phone_number,
    });
  } catch (error) {
    console.error('❌ Error in addPhoneNumberToUser controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

// Is it needed here?
export const verifyUserToken = async (req, res) => {
  try {
    const { uid } = req.params;
    const authHeader = req.get('authorization');
    
    if (!uid) {
      return res.status(400).json({ message: 'Missing uid parameter' });
    }

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

    let decodedUid;
    try {
      decodedUid = await getUidFromToken(token);
    } catch (err) {
      console.error('❌ Error verifying token in verifyUserToken controller:', err);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (decodedUid !== uid) {
      return res.status(403).json({ message: 'Token does not belong to supplied uid' });
    }

    return res.status(200).json({
      message: 'Token is valid for supplied uid',
      uid,
    });
  } catch (error) {
    console.error('❌ Error in verifyUserToken controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const registerFcmToken = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.params || {};
    const { fcm_token } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ message: 'Missing user_id parameter' });
    }
    
    await verifyAuthorizationWithUserId(authHeader, user_id);

    if (!fcm_token) {
      return res.status(400).json({ message: 'Missing fcmToken in request body' });
    }

    await registerFcmTokenService(user_id, fcm_token);

    return res.status(200).json({
      message: 'FCM token registered/updated successfully',
      user_id,
      fcm_token,
    });
  } catch (error) {
    console.error('❌ Error in registerFcmToken controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const applyFcmPreferences = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.params || {};
    const { chat_notifications_disabled, coupon_notifications_disabled } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ message: 'Missing user_id parameter' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);

    if (chat_notifications_disabled === undefined && coupon_notifications_disabled === undefined) {
      return res.status(400).json({ message: 'Missing or invalid preferences in request body' });
    }

    await applyFcmPreferencesService(user_id, chat_notifications_disabled, coupon_notifications_disabled);

    return res.status(200).json({
      message: 'FCM preferences applied successfully',
      user_id,
      chat_notifications_disabled,
      coupon_notifications_disabled
    });
  } catch (error) {
    console.error('❌ Error in applyFcmPreferences controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const sendTestNotification = async (req, res) => {
  try {
    const { user_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'Missing user_id parameter' });
    }

    await sendNotificationService(user_id, "Title", "This is a test notification.", {});

    return res.status(200).json({
      message: 'Test notification sent successfully',
      user_id,
    });
  } catch (error) {
    console.error('❌ Error in sendTestNotification controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { uid, blocked_uid } = req.params;

    await verifyAuthorizationWithUserId(req.get('authorization'), uid);

    await blockUserService(uid, blocked_uid);
    return res.status(200).json({
      message: `User ${blocked_uid} blocked by ${uid}`,
    });
  } catch (error) {
    console.error('❌ Error in blockUser controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { uid, blocked_uid } = req.params;

    await verifyAuthorizationWithUserId(req.get('authorization'), uid);

    await unblockUserService(uid, blocked_uid);
    return res.status(200).json({
      message: `User ${blocked_uid} unblocked by ${uid}`,
    });
  } catch (error) {
    console.error('❌ Error in unblockUser controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const { uid } = req.params;

    await verifyAuthorizationWithUserId(req.get('authorization'), uid);

    const blockedUsers = await getBlockedUsersService(uid);
    return res.status(200).json(blockedUsers);
  } catch (error) {
    console.error('❌ Error in getBlockedUsers controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const isUserBlocking = async (req, res) => {
  try {
    const { uid, blocked_uid } = req.params;

    await verifyAuthorizationWithUserId(req.get('authorization'), uid);

    const isBlocked = await isUserBlockingService(uid, blocked_uid);
    return res.status(200).json({
      is_blocked: isBlocked,
    });
  } catch (error) {
    console.error('❌ Error in isUserBlockedBy controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const isUserBlockedBy = async (req, res) => {
  try {
    const { uid, blocking_uid } = req.params;

    await verifyAuthorizationWithUserId(req.get('authorization'), uid);

    const isBlocked = await isUserBlockedByService(uid, blocking_uid);
    return res.status(200).json({
      is_blocked: isBlocked,
    });
  } catch (error) {
    console.error('❌ Error in isUserBlockedBy controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const getSoldCouponsAmount = async (req, res) => {
  try {
    const { uid } = req.params;

    await verifyAuthorizationWithUserId(req.get('authorization'), uid);

    const amount = await getSoldCouponsAmountService(uid);
    return res.status(200).json({
      sold_coupons_amount: amount,
    });
  } catch (error) {
    console.error('❌ Error in getSoldCouponsAmount controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const getPurchasedCouponsAmount = async (req, res) => {
  try {
    const { uid } = req.params;

    await verifyAuthorizationWithUserId(req.get('authorization'), uid);

    const amount = await getPurchasedCouponsAmountService(uid);
    return res.status(200).json({
      purchased_coupons_amount: amount,
    });
  } catch (error) {
    console.error('❌ Error in getPurchasedCouponsAmount controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};

export const changeProfilePicture = async (req, res) => {
  try {
    const { uid } = req.params;
    const { profile_picture_id } = req.body;
    const authHeader = req.get('authorization');
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);

    if (!uid) {
      return res.status(400).json({ message: 'Missing uid parameter' });
    }

    if (profile_picture_id === undefined) {
      return res.status(400).json({ message: 'Missing profile_picture_id in request body' });
    }

    await changeProfilePictureService(uid, profile_picture_id);

    return res.status(200).json({
      message: 'Profile picture updated successfully',
      uid,
      profile_picture_id,
    });
  } catch (error) {
    console.error('❌ Error in changeProfilePicture controller:', error);
    return res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
};