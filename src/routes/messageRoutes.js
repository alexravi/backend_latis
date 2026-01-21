// Message routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  listConversations,
  getConversation,
  createConversation,
  sendMessage,
  getMessages,
  markConversationAsRead,
  deleteConversation,
  editMessage,
  deleteMessage,
  searchMessages,
  getUnreadCount,
  addReaction,
  removeReaction,
  getMessageReactions,
  forwardMessage,
  validateSendMessage,
  validateEditMessage,
  validateAddReaction,
} = require('../controllers/messageController');

/**
 * @swagger
 * /api/messages/conversations:
 *   get:
 *     summary: List all conversations for current user
 *     description: Get all conversations with pagination, sorted by last message time
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of conversations to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of conversations to skip
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/conversations', authenticateToken, listConversations);

/**
 * @swagger
 * /api/messages/conversations:
 *   post:
 *     summary: Create or get conversation with a user
 *     description: Create a new conversation or return existing one with the specified user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient_id
 *             properties:
 *               recipient_id:
 *                 type: integer
 *                 example: 2
 *                 description: ID of the user to start conversation with
 *     responses:
 *       200:
 *         description: Conversation created or retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: Invalid recipient ID
 *       403:
 *         description: Cannot message this user (blocked)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/conversations', authenticateToken, createConversation);

/**
 * @swagger
 * /api/messages/conversations/{id}:
 *   get:
 *     summary: Get conversation details
 *     description: Get detailed information about a specific conversation
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       403:
 *         description: Not a participant in this conversation
 *       404:
 *         description: Conversation not found
 *       401:
 *         description: Unauthorized
 */
router.get('/conversations/:id', authenticateToken, getConversation);

/**
 * @swagger
 * /api/messages/conversations/{id}:
 *   delete:
 *     summary: Delete conversation (soft delete)
 *     description: Soft delete conversation for current user (conversation persists for other user)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation deleted successfully
 *       403:
 *         description: Not a participant in this conversation
 *       401:
 *         description: Unauthorized
 */
router.delete('/conversations/:id', authenticateToken, deleteConversation);

/**
 * @swagger
 * /api/messages/conversations/{id}/messages:
 *   get:
 *     summary: Get messages in a conversation
 *     description: Retrieve messages from a conversation with pagination
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of messages to skip
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *       403:
 *         description: Not a participant in this conversation
 *       401:
 *         description: Unauthorized
 */
router.get('/conversations/:id/messages', authenticateToken, getMessages);

/**
 * @swagger
 * /api/messages/conversations/{id}/messages:
 *   post:
 *     summary: Send a message in a conversation
 *     description: Send a new message to a conversation. Real-time event emitted to participants.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10000
 *                 example: "Hello, how are you?"
 *                 description: Message content (required if no attachment)
 *               attachment_url:
 *                 type: string
 *                 format: uri
 *                 description: URL of attachment (optional)
 *               attachment_type:
 *                 type: string
 *                 enum: [image, document, video, audio]
 *                 description: Type of attachment
 *               attachment_name:
 *                 type: string
 *                 description: Name of attachment file
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error or missing content/attachment
 *       403:
 *         description: Not a participant or cannot send message
 *       401:
 *         description: Unauthorized
 */
router.post('/conversations/:id/messages', authenticateToken, validateSendMessage, sendMessage);

/**
 * @swagger
 * /api/messages/conversations/{id}/read:
 *   put:
 *     summary: Mark conversation as read
 *     description: Mark all messages in a conversation as read for current user
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Conversation ID
 *     responses:
 *       200:
 *         description: Conversation marked as read
 *       403:
 *         description: Not a participant in this conversation
 *       401:
 *         description: Unauthorized
 */
