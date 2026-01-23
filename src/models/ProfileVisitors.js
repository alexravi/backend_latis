// Profile Visitors model - Track profile visits
const { pool } = require('../config/database');

// Initialize profile_visitors table
const initializeProfileVisitorsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS profile_visitors (
        id SERIAL PRIMARY KEY,
        visitor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        visit_count INTEGER DEFAULT 1,
        first_visited_at TIMESTAMP DEFAULT NOW(),
        last_visited_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (visitor_id != profile_user_id),
        UNIQUE(visitor_id, profile_user_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Profile visitors table initialized');
  } catch (error) {
    console.error('❌ Error initializing profile visitors table:', error.message);
    throw error;
  }
};

// Record a profile visit (upsert with updated timestamp)
const recordVisit = async (visitorId, profileUserId) => {
  try {
    const query = `
      INSERT INTO profile_visitors (visitor_id, profile_user_id, visit_count, first_visited_at, last_visited_at)
      VALUES ($1, $2, 1, NOW(), NOW())
      ON CONFLICT (visitor_id, profile_user_id)
      DO UPDATE SET
        visit_count = profile_visitors.visit_count + 1,
        last_visited_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [visitorId, profileUserId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error recording profile visit:', error.message);
    throw error;
  }
};

// Get users who viewed a profile (most recent first)
const getVisitors = async (profileUserId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT pv.*, 
             u.id as visitor_user_id,
             u.first_name, 
             u.last_name, 
             u.profile_image_url, 
             u.headline
      FROM profile_visitors pv
      JOIN users u ON pv.visitor_id = u.id
      WHERE pv.profile_user_id = $1
      ORDER BY pv.last_visited_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [profileUserId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error getting profile visitors:', error.message);
    throw error;
  }
};

// Get profiles a user has visited
const getVisitedProfiles = async (visitorId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT pv.*, 
             u.id as profile_user_id,
             u.first_name, 
             u.last_name, 
             u.profile_image_url, 
             u.headline
      FROM profile_visitors pv
      JOIN users u ON pv.profile_user_id = u.id
      WHERE pv.visitor_id = $1
      ORDER BY pv.last_visited_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [visitorId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error getting visited profiles:', error.message);
    throw error;
  }
};

// Get total visit count for a profile
const getVisitCount = async (profileUserId) => {
  try {
    const query = `
      SELECT SUM(visit_count) as total_visits
      FROM profile_visitors
      WHERE profile_user_id = $1
    `;
    const result = await pool.query(query, [profileUserId]);
    return parseInt(result.rows[0].total_visits || 0);
  } catch (error) {
    console.error('Error getting visit count:', error.message);
    throw error;
  }
};

// Get unique visitor count for a profile
const getUniqueVisitorCount = async (profileUserId) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM profile_visitors
      WHERE profile_user_id = $1
    `;
    const result = await pool.query(query, [profileUserId]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting unique visitor count:', error.message);
    throw error;
  }
};

// Check if user has visited a profile
const hasVisited = async (visitorId, profileUserId) => {
  try {
    const query = `
      SELECT 1
      FROM profile_visitors
      WHERE visitor_id = $1 AND profile_user_id = $2
      LIMIT 1
    `;
    const result = await pool.query(query, [visitorId, profileUserId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking visit status:', error.message);
    throw error;
  }
};

module.exports = {
  initializeProfileVisitorsTable,
  recordVisit,
  getVisitors,
  getVisitedProfiles,
  getVisitCount,
  getUniqueVisitorCount,
  hasVisited,
};
