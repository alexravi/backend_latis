// Message controller - Messaging functionality
const { body, query, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const MessageReaction = require('../models/MessageReaction');
const Block = require('../models/Block');
const Connection = require('../models/Connection');
const Notification = require('../models/Notification');
const UserOnlineStatus = require('../models/UserOnlineStatus');
const NotificationPreference = require('../models/NotificationPreference');
const { emitMessageCreated, emitMessageUpdated, emitMessageDeleted, emitNotificationNew } = require('../services/eventService');
const { emitToUser, emitToRoom } = require('../services/socketService');
const logger = require('../utils/logger');

// Validation rules
const validateSendMessage = [
  body('content')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
  body('recipient_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Recipient ID must be a valid integer'),
  body('conversation_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Conversation ID must be a valid integer'),
  body('attachment_url')
    .optional()
    .isURL()
    .withMessage('Attachment URL must be a valid URL'),
  body('attachment_type')
    .optional()
    .isIn(['image', 'document', 'video', 'audio'])
    .withMessage('Attachment type must be one of: image, document, video, audio'),
];

const validateEditMessage = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters'),
];

const validateAddReaction = [
  body('reaction_type')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Reaction type must be between 1 and 10 characters'),
];

// Helper: Check if users can message each other
const canMessage = async (userId1, userId2) => {
  // Check if users are blocked either way
  const blocked = await Block.isBlockedEitherWay(userId1, userId2);
  if (blocked) {
    return { allowed: false, reason: 'Users are blocked' };
  }
  
  // Check if connection is required (optional, configurable via environment variable)
  const requireConnection = process.env.REQUIRE_CONNECTION_FOR_MESSAGING === 'true';
  if (requireConnection) {
    const connection = await Connection.findConnection(userId1, userId2);
    if (!connection || connection.status !== 'connected') {
      return { allowed: false, reason: 'Connection required to send messages' };
    }
  }
  
  return { allowed: true };
};

// Helper: Create notification for new message
const createMessageNotification = async (recipientId, senderId, message, conversationId, customTitle = null, customNotificationData = null) => {
  try {
    // Check notification preferences
    const preferences = await NotificationPreference.findByUserId(recipientId);
    if (preferences && !preferences.new_messages) {
      return; // User has disabled message notifications
    }

    // Get sender info
    const { pool } = require('../config/database');
    const userResult = await pool.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [senderId]
    );
    
    if (userResult.rows.length === 0) return;
    
    const sender = userResult.rows[0];
    const senderName = `${sender.first_name} ${sender.last_name}`;
    
    // Truncate message for notification
    const contentText = typeof message.content === 'string' ? message.content : (message.content || '');
    const messagePreview = contentText.length > 100 
      ? contentText.substring(0, 100) + '...' 
      : contentText;

    // Use custom title and notification_data if provided, otherwise use defaults
    const title = customTitle || `New message from ${senderName}`;
    const notificationData = customNotificationData || {
      message_id: message.id,
      conversation_id: conversationId,
      sender_id: senderId,
    };

    const notification = await Notification.create({
      user_id: recipientId,
      notification_type: 'new_message',
      title: title,
      message: messagePreview,
      notification_data: notificationData,
      related_user_id: senderId,
    });

    // Emit notification event
    emitNotificationNew(notification);
  } catch (error) {
    console.error('Error creating message notification:', error.message);
    // Don't throw - notification failure shouldn't break message sending
  }
};

