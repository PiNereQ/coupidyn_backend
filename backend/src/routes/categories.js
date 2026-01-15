import express from 'express';
import {
  getFavoriteCategoriesForUser,
  addCategoryToFavorites,
  removeCategoryFromFavorites
} from '../controllers/categoryController.js';

const router = express.Router();


router.get('/favorites/:user_id', getFavoriteCategoriesForUser);
router.post('/favorites/:category_id', addCategoryToFavorites);
router.delete('/favorites/:category_id', removeCategoryFromFavorites);

export default router;
