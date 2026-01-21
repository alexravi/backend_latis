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
        attachment_url VARCHAR(500),
        attachment_type VARCHAR(50),
        attachment_name VARCHAR(255),
        edited_at TIMESTAMP,
        deleted_at TIMESTAMP,
        forwarded_from_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        delivered_at TIMESTAMP,
        delivery_status VARCHAR(20) DEFAULT 'sent',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    
    // Add new columns if they don't exist (for existing tables)
    const columnsToAdd = [
      { name: 'attachment_url', type: 'VARCHAR(500)' },
      { name: 'attachment_type', type: 'VARCHAR(50)' },
      { name: 'attachment_name', type: 'VARCHAR(255)' },
      { name: 'edited_at', type: 'TIMESTAMP' },
      { name: 'deleted_at', type: 'TIMESTAMP' },
      { name: 'forwarded_from_message_id', type: 'INTEGER REFERENCES messages(id) ON DELETE SET NULL' },
      { name: 'delivered_at', type: 'TIMESTAMP' },
      { name: 'delivery_status', type: "VARCHAR(20) DEFAULT 'sent'" },
    ];
    
    for (const col of columnsToAdd) {
      try {
        await pool.query(`
          ALTER TABLE messages 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `);
      } catch (err) {
        // Column might already exist, ignore
        if (!err.message.includes('already exists')) {
          console.warn(`Warning: Could not add column ${col.name}: ${err.message}`);
        }
      }
    }
    
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
      INSERT INTO messages (
        conversation_id, sender_id, content, 
        attachment_url, attachment_type, attachment_name,
        forwarded_from_message_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [
      messageData.conversation_id,
      messageData.sender_id,
      messageData.content,
      messageData.attachment_url || null,
      messageData.attachment_type || null,
      messageData.attachment_name || null,
      messageData.forwarded_from_message_id || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating message:', error.message);
    throw error;
  }
};

// Find messages by conversation ID
const findByConversationId = async (conversationId, limit = 50, offset = 0, userId = null) => {
  try {
    // Exclude deleted messages (only show if not deleted, or if user is the sender)
    let query;
    let params;
    
    if (userId) {
      query = `
        SELECT m.*, u.first_name, u.last_name, u.profile_image_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1
          AND (m.deleted_at IS NULL OR (m.deleted_at IS NOT NULL AND m.sender_id = $4))
        ORDER BY m.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [conversationId, limit, offset, userId];
    } else {
      // If no userId provided, just exclude all deleted messages
      query = `
        SELECT m.*, u.first_name, u.last_name, u.profile_image_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1
          AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [conversationId, limit, offset];
    }
    
    const result = await pool.query(query, params);
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

// Mark message as delivered
const markAsDelivered = async (id) => {
  try {
    const query = `
      UPDATE messages
      SET delivered_at = NOW(), delivery_status = 'delivered'
      WHERE id = $1 AND delivered_at IS NULL
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error marking message as delivered:', error.message);
    throw error;
  }
};

// Mark message as read
const markAsRead = async (id) => {
  try {
    const query = `
      UPDATE messages
      SET is_read = TRUE, read_at = NOW(), delivery_status = 'read'
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

// Update message
const update = async (id, updates) => {
  try {
    const allowedFields = ['content', 'attachment_url', 'attachment_type', 'attachment_name'];
    const setParts = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setParts.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }

    if (setParts.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add edited_at timestamp when content is updated
    if (updates.content !== undefined) {
      setParts.push(`edited_at = NOW()`);
    }

    values.push(id);
    const query = `
      UPDATE messages
      SET ${setParts.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating message:', error.message);
    throw error;
  }
};

// Soft delete message
const softDelete = async (id, userId) => {
  try {
    // Only allow soft delete if user is the sender
    const query = `
      UPDATE messages
      SET deleted_at = NOW()
      WHERE id = $1 AND sender_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error soft deleting message:', error.message);
    throw error;
  }
};

// Delete message (hard delete)
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

// Search messages
const search = async (userId, searchQuery, conversationId = null, limit = 50, offset = 0) => {
  try {
    let query = `
      SELECT m.*, u.first_name, u.last_name, u.profile_image_url, c.id as conversation_id
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
        AND m.deleted_at IS NULL
        AND m.content ILIKE $2
    `;
    const params = [userId, `%${searchQuery}%`];
    let paramCount = 3;

    if (conversationId) {
      query += ` AND m.conversation_id = $${paramCount}`;
      params.push(conversationId);
      paramCount++;
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error searching messages:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMessagesTable,
  create,
  findByConversationId,
  findById,
  markAsDelivered,
  markAsRead,
  markConversationAsRead,
  update,
  softDelete,
  remove,
  search,
};
