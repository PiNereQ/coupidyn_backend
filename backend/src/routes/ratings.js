import express from 'express';
import {
  addRating,
  getRatingsForUser,
  ratingExistsByBuyerForConversation,
  ratingExistsBySellerForConversation
} from '../controllers/ratingController.js';

const router = express.Router();

router.post('/', addRating);

router.get('/:user_id', getRatingsForUser);

router.get('/rating-by-buyer-exists/:user_id/:conversation_id', ratingExistsByBuyerForConversation);
router.get('/rating-by-seller-exists/:user_id/:conversation_id', ratingExistsBySellerForConversation);

export default router;
