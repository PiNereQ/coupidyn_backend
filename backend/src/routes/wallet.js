import express from 'express';
import {
  getWalletBalance,
  getWalletTransactions,
  requestWithdrawal,
  getWithdrawalHistory
} from '../controllers/walletController.js';

const router = express.Router();

/**
 * @route GET /wallet/balance
 * @desc Get wallet balance for authenticated user
 * @query user_id
 */
router.get('/balance', getWalletBalance);

/**
 * @route GET /wallet/transactions
 * @desc Get wallet transaction history
 * @query user_id, limit, offset
 */
router.get('/transactions', getWalletTransactions);

/**
 * @route POST /wallet/withdraw
 * @desc Request a withdrawal from wallet
 * @body { amount, bankAccount }
 */
router.post('/withdraw', requestWithdrawal);

/**
 * @route GET /wallet/withdrawals
 * @desc Get withdrawal request history
 * @query user_id
 */
router.get('/withdrawals', getWithdrawalHistory);

export default router;
