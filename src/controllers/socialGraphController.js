// Social Graph Controller - Social graph insights and analytics
const Connection = require('../models/Connection');
const Follow = require('../models/Follow');
const User = require('../models/User');
const Block = require('../models/Block');
const ProfileVisitors = require('../models/ProfileVisitors');

// Get mutual connections between current user and target user
const getMutualConnections = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if blocked
    const isBlocked = await Block.isBlockedEitherWay(currentUserId, targetUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot view mutual connections of blocked user',
      });
    }

    const mutualConnections = await Connection.findMutualConnections(currentUserId, targetUserId);

    // Filter out blocked users
    const filteredConnections = [];
    for (const connection of mutualConnections) {
      const isBlockedUser = await Block.isBlockedEitherWay(currentUserId, connection.id);
      if (!isBlockedUser) {
        filteredConnections.push(connection);
      }
    }

    res.status(200).json({
      success: true,
      data: filteredConnections,
      count: filteredConnections.length,
    });
  } catch (error) {
    console.error('Get mutual connections error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get network statistics for current user
const getMyNetworkStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [connectionStats, followStats] = await Promise.all([
      Connection.getNetworkStats(userId),
      Follow.getFollowStats(userId),
    ]);

    res.status(200).json({
      success: true,
      data: {
        connections: connectionStats,
        follows: followStats,
      },
    });
  } catch (error) {
    console.error('Get network stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get network statistics for a specific user
const getUserNetworkStats = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if blocked
    const isBlocked = await Block.isBlockedEitherWay(currentUserId, targetUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot view network stats of blocked user',
      });
    }

    const [connectionStats, followStats] = await Promise.all([
      Connection.getNetworkStats(targetUserId),
      Follow.getFollowStats(targetUserId),
    ]);

    res.status(200).json({
      success: true,
      data: {
        connections: connectionStats,
        follows: followStats,
      },
    });
  } catch (error) {
    console.error('Get user network stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get suggested connections (people you may know)
const getSuggestedConnections = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    // Get second-degree connections (friends of friends)
    const secondDegree = await Connection.findSecondDegreeConnections(userId, limit * 2);

    // Get users with mutual connections
    const myConnections = await Connection.findByUserId(userId, 'connected');
    const connectionIds = myConnections.map(c => 
      c.requester_id === userId ? c.addressee_id : c.requester_id
    );

    if (connectionIds.length === 0) {
      // If no connections, return empty array
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
      });
    }

    // Get mutual connections for each of my connections
    const suggestionsMap = new Map();
    
    for (const connId of connectionIds.slice(0, 10)) { // Limit to avoid too many queries
      const mutuals = await Connection.findMutualConnections(userId, connId);
      for (const mutual of mutuals) {
        if (!suggestionsMap.has(mutual.id)) {
          suggestionsMap.set(mutual.id, {
            ...mutual,
            mutual_count: 1,
          });
        } else {
          suggestionsMap.get(mutual.id).mutual_count++;
        }
      }
    }

    // Combine with second-degree connections
    for (const secondDeg of secondDegree) {
      if (!suggestionsMap.has(secondDeg.id)) {
        suggestionsMap.set(secondDeg.id, secondDeg);
      } else {
        suggestionsMap.get(secondDeg.id).mutual_count += secondDeg.mutual_count || 1;
      }
    }

    // Filter out blocked users and convert to array
    const suggestions = [];
    for (const [userId, user] of suggestionsMap) {
      const isBlocked = await Block.isBlockedEitherWay(req.user.id, userId);
      if (!isBlocked) {
        suggestions.push(user);
      }
    }

    // Sort by mutual count and limit
    suggestions.sort((a, b) => (b.mutual_count || 0) - (a.mutual_count || 0));
    const limited = suggestions.slice(0, limit);

    res.status(200).json({
      success: true,
      data: limited,
      count: limited.length,
    });
  } catch (error) {
    console.error('Get suggested connections error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get relationship path/degrees of separation (simplified - up to 2 degrees)
const getRelationshipPath = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    if (currentUserId === targetUserId) {
      return res.status(200).json({
        success: true,
        data: {
          degree: 0,
          path: [],
          message: 'This is you',
        },
      });
    }

    // Check if blocked
    const isBlocked = await Block.isBlockedEitherWay(currentUserId, targetUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot find relationship path to blocked user',
      });
    }

    // Check direct connection (degree 1)
    const directConnection = await Connection.findConnection(currentUserId, targetUserId);
    if (directConnection && directConnection.status === 'connected') {
      return res.status(200).json({
        success: true,
        data: {
          degree: 1,
          path: [targetUserId],
          message: 'Directly connected',
        },
      });
    }

    // Check second-degree connection (degree 2)
    const myConnections = await Connection.findByUserId(currentUserId, 'connected');
    const connectionIds = myConnections.map(c => 
      c.requester_id === currentUserId ? c.addressee_id : c.requester_id
    );

    for (const connId of connectionIds) {
      const secondConnection = await Connection.findConnection(connId, targetUserId);
      if (secondConnection && secondConnection.status === 'connected') {
        return res.status(200).json({
          success: true,
          data: {
            degree: 2,
            path: [connId, targetUserId],
            message: 'Connected through mutual connection',
          },
        });
      }
    }

    // No path found (degree > 2 or no connection)
    res.status(200).json({
      success: true,
      data: {
        degree: null,
        path: [],
        message: 'No direct or second-degree connection found',
      },
    });
  } catch (error) {
    console.error('Get relationship path error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get second-degree connections (friends of friends)
const getSecondDegreeConnections = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);
    const limit = parseInt(req.query.limit) || 50;

    if (isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if blocked
    const isBlocked = await Block.isBlockedEitherWay(currentUserId, targetUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot view second-degree connections of blocked user',
      });
    }

    const secondDegree = await Connection.findSecondDegreeConnections(targetUserId, limit);

    // Filter out blocked users
    const filtered = [];
    for (const connection of secondDegree) {
      const isBlockedUser = await Block.isBlockedEitherWay(currentUserId, connection.id);
      if (!isBlockedUser) {
        filtered.push(connection);
      }
    }

    res.status(200).json({
      success: true,
      data: filtered,
      count: filtered.length,
    });
  } catch (error) {
    console.error('Get second-degree connections error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get profile visitors for a user
const getProfileVisitors = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    if (isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Only allow viewing own profile visitors or if not blocked
    if (currentUserId !== targetUserId) {
      const isBlocked = await Block.isBlockedEitherWay(currentUserId, targetUserId);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Cannot view profile visitors of blocked user',
        });
      }
      // For now, only allow viewing own visitors (can be changed later)
      return res.status(403).json({
        success: false,
        message: 'You can only view your own profile visitors',
      });
    }

    const visitors = await ProfileVisitors.getVisitors(targetUserId, limit, offset);

    // Filter out blocked users from visitors list
    const filteredVisitors = [];
    for (const visitor of visitors) {
      const isBlocked = await Block.isBlockedEitherWay(currentUserId, visitor.visitor_id);
      if (!isBlocked) {
        filteredVisitors.push(visitor);
      }
    }

    res.status(200).json({
      success: true,
      data: filteredVisitors,
      pagination: {
        limit,
        offset,
        count: filteredVisitors.length,
      },
    });
  } catch (error) {
    console.error('Get profile visitors error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get profiles current user has visited
const getVisitedProfiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const visitedProfiles = await ProfileVisitors.getVisitedProfiles(userId, limit, offset);

    // Filter out blocked users
    const filtered = [];
    for (const profile of visitedProfiles) {
      const isBlocked = await Block.isBlockedEitherWay(userId, profile.profile_user_id);
      if (!isBlocked) {
        filtered.push(profile);
      }
    }

    res.status(200).json({
      success: true,
      data: filtered,
      pagination: {
        limit,
        offset,
        count: filtered.length,
      },
    });
  } catch (error) {
    console.error('Get visited profiles error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get visit statistics for a profile
const getVisitStats = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Only allow viewing own visit stats or if not blocked
    if (currentUserId !== targetUserId) {
      const isBlocked = await Block.isBlockedEitherWay(currentUserId, targetUserId);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Cannot view visit stats of blocked user',
        });
      }
      // For now, only allow viewing own stats (can be changed later)
      return res.status(403).json({
        success: false,
        message: 'You can only view your own visit statistics',
      });
    }

    const [totalVisits, uniqueVisitors] = await Promise.all([
      ProfileVisitors.getVisitCount(targetUserId),
      ProfileVisitors.getUniqueVisitorCount(targetUserId),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total_visits: totalVisits,
        unique_visitors: uniqueVisitors,
      },
    });
  } catch (error) {
    console.error('Get visit stats error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  getMutualConnections,
  getMyNetworkStats,
  getUserNetworkStats,
  getSuggestedConnections,
  getRelationshipPath,
  getSecondDegreeConnections,
  getProfileVisitors,
  getVisitedProfiles,
  getVisitStats,
};
