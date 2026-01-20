// Redis caching service for posts, comments, and vote counts
const { redisClient } = require('../config/redis');

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
  POST: 300,        // 5 minutes
  POST_FEED: 60,    // 1 minute
  COMMENT: 120,     // 2 minutes
  COMMENT_TREE: 120, // 2 minutes
  VOTE_COUNT: 30,   // 30 seconds
  USER_REACTIONS: 60, // 1 minute
  USER_PROFILE: 3600, // 1 hour
  USER_PROFESSIONAL_DATA: 1800, // 30 minutes
};

// Helper function to generate cache keys
const getCacheKey = (type, ...args) => {
  return `${type}:${args.join(':')}`;
};

// Get cached value
const get = async (key) => {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Cache get error:', error.message);
    return null; // Return null on error to allow fallback to database
  }
};

// Set cached value with TTL
const set = async (key, value, ttl) => {
  try {
    const stringValue = JSON.stringify(value);
    if (ttl) {
      await redisClient.setex(key, ttl, stringValue);
    } else {
      await redisClient.set(key, stringValue);
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error.message);
    return false; // Don't throw, just log - caching is optional
  }
};

// Delete cached value
const del = async (key) => {
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error.message);
    return false;
  }
};

// Delete multiple keys with pattern
const delPattern = async (pattern) => {
  try {
    const keys = [];
    let cursor = '0';
    const batchSize = 100;

    // Use SCAN to iterate through keys non-blocking
    do {
      const result = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    // Delete keys in batches to avoid huge argument lists
    if (keys.length > 0) {
      const deleteBatchSize = 100;
      for (let i = 0; i < keys.length; i += deleteBatchSize) {
        const batch = keys.slice(i, i + deleteBatchSize);
        await redisClient.del(...batch);
      }
    }
    return true;
  } catch (error) {
    console.error('Cache delete pattern error:', error.message);
    return false;
  }
};

// Post caching
const getPost = async (postId) => {
  const key = getCacheKey('post', postId);
  return await get(key);
};

const setPost = async (postId, postData) => {
  const key = getCacheKey('post', postId);
  return await set(key, postData, CACHE_TTL.POST);
};

const deletePost = async (postId) => {
  const key = getCacheKey('post', postId);
  await del(key);
  // Also invalidate feed caches
  await delPattern('post:feed:*');
};

// Post feed caching with stale-while-revalidate support
const getPostFeed = async (userId, sortBy, limit, offset) => {
  const key = getCacheKey('post', 'feed', userId, sortBy, limit, offset);
  const staleKey = getCacheKey('post', 'feed', 'stale', userId, sortBy, limit, offset);
  
  // Try to get fresh cache first
  const fresh = await get(key);
  if (fresh) {
    return { data: fresh, isStale: false };
  }
  
  // If no fresh cache, try stale cache
  const stale = await get(staleKey);
  if (stale) {
    return { data: stale, isStale: true };
  }
  
  return null;
};

const setPostFeed = async (userId, sortBy, limit, offset, feedData, isStale = false) => {
  const key = getCacheKey('post', 'feed', userId, sortBy, limit, offset);
  const staleKey = getCacheKey('post', 'feed', 'stale', userId, sortBy, limit, offset);
  
  // Set fresh cache
  await set(key, feedData, CACHE_TTL.POST_FEED);
  
  // Also set stale cache with longer TTL (for stale-while-revalidate)
  if (!isStale) {
    await set(staleKey, feedData, CACHE_TTL.POST_FEED * 2); // Stale cache lasts 2x longer
  }
  
  return true;
};

const invalidatePostFeed = async (userId = null) => {
  if (userId) {
    await delPattern(`post:feed:${userId}:*`);
  } else {
    await delPattern('post:feed:*');
  }
};

// Comment caching
const getComment = async (commentId) => {
  const key = getCacheKey('comment', commentId);
  return await get(key);
};

const setComment = async (commentId, commentData) => {
  const key = getCacheKey('comment', commentId);
  return await set(key, commentData, CACHE_TTL.COMMENT);
};

const deleteComment = async (commentId) => {
  const key = getCacheKey('comment', commentId);
  await del(key);
};

// Comment tree caching
const getCommentTree = async (postId, sortBy) => {
  const key = getCacheKey('comment', 'tree', postId, sortBy);
  return await get(key);
};

const setCommentTree = async (postId, sortBy, treeData) => {
  const key = getCacheKey('comment', 'tree', postId, sortBy);
  return await set(key, treeData, CACHE_TTL.COMMENT_TREE);
};

const invalidateCommentTree = async (postId) => {
  await delPattern(`comment:tree:${postId}:*`);
};

// Vote count caching
const getVoteCount = async (type, id) => {
  const key = getCacheKey('vote', type, id);
  return await get(key);
};

const setVoteCount = async (type, id, voteData) => {
  const key = getCacheKey('vote', type, id);
  return await set(key, voteData, CACHE_TTL.VOTE_COUNT);
};

const invalidateVoteCount = async (type, id) => {
  const key = getCacheKey('vote', type, id);
  await del(key);
};

// User reactions caching (batch)
const getUserReactions = async (userId, type, ids) => {
  // Sort ids for consistent cache key
  const sortedIds = [...ids].sort((a, b) => a - b);
  const key = getCacheKey('reactions', userId, type, sortedIds.join(','));
  return await get(key);
};

const setUserReactions = async (userId, type, ids, reactionsData) => {
  const sortedIds = [...ids].sort((a, b) => a - b);
  const key = getCacheKey('reactions', userId, type, sortedIds.join(','));
  return await set(key, reactionsData, CACHE_TTL.USER_REACTIONS);
};

const invalidateUserReactions = async (userId = null) => {
  if (userId) {
    await delPattern(`reactions:${userId}:*`);
  } else {
    await delPattern('reactions:*');
  }
};

// Batch invalidate related caches (when post is updated/deleted)
const invalidatePostRelated = async (postId) => {
  await deletePost(postId);
  await invalidatePostFeed();
  await invalidateCommentTree(postId);
};

// Batch invalidate related caches (when comment is updated/deleted)
const invalidateCommentRelated = async (postId, commentId) => {
  await deleteComment(commentId);
  await invalidateCommentTree(postId);
};

// User profile caching
const getUserProfile = async (userId) => {
  const key = getCacheKey('user', 'profile', userId);
  return await get(key);
};

const setUserProfile = async (userId, profileData) => {
  const key = getCacheKey('user', 'profile', userId);
  return await set(key, profileData, CACHE_TTL.USER_PROFILE);
};

const deleteUserProfile = async (userId) => {
  const key = getCacheKey('user', 'profile', userId);
  await del(key);
  // Also invalidate professional data cache
  await deleteUserProfessionalData(userId);
};

// User professional data caching (experiences, education, skills, etc.)
const getUserProfessionalData = async (userId) => {
  const key = getCacheKey('user', 'professional', userId);
  return await get(key);
};

const setUserProfessionalData = async (userId, professionalData) => {
  const key = getCacheKey('user', 'professional', userId);
  return await set(key, professionalData, CACHE_TTL.USER_PROFESSIONAL_DATA);
};

const deleteUserProfessionalData = async (userId) => {
  const key = getCacheKey('user', 'professional', userId);
  await del(key);
};

// Invalidate all user-related caches
const invalidateUserCaches = async (userId) => {
  await deleteUserProfile(userId);
  await deleteUserProfessionalData(userId);
  await invalidateUserReactions(userId);
};

module.exports = {
  // Generic cache operations
  get,
  set,
  del,
  delPattern,
  
  // Post cache
  getPost,
  setPost,
  deletePost,
  
  // Post feed cache
  getPostFeed,
  setPostFeed,
  invalidatePostFeed,
  
  // Comment cache
  getComment,
  setComment,
  deleteComment,
  
  // Comment tree cache
  getCommentTree,
  setCommentTree,
  invalidateCommentTree,
  
  // Vote count cache
  getVoteCount,
  setVoteCount,
  invalidateVoteCount,
  
  // User reactions cache
  getUserReactions,
  setUserReactions,
  invalidateUserReactions,
  
  // Batch invalidation
  invalidatePostRelated,
  invalidateCommentRelated,
  
  // User profile cache
  getUserProfile,
  setUserProfile,
  deleteUserProfile,
  
  // User professional data cache
  getUserProfessionalData,
  setUserProfessionalData,
  deleteUserProfessionalData,
  
  // User cache invalidation
  invalidateUserCaches,
};
