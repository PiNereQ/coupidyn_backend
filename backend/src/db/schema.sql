-- USERS
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(80) NOT NULL UNIQUE,
  phone_number VARCHAR(15) UNIQUE,
  username VARCHAR(30) NOT NULL UNIQUE,
  profile_picture INT DEFAULT 0,
  reputation INT DEFAULT NULL,
  join_date DATETIME NOT NULL,
  terms_accepted BOOLEAN NOT NULL,
  terms_version VARCHAR(50) NOT NULL,
  terms_accepted_at DATETIME NOT NULL,
  privacy_accepted BOOLEAN NOT NULL,
  privacy_version VARCHAR(50) NOT NULL,
  privacy_accepted_at DATETIME NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- FCM TOKENS
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id CHAR(36) UNIQUE NOT NULL,
  token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- FCM PREFERENCES
CREATE TABLE IF NOT EXISTS fcm_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id CHAR(36) UNIQUE NOT NULL,
  chat_notifications_disabled BOOLEAN,
  coupon_notifications_disabled BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uniq_user_id (user_id)
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL UNIQUE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  name_color CHAR(7) DEFAULT '#000000',
  bg_color CHAR(7) DEFAULT '#FFFFFF',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT KEY ft_categories_name (name)
);

-- SHOPS
CREATE TABLE IF NOT EXISTS shops (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  name_color CHAR(7) DEFAULT '#000000',
  bg_color CHAR(7) DEFAULT '#FFFFFF',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FULLTEXT KEY ft_shops_name (name)
);

-- SHOPS_CATEGORIES (many-to-many relationship between shops and categories)
CREATE TABLE IF NOT EXISTS shops_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  category_id INT NOT NULL,
  UNIQUE KEY shop_category_unique (shop_id, category_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- SHOP LOCATIONS
CREATE TABLE IF NOT EXISTS shop_locations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id)
);

-- SHOP SUGGESTIONS
CREATE TABLE IF NOT EXISTS shop_suggestions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id CHAR(36),
  shop_name VARCHAR(255) NOT NULL,
  additional_info TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- COUPONS
CREATE TABLE IF NOT EXISTS coupons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  description VARCHAR(255),
  price INT NOT NULL,
  discount DECIMAL(10,2) NOT NULL,
  is_discount_percentage BOOLEAN DEFAULT FALSE,
  expiry_date DATE,
  code VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_multiple_use BOOLEAN DEFAULT FALSE,
  has_limits BOOLEAN DEFAULT FALSE,
  works_in_store BOOLEAN DEFAULT TRUE,
  works_online BOOLEAN DEFAULT TRUE,
  shop_id INT NOT NULL,
  owner_id CHAR(36),
  seller_id CHAR(36),
  is_deleted BOOLEAN DEFAULT FALSE,
  bought_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_blocked_for_payment BOOLEAN DEFAULT FALSE,
  blocked_for_payment_at TIMESTAMP NULL,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- TRANSACTIONS (HISTORIA SPRZEDAŻY)
CREATE TABLE IF NOT EXISTS transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coupon_id INT NOT NULL,
  buyer_id CHAR(36) NOT NULL,
  seller_id CHAR(36) NOT NULL,
  price INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES users(id)
);

-- USES (WYKORZYSTANIE KUPONÓW)
CREATE TABLE IF NOT EXISTS uses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coupon_id INT NOT NULL,
  user_id CHAR(36) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- SAVES (ZAPISANE KUPONY)
