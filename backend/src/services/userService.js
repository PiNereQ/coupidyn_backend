import pool from '../config/db.js';

import admin from '../config/firebase.js';



/**
 * Get all users from the database
 */
export const getAllUsers = async () => {
  try {
    const [rows] = await pool.query('SELECT * FROM users');
    return rows;
  } catch (error) {
    console.error('❌ Error in getAllUsers service:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    throw error;
  }
};

/**
 * Get a single user by ID
 */
export const getUserById = async (id) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id,
        u.email,
        (u.phone_number IS NOT NULL) AS phone_number_verified,
        u.username,
        u.profile_picture,
        u.reputation,
        u.join_date,
        u.terms_accepted,
        u.terms_version,
        u.terms_accepted_at,
        u.privacy_accepted,
        u.privacy_version,
        u.privacy_accepted_at,
        fp.chat_notifications_disabled,
        fp.coupon_notifications_disabled,
        u.is_deleted,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN fcm_preferences fp ON u.id = fp.user_id
      WHERE u.id = ?`, [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error in getUserById service:', error);
    console.error('Error details:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    throw error;
  }
};

/**
 * Add a new user to the database
 */
export const addUser = async ({ 
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
}) => {
  try {
    const profile_picture = Math.floor(Math.random() * 15)
    await pool.query(
      'INSERT INTO users (id, email, username, profile_picture, join_date, terms_accepted, terms_version, terms_accepted_at, privacy_accepted, privacy_version, privacy_accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, email, username, profile_picture, joinDate, termsAccepted, termsVersionAccepted, termsAcceptedAt, privacyPolicyAccepted, privacyPolicyVersionAccepted, privacyPolicyAcceptedAt]
    );

    const [newUser] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    return newUser[0];
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Username already exists');
    }
    console.error('Error in addUser service:', error);
    throw error;
  }
};

export const checkIfPhoneNumberIsUsed = async (phoneNumber) => {
  try {
    const user = await admin.auth().getUserByPhoneNumber(phoneNumber);
    console.log('User fetched by phone number:', user.uid);
    return true;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('No user found with phone number:', phoneNumber);
      return false;
    }
    console.error('❌ Error in checkIfPhoneNumberIsUsed service:', error);
    throw error;
  }
};

export const addPhoneNumberToUser = async (userId, phoneNumber) => {
  try {
    await pool.query(
      'UPDATE users SET phone_number = ? WHERE id = ?',
      [ phoneNumber, userId ]
    );
    return true;
  } catch (error) {
    console.error('❌ Error in updateUserPhoneNumber service:', error);
    throw error;
  }
};


/**
 * Disable a Firebase auth user by UID
 */
export const disableFirebaseUser = async (uid) => {
  try {
    console.log(`🔒 Disabling Firebase user with UID: ${uid}`);
    const userRecord = await admin.auth().updateUser(uid, { disabled: true });
    console.log(`✅ Successfully disabled user: ${userRecord.uid}`);

    const dbResult = await pool.query(
      'UPDATE users SET is_deleted = ? WHERE id = ?',
      [ true, uid ]
    );
    
    console.log(`✅ Successfully marked user as deleted in DB: ${uid}`);
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      disabled: userRecord.disabled,
    };
  } catch (error) {
    console.error('❌ Error in disableFirebaseUser service:', error);
    throw error;
  }
};

export const blockUser = async (blockingUserId, blockedUserId) => {
  try {
    await pool.query(
      'INSERT INTO blocks (blocking_user_id, blocked_user_id) VALUES (?, ?)',
      [blockingUserId, blockedUserId]
    );
    return true;
  } catch (error) {
    console.error('❌ Error in blockUser service:', error);
    throw error;
  }
};

export const unblockUser = async (blockingUserId, blockedUserId) => {
  try {
    await pool.query(
      'DELETE FROM blocks WHERE blocking_user_id = ? AND blocked_user_id = ?',
      [blockingUserId, blockedUserId]
    );
    return true;
  } catch (error) {
    console.error('❌ Error in unblockUser service:', error);
    throw error;
  }
};

export const isUserBlocked = async (blockingUserId, blockedUserId) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM blocks WHERE blocking_user_id = ? AND blocked_user_id = ?',
      [blockingUserId, blockedUserId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('❌ Error in isUserBlocked service:', error);
    throw error;
  }
};

export const getBlockedUsers = async (blockingUserId) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.email
       FROM blocks b
       JOIN users u ON b.blocked_user_id = u.id
       WHERE b.blocking_user_id = ?`,
      [blockingUserId]
    );
    return rows;
  } catch (error) {
    console.error('❌ Error in getBlockedUsers service:', error);
    throw error;
  }
};

export const isUserBlocking = async (blockingUserId, blockedUserId) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM blocks WHERE blocking_user_id = ? AND blocked_user_id = ?',
      [blockingUserId, blockedUserId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('❌ Error in isUserBlockedBy service:', error);
    throw error;
  }
};

export const isUserBlockedBy = async (blockedUserId, blockingUserId) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM blocks WHERE blocked_user_id = ? AND blocking_user_id = ?',
      [blockedUserId, blockingUserId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('❌ Error in isUserBlockedBy service:', error);
    throw error;
  }
};

export const changeProfilePicture = async (userId, profilePictureId) => {
  try {
    await pool.query(
      'UPDATE users SET profile_picture = ? WHERE id = ?',
      [ profilePictureId, userId ]
    );
    return true;
  } catch (error) {
    console.error('❌ Error in changeProfilePicture service:', error);
    throw error;
  }
};