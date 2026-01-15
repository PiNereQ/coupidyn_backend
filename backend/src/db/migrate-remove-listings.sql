-- Migration: Remove listings table and listing_id from transactions
-- This script preserves all other data (users, coupons, transactions history, etc.)

-- Step 1: Drop foreign key constraint from transactions table
ALTER TABLE transactions DROP FOREIGN KEY transactions_ibfk_2;

-- Step 2: Drop listing_id column from transactions table
ALTER TABLE transactions DROP COLUMN listing_id;

-- Step 3: Drop listings table
DROP TABLE IF EXISTS listings;

-- Verification
SELECT "Migration complete! Listings table and listing_id column removed." as status;
