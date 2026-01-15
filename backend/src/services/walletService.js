import pool from '../config/db.js';

/**
 * Get or create a wallet for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} The wallet object
 */
export const getOrCreateWallet = async (userId) => {
  const connection = await pool.getConnection();
  
  try {
    // Try to find existing wallet
    const [existing] = await connection.query(
      'SELECT * FROM user_wallets WHERE user_id = ?',
      [userId]
    );
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    // Create new wallet
    const [result] = await connection.query(
      'INSERT INTO user_wallets (user_id, balance, pending_balance, currency) VALUES (?, 0.00, 0.00, ?)',
      [userId, 'PLN']
    );
    
    const [newWallet] = await connection.query(
      'SELECT * FROM user_wallets WHERE id = ?',
      [result.insertId]
    );
    
    return newWallet[0];
  } finally {
    connection.release();
  }
};

/**
 * Get wallet balance for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Balance info
 */
export const getWalletBalance = async (userId) => {
  try {
    const wallet = await getOrCreateWallet(userId);
    return {
      balance: parseFloat(wallet.balance) * 100, // in grosze/cents
      pendingBalance: parseFloat(wallet.pending_balance),
      totalBalance: (parseFloat(wallet.balance) + parseFloat(wallet.pending_balance)) * 100, // in grosze/cents
      currency: wallet.currency,
    };
  } catch (error) {
    console.error('Error in getWalletBalance:', error);
    throw error;
  }
};

/**
 * Credit money to seller's wallet after a successful sale
 * @param {string} sellerId - The seller's user ID
 * @param {number} amount - Amount to credit (in grosze/cents)
 * @param {number} transactionId - The transaction ID for reference
 * @param {string} description - Description of the credit
 * @returns {Promise<Object>} Updated wallet info
 */
export const creditWalletFromSale = async (sellerId, amount, transactionId, description = null) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get or create wallet
    let [walletRows] = await connection.query(
      'SELECT * FROM user_wallets WHERE user_id = ? FOR UPDATE',
      [sellerId]
    );
    
    let wallet;
    if (walletRows.length === 0) {
      // Create wallet
      const [result] = await connection.query(
        'INSERT INTO user_wallets (user_id, balance, pending_balance, currency) VALUES (?, 0.00, 0.00, ?)',
        [sellerId, 'PLN']
      );
      const [newWallet] = await connection.query(
        'SELECT * FROM user_wallets WHERE id = ?',
        [result.insertId]
      );
      wallet = newWallet[0];
    } else {
      wallet = walletRows[0];
    }
    
    // Convert amount from grosze to PLN
    const amountPLN = amount / 100;
    
    // Calculate platform fee (e.g., 5%)
    const platformFeePercent = 0.05;
    const platformFee = Math.round(amountPLN * platformFeePercent * 100) / 100;
    const netAmount = Math.round((amountPLN - platformFee) * 100) / 100;
    
    // Update wallet balance
    const newBalance = parseFloat(wallet.balance) + netAmount;
    
    await connection.query(
      'UPDATE user_wallets SET balance = ?, updated_at = NOW() WHERE id = ?',
      [newBalance, wallet.id]
    );
    
    // Record the wallet transaction
    await connection.query(
      `INSERT INTO wallet_transactions 
        (wallet_id, user_id, transaction_id, type, amount, balance_after, description, reference_type, reference_id, status)
       VALUES (?, ?, ?, 'credit', ?, ?, ?, 'coupon_sale', ?, 'completed')`,
      [wallet.id, sellerId, transactionId, netAmount, newBalance, description || 'Sprzedaż kuponu', transactionId]
    );
    
    // Record platform fee as separate transaction (if needed for accounting)
    if (platformFee > 0) {
      await connection.query(
        `INSERT INTO wallet_transactions 
          (wallet_id, user_id, transaction_id, type, amount, balance_after, description, reference_type, reference_id, status)
         VALUES (?, ?, ?, 'fee', ?, ?, ?, 'platform_fee', ?, 'completed')`,
        [wallet.id, sellerId, transactionId, platformFee, newBalance, 'Prowizja platformy (5%)', transactionId]
      );
    }
    
    await connection.commit();
    
    console.log(`�� [WALLET] Credited ${netAmount} PLN to seller ${sellerId} (fee: ${platformFee} PLN)`);
    
    return {
      success: true,
      walletId: wallet.id,
      creditedAmount: netAmount,
      platformFee: platformFee,
      grossAmount: amountPLN,
      newBalance: newBalance,
      currency: wallet.currency,
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('Error in creditWalletFromSale:', error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get wallet transaction history for a user
 * @param {string} userId - The user ID
 * @param {number} limit - Number of transactions to return
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Array>} Transaction history
 */
export const getWalletTransactions = async (userId, limit = 50, offset = 0) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        wt.id,
        wt.type,
        wt.amount,
        wt.balance_after,
        wt.description,
        wt.reference_type,
        wt.status,
        wt.created_at,
        t.coupon_id,
        c.description as coupon_description,
        u.username as buyer_username
       FROM wallet_transactions wt
       LEFT JOIN transactions t ON wt.transaction_id = t.id
       LEFT JOIN coupons c ON t.coupon_id = c.id
       LEFT JOIN users u ON t.buyer_id = u.id
       WHERE wt.user_id = ?
       ORDER BY wt.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    
    return rows;
  } catch (error) {
    console.error('Error in getWalletTransactions:', error);
    throw error;
  }
};

