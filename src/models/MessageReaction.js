// MessageReaction model - Reactions to messages (emojis)
const { pool } = require('../config/database');

// Initialize message_reactions table
const initializeMessageReactionsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reaction_type VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(message_id, user_id, reaction_type)
      );
    `;
    await pool.query(query);
    console.log('✅ Message reactions table initialized');
  } catch (error) {
    console.error('❌ Error initializing message reactions table:', error.message);
    throw error;
  }
};

// Add reaction
const add = async (messageId, userId, reactionType) => {
  try {
    const query = `
      INSERT INTO message_reactions (message_id, user_id, reaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (message_id, user_id, reaction_type) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [messageId, userId, reactionType]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error adding message reaction:', error.message);
    throw error;
  }
};

// Remove reaction
const remove = async (messageId, userId, reactionType) => {
  try {
    const query = `
      DELETE FROM message_reactions
      WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3
      RETURNING *
    `;
    const result = await pool.query(query, [messageId, userId, reactionType]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error removing message reaction:', error.message);
    throw error;
  }
};

// Get reactions for a message
const findByMessageId = async (messageId) => {
  try {
    const query = `
      SELECT mr.*, u.first_name, u.last_name, u.profile_image_url
      FROM message_reactions mr
      JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id = $1
      ORDER BY mr.created_at ASC
    `;
    const result = await pool.query(query, [messageId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding message reactions:', error.message);
    throw error;
  }
};

// Get reaction counts grouped by type
const getReactionCounts = async (messageId) => {
  try {
    const query = `
      SELECT reaction_type, COUNT(*) as count,
             ARRAY_AGG(
               json_build_object(
                 'user_id', user_id,
                 'first_name', (SELECT first_name FROM users WHERE id = message_reactions.user_id),
                 'last_name', (SELECT last_name FROM users WHERE id = message_reactions.user_id),
                 'profile_image_url', (SELECT profile_image_url FROM users WHERE id = message_reactions.user_id)
               )
             ) as users
      FROM message_reactions
      WHERE message_id = $1
      GROUP BY reaction_type
      ORDER BY count DESC
    `;
    const result = await pool.query(query, [messageId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting reaction counts:', error.message);
    throw error;
  }
};

// Check if user has reacted with specific type
const hasUserReacted = async (messageId, userId, reactionType) => {
  try {
    const query = `
      SELECT 1
      FROM message_reactions
      WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3
      LIMIT 1
    `;
    const result = await pool.query(query, [messageId, userId, reactionType]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking user reaction:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMessageReactionsTable,
  add,
  remove,
  findByMessageId,
  getReactionCounts,
  hasUserReacted,
};
