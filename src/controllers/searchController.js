// Search controller
const {
  searchUsers,
  searchPosts,
  searchJobPostings,
  universalSearch,
} = require('../services/searchService');

/**
 * Search users
 */
const searchUsersHandler = async (req, res) => {
  try {
    const query = req.query.q || req.query.query || '';
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const results = await searchUsers(query.trim(), limit, offset);

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
