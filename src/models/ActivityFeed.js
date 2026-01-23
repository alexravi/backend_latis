// Activity Feed model - User activity timeline
const { pool } = require('../config/database');

// Initialize activity_feed table
const initializeActivityFeedTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS activity_feed (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_type VARCHAR(100) NOT NULL,
        activity_data JSONB,
        related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        related_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
        related_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
        related_connection_id INTEGER REFERENCES connections(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Activity feed table initialized');
  } catch (error) {
    console.error('❌ Error initializing activity feed table:', error.message);
    throw error;
  }
};

// Create activity
const create = async (activityData) => {
  try {
    const query = `
      INSERT INTO activity_feed (
        user_id, activity_type, activity_data, related_user_id,
        related_post_id, related_comment_id, related_connection_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [
      activityData.user_id,
      activityData.activity_type,
      activityData.activity_data || null,
      activityData.related_user_id || null,
      activityData.related_post_id || null,
      activityData.related_comment_id || null,
      activityData.related_connection_id || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating activity:', error.message);
    throw error;
  }
};

// Find activities by user ID (for user's own activity)
const findByUserId = async (userId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT * FROM activity_feed
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding activities by user ID:', error.message);
    throw error;
  }
};

// Find feed activities (activities from connections/following)
const findFeed = async (userId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT af.*, u.first_name, u.last_name, u.profile_image_url
      FROM activity_feed af
      JOIN users u ON af.user_id = u.id
      WHERE af.user_id = $1
         OR EXISTS (
           SELECT 1 FROM follows f
           WHERE f.following_id = af.user_id AND f.follower_id = $1
         )
         OR EXISTS (
           SELECT 1 FROM connections c
           WHERE ((c.requester_id = $1 AND c.addressee_id = af.user_id) OR
                  (c.requester_id = af.user_id AND c.addressee_id = $1))
             AND c.status = 'connected'
         )
      ORDER BY af.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding feed activities:', error.message);
    throw error;
  }
};

// Delete activity
const remove = async (id) => {
  try {
    const query = 'DELETE FROM activity_feed WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting activity:', error.message);
    throw error;
  }
};

// Find activities by type
const findByType = async (userId, activityType, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT * FROM activity_feed
      WHERE user_id = $1 AND activity_type = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await pool.query(query, [userId, activityType, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding activities by type:', error.message);
    throw error;
  }
};

// Find activities by date range
const findByDateRange = async (userId, startDate, endDate, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT * FROM activity_feed
      WHERE user_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
      ORDER BY created_at DESC
      LIMIT $4 OFFSET $5
    `;
    const result = await pool.query(query, [userId, startDate, endDate, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding activities by date range:', error.message);
    throw error;
  }
};

// Find activities with filters (type and/or date range)
const findWithFilters = async (userId, filters = {}, limit = 50, offset = 0) => {
  try {
    let query = 'SELECT * FROM activity_feed WHERE user_id = $1';
    const params = [userId];
    let paramCount = 2;

    if (filters.activity_type) {
      query += ` AND activity_type = $${paramCount}`;
      params.push(filters.activity_type);
      paramCount++;
    }

    if (filters.start_date) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(filters.start_date);
      paramCount++;
    }

    if (filters.end_date) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(filters.end_date);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error finding activities with filters:', error.message);
    throw error;
  }
};

// Find feed activities with filters
const findFeedWithFilters = async (userId, filters = {}, limit = 50, offset = 0) => {
  try {
    let query = `
      SELECT af.*, u.first_name, u.last_name, u.profile_image_url
      FROM activity_feed af
      JOIN users u ON af.user_id = u.id
      WHERE (af.user_id = $1
         OR EXISTS (
           SELECT 1 FROM follows f
           WHERE f.following_id = af.user_id AND f.follower_id = $1
         )
         OR EXISTS (
           SELECT 1 FROM connections c
           WHERE ((c.requester_id = $1 AND c.addressee_id = af.user_id) OR
                  (c.requester_id = af.user_id AND c.addressee_id = $1))
             AND c.status = 'connected'
         ))
    `;
    const params = [userId];
    let paramCount = 2;

    if (filters.activity_type) {
      query += ` AND af.activity_type = $${paramCount}`;
      params.push(filters.activity_type);
      paramCount++;
    }

    if (filters.start_date) {
      query += ` AND af.created_at >= $${paramCount}`;
      params.push(filters.start_date);
      paramCount++;
    }

    if (filters.end_date) {
      query += ` AND af.created_at <= $${paramCount}`;
      params.push(filters.end_date);
      paramCount++;
    }

    query += ` ORDER BY af.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error finding feed activities with filters:', error.message);
    throw error;
  }
};

// Find activities involving multiple users (mutual activities)
const findMutualActivities = async (userId1, userId2, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT * FROM activity_feed
      WHERE (user_id = $1 AND related_user_id = $2)
         OR (user_id = $2 AND related_user_id = $1)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    const result = await pool.query(query, [userId1, userId2, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding mutual activities:', error.message);
    throw error;
  }
};

module.exports = {
  initializeActivityFeedTable,
  create,
  findByUserId,
  findFeed,
  remove,
  findByType,
  findByDateRange,
  findWithFilters,
  findFeedWithFilters,
  findMutualActivities,
};