CREATE TABLE IF NOT EXISTS saves (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coupon_id INT NOT NULL,
  user_id CHAR(36) NOT NULL,
  saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- FAVORITE_SHOPS (ULUBIONE SKLEPY)
CREATE TABLE IF NOT EXISTS favorite_shops (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  user_id CHAR(36) NOT NULL,
  favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- FAVORITE_CATEGORIES (ULUBIONE KATEGORIE)
CREATE TABLE IF NOT EXISTS favorite_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  user_id CHAR(36) NOT NULL,
  favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  coupon_id INT NOT NULL,
  buyer_id CHAR(36) NOT NULL,
  seller_id CHAR(36) NOT NULL,
  is_read_by_buyer BOOLEAN DEFAULT FALSE,
  is_read_by_seller BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES users(id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id)
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  sender_id CHAR(36),
  content TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE,
  message_type VARCHAR(20) DEFAULT 'user',
  target_user_id CHAR(36),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- PENDING FCM MESSAGES
CREATE TABLE IF NOT EXISTS pending_fcm_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  message_title VARCHAR(255) NOT NULL,
  message_body TEXT NOT NULL,
  data_payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- BLOCKS
CREATE TABLE blocks(  
    id int NOT NULL PRIMARY KEY AUTO_INCREMENT,
    blocking_user_id CHAR(36) NOT NULL,
    blocked_user_id CHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_block (blocking_user_id, blocked_user_id),
    FOREIGN KEY (blocking_user_id) REFERENCES users(id),
    FOREIGN KEY (blocked_user_id) REFERENCES users(id)
);

-- RATINGS
CREATE TABLE IF NOT EXISTS ratings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_id INT NOT NULL,
  rated_user_id CHAR(36),
  rating_user_id CHAR(36),
  rated_user_is_seller BOOL NOT NULL,
  rating_stars INT NOT NULL,
  rating_value INT NOT NULL,
  rating_comment VARCHAR(255),
  is_cancelled BOOL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  FOREIGN KEY (rated_user_id) REFERENCES users(id),
  FOREIGN KEY (rating_user_id) REFERENCES users(id)
)

-- REPORTS
CREATE TABLE IF NOT EXISTS reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reported_user_id CHAR(36) NOT NULL,
  reporting_user_id CHAR(36) NOT NULL,
  coupon_id INT,
  report_reason VARCHAR(255) NOT NULL,
  report_details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP NULL
  FOREIGN KEY (reported_user_id) REFERENCES users(id),
  FOREIGN KEY (reporting_user_id) REFERENCES users(id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id)
);

CREATE TABLE coupon_clicks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  coupon_id INT NOT NULL,
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  UNIQUE KEY uniq_user_coupon_click (user_id, coupon_id),
  INDEX idx_user_click (user_id)
);



-- INDEXES
CREATE INDEX idx_coupons_owner ON coupons(owner_id);
CREATE INDEX idx_coupons_shop ON coupons(shop_id);
CREATE INDEX idx_coupons_expiry ON coupons(expiry_date);

CREATE INDEX idx_transactions_coupon ON transactions(coupon_id);
CREATE INDEX idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON transactions(seller_id);

CREATE INDEX idx_shop_locations_shop ON shop_locations(shop_id);

CREATE INDEX idx_fcm_tokens_user ON fcm_tokens(user_id);
CREATE INDEX idx_fcm_tokens_user ON fcm_tokens(user_id);

CREATE INDEX idx_coupons_shop_id ON coupons (shop_id);
CREATE INDEX idx_transactions_coupon_buyer ON transactions (coupon_id, buyer_id);

-- CHAT
CREATE INDEX idx_conversations_buyer_id ON conversations (buyer_id);
CREATE INDEX idx_conversations_seller_id ON conversations (seller_id);
CREATE INDEX idx_conversations_coupon_buyer_seller ON conversations (coupon_id, buyer_id, seller_id);
CREATE INDEX idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX idx_messages_conversation_sent_at ON messages (conversation_id, sent_at);
CREATE INDEX idx_messages_conversation_target_read ON messages (conversation_id, target_user_id, is_read);
CREATE INDEX idx_messages_target_read ON messages (target_user_id, is_read);
CREATE INDEX idx_messages_conversation_sender_read ON messages (conversation_id, sender_id, is_read);
CREATE INDEX idx_messages_conversation_target_read_alt ON messages (conversation_id, target_user_id, is_read);



-- USER WALLETS (główne saldo użytkownika)
CREATE TABLE IF NOT EXISTS user_wallets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL UNIQUE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pending_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'PLN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- WALLET TRANSACTIONS (historia transakcji portfela)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  wallet_id INT NOT NULL,
  user_id CHAR(36) NOT NULL,
  transaction_id INT,
  type ENUM('credit', 'debit', 'withdrawal', 'refund', 'fee') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description VARCHAR(255),
  reference_type ENUM('coupon_sale', 'withdrawal', 'refund', 'platform_fee', 'other') DEFAULT 'other',
  reference_id INT,
  status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES user_wallets(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

-- WITHDRAWAL REQUESTS (żądania wypłaty)
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  wallet_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  bank_account VARCHAR(100),
  status ENUM('pending', 'processing', 'completed', 'rejected', 'cancelled') DEFAULT 'pending',
  processed_at TIMESTAMP NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (wallet_id) REFERENCES user_wallets(id)
);

-- WALLET INDEXES
CREATE INDEX idx_user_wallets_user ON user_wallets(user_id);
CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
