// Event emitter service for real-time events
// Decouples event emission from business logic
const EventEmitter = require('events');

class PostEventEmitter extends EventEmitter {}

const eventService = new PostEventEmitter();

// Event types
const EVENTS = {
  POST_CREATED: 'post:created',
  POST_UPDATED: 'post:updated',
  POST_DELETED: 'post:deleted',
  POST_REPOSTED: 'post:reposted',
  POST_UNREPOSTED: 'post:unreposted',
  
  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',
  COMMENT_DELETED: 'comment:deleted',
  COMMENT_REPLIED: 'comment:replied',
  
  VOTE_UPVOTE: 'vote:upvote',
  VOTE_DOWNVOTE: 'vote:downvote',
  VOTE_REMOVED: 'vote:removed',
  
  NOTIFICATION_NEW: 'notification:new',
  
  MESSAGE_CREATED: 'message:created',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',
};

// Helper functions to emit events with standardized payloads

// Post events
const emitPostCreated = (post) => {
  eventService.emit(EVENTS.POST_CREATED, {
    type: EVENTS.POST_CREATED,
    timestamp: new Date().toISOString(),
    data: {
      post_id: post.id,
      user_id: post.user_id,
      post_type: post.post_type,
      visibility: post.visibility,
      parent_post_id: post.parent_post_id,
    },
  });
};

const emitPostUpdated = (post) => {
  eventService.emit(EVENTS.POST_UPDATED, {
    type: EVENTS.POST_UPDATED,
    timestamp: new Date().toISOString(),
    data: {
      post_id: post.id,
      user_id: post.user_id,
    },
  });
};

const emitPostDeleted = (postId, userId) => {
  eventService.emit(EVENTS.POST_DELETED, {
    type: EVENTS.POST_DELETED,
    timestamp: new Date().toISOString(),
    data: {
      post_id: postId,
      user_id: userId,
    },
  });
};

const emitPostReposted = (repost, originalPostId) => {
  eventService.emit(EVENTS.POST_REPOSTED, {
    type: EVENTS.POST_REPOSTED,
    timestamp: new Date().toISOString(),
    data: {
      repost_id: repost.id,
      user_id: repost.user_id,
      original_post_id: originalPostId,
    },
  });
};

const emitPostUnreposted = (originalPostId, userId) => {
  eventService.emit(EVENTS.POST_UNREPOSTED, {
    type: EVENTS.POST_UNREPOSTED,
    timestamp: new Date().toISOString(),
    data: {
      original_post_id: originalPostId,
      user_id: userId,
    },
  });
};

// Comment events
const emitCommentCreated = (comment) => {
  const eventType = comment.parent_comment_id 
    ? EVENTS.COMMENT_REPLIED 
    : EVENTS.COMMENT_CREATED;
  
  eventService.emit(eventType, {
    type: eventType,
    timestamp: new Date().toISOString(),
    data: {
      comment_id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      parent_comment_id: comment.parent_comment_id,
    },
  });
};

const emitCommentUpdated = (comment) => {
  eventService.emit(EVENTS.COMMENT_UPDATED, {
    type: EVENTS.COMMENT_UPDATED,
    timestamp: new Date().toISOString(),
    data: {
      comment_id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
    },
  });
};

const emitCommentDeleted = (comment) => {
  eventService.emit(EVENTS.COMMENT_DELETED, {
    type: EVENTS.COMMENT_DELETED,
    timestamp: new Date().toISOString(),
    data: {
      comment_id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      parent_comment_id: comment.parent_comment_id,
    },
  });
};

// Vote events
const emitVoteUpvote = (type, id, userId) => {
  eventService.emit(EVENTS.VOTE_UPVOTE, {
    type: EVENTS.VOTE_UPVOTE,
    timestamp: new Date().toISOString(),
    data: {
      entity_type: type, // 'post' or 'comment'
      entity_id: id,
      user_id: userId,
    },
  });
};

const emitVoteDownvote = (type, id, userId) => {
  eventService.emit(EVENTS.VOTE_DOWNVOTE, {
    type: EVENTS.VOTE_DOWNVOTE,
    timestamp: new Date().toISOString(),
    data: {
      entity_type: type, // 'post' or 'comment'
      entity_id: id,
      user_id: userId,
    },
  });
};

const emitVoteRemoved = (type, id, userId) => {
  eventService.emit(EVENTS.VOTE_REMOVED, {
    type: EVENTS.VOTE_REMOVED,
    timestamp: new Date().toISOString(),
    data: {
      entity_type: type, // 'post' or 'comment'
      entity_id: id,
      user_id: userId,
    },
  });
};

// Notification events
const emitNotificationNew = (notification) => {
  eventService.emit(EVENTS.NOTIFICATION_NEW, {
    type: EVENTS.NOTIFICATION_NEW,
    timestamp: new Date().toISOString(),
    data: {
      notification_id: notification.id,
      user_id: notification.user_id,
      notification_type: notification.notification_type,
      related_post_id: notification.related_post_id,
      related_comment_id: notification.related_comment_id,
    },
  });
};

// Message events
const emitMessageCreated = (message, conversationId, senderId, recipientId) => {
  eventService.emit(EVENTS.MESSAGE_CREATED, {
    type: EVENTS.MESSAGE_CREATED,
    timestamp: new Date().toISOString(),
    data: {
      message_id: message.id,
      conversation_id: conversationId,
      sender_id: senderId,
      recipient_id: recipientId,
    },
  });
};

const emitMessageUpdated = (message, conversationId) => {
  eventService.emit(EVENTS.MESSAGE_UPDATED, {
    type: EVENTS.MESSAGE_UPDATED,
    timestamp: new Date().toISOString(),
    data: {
      message_id: message.id,
      conversation_id: conversationId,
      sender_id: message.sender_id,
    },
  });
};

const emitMessageDeleted = (message, conversationId) => {
  eventService.emit(EVENTS.MESSAGE_DELETED, {
    type: EVENTS.MESSAGE_DELETED,
    timestamp: new Date().toISOString(),
    data: {
      message_id: message.id,
      conversation_id: conversationId,
      sender_id: message.sender_id,
    },
  });
};

module.exports = {
  eventService,
  EVENTS,
  
  // Post event emitters
  emitPostCreated,
  emitPostUpdated,
  emitPostDeleted,
  emitPostReposted,
  emitPostUnreposted,
  
  // Comment event emitters
  emitCommentCreated,
  emitCommentUpdated,
  emitCommentDeleted,
  
  // Vote event emitters
  emitVoteUpvote,
  emitVoteDownvote,
  emitVoteRemoved,
  
  // Notification event emitters
  emitNotificationNew,
  
  // Message event emitters
  emitMessageCreated,
  emitMessageUpdated,
  emitMessageDeleted,
};
