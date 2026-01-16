// Hashtag model - Medical hashtags for content discovery
const { pool } = require('../config/database');

// Initialize hashtags table
const initializeHashtagsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS hashtags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        posts_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Hashtags table initialized');
  } catch (error) {
    console.error('❌ Error initializing hashtags table:', error.message);
    throw error;
  }
};

// Create or get hashtag
const findOrCreate = async (name) => {
  try {
    const normalizedName = name.toLowerCase().trim().replace(/^#/, '');
    
    // Use atomic upsert to prevent race conditions
    const query = `
      INSERT INTO hashtags (name)
      VALUES ($1)
      ON CONFLICT (name) DO NOTHING
      RETURNING *
    `;
    let result = await pool.query(query, [normalizedName]);
    
    // If INSERT didn't return a row (conflict), fetch existing
    if (result.rows.length === 0) {
      const selectQuery = 'SELECT * FROM hashtags WHERE name = $1';
      result = await pool.query(selectQuery, [normalizedName]);
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error finding or creating hashtag:', error.message);
    throw error;
  }
};

// Find hashtag by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM hashtags WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding hashtag by ID:', error.message);
    throw error;
  }
};

// Find hashtag by name
const findByName = async (name) => {
  try {
    const normalizedName = name.toLowerCase().trim().replace(/^#/, '');
    const query = 'SELECT * FROM hashtags WHERE name = $1';
    const result = await pool.query(query, [normalizedName]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding hashtag by name:', error.message);
    throw error;
  }
};

// Search hashtags
const search = async (searchTerm, limit = 20) => {
  try {
    // Escape SQL LIKE wildcards
    const escapedTerm = searchTerm
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    
    const query = `
      SELECT * FROM hashtags
      WHERE name ILIKE $1 ESCAPE '\\'
      ORDER BY posts_count DESC, name ASC
      LIMIT $2
    `;
    const result = await pool.query(query, [`%${escapedTerm}%`, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error searching hashtags:', error.message);
    throw error;
  }
};

// Get trending hashtags
const getTrending = async (limit = 20, days = 7) => {
  try {
    // Validate and normalize days to integer
    const daysInt = parseInt(days, 10);
    if (isNaN(daysInt) || daysInt < 1) {
      throw new Error('days must be a positive integer');
    }
    
    const query = `
      SELECT h.*, COUNT(ph.post_id) as recent_posts_count
      FROM hashtags h
      JOIN post_hashtags ph ON h.id = ph.hashtag_id
      JOIN posts p ON ph.post_id = p.id
      WHERE p.created_at >= NOW() - make_interval(days => $2)
      GROUP BY h.id
      ORDER BY recent_posts_count DESC, h.posts_count DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [limit, daysInt]);
    return result.rows;
  } catch (error) {
    console.error('Error getting trending hashtags:', error.message);
    throw error;
  }
};

// Increment posts count
const incrementPostsCount = async (id, increment = 1) => {
  try {
    const query = `
      UPDATE hashtags
      SET posts_count = posts_count + $1
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing posts count:', error.message);
    throw error;
  }
};

module.exports = {
  initializeHashtagsTable,
  findOrCreate,
  findById,
  findByName,
  search,
  getTrending,
  incrementPostsCount,
};
