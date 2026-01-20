// Block model - Hard blocks between users
const { pool } = require('../config/database');

// Initialize blocks table
const initializeBlocksTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS blocks (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        CHECK (blocker_id != blocked_id),
        UNIQUE(blocker_id, blocked_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Blocks table initialized');
  } catch (error) {
    console.error('❌ Error initializing blocks table:', error.message);
    throw error;
  }
};

// Create a block (idempotent)
const blockUser = async (blockerId, blockedId) => {
  try {
    const query = `
      INSERT INTO blocks (blocker_id, blocked_id)
      VALUES ($1, $2)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [blockerId, blockedId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error blocking user:', error.message);
    throw error;
  }
};

// Remove a block
const unblockUser = async (blockerId, blockedId) => {
  try {
    const query = `
      DELETE FROM blocks
      WHERE blocker_id = $1 AND blocked_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [blockerId, blockedId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error unblocking user:', error.message);
    throw error;
  }
};

// Check if userA has blocked userB
const isBlockedOneWay = async (blockerId, blockedId) => {
  try {
    const query = `
      SELECT 1
      FROM blocks
      WHERE blocker_id = $1 AND blocked_id = $2
      LIMIT 1
    `;
    const result = await pool.query(query, [blockerId, blockedId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking one-way block status:', error.message);
    throw error;
  }
};

// Check if there is a block in either direction between two users
const isBlockedEitherWay = async (userId1, userId2) => {
  try {
    const query = `
      SELECT 1
      FROM blocks
      WHERE (blocker_id = $1 AND blocked_id = $2)
         OR (blocker_id = $2 AND blocked_id = $1)
      LIMIT 1
    `;
    const result = await pool.query(query, [userId1, userId2]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking bidirectional block status:', error.message);
    throw error;
  }
};

// Find users current user has blocked
const findBlockedByUser = async (userId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT b.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM blocks b
      JOIN users u ON b.blocked_id = u.id
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding blocked users:', error.message);
    throw error;
  }
};

module.exports = {
  initializeBlocksTable,
  blockUser,
  unblockUser,
  isBlockedOneWay,
  isBlockedEitherWay,
  findBlockedByUser,
};