router.put('/conversations/:id/read', authenticateToken, markConversationAsRead);

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Send a message (create conversation if needed)
 *     description: Send a message. Creates conversation if it doesn't exist. Real-time event emitted.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient_id
 *             properties:
 *               recipient_id:
 *                 type: integer
 *                 example: 2
 *                 description: ID of recipient (required if no conversation_id)
 *               conversation_id:
 *                 type: integer
 *                 description: Existing conversation ID (optional)
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10000
 *                 example: "Hello!"
 *                 description: Message content (required if no attachment)
 *               attachment_url:
 *                 type: string
 *                 format: uri
 *                 description: URL of attachment
 *               attachment_type:
 *                 type: string
 *                 enum: [image, document, video, audio]
 *                 description: Type of attachment
 *               attachment_name:
 *                 type: string
 *                 description: Name of attachment file
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Cannot send message to this user
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateToken, validateSendMessage, sendMessage);

/**
 * @swagger
 * /api/messages/search:
 *   get:
 *     summary: Search messages
 *     description: Search messages across user's conversations
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: conversation_id
 *         schema:
 *           type: integer
 *         description: Filter by conversation ID (optional)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Search query required
 *       401:
 *         description: Unauthorized
 */
router.get('/search', authenticateToken, searchMessages);

/**
 * @swagger
 * /api/messages/unread-count:
 *   get:
 *     summary: Get total unread message count
 *     description: Get total number of unread messages across all conversations
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/unread-count', authenticateToken, getUnreadCount);

/**
 * @swagger
 * /api/messages/{id}:
 *   put:
 *     summary: Edit a message
 *     description: Edit a message (only within 15 minutes of sending). Real-time event emitted.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10000
 *                 example: "Updated message content"
 *     responses:
 *       200:
 *         description: Message updated successfully
 *       400:
 *         description: Validation error or edit time limit exceeded
 *       403:
 *         description: Not the sender of this message
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', authenticateToken, validateEditMessage, editMessage);

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     description: Soft delete a message (only sender can delete). Real-time event emitted.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message deleted successfully
 *       403:
 *         description: Not the sender of this message
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', authenticateToken, deleteMessage);

/**
 * @swagger
 * /api/messages/{id}/reactions:
 *   post:
 *     summary: Add reaction to a message
 *     description: Add an emoji reaction to a message. Real-time event emitted.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reaction_type
 *             properties:
 *               reaction_type:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10
 *                 example: "👍"
 *                 description: Emoji reaction type
 *     responses:
 *       201:
 *         description: Reaction added successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Not a participant in this conversation
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/reactions', authenticateToken, validateAddReaction, addReaction);

/**
 * @swagger
 * /api/messages/{id}/reactions:
 *   get:
 *     summary: Get reactions for a message
 *     description: Get all reactions with counts for a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Reactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MessageReaction'
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id/reactions', authenticateToken, getMessageReactions);

/**
 * @swagger
 * /api/messages/{id}/reactions/{type}:
 *   delete:
 *     summary: Remove reaction from a message
 *     description: Remove an emoji reaction from a message. Real-time event emitted.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Message ID
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Reaction type to remove
 *     responses:
 *       200:
 *         description: Reaction removed successfully
 *       403:
 *         description: Not a participant in this conversation
 *       404:
 *         description: Message or reaction not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id/reactions/:type', authenticateToken, removeReaction);

/**
 * @swagger
 * /api/messages/{id}/forward:
 *   post:
 *     summary: Forward a message to another conversation
 *     description: Forward a message from one conversation to another. Includes original sender info.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Message ID to forward
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipient_id
 *             properties:
 *               recipient_id:
 *                 type: integer
 *                 example: 2
 *                 description: ID of recipient (required if no conversation_id)
 *               conversation_id:
 *                 type: integer
 *                 description: Target conversation ID (optional)
 *               content:
 *                 type: string
 *                 description: Optional custom message to include with forwarded message
 *     responses:
 *       201:
 *         description: Message forwarded successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Cannot forward message (access denied or blocked)
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/forward', authenticateToken, forwardMessage);

module.exports = router;
