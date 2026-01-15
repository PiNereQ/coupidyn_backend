import express from 'express';
import {
  getAllShops,
  getShopById,
  getShopLocationsInBounds,
  addShop,
  getFavoriteShopsForUser,
  addShopToFavorites,
  removeShopFromFavorites,
  searchShopsByName,
  getCouponsByCategory,
  getCouponsByShop,
  getShopsByCategory,
  suggestNewShop
} from '../controllers/shopController.js';
import {
  searchCategoriesByName,
  getFavoriteCategoriesForUser,
  addCategoryToFavorites,
  removeCategoryFromFavorites
} from '../controllers/categoryController.js';

const router = express.Router();

/**
 * Shop routes.
 *
 * Base path is typically mounted as `/shops`.
 */

/**
 * GET /shops/locations
 *
 * Returns shop locations that fall within given geographic bounds.
 * Expects boundary values as query parameters: `north`, `west`, `south`, `east`.
 */
router.get('/locations', getShopLocationsInBounds);


router.get('/favorites/:user_id', getFavoriteShopsForUser);
router.post('/favorites/:shop_id', addShopToFavorites);
router.delete('/favorites/:shop_id', removeShopFromFavorites);


router.get('/categories/favorites/:user_id', getFavoriteCategoriesForUser);
router.post('/categories/favorites/:category_id', addCategoryToFavorites);
router.delete('/categories/favorites/:category_id', removeCategoryFromFavorites);


// get shops by name
router.get('/search', searchShopsByName);

// search categories by name
router.get('/categories/search', searchCategoriesByName);
// get coupons for a category
router.get('/categories/:category_id/coupons', getCouponsByCategory);

// get shops by category
router.get('/categories/:category_id/shops', getShopsByCategory);



router.post('/suggest', suggestNewShop);

// get coupons for a shop
router.get('/:shop_id/coupons', getCouponsByShop);



/**
 * GET /shops
 *
 * Returns a list of all shops with aggregated data.
 */
router.get('/', getAllShops);

/**
 * GET /shops/:id
 *
 * Returns details for a single shop identified by its ID.
 */
router.get('/:id', getShopById);

/**
 * POST /shops
 *
 * Creates a new shop using values provided in the request body.
 */
router.post('/', addShop);

export default router;
