// Socket.io service for real-time communication
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { authenticateSocket } = require('../middleware/socketAuth');
const { eventService, EVENTS } = require('./eventService');
const { redisClient } = require('../config/redis');
const UserOnlineStatus = require('../models/UserOnlineStatus');
const Message = require('../models/Message');

let io = null;

// Initialize Socket.io server
const initializeSocketIO = async (httpServer) => {
  const corsOrigins = process.env.WS_CORS_ORIGIN 
    ? process.env.WS_CORS_ORIGIN.split(',')
    : ['http://localhost:5173'];

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Setup Redis adapter for horizontal scaling (pub/sub)
  // Create a separate Redis client for pub/sub (required by Socket.io adapter)
  try {
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();

    // Add error handlers for Redis clients
    pubClient.on('error', (error) => {
      console.error('Redis pubClient error:', error.message);
    });

    subClient.on('error', (error) => {
      console.error('Redis subClient error:', error.message);
    });

    // Test connection by pinging both clients
    try {
      await Promise.all([
        pubClient.ping().catch(err => {
          console.error('Failed to ping pubClient:', err.message);
          throw err;
        }),
        subClient.ping().catch(err => {
          console.error('Failed to ping subClient:', err.message);
          throw err;
        })
      ]);
    } catch (pingError) {
      console.error('Redis clients not ready:', pingError.message);
      throw pingError;
    }

    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.io Redis adapter initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Socket.io Redis adapter:', error.message);
    console.log('⚠️  Socket.io will continue without Redis adapter (single instance mode)');
  }

  // Authentication middleware
  io.use(authenticateSocket);

  // Connection handler
  io.on('connection', async (socket) => {
    console.log(`✅ Socket connected: user ${socket.user.id}`);

    // Join user's personal room for notifications
    socket.join(`user:${socket.user.id}`);

    // Update user online status
    try {
      await UserOnlineStatus.setOnline(socket.user.id);
      
      // Emit online status to user's connections (if needed)
      // This could be enhanced to notify specific users
      socket.broadcast.emit('user:online', {
        user_id: socket.user.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error setting user online:', error.message);
    }

    // Join post room to receive updates
    socket.on('post:join', (postId) => {
      socket.join(`post:${postId}`);
      console.log(`User ${socket.user.id} joined post room: ${postId}`);
    });

    // Leave post room
    socket.on('post:leave', (postId) => {
      socket.leave(`post:${postId}`);
      console.log(`User ${socket.user.id} left post room: ${postId}`);
    });

    // Join conversation room
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${socket.user.id} joined conversation room: ${conversationId}`);
    });

    // Leave conversation room
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${socket.user.id} left conversation room: ${conversationId}`);
    });

    // Typing indicator - start typing
    socket.on('message:typing:start', (data) => {
      const { conversation_id } = data;
      if (conversation_id) {
        socket.to(`conversation:${conversation_id}`).emit('typing:status', {
          conversation_id,
          user_id: socket.user.id,
          typing: true,
        });
      }
    });

    // Typing indicator - stop typing
    socket.on('message:typing:stop', (data) => {
      const { conversation_id } = data;
      if (conversation_id) {
        socket.to(`conversation:${conversation_id}`).emit('typing:status', {
          conversation_id,
          user_id: socket.user.id,
          typing: false,
        });
      }
    });

    // Message delivery confirmation
    socket.on('message:delivered', async (data) => {
      const { message_id } = data;
      if (message_id) {
        try {
          // Mark message as delivered
          const message = await Message.markAsDelivered(message_id);
          if (message) {
            // Emit delivery confirmation to sender
            io.to(`user:${message.sender_id}`).emit('message:delivered', {
              message_id,
              conversation_id: message.conversation_id,
              delivered_at: message.delivered_at,
            });
          }
        } catch (error) {
          console.error('Error marking message as delivered:', error.message);
        }
      }
    });

    // Periodic last seen update (every 30 seconds while connected)
    const lastSeenInterval = setInterval(async () => {
      try {
        await UserOnlineStatus.updateLastSeen(socket.user.id);
      } catch (error) {
        console.error('Error updating last seen:', error.message);
      }
    }, 30000); // 30 seconds

    // Disconnect handler
    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${socket.user.id}`);
      
      // Clear interval
      clearInterval(lastSeenInterval);
      
      // Small delay to check if reconnection happens
      setTimeout(async () => {
        // Check if user has other active connections
        try {
          const socketsInRoom = await io.in(`user:${socket.user.id}`).fetchSockets();
          
          if (socketsInRoom.length === 0) {
            // No other connections, set user offline
            try {
              await UserOnlineStatus.setOffline(socket.user.id);
              
              // Emit offline status
              io.emit('user:offline', {
                user_id: socket.user.id,
                timestamp: new Date().toISOString(),
              });
            } catch (error) {
              console.error('Error setting user offline:', error.message);
            }
          } else {
            // User still has other connections, just update last seen
            try {
              await UserOnlineStatus.updateLastSeen(socket.user.id);
            } catch (error) {
              console.error('Error updating last seen on disconnect:', error.message);
            }
          }
        } catch (error) {
          console.error('Error checking sockets on disconnect:', error.message);
        }
      }, 1000); // 1 second delay
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.id}:`, error.message);
    });
  });

  // Listen to events from event service and broadcast
  setupEventListeners();

  console.log('✅ Socket.io initialized');
  return io;
};

