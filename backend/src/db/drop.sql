-- Safely delete data in child tables first, then parents
SET FOREIGN_KEY_CHECKS=0;
DELETE FROM shop_locations;
DELETE FROM coupons;
DELETE FROM shops_categories;
DELETE FROM shops;
DELETE FROM categories;
DELETE FROM users;
SET FOREIGN_KEY_CHECKS=1;