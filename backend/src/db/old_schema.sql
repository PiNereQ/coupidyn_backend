-- Create Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL UNIQUE,
  reputation INT NOT NULL,
  joinDate VARCHAR(255) NOT NULL,
  termsAccepted BOOLEAN NOT NULL,
  termsVersionAccepted VARCHAR(50) NOT NULL,
  termsAcceptedAt VARCHAR(255) NOT NULL,
  privacyPolicyAccepted BOOLEAN NOT NULL,
  privacyPolicyVersionAccepted VARCHAR(50) NOT NULL,
  privacyPolicyAcceptedAt VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Shops table
CREATE TABLE IF NOT EXISTS shops (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  nameColor VARCHAR(7) DEFAULT '#000000',
  bgColor VARCHAR(7) DEFAULT '#FFFFFF',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create Shops_Categories junction table (now has its own auto-increment id)
CREATE TABLE IF NOT EXISTS shops_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  category_id INT NOT NULL,
  UNIQUE KEY shop_category_unique (shop_id, category_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Create Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id INT PRIMARY KEY AUTO_INCREMENT,
  description VARCHAR(255),
  price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) NOT NULL,
  is_discount_percentage BOOLEAN DEFAULT false,
  expiry_date DATE,
  code VARCHAR(50) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  has_limits BOOLEAN DEFAULT false,
  works_in_store BOOLEAN DEFAULT true,
  works_online BOOLEAN DEFAULT true,
  shop_id INT,
  seller_id VARCHAR(255),
  owner_id VARCHAR(255),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  bought_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create table Shop_locations
CREATE TABLE IF NOT EXISTS shop_locations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);