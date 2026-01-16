// Post Hashtag model - Post-hashtag relationships
const { pool } = require('../config/database');

// Initialize post_hashtags table
const initializePostHashtagsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS post_hashtags (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        hashtag_id INTEGER NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(post_id, hashtag_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Post hashtags table initialized');
  } catch (error) {
    console.error('❌ Error initializing post hashtags table:', error.message);
    throw error;
  }
};

// Add hashtag to post
const addHashtag = async (postId, hashtagId) => {
  try {
    const query = `
      INSERT INTO post_hashtags (post_id, hashtag_id)
      VALUES ($1, $2)
      ON CONFLICT (post_id, hashtag_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [postId, hashtagId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error adding hashtag to post:', error.message);
    throw error;
  }
};

// Remove hashtag from post
const removeHashtag = async (postId, hashtagId) => {
  try {
    const query = `
      DELETE FROM post_hashtags
      WHERE post_id = $1 AND hashtag_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [postId, hashtagId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error removing hashtag from post:', error.message);
    throw error;
  }
};

// Find hashtags by post ID
const findByPostId = async (postId) => {
  try {
    const query = `
      SELECT ph.*, h.name, h.description
      FROM post_hashtags ph
      JOIN hashtags h ON ph.hashtag_id = h.id
      WHERE ph.post_id = $1
      ORDER BY h.name ASC
    `;
    const result = await pool.query(query, [postId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding hashtags by post ID:', error.message);
    throw error;
  }
};

// Find posts by hashtag ID
const findByHashtagId = async (hashtagId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT ph.*, p.*, u.first_name, u.last_name, u.profile_image_url
      FROM post_hashtags ph
      JOIN posts p ON ph.post_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE ph.hashtag_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [hashtagId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding posts by hashtag ID:', error.message);
    throw error;
  }
};

// Remove all hashtags from post
const removeByPostId = async (postId) => {
  try {
    const query = 'DELETE FROM post_hashtags WHERE post_id = $1 RETURNING *';
    const result = await pool.query(query, [postId]);
    return result.rows;
  } catch (error) {
    console.error('Error removing hashtags by post ID:', error.message);
    throw error;
  }
};

module.exports = {
  initializePostHashtagsTable,
  addHashtag,
  removeHashtag,
  findByPostId,
  findByHashtagId,
  removeByPostId,
};
