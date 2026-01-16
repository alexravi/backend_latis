// Message model - Direct messages
const { pool } = require('../config/database');

// Initialize messages table
const initializeMessagesTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Messages table initialized');
  } catch (error) {
    console.error('❌ Error initializing messages table:', error.message);
    throw error;
  }
};

// Create message
const create = async (messageData) => {
  try {
    const query = `
      INSERT INTO messages (conversation_id, sender_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [
      messageData.conversation_id,
      messageData.sender_id,
      messageData.content
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating message:', error.message);
    throw error;
  }
};

// Find messages by conversation ID
const findByConversationId = async (conversationId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT m.*, u.first_name, u.last_name, u.profile_image_url
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [conversationId, limit, offset]);
    return result.rows.reverse(); // Reverse to get chronological order
  } catch (error) {
    console.error('Error finding messages by conversation ID:', error.message);
    throw error;
  }
};

// Find message by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM messages WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding message by ID:', error.message);
    throw error;
  }
};

// Mark message as read
const markAsRead = async (id) => {
  try {
    const query = `
      UPDATE messages
      SET is_read = TRUE, read_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error marking message as read:', error.message);
    throw error;
  }
};

// Mark all messages in conversation as read
const markConversationAsRead = async (conversationId, userId) => {
  try {
    const query = `
      UPDATE messages
      SET is_read = TRUE, read_at = NOW()
      WHERE conversation_id = $1 
        AND sender_id != $2 
        AND is_read = FALSE
      RETURNING *
    `;
    const result = await pool.query(query, [conversationId, userId]);
    return result.rows;
  } catch (error) {
    console.error('Error marking conversation messages as read:', error.message);
    throw error;
  }
};

// Delete message
const remove = async (id) => {
  try {
    const query = 'DELETE FROM messages WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting message:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMessagesTable,
  create,
  findByConversationId,
  findById,
  markAsRead,
  markConversationAsRead,
  remove,
};
