// Activity Controller - Activity feed management
const ActivityFeed = require('../models/ActivityFeed');
const User = require('../models/User');
const Block = require('../models/Block');

// Get activity feed (activities from connections/following)
const getActivityFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const activityType = req.query.type || null;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;

    // Build filters
    const filters = {};
    if (activityType) filters.activity_type = activityType;
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;

    // Get activities
    const activities = filters.activity_type || filters.start_date || filters.end_date
      ? await ActivityFeed.findFeedWithFilters(userId, filters, limit, offset)
      : await ActivityFeed.findFeed(userId, limit, offset);

    // Filter out activities from blocked users
    const filteredActivities = [];
    for (const activity of activities) {
      // Skip if activity is from a blocked user or user is blocked by them
      const isBlocked = await Block.isBlockedEitherWay(userId, activity.user_id);
      if (!isBlocked) {
        filteredActivities.push(activity);
      }
    }

    res.status(200).json({
      success: true,
      data: filteredActivities,
      pagination: {
        limit,
        offset,
        count: filteredActivities.length,
      },
    });
  } catch (error) {
    console.error('Get activity feed error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get current user's own activities
const getMyActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const activityType = req.query.type || null;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;

    // Build filters
    const filters = {};
    if (activityType) filters.activity_type = activityType;
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;

    // Get activities
    const activities = filters.activity_type || filters.start_date || filters.end_date
      ? await ActivityFeed.findWithFilters(userId, filters, limit, offset)
      : await ActivityFeed.findByUserId(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        limit,
        offset,
        count: activities.length,
      },
    });
  } catch (error) {
    console.error('Get my activities error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get activities for a specific user
const getUserActivities = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInt(req.params.id, 10);

    if (isNaN(targetUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Check if user exists
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
        message: 'Cannot view activities of blocked user',
      });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const activityType = req.query.type || null;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;

    // Build filters
    const filters = {};
    if (activityType) filters.activity_type = activityType;
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;

    // Get activities
    const activities = filters.activity_type || filters.start_date || filters.end_date
      ? await ActivityFeed.findWithFilters(targetUserId, filters, limit, offset)
      : await ActivityFeed.findByUserId(targetUserId, limit, offset);

    res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        limit,
        offset,
        count: activities.length,
      },
    });
  } catch (error) {
    console.error('Get user activities error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get activities with filtering (general endpoint)
const getActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const activityType = req.query.type || null;
    const startDate = req.query.start_date || null;
    const endDate = req.query.end_date || null;
    const feed = req.query.feed === 'true'; // If true, show feed (connections/following), else own activities

    // Build filters
    const filters = {};
    if (activityType) filters.activity_type = activityType;
    if (startDate) filters.start_date = startDate;
    if (endDate) filters.end_date = endDate;

    let activities;
    if (feed) {
      // Get feed activities
      activities = filters.activity_type || filters.start_date || filters.end_date
        ? await ActivityFeed.findFeedWithFilters(userId, filters, limit, offset)
        : await ActivityFeed.findFeed(userId, limit, offset);

      // Filter out activities from blocked users
      const filteredActivities = [];
      for (const activity of activities) {
        const isBlocked = await Block.isBlockedEitherWay(userId, activity.user_id);
        if (!isBlocked) {
          filteredActivities.push(activity);
        }
      }
      activities = filteredActivities;
    } else {
      // Get own activities
      activities = filters.activity_type || filters.start_date || filters.end_date
        ? await ActivityFeed.findWithFilters(userId, filters, limit, offset)
        : await ActivityFeed.findByUserId(userId, limit, offset);
    }

    res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        limit,
        offset,
        count: activities.length,
      },
    });
  } catch (error) {
    console.error('Get activities error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  getActivityFeed,
  getMyActivities,
  getUserActivities,
  getActivities,
};
