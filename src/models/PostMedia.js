// Post Media model - Images, documents, videos attached to posts
const { pool } = require('../config/database');

// Initialize post_media table
const initializePostMediaTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS post_media (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        media_type VARCHAR(50) NOT NULL,
        media_url VARCHAR(500) NOT NULL,
        thumbnail_url VARCHAR(500),
        file_name VARCHAR(255),
        file_size INTEGER,
        mime_type VARCHAR(100),
        width INTEGER,
        height INTEGER,
        duration INTEGER,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Post media table initialized');
  } catch (error) {
    console.error('❌ Error initializing post media table:', error.message);
    throw error;
  }
};

// Create post media
const create = async (mediaData) => {
  try {
    const query = `
      INSERT INTO post_media (
        post_id, media_type, media_url, thumbnail_url, file_name,
        file_size, mime_type, width, height, duration, display_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await pool.query(query, [
      mediaData.post_id,
      mediaData.media_type,
      mediaData.media_url,
      mediaData.thumbnail_url || null,
      mediaData.file_name || null,
      mediaData.file_size || null,
      mediaData.mime_type || null,
      mediaData.width || null,
      mediaData.height || null,
      mediaData.duration || null,
      mediaData.display_order || 0
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating post media:', error.message);
    throw error;
  }
};

// Find media by post ID
const findByPostId = async (postId) => {
  try {
    const query = `
      SELECT * FROM post_media
      WHERE post_id = $1
      ORDER BY display_order ASC, created_at ASC
    `;
    const result = await pool.query(query, [postId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding post media by post ID:', error.message);
    throw error;
  }
};

// Find media by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM post_media WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding post media by ID:', error.message);
    throw error;
  }
};

// Delete post media
const remove = async (id) => {
  try {
    const query = 'DELETE FROM post_media WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting post media:', error.message);
    throw error;
  }
};

// Delete all media for a post
const removeByPostId = async (postId) => {
  try {
    const query = 'DELETE FROM post_media WHERE post_id = $1 RETURNING *';
    const result = await pool.query(query, [postId]);
    return result.rows;
  } catch (error) {
    console.error('Error deleting post media by post ID:', error.message);
    throw error;
  }
};

module.exports = {
  initializePostMediaTable,
  create,
  findByPostId,
  findById,
  remove,
  removeByPostId,
};
