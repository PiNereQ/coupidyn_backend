// POST /payments/create-payment-intent
// POST /payments/confirm-payment

import express from 'express';
import Stripe from 'stripe';
import { blockCouponTemporarily, unblockCouponAfterFailure, deactivateCoupon, isAvailable, removeCouponFromSaved } from './couponService.js';
import { createTransaction } from './transactionService.js';
import { creditWalletFromSale } from './walletService.js';
import {verifyAuthorizationWithUserId} from './authService.js';

const router = express.Router();

// YOUR SECRET KEY - stored ONLY on server
const stripe = new Stripe("sk_test_51RZ6Tm4DImOdy65uBFzh0SroA2FUBxuk5gLX6pq8cNnjdnUjys2uj2ioPZvq3SYUornlg9poak2ypcvwLATsAD5F007SPagDrl");  

/**
 * POST /payments/create-payment-intent
 * Creates a Stripe PaymentIntent and blocks the coupon temporarily
 */
router.post('/create-payment-intent', async (req, res) => {
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
    const { amount, couponId } = req.body;
    console.log('📋 [CREATE-PAYMENT] Received request:', { amount, couponId });

    if (!amount) {
      console.warn('⚠️ [CREATE-PAYMENT] Missing amount');
      return res.status(400).json({ error: 'Amount is required' });
    }

    // Stripe minimum for PLN is 200 (2.00 PLN)
    if (amount < 200) {
      console.warn('⚠️ [CREATE-PAYMENT] Amount too low:', amount);
      return res.status(400).json({ error: 'Amount must be at least 2.00 PLN' });
    }
    const available = await isAvailable(couponId);
    if (!available) {
      console.warn('⚠️ [CREATE-PAYMENT] Coupon not available:', couponId);
      return res.status(400).json({ error: 'Coupon is not available for purchase' });
    }

    // Block coupon temporarily to prevent other buyers from purchasing
    console.log('🔒 [CREATE-PAYMENT] Blocking coupon:', couponId);
    await blockCouponTemporarily(couponId);
    console.log('✓ [CREATE-PAYMENT] Coupon blocked successfully');

    // Create PaymentIntent
    console.log('💳 [CREATE-PAYMENT] Creating Stripe PaymentIntent for amount:', amount);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'pln',
      automatic_payment_methods: { enabled: true },
      metadata: {
        couponId: couponId || 'unknown',
      },
    });
    console.log('✓ [CREATE-PAYMENT] PaymentIntent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });

  } catch (err) {
    console.error('❌ [CREATE-PAYMENT] Error:', err.message);
    console.error('   Full error:', err);
    res.status(500).json({ error: err.message || 'Payment intent creation failed' });
  }
});

/**
 * POST /payments/confirm-payment
 * Confirms successful payment and creates transaction
 * Expected body: { paymentIntentId, couponId, buyerId, sellerId, price, isMultipleUse }
 */
router.post('/confirm-payment', async (req, res) => {
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
    const { paymentIntentId, couponId, buyerId, sellerId, price, isMultipleUse } = req.body;

    // Validate required fields
    if (!paymentIntentId || !couponId || !buyerId || !sellerId || !price) {
      return res.status(400).json({
        error: 'Missing required fields: paymentIntentId, couponId, buyerId, sellerId, price',
      });
    }

    // Verify payment was successful with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      // Payment failed - unblock the coupon
      return res.status(400).json({ 
        error: `Payment not successful. Status: ${paymentIntent.status}` 
      });
    }
    await unblockCouponAfterFailure(couponId);
  
    // Payment succeeded - create transaction
    const transaction = await createTransaction({
      couponId,
      buyerId,
      sellerId,
      price,
    });

    // Credit seller's wallet with the payment amount (minus platform fee)
    let walletResult = null;
    try {
      walletResult = await creditWalletFromSale(
        sellerId,
        price, // price is in grosze (cents)
        transaction.id,
        `Sprzedaż kuponu #${couponId}`
      );
      console.log('💰 [CONFIRM-PAYMENT] Seller wallet credited:', walletResult);
    } catch (walletError) {
      // Log error but don't fail the transaction - wallet credit can be retried
      console.error('⚠️ [CONFIRM-PAYMENT] Wallet credit failed:', walletError.message);
      // The transaction is still valid, but wallet credit needs manual reconciliation
    }

    // Deactivate coupon if not multiple use
    await deactivateCoupon(couponId, isMultipleUse);
    await removeCouponFromSaved(couponId, buyerId);

    res.status(201).json({
      success: true,
      message: 'Payment confirmed and transaction created',
      transaction,
      walletCredit: walletResult ? {
        creditedAmount: walletResult.creditedAmount,
        platformFee: walletResult.platformFee,
        newBalance: walletResult.newBalance,
      } : null,
    });

  } catch (err) {
    console.error('Payment Confirmation Error:', err);
    res.status(500).json({ error: err.message || 'Payment confirmation failed' });
  }
});

/**
 * POST /payments/cancel-payment
 * Cancels payment and unblocks the coupon
 * Expected body: { couponId }
 */
router.post('/cancel-payment', async (req, res) => {
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
    const { couponId } = req.body;

    if (!couponId) {
      return res.status(400).json({ error: 'couponId is required' });
    }

    // Unblock the coupon
    await unblockCouponAfterFailure(couponId);

    res.json({
      success: true,
      message: 'Payment cancelled and coupon unblocked',
    });

  } catch (err) {
    console.error('Payment Cancellation Error:', err);
    res.status(500).json({ error: err.message || 'Payment cancellation failed' });
  }
});

export default router;
