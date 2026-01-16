// Share model - Post shares/reposts
const { pool } = require('../config/database');

// Initialize shares table
const initializeSharesTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        shared_content TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, post_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Shares table initialized');
  } catch (error) {
    console.error('❌ Error initializing shares table:', error.message);
    throw error;
  }
};

// Create share
const create = async (shareData) => {
  try {
    const query = `
      INSERT INTO shares (user_id, post_id, shared_content)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, post_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [
      shareData.user_id,
      shareData.post_id,
      shareData.shared_content || null
    ]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error creating share:', error.message);
    throw error;
  }
};

// Find shares by post ID
const findByPostId = async (postId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT s.*, u.first_name, u.last_name, u.profile_image_url
      FROM shares s
      JOIN users u ON s.user_id = u.id
      WHERE s.post_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [postId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding shares by post ID:', error.message);
    throw error;
  }
};

// Find shares by user ID
const findByUserId = async (userId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT s.*, p.content as original_post_content, p.user_id as original_author_id,
             u.first_name as original_author_first_name, u.last_name as original_author_last_name
      FROM shares s
      JOIN posts p ON s.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding shares by user ID:', error.message);
    throw error;
  }
};

// Check if user has shared post
const hasShared = async (userId, postId) => {
  try {
    const query = `
      SELECT * FROM shares
      WHERE user_id = $1 AND post_id = $2
    `;
    const result = await pool.query(query, [userId, postId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking if user has shared:', error.message);
    throw error;
  }
};

// Remove share
const remove = async (userId, postId) => {
  try {
    const query = `
      DELETE FROM shares
      WHERE user_id = $1 AND post_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [userId, postId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error removing share:', error.message);
    throw error;
  }
};

module.exports = {
  initializeSharesTable,
  create,
  findByPostId,
  findByUserId,
  hasShared,
  remove,
};
