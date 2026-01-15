import {
  getFavoriteCategoriesForUser as getFavoriteCategoriesForUserService,
  addCategoryToFavorites as addCategoryToFavoritesService,
  removeCategoryFromFavorites as removeCategoryFromFavoritesService,
  searchCategoriesByName as searchCategoriesByNameService,
} from '../services/categoryService.js';

import { verifyAuthorizationWithUserId } from '../services/authService.js';


export const getFavoriteCategoriesForUser = async (req, res) => {
  try {
    const { user_id } = req.params || {};
    const favoriteCategories = await getFavoriteCategoriesForUserService(user_id);
    res.json(favoriteCategories);
  } catch (error) {
    console.error('Error in getFavoriteCategoriesForUser controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
  
export const addCategoryToFavorites = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { category_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!category_id) {
      return res.status(400).json({ message: 'category_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const result = await addCategoryToFavoritesService(category_id, user_id);

    if (result.alreadySaved) {
      return res.status(200).json({ message: 'Category already in favorite list' });
    }

    res.status(201).json({ message: 'Category added to favorite list successfully' });
  } catch (error) {
    console.error('Error in addCategoryToFavorites controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const removeCategoryFromFavorites = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { category_id } = req.params || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!category_id) {
      return res.status(400).json({ message: 'category_id is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const result = await removeCategoryFromFavoritesService(category_id, user_id);

    if (result.notSaved) {
      return res.status(404).json({ message: 'Category not found in favorite list' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in removeCategoryFromFavorites controller:', error);
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const searchCategoriesByName = async (req, res) => {
  try {
    const { query } = req.query || {};
    if (!query) {
      return res.status(400).json({ message: 'Missing required query parameter: query' });
    }

    const categories = await searchCategoriesByNameService(query);
    res.json(categories);
  } catch (error) {
    console.error('Error in searchCategoriesByName controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};