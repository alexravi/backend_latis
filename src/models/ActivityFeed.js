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

module.exports = {
  initializeActivityFeedTable,
  create,
  findByUserId,
  findFeed,
  remove,
};
