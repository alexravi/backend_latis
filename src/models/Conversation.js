// Conversation model - Message threads
const { pool } = require('../config/database');

// Initialize conversations table
const initializeConversationsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        participant1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        participant2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_message_at TIMESTAMP,
        last_message_id INTEGER,
        participant1_unread_count INTEGER DEFAULT 0,
        participant2_unread_count INTEGER DEFAULT 0,
        participant1_deleted BOOLEAN DEFAULT FALSE,
        participant2_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (participant1_id != participant2_id),
        UNIQUE(participant1_id, participant2_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Conversations table initialized');
  } catch (error) {
    console.error('❌ Error initializing conversations table:', error.message);
    throw error;
  }
};

// Create or get conversation
const findOrCreate = async (userId1, userId2) => {
  try {
    // Ensure consistent ordering (smaller ID first)
    const [participant1, participant2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
    
    // Use atomic upsert
    const query = `
      INSERT INTO conversations (participant1_id, participant2_id)
      VALUES ($1, $2)
      ON CONFLICT (participant1_id, participant2_id) DO UPDATE SET
        participant1_id = EXCLUDED.participant1_id
      RETURNING *
    `;
    const result = await pool.query(query, [participant1, participant2]);
    return result.rows[0];
  } catch (error) {
    console.error('Error finding or creating conversation:', error.message);
    throw error;
  }
};

// Find conversation by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM conversations WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding conversation by ID:', error.message);
    throw error;
  }
};

// Find conversations for a user
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT c.*,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.id
               ELSE u1.id
             END as other_user_id,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.first_name
               ELSE u1.first_name
             END as other_user_first_name,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.last_name
               ELSE u1.last_name
             END as other_user_last_name,
             CASE 
               WHEN c.participant1_id = $1 THEN u2.profile_image_url
               ELSE u1.profile_image_url
             END as other_user_profile_image,
             CASE 
               WHEN c.participant1_id = $1 THEN c.participant1_unread_count
               ELSE c.participant2_unread_count
             END as unread_count
      FROM conversations c
      JOIN users u1 ON c.participant1_id = u1.id
      JOIN users u2 ON c.participant2_id = u2.id
      WHERE (c.participant1_id = $1 AND c.participant1_deleted = FALSE)
         OR (c.participant2_id = $1 AND c.participant2_deleted = FALSE)
      ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding conversations by user ID:', error.message);
    throw error;
  }
};

// Update last message
const updateLastMessage = async (conversationId, messageId) => {
  try {
    const query = `
      UPDATE conversations
      SET last_message_at = NOW(), last_message_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [messageId, conversationId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating last message:', error.message);
    throw error;
  }
};

// Increment unread count
const incrementUnreadCount = async (conversationId, userId) => {
  try {
    const query = `
      UPDATE conversations
      SET 
        participant1_unread_count = CASE 
          WHEN participant1_id = $2 THEN participant1_unread_count + 1
          ELSE participant1_unread_count
        END,
        participant2_unread_count = CASE 
          WHEN participant2_id = $2 THEN participant2_unread_count + 1
          ELSE participant2_unread_count
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [conversationId, userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing unread count:', error.message);
    throw error;
  }
};

// Mark as read
const markAsRead = async (conversationId, userId) => {
  try {
    const query = `
      UPDATE conversations
      SET 
        participant1_unread_count = CASE 
          WHEN participant1_id = $2 THEN 0
          ELSE participant1_unread_count
        END,
        participant2_unread_count = CASE 
          WHEN participant2_id = $2 THEN 0
          ELSE participant2_unread_count
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [conversationId, userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error marking conversation as read:', error.message);
    throw error;
  }
};

// Delete conversation for user
const deleteForUser = async (conversationId, userId) => {
  try {
    const query = `
      UPDATE conversations
      SET 
        participant1_deleted = CASE 
          WHEN participant1_id = $2 THEN TRUE
          ELSE participant1_deleted
        END,
        participant2_deleted = CASE 
          WHEN participant2_id = $2 THEN TRUE
          ELSE participant2_deleted
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [conversationId, userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting conversation for user:', error.message);
    throw error;
  }
};

module.exports = {
  initializeConversationsTable,
  findOrCreate,
  findById,
  findByUserId,
  updateLastMessage,
  incrementUnreadCount,
  markAsRead,
  deleteForUser,
};
