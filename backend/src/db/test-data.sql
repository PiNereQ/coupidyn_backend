-- ============================================
-- TEST DATA FOR COUPON MARKETPLACE DATABASE
-- Adapted for MySQL and current `schema.sql`
-- ============================================

-- Clear tables in correct order and reset auto-increments
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE TABLE transactions;
TRUNCATE TABLE listings;
TRUNCATE TABLE coupons;
TRUNCATE TABLE shop_locations;
TRUNCATE TABLE shops;
TRUNCATE TABLE categories;
TRUNCATE TABLE shops_categories;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS=1;

-- ============================================
-- USERS
-- Use fixed UUID-like CHAR(36) ids so other inserts can reference them
-- ============================================
INSERT INTO users (
	id, username, email, reputation, join_date,
	terms_accepted, terms_version, terms_accepted_at,
	privacy_accepted, privacy_version, privacy_accepted_at
) VALUES
('11111111-1111-1111-1111-111111111111','adam123','adam@example.com',10,'2025-01-01 10:00:00',1,'1','2025-01-01 10:00:00',1,'1','2025-01-01 10:00:00'),
('22222222-2222-2222-2222-222222222222','kasia_k','kasia@example.com',5,'2025-02-01 11:00:00',1,'1','2025-02-01 11:00:00',1,'1','2025-02-01 11:00:00'),
('33333333-3333-3333-3333-333333333333','marek90','marek@example.com',7,'2025-03-01 12:00:00',1,'1','2025-03-01 12:00:00',1,'1','2025-03-01 12:00:00'),
('44444444-4444-4444-4444-444444444444','ola_s','ola@example.com',3,'2025-04-01 09:00:00',0,'1','2025-04-01 09:00:00',0,'1','2025-04-01 09:00:00');

-- ============================================
-- SHOPS
-- ============================================
INSERT INTO shops (name, name_color, bg_color) VALUES
('MediaWorld', '#FF5733', '#C70039'),
('FreshMarket', '#33FF57', '#39C7C7'),
('FitLife', '#00AACC', '#E0F7FA'),
('BookPlanet', '#333333', '#FFFFFF');

-- ============================================
-- SHOP LOCATIONS (uses schema: shop_id, latitude, longitude)
-- ============================================
INSERT INTO shop_locations (shop_id, latitude, longitude) VALUES
(0, 52.2297, 21.0122),
(0, 52.4064, 16.9252),
(0, 54.3520, 18.6466),
(0, 50.0647, 19.9450),
(0, 51.7592, 19.4550);

-- ============================================
-- CATEGORIES and shops_categories (optional small set)
-- ============================================
INSERT INTO categories (name) VALUES
('Electronics'),
('Groceries'),
('Fitness'),
('Books');

INSERT INTO shops_categories (shop_id, category_id) VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 4);

-- ============================================
-- COUPONS
-- Fields: description, price, discount, is_discount_percentage, expiry_date, code, is_active, has_limits, works_in_store, works_online, shop_id, owner_id
-- ============================================
INSERT INTO coupons (description, price, discount, is_discount_percentage, expiry_date, code, is_active, has_limits, works_in_store, works_online, shop_id, owner_id) VALUES
('20% off Electronics', 100.00, 20.00, 1, '2025-12-31', 'ELEC20', 1, 0, 1, 1, 1, '11111111-1111-1111-1111-111111111111'),
('10% off Clothing', 50.00, 10.00, 1, '2026-01-01', 'CLOTH10', 1, 1, 1, 0, 1, '22222222-2222-2222-2222-222222222222'),
('Flat $25 off Books', 25.00, 25.00, 0, '2025-12-25', 'BOOK25', 1, 0, 0, 1, 4, '33333333-3333-3333-3333-333333333333');

-- ============================================
-- LISTINGS (seller offers)
-- Fields: coupon_id, seller_id, price, is_active
-- ============================================
INSERT INTO listings (coupon_id, seller_id, price, is_active) VALUES
(1, '11111111-1111-1111-1111-111111111111', 50.00, 1),
(2, '11111111-1111-1111-1111-111111111111', 30.00, 1),
(3, '22222222-2222-2222-2222-222222222222', 40.00, 1);

-- ============================================
-- TRANSACTIONS (history)
-- Fields: coupon_id, listing_id, buyer_id, seller_id, price
-- ============================================
INSERT INTO transactions (coupon_id, listing_id, buyer_id, seller_id, price) VALUES
(3, 3, '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 25.00),
(1, 1, '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 45.00);

-- Done