// List conversations
const listConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    logger.info('List conversations', { userId, limit, offset });

    const conversations = await Conversation.findByUserId(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: conversations,
      pagination: {
        limit,
        offset,
        count: conversations.length,
      },
    });
  } catch (error) {
    logger.error('List conversations error', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get conversation details
const getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id);

    logger.info('Get conversation', { userId, conversationId });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Check if user is participant
    const isParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this conversation',
      });
    }

    // Get other participant info
    const otherParticipantId = await Conversation.getOtherParticipantId(conversationId, userId);
    const { pool } = require('../config/database');
    const userResult = await pool.query(
      'SELECT id, first_name, last_name, profile_image_url, headline FROM users WHERE id = $1',
      [otherParticipantId]
    );

    // Get online status for other participant
    const status = await UserOnlineStatus.getStatus(otherParticipantId);

    const conversationData = {
      ...conversation,
      other_participant: userResult.rows[0] ? {
        ...userResult.rows[0],
        is_online: status.is_online,
        last_seen_at: status.last_seen_at,
      } : null,
      unread_count: conversation.participant1_id === userId 
        ? conversation.participant1_unread_count 
        : conversation.participant2_unread_count,
    };

    res.status(200).json({
      success: true,
      data: conversationData,
    });
  } catch (error) {
    logger.error('Get conversation error', {
      userId: req.user?.id,
      conversationId: req.params?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Create or get conversation
const createConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const recipientId = parseInt(req.body.recipient_id);

    logger.info('Create or get conversation', { userId, recipientId });

    if (!recipientId || recipientId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recipient ID',
      });
    }

    // Check if users can message
    const canMessageResult = await canMessage(userId, recipientId);
    if (!canMessageResult.allowed) {
      return res.status(403).json({
        success: false,
        message: canMessageResult.reason || 'Cannot send message to this user',
      });
    }

    const conversation = await Conversation.findOrCreate(userId, recipientId);

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Create conversation error', {
      userId: req.user?.id,
      recipientId: req.body?.recipient_id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Send message
const sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Send message validation failed', {
        userId: req.user?.id,
        errors: errors.array(),
      });
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    let conversationId = parseInt(req.body.conversation_id);
    const recipientId = req.body.recipient_id ? parseInt(req.body.recipient_id) : null;
    const content = req.body.content?.trim();
    const attachmentUrl = req.body.attachment_url;
    const attachmentType = req.body.attachment_type;
    const attachmentName = req.body.attachment_name;

    logger.info('Send message start', {
      userId,
      conversationId,
      recipientId,
      hasContent: Boolean(content),
      hasAttachment: Boolean(attachmentUrl),
      attachmentType: attachmentType || undefined,
    });

    // Validate that we have either content or attachment
    if (!content && !attachmentUrl) {
      return res.status(400).json({
        success: false,
        message: 'Either content or attachment is required',
      });
    }

    // Get or create conversation
    if (!conversationId && recipientId) {
      // Check if users can message
      const canMessageResult = await canMessage(userId, recipientId);
      if (!canMessageResult.allowed) {
        return res.status(403).json({
          success: false,
          message: canMessageResult.reason || 'Cannot send message to this user',
        });
      }

      const conversation = await Conversation.findOrCreate(userId, recipientId);
      conversationId = conversation.id;
    } else if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Either conversation_id or recipient_id is required',
      });
    }

    // Verify user is participant
    const isParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
      });
    }

    // Get other participant
    const otherParticipantId = await Conversation.getOtherParticipantId(conversationId, userId);
    
    // Check if other user has blocked current user
    const blocked = await Block.isBlockedOneWay(otherParticipantId, userId);
    if (blocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot send message to this user',
      });
    }

    // Create message
    const messageData = {
      conversation_id: conversationId,
      sender_id: userId,
      content: content || (attachmentUrl ? 'Attachment' : ''),
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null,
      attachment_name: attachmentName || null,
    };

    const message = await Message.create(messageData);

    // Update conversation last message and increment unread count
    await Conversation.updateLastMessage(conversationId, message.id);
    await Conversation.incrementUnreadCount(conversationId, otherParticipantId);

    // Emit events
    emitMessageCreated(message, conversationId, userId, otherParticipantId);
    emitToRoom(`conversation:${conversationId}`, 'message:new', {
      message,
      conversation_id: conversationId,
    });

    // Create notification
    await createMessageNotification(otherParticipantId, userId, message, conversationId);

    // Get message with sender info
    const { pool } = require('../config/database');
    const messageWithSender = await pool.query(
      `SELECT m.*, u.first_name, u.last_name, u.profile_image_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = $1`,
      [message.id]
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: messageWithSender.rows[0],
    });
  } catch (error) {
    logger.error('Send message error', {
      userId: req.user?.id,
      conversationId: req.body?.conversation_id,
      recipientId: req.body?.recipient_id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get messages in conversation
const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    logger.info('Get messages', { userId, conversationId, limit, offset });

    // Verify user is participant
    const isParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
      });
    }

    const messages = await Message.findByConversationId(conversationId, limit, offset, userId);

    res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        limit,
        offset,
        count: messages.length,
      },
    });
  } catch (error) {
    logger.error('Get messages error', {
      userId: req.user?.id,
      conversationId: req.params?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Mark conversation as read
const markConversationAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id);

    logger.info('Mark conversation as read', { userId, conversationId });

    // Verify user is participant
    const isParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
      });
    }

    // Mark all messages as read
    await Message.markConversationAsRead(conversationId, userId);
    
    // Reset unread count
    await Conversation.markAsRead(conversationId, userId);

    // Emit read receipt event
    const otherParticipantId = await Conversation.getOtherParticipantId(conversationId, userId);
    emitToUser(otherParticipantId, 'conversation:read', {
      conversation_id: conversationId,
      read_by: userId,
    });

    res.status(200).json({
      success: true,
      message: 'Conversation marked as read',
    });
  } catch (error) {
    logger.error('Mark conversation as read error', {
      userId: req.user?.id,
      conversationId: req.params?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete conversation
const deleteConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationId = parseInt(req.params.id);

    logger.info('Delete conversation', { userId, conversationId });

    // Verify user is participant
    const isParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
      });
    }

    await Conversation.deleteForUser(conversationId, userId);

    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    logger.error('Delete conversation error', {
      userId: req.user?.id,
      conversationId: req.params?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Edit message
const editMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Edit message validation failed', {
        userId: req.user?.id,
        errors: errors.array(),
      });
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const messageId = parseInt(req.params.id);
    const content = req.body.content?.trim();

    // Get message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Verify user is sender
    if (message.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages',
      });
    }

    // Check if message is deleted
    if (message.deleted_at) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit deleted message',
      });
    }

    // Check edit time limit (15 minutes)
    const createdAt = new Date(message.created_at);
    const now = new Date();
    const minutesDiff = (now - createdAt) / (1000 * 60);
    if (minutesDiff > 15) {
      return res.status(400).json({
        success: false,
        message: 'Message can only be edited within 15 minutes',
      });
    }

    // Update message
    const updatedMessage = await Message.update(messageId, { content });

    // Emit event
    emitMessageUpdated(updatedMessage, message.conversation_id);
    emitToRoom(`conversation:${message.conversation_id}`, 'message:updated', {
      message: updatedMessage,
      conversation_id: message.conversation_id,
    });

    // Get message with sender info
    const { pool } = require('../config/database');
    const messageWithSender = await pool.query(
      `SELECT m.*, u.first_name, u.last_name, u.profile_image_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = $1`,
      [updatedMessage.id]
    );

    res.status(200).json({
      success: true,
      message: 'Message updated successfully',
      data: messageWithSender.rows[0],
    });
  } catch (error) {
    logger.error('Edit message error', {
      userId: req.user?.id,
      messageId: req.params?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id);

    logger.info('Delete message', { userId, messageId });

    // Get message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Verify user is sender
    if (message.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages',
      });
    }

    // Soft delete
    const deletedMessage = await Message.softDelete(messageId, userId);

    // Emit event
    emitMessageDeleted(message, message.conversation_id);
    emitToRoom(`conversation:${message.conversation_id}`, 'message:deleted', {
      message_id: messageId,
      conversation_id: message.conversation_id,
    });

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    logger.error('Delete message error', {
      userId: req.user?.id,
      messageId: req.params?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Search messages
const searchMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const searchQuery = req.query.q?.trim();
    const conversationId = req.query.conversation_id ? parseInt(req.query.conversation_id) : null;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    logger.info('Search messages', { userId, conversationId, limit, offset, hasQuery: Boolean(searchQuery) });

    if (!searchQuery || searchQuery.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    // If conversation_id provided, verify user is participant
    if (conversationId) {
      const isParticipant = await Conversation.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'You are not a participant in this conversation',
        });
      }
    }

    const messages = await Message.search(userId, searchQuery, conversationId, limit, offset);

    res.status(200).json({
      success: true,
      data: messages,
      pagination: {
        limit,
        offset,
        count: messages.length,
      },
    });
  } catch (error) {
    logger.error('Search messages error', {
      userId: req.user?.id,
      conversationId: req.query?.conversation_id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get unread count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    logger.info('Get unread count', { userId });
    const count = await Conversation.getTotalUnreadCount(userId);

    res.status(200).json({
      success: true,
      data: {
        unread_count: count,
      },
    });
  } catch (error) {
    logger.error('Get unread count error', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Add reaction to message
const addReaction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Add reaction validation failed', {
        userId: req.user?.id,
        errors: errors.array(),
      });
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const userId = req.user.id;
    const messageId = parseInt(req.params.id);
    const reactionType = req.body.reaction_type;

    logger.info('Add reaction', { userId, messageId, reactionType });

    // Get message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Verify user is participant in conversation
    const isParticipant = await Conversation.isParticipant(message.conversation_id, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
      });
    }

    // Add reaction
    const reaction = await MessageReaction.add(messageId, userId, reactionType);

    if (!reaction) {
      // Reaction already exists
      return res.status(200).json({
        success: true,
        message: 'Reaction already exists',
        data: { message_id: messageId, reaction_type: reactionType },
      });
    }

    // Get all reactions for the message
    const reactions = await MessageReaction.getReactionCounts(messageId);

    // Emit event
    emitToRoom(`conversation:${message.conversation_id}`, 'message:reaction:added', {
      message_id: messageId,
      user_id: userId,
      reaction_type: reactionType,
      reactions,
    });

    res.status(201).json({
      success: true,
      message: 'Reaction added successfully',
      data: {
        message_id: messageId,
        reaction_type: reactionType,
        reactions,
      },
    });
  } catch (error) {
    logger.error('Add reaction error', {
      userId: req.user?.id,
      messageId: req.params?.id,
      reactionType: req.body?.reaction_type,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Remove reaction from message
const removeReaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id);
    const reactionType = req.params.type;

    logger.info('Remove reaction', { userId, messageId, reactionType });

    // Get message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Verify user is participant in conversation
    const isParticipant = await Conversation.isParticipant(message.conversation_id, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
      });
    }

    // Remove reaction
    const reaction = await MessageReaction.remove(messageId, userId, reactionType);

    if (!reaction) {
      return res.status(404).json({
        success: false,
        message: 'Reaction not found',
      });
    }

    // Get all reactions for the message
    const reactions = await MessageReaction.getReactionCounts(messageId);

    // Emit event
    emitToRoom(`conversation:${message.conversation_id}`, 'message:reaction:removed', {
      message_id: messageId,
      user_id: userId,
      reaction_type: reactionType,
      reactions,
    });

    res.status(200).json({
      success: true,
      message: 'Reaction removed successfully',
      data: {
        message_id: messageId,
        reaction_type: reactionType,
        reactions,
      },
    });
  } catch (error) {
    logger.error('Remove reaction error', {
      userId: req.user?.id,
      messageId: req.params?.id,
      reactionType: req.params?.type,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get message reactions
const getMessageReactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id);

    logger.info('Get message reactions', { userId, messageId });

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Verify user is participant in conversation
    const isParticipant = await Conversation.isParticipant(message.conversation_id, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
      });
    }

    const reactions = await MessageReaction.getReactionCounts(messageId);

    res.status(200).json({
      success: true,
      data: reactions,
    });
  } catch (error) {
    logger.error('Get message reactions error', {
      userId: req.user?.id,
      messageId: req.params?.id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Forward message
const forwardMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id);
    const recipientId = req.body.recipient_id ? parseInt(req.body.recipient_id) : null;
    let conversationId = req.body.conversation_id ? parseInt(req.body.conversation_id) : null;
    const optionalContent = req.body.content?.trim();

    logger.info('Forward message start', {
      userId,
      messageId,
      recipientId,
      conversationId,
      hasOptionalContent: Boolean(optionalContent),
    });

    // Get original message
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Verify user has access to original message (must be participant)
    const isParticipant = await Conversation.isParticipant(originalMessage.conversation_id, userId);
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this message',
      });
    }

    // Validate recipient
    if (!recipientId && !conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Either recipient_id or conversation_id is required',
      });
    }

    // Get or create target conversation
    if (!conversationId && recipientId) {
      // Check if users can message
      const canMessageResult = await canMessage(userId, recipientId);
      if (!canMessageResult.allowed) {
        return res.status(403).json({
          success: false,
          message: canMessageResult.reason || 'Cannot forward message to this user',
        });
      }

      const conversation = await Conversation.findOrCreate(userId, recipientId);
      conversationId = conversation.id;
    }

    // Verify user is participant in target conversation
    const isTargetParticipant = await Conversation.isParticipant(conversationId, userId);
    if (!isTargetParticipant) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in the target conversation',
      });
    }

    // Get target recipient
    const targetRecipientId = await Conversation.getOtherParticipantId(conversationId, userId);

    // Check if target recipient has blocked current user
    const blocked = await Block.isBlockedOneWay(targetRecipientId, userId);
    if (blocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot forward message to this user',
      });
    }

    // Get original sender info
    const { pool } = require('../config/database');
    const senderResult = await pool.query(
      'SELECT id, first_name, last_name, profile_image_url FROM users WHERE id = $1',
      [originalMessage.sender_id]
    );
    const originalSender = senderResult.rows[0] || null;

    // Create forwarded message content
    const forwardContent = optionalContent 
      ? optionalContent 
      : originalMessage.content;

    // Create forwarded message
    const messageData = {
      conversation_id: conversationId,
      sender_id: userId,
      content: forwardContent,
      forwarded_from_message_id: messageId,
      attachment_url: originalMessage.attachment_url || null,
      attachment_type: originalMessage.attachment_type || null,
      attachment_name: originalMessage.attachment_name || null,
    };

    const forwardedMessage = await Message.create(messageData);

    // Update conversation last message and increment unread count
    await Conversation.updateLastMessage(conversationId, forwardedMessage.id);
    await Conversation.incrementUnreadCount(conversationId, targetRecipientId);

    // Emit events
    emitMessageCreated(forwardedMessage, conversationId, userId, targetRecipientId);
    emitToRoom(`conversation:${conversationId}`, 'message:new', {
      message: forwardedMessage,
      conversation_id: conversationId,
      forwarded: true,
      original_sender: originalSender,
    });

    // Create notification with forwarded context
    const forwardTitle = `Forwarded message from ${req.user.first_name} ${req.user.last_name}`;
    const forwardNotificationData = {
      message_id: forwardedMessage.id,
      conversation_id: conversationId,
      sender_id: userId,
      forwarded: true,
      original_message_id: messageId,
      original_sender_id: originalMessage.sender_id,
      original_sender_name: originalSender ? `${originalSender.first_name} ${originalSender.last_name}` : null,
    };
    await createMessageNotification(targetRecipientId, userId, forwardedMessage, conversationId, forwardTitle, forwardNotificationData);

    // Get message with sender info
    const messageWithSender = await pool.query(
      `SELECT m.*, u.first_name, u.last_name, u.profile_image_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = $1`,
      [forwardedMessage.id]
    );

    res.status(201).json({
      success: true,
      message: 'Message forwarded successfully',
      data: {
        ...messageWithSender.rows[0],
        forwarded_from_message_id: messageId,
        original_sender: originalSender,
      },
    });
  } catch (error) {
    logger.error('Forward message error', {
      userId: req.user?.id,
      messageId: req.params?.id,
      recipientId: req.body?.recipient_id,
      conversationId: req.body?.conversation_id,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
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
};
