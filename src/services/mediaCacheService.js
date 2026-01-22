// Media Cache Service - Purpose-based Redis caching for media URLs
const { get, set, del } = require('./cacheService');
const logger = require('../utils/logger');

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
  MEDIA_DESCRIPTOR: 3600,  // 1 hour
  MEDIA_VARIANT: 3600,     // 1 hour
  PROFILE_PICTURE: 3600,   // 1 hour
};

/**
 * Get cache key for media variant
 */
const getMediaVariantKey = (mediaId, purpose) => {
  return `media:${mediaId}:${purpose}`;
};

/**
 * Get cache key for media descriptor
 */
const getMediaDescriptorKey = (mediaId) => {
  return `media:${mediaId}:descriptor`;
};

/**
 * Get cache key for profile picture
 */
const getProfilePictureKey = (userId, purpose) => {
  return `profile:${userId}:${purpose}`;
};

/**
 * Cache media variant URL
 */
const cacheMediaVariant = async (mediaId, purpose, url) => {
  try {
    const key = getMediaVariantKey(mediaId, purpose);
    await set(key, url, CACHE_TTL.MEDIA_VARIANT);
    return true;
  } catch (error) {
    logger.error('Failed to cache media variant', { error: error.message, mediaId, purpose });
    return false;
  }
};

/**
 * Get cached media variant URL
 */
const getCachedMediaVariant = async (mediaId, purpose) => {
  try {
    const key = getMediaVariantKey(mediaId, purpose);
    return await get(key);
  } catch (error) {
    logger.error('Failed to get cached media variant', { error: error.message, mediaId, purpose });
    return null;
  }
};

/**
 * Cache media descriptor
 */
const cacheMediaDescriptor = async (mediaId, descriptor) => {
  try {
    const key = getMediaDescriptorKey(mediaId);
    await set(key, descriptor, CACHE_TTL.MEDIA_DESCRIPTOR);
    return true;
  } catch (error) {
    logger.error('Failed to cache media descriptor', { error: error.message, mediaId });
    return false;
  }
};

/**
 * Get cached media descriptor
 */
const getCachedMediaDescriptor = async (mediaId) => {
  try {
    const key = getMediaDescriptorKey(mediaId);
    return await get(key);
  } catch (error) {
    logger.error('Failed to get cached media descriptor', { error: error.message, mediaId });
    return null;
  }
};

/**
 * Cache profile picture URL
 */
const cacheProfilePicture = async (userId, purpose, url) => {
  try {
    const key = getProfilePictureKey(userId, purpose);
    await set(key, url, CACHE_TTL.PROFILE_PICTURE);
    return true;
  } catch (error) {
    logger.error('Failed to cache profile picture', { error: error.message, userId, purpose });
    return false;
  }
};

/**
 * Get cached profile picture URL
 */
const getCachedProfilePicture = async (userId, purpose) => {
  try {
    const key = getProfilePictureKey(userId, purpose);
    return await get(key);
  } catch (error) {
    logger.error('Failed to get cached profile picture', { error: error.message, userId, purpose });
    return null;
  }
};

/**
 * Invalidate media cache (all variants and descriptor)
 */
const invalidateMediaCache = async (mediaId) => {
  try {
    const purposes = ['thumb', 'feed', 'full', 'descriptor'];
    const keys = purposes.map(purpose => 
      purpose === 'descriptor' 
        ? getMediaDescriptorKey(mediaId)
        : getMediaVariantKey(mediaId, purpose)
    );
    
    for (const key of keys) {
      await del(key);
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to invalidate media cache', { error: error.message, mediaId });
    return false;
  }
};

/**
 * Invalidate profile picture cache (all variants)
 */
const invalidateProfilePictureCache = async (userId) => {
  try {
    const purposes = ['thumb', 'small', 'medium'];
    const keys = purposes.map(purpose => getProfilePictureKey(userId, purpose));
    
    for (const key of keys) {
      await del(key);
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to invalidate profile picture cache', { error: error.message, userId });
    return false;
  }
};

/**
 * Batch cache media variants
 */
const batchCacheMediaVariants = async (mediaId, variants) => {
  try {
    const cachePromises = Object.entries(variants).map(([purpose, url]) =>
      cacheMediaVariant(mediaId, purpose, url)
    );
    await Promise.all(cachePromises);
    return true;
  } catch (error) {
    logger.error('Failed to batch cache media variants', { error: error.message, mediaId });
    return false;
  }
};

module.exports = {
  cacheMediaVariant,
  getCachedMediaVariant,
  cacheMediaDescriptor,
  getCachedMediaDescriptor,
  cacheProfilePicture,
  getCachedProfilePicture,
  invalidateMediaCache,
  invalidateProfilePictureCache,
  batchCacheMediaVariants,
};
