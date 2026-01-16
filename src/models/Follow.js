// Follow model - Follow relationships (separate from connections)
const { pool } = require('../config/database');

// Initialize follows table
const initializeFollowsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        CHECK (follower_id != following_id),
        UNIQUE(follower_id, following_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Follows table initialized');
  } catch (error) {
    console.error('❌ Error initializing follows table:', error.message);
    throw error;
  }
};

// Follow user
const follow = async (followerId, followingId) => {
  try {
    const query = `
      INSERT INTO follows (follower_id, following_id)
      VALUES ($1, $2)
      ON CONFLICT (follower_id, following_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error following user:', error.message);
    throw error;
  }
};

// Unfollow user
const unfollow = async (followerId, followingId) => {
  try {
    const query = `
      DELETE FROM follows
      WHERE follower_id = $1 AND following_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error unfollowing user:', error.message);
    throw error;
  }
};

// Check if user is following
const isFollowing = async (followerId, followingId) => {
  try {
    const query = `
      SELECT * FROM follows
      WHERE follower_id = $1 AND following_id = $2
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking follow status:', error.message);
    throw error;
  }
};

// Find followers of a user
const findFollowers = async (userId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT f.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding followers:', error.message);
    throw error;
  }
};

// Find users a user is following
const findFollowing = async (userId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT f.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding following:', error.message);
    throw error;
  }
};

// Get follower count
const getFollowerCount = async (userId) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM follows
      WHERE following_id = $1
    `;
    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting follower count:', error.message);
    throw error;
  }
};

// Get following count
const getFollowingCount = async (userId) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM follows
      WHERE follower_id = $1
    `;
    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting following count:', error.message);
    throw error;
  }
};

module.exports = {
  initializeFollowsTable,
  follow,
  unfollow,
  isFollowing,
  findFollowers,
  findFollowing,
  getFollowerCount,
  getFollowingCount,
};
