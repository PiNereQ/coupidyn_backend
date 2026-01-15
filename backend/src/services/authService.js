import admin from '../config/firebase.js';

export async function getUidFromToken(token) {
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded.uid;
}

const authorizeToken = (authHeader) => {
  if (!authHeader) {
    throw { status: 401, message: 'Missing Authorization header' };
  }
      const lower = authHeader.toLowerCase();
    if (!lower.startsWith('bearer ')) {
      throw { status: 401, message: 'Missing Authorization header' };
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw { status: 401, message: 'Missing Authorization header' };
    }
    return token;
};
const validateTokenWithUserId = async (token, user_id) => {
  try {
    const tokenUid = await getUidFromToken(token);
    if (tokenUid !== user_id) {
      throw { status: 403, message: 'Token does not match user_id' };
    }
    return true;
  } catch (error) {
    if (error.status) {
      throw error;
    }
    throw { status: 401, message: 'Invalid token' };
  }
};

export const verifyAuthorizationWithUserId = async (authHeader, user_id) => {
  const token = authorizeToken(authHeader);
  await validateTokenWithUserId(token, user_id);
  return true;
};