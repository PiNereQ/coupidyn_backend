import {
  getWalletBalance as getWalletBalanceService,
  getWalletTransactions as getWalletTransactionsService,
  requestWithdrawal as requestWithdrawalService,
  getWithdrawalHistory as getWithdrawalHistoryService
} from '../services/walletService.js';
import { verifyAuthorizationWithUserId } from '../services/authService.js';

/**
 * Get wallet balance for the authenticated user
 * GET /wallet/balance
 */
export const getWalletBalance = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const balance = await getWalletBalanceService(user_id);
    
    res.json({
      success: true,
      ...balance
    });
  } catch (error) {
    console.error('Error in getWalletBalance controller:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * Get wallet transaction history for the authenticated user
 * GET /wallet/transactions
 */
export const getWalletTransactions = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id, limit = 50, offset = 0 } = req.query || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const transactions = await getWalletTransactionsService(
      user_id, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({
      success: true,
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error('Error in getWalletTransactions controller:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

/**
 * Request a withdrawal from wallet
 * POST /wallet/withdraw
 * Body: { amount, bankAccount }
 */
export const requestWithdrawal = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};
    const { amount, bankAccount } = req.body || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }
    if (!amount || !bankAccount) {
      return res.status(400).json({ message: 'amount and bankAccount are required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const result = await requestWithdrawalService(user_id, parseFloat(amount), bankAccount);
    
    res.status(201).json({
      success: true,
      message: 'Żądanie wypłaty zostało złożone',
      ...result
    });
  } catch (error) {
    console.error('Error in requestWithdrawal controller:', error);
    res.status(400).json({ message: error.message || 'Nie udało się złożyć żądania wypłaty' });
  }
};

/**
 * Get withdrawal history for the authenticated user
 * GET /wallet/withdrawals
 */
export const getWithdrawalHistory = async (req, res) => {
  try {
    const authHeader = req.get('authorization');
    const { user_id } = req.query || {};

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!authHeader) {
      return res.status(400).json({ message: 'auth token is required' });
    }

    await verifyAuthorizationWithUserId(authHeader, user_id);

    const withdrawals = await getWithdrawalHistoryService(user_id);
    
    res.json({
      success: true,
      withdrawals,
      count: withdrawals.length,
    });
  } catch (error) {
    console.error('Error in getWithdrawalHistory controller:', error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};