// Setup event listeners to broadcast to Socket.io rooms
const setupEventListeners = () => {
  // Post created
  eventService.on(EVENTS.POST_CREATED, (event) => {
    if (io) {
      // Broadcast to feed (all connected users will see in their feed)
      io.emit('post:new', event);
    }
  });

  // Post updated
  eventService.on(EVENTS.POST_UPDATED, (event) => {
    if (io) {
      io.to(`post:${event.data.post_id}`).emit('post:updated', event);
    }
  });

  // Post deleted
  eventService.on(EVENTS.POST_DELETED, (event) => {
    if (io) {
      io.to(`post:${event.data.post_id}`).emit('post:deleted', event);
      // Also broadcast to feed
      io.emit('post:deleted', event);
    }
  });

  // Post reposted
  eventService.on(EVENTS.POST_REPOSTED, (event) => {
    if (io) {
      // Broadcast to original post room
      io.to(`post:${event.data.original_post_id}`).emit('post:repost', event);
      // Broadcast to feed
      io.emit('post:repost', event);
    }
  });

  // Post unreposted
  eventService.on(EVENTS.POST_UNREPOSTED, (event) => {
    if (io) {
      io.to(`post:${event.data.original_post_id}`).emit('post:unrepost', event);
    }
  });

  // Comment created/replied
  eventService.on(EVENTS.COMMENT_CREATED, (event) => {
    if (io) {
      io.to(`post:${event.data.post_id}`).emit('comment:new', event);
    }
  });

  eventService.on(EVENTS.COMMENT_REPLIED, (event) => {
    if (io) {
      io.to(`post:${event.data.post_id}`).emit('comment:reply', event);
      // Also emit to parent comment room if needed
      if (event.data.parent_comment_id) {
        io.to(`comment:${event.data.parent_comment_id}`).emit('comment:reply', event);
      }
    }
  });

  // Comment updated
  eventService.on(EVENTS.COMMENT_UPDATED, (event) => {
    if (io) {
      io.to(`post:${event.data.post_id}`).emit('comment:updated', event);
    }
  });

  // Comment deleted
  eventService.on(EVENTS.COMMENT_DELETED, (event) => {
    if (io) {
      io.to(`post:${event.data.post_id}`).emit('comment:deleted', event);
    }
  });

  // Vote upvote
  eventService.on(EVENTS.VOTE_UPVOTE, (event) => {
    if (io) {
      const room = event.data.entity_type === 'post' 
        ? `post:${event.data.entity_id}` 
        : `comment:${event.data.entity_id}`;
      io.to(room).emit('vote:update', event);
    }
  });

  // Vote downvote
  eventService.on(EVENTS.VOTE_DOWNVOTE, (event) => {
    if (io) {
      const room = event.data.entity_type === 'post' 
        ? `post:${event.data.entity_id}` 
        : `comment:${event.data.entity_id}`;
      io.to(room).emit('vote:update', event);
    }
  });

  // Vote removed
  eventService.on(EVENTS.VOTE_REMOVED, (event) => {
    if (io) {
      const room = event.data.entity_type === 'post' 
        ? `post:${event.data.entity_id}` 
        : `comment:${event.data.entity_id}`;
      io.to(room).emit('vote:update', event);
    }
  });

  // Notification new
  eventService.on(EVENTS.NOTIFICATION_NEW, (event) => {
    if (io) {
      // Send to specific user's room
      io.to(`user:${event.data.user_id}`).emit('notification:new', event);
    }
  });

  // Message created
  eventService.on(EVENTS.MESSAGE_CREATED, (event) => {
    if (io) {
      // Send to conversation room and recipient's user room
      io.to(`conversation:${event.data.conversation_id}`).emit('message:new', event);
      io.to(`user:${event.data.recipient_id}`).emit('message:new', event);
    }
  });

  // Message updated
  eventService.on(EVENTS.MESSAGE_UPDATED, (event) => {
    if (io) {
      io.to(`conversation:${event.data.conversation_id}`).emit('message:updated', event);
    }
  });

  // Message deleted
  eventService.on(EVENTS.MESSAGE_DELETED, (event) => {
    if (io) {
      io.to(`conversation:${event.data.conversation_id}`).emit('message:deleted', event);
    }
  });
};

// Mark message as delivered when it reaches recipient's device
const handleMessageDelivered = async (messageId, recipientId) => {
  try {
    const message = await Message.markAsDelivered(messageId);
    if (message && io) {
      // Notify sender that message was delivered
      io.to(`user:${message.sender_id}`).emit('message:delivered', {
        message_id: messageId,
        conversation_id: message.conversation_id,
        delivered_at: message.delivered_at,
      });
    }
  } catch (error) {
    console.error('Error handling message delivery:', error.message);
  }
};

// Get Socket.io instance
const getIO = () => {
  return io;
};

// Emit to specific room
const emitToRoom = (room, event, data) => {
  if (io) {
    io.to(room).emit(event, data);
  }
};

// Emit to specific user
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Broadcast to all connected clients
const broadcast = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = {
  initializeSocketIO,
  getIO,
  emitToRoom,
  emitToUser,
  broadcast,
  handleMessageDelivered,
};
