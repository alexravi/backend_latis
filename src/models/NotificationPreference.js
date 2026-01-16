// Notification Preference model - User notification settings
const { pool } = require('../config/database');

// Initialize notification_preferences table
const initializeNotificationPreferencesTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email_notifications BOOLEAN DEFAULT TRUE,
        push_notifications BOOLEAN DEFAULT TRUE,
        connection_requests BOOLEAN DEFAULT TRUE,
        connection_accepted BOOLEAN DEFAULT TRUE,
        new_messages BOOLEAN DEFAULT TRUE,
        post_likes BOOLEAN DEFAULT TRUE,
        post_comments BOOLEAN DEFAULT TRUE,
        post_shares BOOLEAN DEFAULT TRUE,
        mentions BOOLEAN DEFAULT TRUE,
        recommendations BOOLEAN DEFAULT TRUE,
        job_alerts BOOLEAN DEFAULT TRUE,
        group_updates BOOLEAN DEFAULT TRUE,
        weekly_digest BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Notification preferences table initialized');
  } catch (error) {
    console.error('❌ Error initializing notification preferences table:', error.message);
    throw error;
  }
};

// Create or update notification preferences
const upsert = async (userId, preferences) => {
  try {
    const allowedFields = [
      'email_notifications', 'push_notifications', 'connection_requests',
      'connection_accepted', 'new_messages', 'post_likes', 'post_comments',
      'post_shares', 'mentions', 'recommendations', 'job_alerts',
      'group_updates', 'weekly_digest'
    ];

    // Defaults for new records
    const defaults = {
      email_notifications: true,
      push_notifications: true,
      connection_requests: true,
      connection_accepted: true,
      new_messages: true,
      post_likes: true,
      post_comments: true,
      post_shares: true,
      mentions: true,
      recommendations: true,
      job_alerts: true,
      group_updates: true,
      weekly_digest: false
    };
    
    // Merge defaults with provided preferences
    const mergedPreferences = { ...defaults, ...preferences };
    const values = [userId];
    const fieldNames = ['user_id'];
    const placeholders = ['$1'];
    const updateParts = [];
    let paramCount = 2;

    allowedFields.forEach(field => {
      fieldNames.push(field);
      placeholders.push(`$${paramCount}`);
      values.push(mergedPreferences[field] !== undefined ? mergedPreferences[field] : defaults[field]);
      updateParts.push(`${field} = EXCLUDED.${field}`);
      paramCount++;
    });

    const query = `
      INSERT INTO notification_preferences (${fieldNames.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (user_id) DO UPDATE SET
        ${updateParts.join(', ')},
        updated_at = NOW()
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error upserting notification preferences:', error.message);
    throw error;
  }
};

// Find preferences by user ID
const findByUserId = async (userId) => {
  try {
    const query = 'SELECT * FROM notification_preferences WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding notification preferences by user ID:', error.message);
    throw error;
  }
};

// Update notification preferences
const update = async (userId, preferences) => {
  try {
    const allowedFields = [
      'email_notifications', 'push_notifications', 'connection_requests',
      'connection_accepted', 'new_messages', 'post_likes', 'post_comments',
      'post_shares', 'mentions', 'recommendations', 'job_alerts',
      'group_updates', 'weekly_digest'
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(preferences)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return await findByUserId(userId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE notification_preferences
      SET ${fields.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating notification preferences:', error.message);
    throw error;
  }
};

module.exports = {
  initializeNotificationPreferencesTable,
  upsert,
  findByUserId,
  update,
};
