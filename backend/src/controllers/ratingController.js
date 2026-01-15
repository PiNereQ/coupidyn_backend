import {
  addRating as addRatingService,
  getRatingsForUser as getRatingsForUserService,
  ratingExistsByBuyerForConversation as ratingExistsByBuyerForConversationService,
  ratingExistsBySellerForConversation as ratingExistsBySellerForConversationService
} from '../services/ratingService.js';
import { 
  verifyAuthorizationWithUserId,
} from '../services/authService.js';

export const addRating = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    const {
      conversation_id,
      rated_user_id,
      rating_user_id,
      rated_user_is_seller,
      rating_stars,
      rating_value,
      rating_comment} = req.body || {};
    if (!rated_user_id) {
      return res.status(401).json({ message: 'Missing User Id' });
    }
    await verifyAuthorizationWithUserId(authHeader, rating_user_id);
    
    const newRating = await addRatingService(
      conversation_id,
      rated_user_id,
      rating_user_id,
      rated_user_is_seller,
      rating_stars,
      rating_value,
      rating_comment
    );
    res.status(201).json(newRating);
  } catch (error) {
    if (error.status && error.message) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error in addRating controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getRatingsForUser = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.params;
    if (!authHeader) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    if (!user_id) {
      return res.status(401).json({ message: 'Missing User Id' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);


    console.log('Fetching ratings for userId:', user_id);
    const ratings = await getRatingsForUserService(user_id);

    res.status(200).json(ratings);
  } catch (error) {
    if (error.status && error.message) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error in getRatingsForUser controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const ratingExistsByBuyerForConversation = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id, conversation_id } = req.params;
    if (!authHeader) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    if (!user_id || !conversation_id) {
      return res.status(401).json({ message: 'Missing User Id or Coupon Id' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);

    const exists = await ratingExistsByBuyerForConversationService(user_id, conversation_id);

    res.status(200).json({ exists });
  } catch (error) {
    if (error.status && error.message) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error in ratingExistsByUserForCoupon controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const ratingExistsBySellerForConversation = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id, conversation_id } = req.params;
    if (!authHeader) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    if (!user_id || !conversation_id) {
      return res.status(401).json({ message: 'Missing User Id or Coupon Id' });
    }
    await verifyAuthorizationWithUserId(authHeader, user_id);

    const exists = await ratingExistsBySellerForConversationService(user_id, conversation_id);

    res.status(200).json({ exists });
  } catch (error) {
    if (error.status && error.message) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error in ratingExistsBySellerForConversation controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};