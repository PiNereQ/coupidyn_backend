-- Migration: Add User Wallet System
-- This migration adds tables for storing user balances and wallet transaction history

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

-- INDEXES
CREATE INDEX idx_user_wallets_user ON user_wallets(user_id);
CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);

-- Verification
SELECT "Wallet system migration complete!" as status;
