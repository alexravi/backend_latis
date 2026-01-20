// Search controller
const {
  searchUsers,
  searchPosts,
  searchJobPostings,
  universalSearch,
} = require('../services/searchService');
const Connection = require('../models/Connection');
const Follow = require('../models/Follow');
const Block = require('../models/Block');

/**
 * Search users
 */
const searchUsersHandler = async (req, res) => {
  try {
    const query = req.query.q || req.query.query || '';
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const viewerId = req.user ? req.user.id : null;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    let results = await searchUsers(query.trim(), limit, offset);

    // Attach relationship flags and filter out blocked users for authenticated viewers
    if (viewerId && Array.isArray(results) && results.length > 0) {
      const enhanced = [];
      for (const user of results) {
        const targetId = user.id;
        if (!targetId || targetId === viewerId) {
          enhanced.push(user);
          continue;
        }

        const [isBlockedEither, connection, iFollowThem, theyFollowMe, iBlocked, blockedMe] =
          await Promise.all([
            Block.isBlockedEitherWay(viewerId, targetId),
            Connection.findConnection(viewerId, targetId),
            Follow.isFollowing(viewerId, targetId),
            Follow.isFollowing(targetId, viewerId),
            Block.isBlockedOneWay(viewerId, targetId),
            Block.isBlockedOneWay(targetId, viewerId),
          ]);

        // Hard block: do not show user at all
        if (isBlockedEither) {
          continue;
        }

        user.relationship = {
          isConnected: !!connection && connection.status === 'connected',
          connectionStatus: connection ? connection.status : null,
          connectionRequesterId: connection ? connection.requester_id : null,
          connectionPending: !!connection && connection.status === 'pending',
          iFollowThem,
          theyFollowMe,
          iBlocked,
          blockedMe,
        };

        enhanced.push(user);
      }

      results = enhanced;
    }

    res.status(200).json({
      success: true,
      data: results,
      pagination: {
        limit,
        offset,
        hasMore: results.length === limit,
      },
    });
  } catch (error) {
    console.error('Search users error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Search posts
 */
const searchPostsHandler = async (req, res) => {
  try {
    const query = req.query.q || req.query.query || '';
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.user ? req.user.id : null;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const results = await searchPosts(query.trim(), limit, offset, userId);

    res.status(200).json({
      success: true,
      data: results,
      pagination: {
        limit,
        offset,
        hasMore: results.length === limit,
      },
    });
  } catch (error) {
    console.error('Search posts error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Search job postings
 */
const searchJobsHandler = async (req, res) => {
  try {
    const query = req.query.q || req.query.query || '';
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const filters = {
      specialty: req.query.specialty,
      job_type: req.query.job_type,
      location: req.query.location,
      is_remote: req.query.is_remote === 'true' ? true : req.query.is_remote === 'false' ? false : undefined,
    };

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const results = await searchJobPostings(query.trim(), filters, limit, offset);

    res.status(200).json({
      success: true,
      data: results,
      pagination: {
        limit,
        offset,
        hasMore: results.length === limit,
      },
    });
  } catch (error) {
    console.error('Search jobs error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Universal search (searches across all types)
 */
const universalSearchHandler = async (req, res) => {
  try {
    const query = req.query.q || req.query.query || '';
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const userId = req.user ? req.user.id : null;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const results = await universalSearch(query.trim(), limit, offset, userId);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Universal search error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  searchUsers: searchUsersHandler,
  searchPosts: searchPostsHandler,
  searchJobs: searchJobsHandler,
  universalSearch: universalSearchHandler,
};
