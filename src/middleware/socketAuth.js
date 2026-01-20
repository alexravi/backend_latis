// WebSocket JWT authentication middleware for Socket.io
const { verifyToken } = require('../utils/auth');
const User = require('../models/User');

// Authenticate WebSocket connection using JWT token
const authenticateSocket = async (socket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication token is required'));
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user info to socket
    socket.user = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    next();
  } catch (error) {
    if (error.message === 'Token has expired') {
      return next(new Error('Token has expired'));
    } else if (error.message === 'Invalid token') {
      return next(new Error('Invalid token'));
    } else {
      console.error('Socket authentication error:', error.message);
      return next(new Error('Authentication failed'));
    }
  }
};

module.exports = {
  authenticateSocket,
};
