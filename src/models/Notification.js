// Notification model - System notifications
const { pool } = require('../config/database');

// Initialize notifications table
const initializeNotificationsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        notification_data JSONB,
        related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        related_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
        related_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
        related_connection_id INTEGER REFERENCES connections(id) ON DELETE SET NULL,
        related_job_posting_id INTEGER REFERENCES job_postings(id) ON DELETE SET NULL,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Notifications table initialized');
  } catch (error) {
    console.error('❌ Error initializing notifications table:', error.message);
    throw error;
  }
};

// Create notification
const create = async (notificationData) => {
  try {
    const query = `
      INSERT INTO notifications (
        user_id, notification_type, title, message, notification_data,
        related_user_id, related_post_id, related_comment_id,
        related_connection_id, related_job_posting_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await pool.query(query, [
      notificationData.user_id,
      notificationData.notification_type,
      notificationData.title,
      notificationData.message || null,
      notificationData.notification_data || null,
      notificationData.related_user_id || null,
      notificationData.related_post_id || null,
      notificationData.related_comment_id || null,
      notificationData.related_connection_id || null,
      notificationData.related_job_posting_id || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error.message);
    throw error;
  }
};

// Find notifications by user ID
const findByUserId = async (userId, limit = 50, offset = 0, unreadOnly = false) => {
  try {
    let query = `
      SELECT n.*, u.first_name as related_user_first_name,
             u.last_name as related_user_last_name,
             u.profile_image_url as related_user_profile_image
      FROM notifications n
      LEFT JOIN users u ON n.related_user_id = u.id
      WHERE n.user_id = $1
    `;
    const params = [userId];
    let paramCount = 2;

    if (unreadOnly) {
      query += ` AND n.is_read = FALSE`;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error finding notifications by user ID:', error.message);
    throw error;
  }
};

// Find notification by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM notifications WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding notification by ID:', error.message);
    throw error;
  }
};

// Mark notification as read
const markAsRead = async (id) => {
  try {
    const query = `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error marking notification as read:', error.message);
    throw error;
  }
};

// Mark all notifications as read for user
const markAllAsRead = async (userId) => {
  try {
    const query = `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE user_id = $1 AND is_read = FALSE
      RETURNING *
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error marking all notifications as read:', error.message);
    throw error;
  }
};

// Get unread count
const getUnreadCount = async (userId) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND is_read = FALSE
    `;
    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting unread count:', error.message);
    throw error;
  }
};

// Delete notification
const remove = async (id) => {
  try {
    const query = 'DELETE FROM notifications WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting notification:', error.message);
    throw error;
  }
};

// Delete all notifications for user
const removeAllByUserId = async (userId) => {
  try {
    const query = 'DELETE FROM notifications WHERE user_id = $1 RETURNING *';
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error deleting all notifications:', error.message);
    throw error;
  }
};

module.exports = {
  initializeNotificationsTable,
  create,
  findByUserId,
  findById,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  remove,
  removeAllByUserId,
};