/**
 * Request a withdrawal from wallet
 * @param {string} userId - The user ID
 * @param {number} amount - Amount to withdraw in PLN
 * @param {string} bankAccount - Bank account details
 * @returns {Promise<Object>} Withdrawal request info
 */
export const requestWithdrawal = async (userId, amount, bankAccount) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get wallet with lock
    const [walletRows] = await connection.query(
      'SELECT * FROM user_wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    
    if (walletRows.length === 0) {
      throw new Error('Wallet not found');
    }
    
    const wallet = walletRows[0];
    
    // Check if user has enough balance
    if (parseFloat(wallet.balance) < amount) {
      throw new Error('Niewystarczające środki na koncie');
    }
    
    // Minimum withdrawal amount
    const minWithdrawal = 10.00;
    if (amount < minWithdrawal) {
      throw new Error(`Minimalna kwota wypłaty to ${minWithdrawal} PLN`);
    }
    
    // Create withdrawal request
    const [result] = await connection.query(
      `INSERT INTO withdrawal_requests (user_id, wallet_id, amount, bank_account, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, wallet.id, amount, bankAccount]
    );
    
    // Move amount to pending (deduct from available balance)
    const newBalance = parseFloat(wallet.balance) - amount;
    const newPendingBalance = parseFloat(wallet.pending_balance) + amount;
    
    await connection.query(
      'UPDATE user_wallets SET balance = ?, pending_balance = ?, updated_at = NOW() WHERE id = ?',
      [newBalance, newPendingBalance, wallet.id]
    );
    
    // Record wallet transaction
    await connection.query(
      `INSERT INTO wallet_transactions 
        (wallet_id, user_id, type, amount, balance_after, description, reference_type, reference_id, status)
       VALUES (?, ?, 'withdrawal', ?, ?, ?, 'withdrawal', ?, 'pending')`,
      [wallet.id, userId, amount, newBalance, 'Żądanie wypłaty', result.insertId]
    );
    
    await connection.commit();
    
    return {
      success: true,
      withdrawalId: result.insertId,
      amount: amount,
      newBalance: newBalance,
      pendingBalance: newPendingBalance,
      status: 'pending',
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('Error in requestWithdrawal:', error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get withdrawal history for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} Withdrawal history
 */
export const getWithdrawalHistory = async (userId) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        id,
        amount,
        bank_account,
        status,
        processed_at,
        notes,
        created_at
       FROM withdrawal_requests
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return rows;
  } catch (error) {
    console.error('Error in getWithdrawalHistory:', error);
    throw error;
  }
};
