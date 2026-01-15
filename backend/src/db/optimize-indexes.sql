-- Optimize Database Indexes for Performance
-- Run this file to add critical indexes that improve query performance

-- Indexes for messages table (heavily used in conversation queries)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent_at 
ON messages(conversation_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
ON messages(conversation_id);

-- Indexes for conversations table
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id 
ON conversations(buyer_id);

CREATE INDEX IF NOT EXISTS idx_conversations_seller_id 
ON conversations(seller_id);

CREATE INDEX IF NOT EXISTS idx_conversations_coupon_buyer_seller 
ON conversations(coupon_id, buyer_id, seller_id);

-- Indexes for coupons table (note: column is 'id', not 'coupon_id')
CREATE INDEX IF NOT EXISTS idx_coupons_seller_id 
ON coupons(seller_id);

CREATE INDEX IF NOT EXISTS idx_coupons_is_active_expiry 
ON coupons(is_active, expiry_date);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_username 
ON users(username);

-- Indexes for transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_coupon 
ON transactions(buyer_id, coupon_id);

-- Indexes for uses table
CREATE INDEX IF NOT EXISTS idx_uses_coupon_user 
ON uses(coupon_id, user_id);

-- Indexes for saves table
CREATE INDEX IF NOT EXISTS idx_saves_coupon_user 
ON saves(coupon_id, user_id);

-- Indexes for listings table
CREATE INDEX IF NOT EXISTS idx_listings_seller_active 
ON listings(seller_id, is_active);

-- Create query execution stats view (for monitoring)
-- This helps identify slow queries
CREATE OR REPLACE VIEW vw_conversation_stats AS
SELECT 
  c.id,
  COUNT(DISTINCT m.id) as message_count,
  MAX(m.sent_at) as latest_message_time,
  DATEDIFF(NOW(), c.created_at) as days_active
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id;

