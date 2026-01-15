import {
  getAllShops as getAllShopsService,
  getShopById as getShopByIdService,
  getShopLocationsInBounds as getShopLocationsInBoundsService,
  addShop as addShopService,
  getFavoriteShopsForUser as getFavoriteShopsForUserService,
  addShopToFavorites as addShopToFavoritesService,
  removeShopFromFavorites as removeShopFromFavoritesService,
  searchShopsByName as searchShopsByNameService,
  getShopsByCategory as getShopsByCategoryService,
  suggestNewShop as suggestNewShopService
} from '../services/shopService.js';

import { 
  getAvailableForPurchaseByShop as getAvailableForPurchaseByShopService,
  getAvailableForPurchaseByCategory as getAvailableForPurchaseByCategoryService
} from '../services/couponService.js';

import { verifyAuthorizationWithUserId } from '../services/authService.js';

/**
 * GET /shops
 *
 * Returns a list of all shops.
 *
 * @param {import('express').Request} _req - Express request object (unused).
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>} Sends JSON response with shops or an error status.
 */
export const getAllShops = async (_req, res) => {
  try {
    const shops = await getAllShopsService();
    res.json(shops);
  } catch (error) {
    console.error('Error in getAllShops controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * GET /shops/:id
 *
 * Returns a single shop by ID, including its locations.
 *
 * @param {import('express').Request} req - Express request object containing `params.id`.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>} Sends JSON response with the shop or a 404/500 error.
 */
export const getShopById = async (req, res) => {
  try {
    const { id } = req.params;
    const shop = await getShopByIdService(id);
    if (shop) {
      res.json(shop);
    } else {
      res.status(404).json({ message: 'Shop not found' });
    }
  } catch (error) {
    console.error('Error in getShopById controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * GET /shops/locations
 *
 * Returns locations of shops that fall within the provided geographic bounds.
 * The bounds are expected in the query parameters as `north`, `west`, `south`, and `east`.
 *
 * @param {import('express').Request} req - Express request with bound coordinates in the query parameters.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>} Sends JSON response with matching shop locations or an error.
 */
export const getShopLocationsInBounds = async (req, res) => {
  const { north, west, south, east } = req.query || {};

  const latNorth = parseFloat(north);
  const lngWest = parseFloat(west);
  const latSouth = parseFloat(south);
  const lngEast = parseFloat(east);

  if (isNaN(latNorth) || isNaN(lngWest) || isNaN(latSouth) || isNaN(lngEast)) {
    return res.status(400).json({ error: 'Invalid query parameters' });
  }

  try {
    const shopLocations = await getShopLocationsInBoundsService(latNorth, lngWest, latSouth, lngEast);
    res.json(shopLocations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shop locations' });
  }
};

/**
 * POST /shops
 *
 * Creates a new shop using the `name`, `name_color`, and `bg_color` provided
 * in the request body.
 *
 * @param {import('express').Request} req - Express request with shop data in the body.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>} Sends JSON response with the created shop or an error status.
 */


export const addShop = async (req, res) => {
  try {
    const { name, name_color, bg_color } = req.body || {};
    
    if (!name) {
      return res.status(400).json({ message: 'Missing required field: name' });
    }

    const newShop = await addShopService({ name, name_color, bg_color });
    res.status(201).json(newShop);
  } catch (error) {
    if (error.message === 'Shop name already exists') {
      return res.status(409).json({ message: 'Shop name already exists' });
    }
    console.error('Error in addShop controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getFavoriteShopsForUser = async (req, res) => {
  try {
    const { user_id } = req.params || {};
    const favoriteShops = await getFavoriteShopsForUserService(user_id);
    res.json(favoriteShops);
  } catch (error) {
    console.error('Error in getFavoriteShopsForUser controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const addShopToFavorites = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { shop_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!shop_id) {
      return res.status(400).json({ message: 'shop_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const result = await addShopToFavoritesService(shop_id, user_id);

    if (result.alreadySaved) {
      return res.status(200).json({ message: 'Shop already in favorite list' });
    }

    res.status(201).json({ message: 'Shop added to favorite list successfully' });
  } catch (error) {
    console.error('Error in addShopToFavorites controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const removeShopFromFavorites = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { shop_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!shop_id) {
      return res.status(400).json({ message: 'shop_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const result = await removeShopFromFavoritesService(shop_id, user_id);

    if (result.notSaved) {
      return res.status(404).json({ message: 'Shop not found in favorite list' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in removeShopFromFavorites controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const searchShopsByName = async (req, res) => {
  try {
    const { query } = req.query || {};
    console.log('searchShopsByName called with query:', query);
    if (!query) {
      return res.status(400).json({ message: 'Missing required query parameter: query' });
    }

    const shops = await searchShopsByNameService(query);
    res.json(shops);
  } catch (error) {
    console.error('Error in searchShopsByName controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getCouponsByShop = async (req, res) => {
  try {
    const { shop_id } = req.params || {};
    const { user_id } = req.query || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!shop_id) {
      return res.status(400).json({ message: 'shop_id is required' });
    }
    const coupons = await getAvailableForPurchaseByShopService(shop_id, user_id);
    res.json(coupons);
  } catch (error) {
    console.error('Error in getAvailableForPurchaseByShop controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getCouponsByCategory = async (req, res) => {
  try {
    const { category_id } = req.params || {};
    const { user_id } = req.query || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!category_id) {
      return res.status(400).json({ message: 'category_id is required' });
    }
    const coupons = await getAvailableForPurchaseByCategoryService(category_id, user_id);
    res.json(coupons);
  } catch (error) {
    console.error('Error in getAvailableForPurchaseByCategory controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getShopsByCategory = async (req, res) => {
  try {
    const { category_id } = req.params || {};

    if (!category_id) {
      return res.status(400).json({ message: 'category_id is required' });
    }
    const shops = await getShopsByCategoryService(category_id);
    res.json(shops);
  } catch (error) {
    console.error('Error in getShopsByCategory controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const suggestNewShop = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    console.log('suggestNewShop called with user_id:', user_id, 'and body:', req.body);
    const { shop_name, additional_info } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!shop_name) {
      return res.status(400).json({ message: 'shop_name is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    await suggestNewShopService(user_id, shop_name, additional_info);

    res.status(201).json({ message: 'Shop suggestion submitted successfully' });
  } catch (error) {
    console.error('Error in suggestNewShop controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};