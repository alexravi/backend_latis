// Connection model - Network relationships (connected, pending, blocked)
const { pool } = require('../config/database');

// Initialize connections table
const initializeConnectionsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS connections (
        id SERIAL PRIMARY KEY,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT NOW(),
        accepted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (requester_id != addressee_id),
        UNIQUE(requester_id, addressee_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Connections table initialized');
  } catch (error) {
    console.error('❌ Error initializing connections table:', error.message);
    throw error;
  }
};

// Create connection request
const createRequest = async (requesterId, addresseeId) => {
  try {
    // First check for existing bidirectional connection
    const existingQuery = `
      SELECT * FROM connections
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)
    `;
    const existingResult = await pool.query(existingQuery, [requesterId, addresseeId]);
    
    if (existingResult.rows.length > 0) {
      // Return existing connection
      return existingResult.rows[0];
    }
    
    // Insert new connection request
    const query = `
      INSERT INTO connections (requester_id, addressee_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (requester_id, addressee_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [requesterId, addresseeId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error creating connection request:', error.message);
    throw error;
  }
};

// Accept connection request
const acceptRequest = async (requesterId, addresseeId) => {
  try {
    const query = `
      UPDATE connections
      SET status = 'connected', accepted_at = NOW(), updated_at = NOW()
      WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
      RETURNING *
    `;
    const result = await pool.query(query, [requesterId, addresseeId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error accepting connection request:', error.message);
    throw error;
  }
};

// Reject/Remove connection
const removeConnection = async (userId1, userId2) => {
  try {
    const query = `
      DELETE FROM connections
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)
      RETURNING *
    `;
    const result = await pool.query(query, [userId1, userId2]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error removing connection:', error.message);
    throw error;
  }
};

// Find connection between two users
const findConnection = async (userId1, userId2) => {
  try {
    const query = `
      SELECT * FROM connections
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)
    `;
    const result = await pool.query(query, [userId1, userId2]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding connection:', error.message);
    throw error;
  }
};

// Find all connections for a user
const findByUserId = async (userId, status = null) => {
  try {
    let query = `
      SELECT c.*,
             CASE 
               WHEN c.requester_id = $1 THEN u2.id
               ELSE u1.id
             END as connection_id,
             CASE 
               WHEN c.requester_id = $1 THEN u2.first_name
               ELSE u1.first_name
             END as connection_first_name,
             CASE 
               WHEN c.requester_id = $1 THEN u2.last_name
               ELSE u1.last_name
             END as connection_last_name,
             CASE 
               WHEN c.requester_id = $1 THEN u2.profile_image_url
               ELSE u1.profile_image_url
             END as connection_profile_image
      FROM connections c
      JOIN users u1 ON c.requester_id = u1.id
      JOIN users u2 ON c.addressee_id = u2.id
      WHERE (c.requester_id = $1 OR c.addressee_id = $1)
    `;
    const params = [userId];
    
    if (status) {
      query += ' AND c.status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY c.accepted_at DESC NULLS LAST, c.created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error finding connections by user ID:', error.message);
    throw error;
  }
};

// Find pending requests for a user
const findPendingRequests = async (userId) => {
  try {
    const query = `
      SELECT c.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM connections c
      JOIN users u ON c.requester_id = u.id
      WHERE c.addressee_id = $1 AND c.status = 'pending'
      ORDER BY c.requested_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding pending requests:', error.message);
    throw error;
  }
};

// Get connection count
const getConnectionCount = async (userId) => {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM connections
      WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'connected'
    `;
    const result = await pool.query(query, [userId]);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Error getting connection count:', error.message);
    throw error;
  }
};

module.exports = {
  initializeConnectionsTable,
  createRequest,
  acceptRequest,
  removeConnection,
  findConnection,
  findByUserId,
  findPendingRequests,
  getConnectionCount,
};
