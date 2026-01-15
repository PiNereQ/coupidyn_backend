
import express from 'express';
import {
  getAllConversations,
  createConversation,
  checkIfConversationExists,
  getMessagesInConversation,
  sendMessageInConversation,
  markConversationAsRead,
  getUnreadSummary
} from '../controllers/chatController.js';

const router = express.Router();

router.get('/conversations/exists', checkIfConversationExists)

/**
 * @route GET /conversations
 * @desc Get all conversations for a user (buyer or seller)
 * @query user, role
 */
router.get('/conversations', getAllConversations);

/**
 * @route POST /conversations
 * @desc Create a new conversation
 */
router.post('/conversations', createConversation);

/**
 * @route GET /conversations/:conversationId/messages
 * @desc Get all messages in a conversation
 */
router.get('/conversations/:conversationId/messages', getMessagesInConversation);

/**
 * @route POST /conversations/:conversationId/messages
 * @desc Send a message in a conversation
 */
router.post('/conversations/:conversationId/messages', sendMessageInConversation);

/**
 * @route PATCH /conversations/:conversationId/read
 * @desc Mark a conversation as read
 */
router.patch('/conversations/:conversationId/read', markConversationAsRead);

/**
 * @route GET /unread-summary
 * @desc Get a summary of unread conversations/messages
 */
router.get('/unread-summary', getUnreadSummary);


export default router;
