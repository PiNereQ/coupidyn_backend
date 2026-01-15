import { 
  getAllConversationsAsBuyer as getAllConversationsAsBuyerService,
  getAllConversationsAsSeller as getAllConversationsAsSellerService,
  createConversation as createConversationService,
  checkIfConversationExists as checkIfConversationExistsService,
  getMessagesInConversation as getMessagesInConversationService,
  sendMessageInConversation as sendMessageInConversationService,
  markConversationAsRead as markConversationAsReadService,
  getUnreadSummary as getUnreadSummaryService
} from '../services/chatService.js';
import {
  verifyAuthorizationWithUserId
} from '../services/authService.js';


/**
 * Get all conversations for a user_id (buyer or seller)
 * @param {Request} req - Express request object (expects query: user_id, role)
 * @param {Response} res - Express response object
 */
export const getAllConversations = async (req, res) => {
  const { role, user_id } = req.query || {};
  const authHeader = req.get('authorization');
  if (!user_id) {
    return res.status(400).json({ message: 'user_id is required' });
  }
  await verifyAuthorizationWithUserId(authHeader, user_id);
  try {
    if (role == 'buyer') {
      const conversations = await getAllConversationsAsBuyerService(user_id);
      return res.json(conversations);
    }
    if (role == 'seller') {
      const conversations = await getAllConversationsAsSellerService(user_id);
      return res.json(conversations);
    }
    return res.status(400).json({ error: 'Invalid query parameters' });
  } catch (error) {
    console.error('Error in getAllConversations controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


/**
 * Create a new conversation (not implemented)
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
export const createConversation = async (req, res) => {
  try {
    const { coupon_id, buyer_id, seller_id } = req.body || {};
    const { user_id } = req.query;
    const authHeader = req.get('authorization');
    if (!user_id) {
    return res.status(400).json({ message: 'user_id is required' });
  }
  await verifyAuthorizationWithUserId(authHeader, user_id);
    const existingConversation = await checkIfConversationExistsService(coupon_id, buyer_id, seller_id);
    if (existingConversation) {
      return res.status(400).json({ error: 'Conversation already exists' });
    }
    const conversation = await createConversationService(coupon_id, buyer_id, seller_id);
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error in createConversation controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


export const checkIfConversationExists = async (req, res) => {
  try {
    const { coupon_id, buyer_id, seller_id, user_id } = req.query;
    const authHeader = req.get('authorization');
    if (!user_id) {
    return res.status(400).json({ message: 'user_id is required' });
    }
    console.log('checkIfConversationExists called with couponId:', coupon_id, 'buyerId:', buyer_id, 'sellerId:', seller_id, 'user_id:', user_id);
    await verifyAuthorizationWithUserId(authHeader, user_id);
    const conversation = await checkIfConversationExistsService(coupon_id, buyer_id, seller_id);
    res.json(conversation);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('Error in checkIfConversationExists controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}


/**
 * Get all messages in a conversation
 * @param {Request} req - Express request object (expects param: conversationId)
 * @param {Response} res - Express response object
 */
export const getMessagesInConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { user_id } = req.query;
    const authHeader = req.get('authorization');
    if (!user_id) {
    return res.status(400).json({ message: 'user_id is required' });
  }
  await verifyAuthorizationWithUserId(authHeader, user_id);
    const messages = await getMessagesInConversationService(conversationId, user_id);
    res.json(messages);
  } catch (error) {
    console.error('Error in getMessagesInConversation controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


/**
 * Send a message in a conversation
 * @param {Request} req - Express request object (expects param: conversationId, body: sender_id, content)
 * @param {Response} res - Express response object
 */
export const sendMessageInConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { sender_id, content } = req.body || {};
    const { user_id } = req.query;
    const authHeader = req.get('authorization');
    if (!user_id) {
    return res.status(400).json({ message: 'user_id is required' });
  }
  await verifyAuthorizationWithUserId(authHeader, user_id);
    const result = await sendMessageInConversationService(conversationId, sender_id, content);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in sendMessageInConversation controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { user_id } = req.query;
    const authHeader = req.get('authorization');
    if (!user_id) {
    return res.status(400).json({ message: 'user_id is required' });
  }
  await verifyAuthorizationWithUserId(authHeader, user_id);
    await markConversationAsReadService(conversationId, user_id);
    res.status(200).json({ message: 'Conversation marked as read' });
  } catch (error) {
    console.error('Error in markConversationAsRead controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getUnreadSummary = async (req, res) => {
  try {
    const { user_id } = req.query || {};
    console.log('getUnreadSummary called with user_id:', user_id);
    const authHeader = req.get('authorization');
    if (!user_id) {
    return res.status(400).json({ message: 'user_id is required' });
  }
  await verifyAuthorizationWithUserId(authHeader, user_id);
    const summary = await getUnreadSummaryService(user_id);
    res.json(summary);
  } catch (error) {
    console.error('Error in getUnreadSummary controller:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};