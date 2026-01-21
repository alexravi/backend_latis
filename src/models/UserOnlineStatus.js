// UserOnlineStatus model - Online/presence status tracking
const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');

// Initialize user_online_status table
const initializeUserOnlineStatusTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS user_online_status (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        is_online BOOLEAN DEFAULT FALSE,
        last_seen_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ User online status table initialized');
  } catch (error) {
    console.error('❌ Error initializing user online status table:', error.message);
    throw error;
  }
};

// Set user online
const setOnline = async (userId) => {
  try {
    const query = `
      INSERT INTO user_online_status (user_id, is_online, last_seen_at, updated_at)
      VALUES ($1, TRUE, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        is_online = TRUE,
        updated_at = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [userId]);
    
    // Cache in Redis for fast lookups
    if (redisClient) {
      await redisClient.setex(`user:${userId}:status`, 300, JSON.stringify({
        is_online: true,
        last_seen_at: result.rows[0].last_seen_at,
        updated_at: result.rows[0].updated_at,
      }));
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error setting user online:', error.message);
    throw error;
  }
};

// Set user offline
const setOffline = async (userId) => {
  try {
    const query = `
      UPDATE user_online_status
      SET is_online = FALSE, last_seen_at = NOW(), updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [userId]);
    
    // Update cache in Redis
    if (redisClient) {
      const statusData = result.rows[0] || {
        is_online: false,
        last_seen_at: new Date(),
        updated_at: new Date(),
      };
      await redisClient.setex(`user:${userId}:status`, 300, JSON.stringify({
        is_online: false,
        last_seen_at: statusData.last_seen_at,
        updated_at: statusData.updated_at,
      }));
    }
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error setting user offline:', error.message);
    throw error;
  }
};

// Update last seen timestamp
const updateLastSeen = async (userId) => {
  try {
    const query = `
      INSERT INTO user_online_status (user_id, last_seen_at, updated_at)
      VALUES ($1, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        last_seen_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [userId]);
    
    // Update cache in Redis
    if (redisClient && result.rows[0]) {
      await redisClient.setex(`user:${userId}:status`, 300, JSON.stringify({
        is_online: result.rows[0].is_online,
        last_seen_at: result.rows[0].last_seen_at,
        updated_at: result.rows[0].updated_at,
      }));
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error updating last seen:', error.message);
    throw error;
  }
};

// Get user status (check cache first, then database)
const getStatus = async (userId) => {
  try {
    // Try Redis cache first
    if (redisClient) {
      const cached = await redisClient.get(`user:${userId}:status`);
      if (cached) {
        return JSON.parse(cached);
      }
    }
    
    // Fall back to database
    const query = `
      SELECT * FROM user_online_status WHERE user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      // User doesn't have status record yet, return default
      return {
        is_online: false,
        last_seen_at: null,
        updated_at: null,
      };
    }
    
    const status = result.rows[0];
    
    // Cache for future lookups
    if (redisClient) {
      await redisClient.setex(`user:${userId}:status`, 300, JSON.stringify({
        is_online: status.is_online,
        last_seen_at: status.last_seen_at,
        updated_at: status.updated_at,
      }));
    }
    
    return {
      is_online: status.is_online,
      last_seen_at: status.last_seen_at,
      updated_at: status.updated_at,
    };
  } catch (error) {
    console.error('Error getting user status:', error.message);
    throw error;
  }
};

// Get status for multiple users
const getStatuses = async (userIds) => {
  try {
    if (!userIds || userIds.length === 0) {
      return [];
    }
    
    // Try to get as many as possible from Redis cache
    const statuses = {};
    const uncachedUserIds = [];
    
    if (redisClient) {
      for (const userId of userIds) {
        try {
          const cached = await redisClient.get(`user:${userId}:status`);
          if (cached) {
            statuses[userId] = JSON.parse(cached);
          } else {
            uncachedUserIds.push(userId);
          }
        } catch (err) {
          uncachedUserIds.push(userId);
        }
      }
    } else {
      uncachedUserIds.push(...userIds);
    }
    
    // Fetch uncached users from database
    if (uncachedUserIds.length > 0) {
      const placeholders = uncachedUserIds.map((_, i) => `$${i + 1}`).join(',');
      const query = `
        SELECT * FROM user_online_status
        WHERE user_id IN (${placeholders})
      `;
      const result = await pool.query(query, uncachedUserIds);
      
      for (const row of result.rows) {
        statuses[row.user_id] = {
          is_online: row.is_online,
          last_seen_at: row.last_seen_at,
          updated_at: row.updated_at,
        };
        
        // Cache for future lookups
        if (redisClient) {
          await redisClient.setex(`user:${row.user_id}:status`, 300, JSON.stringify({
            is_online: row.is_online,
            last_seen_at: row.last_seen_at,
            updated_at: row.updated_at,
          }));
        }
      }
    }
    
    // Return statuses in the order requested, with defaults for missing ones
    return userIds.map(userId => ({
      user_id: userId,
      ...(statuses[userId] || {
        is_online: false,
        last_seen_at: null,
        updated_at: null,
      }),
    }));
  } catch (error) {
    console.error('Error getting user statuses:', error.message);
    throw error;
  }
};

module.exports = {
  initializeUserOnlineStatusTable,
  setOnline,
  setOffline,
  updateLastSeen,
  getStatus,
  getStatuses,
};
