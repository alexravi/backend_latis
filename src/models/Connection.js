// Connection model - Network relationships (connected, pending, blocked)
const { pool } = require('../config/database');
const crypto = require('crypto');

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
    // Canonicalize the pair to ensure consistent ordering
    const lowId = Math.min(requesterId, addresseeId);
    const highId = Math.max(requesterId, addresseeId);
    const isRequesterLow = requesterId === lowId;
    
    // Use advisory lock to prevent race conditions
    // Generate a hash from the two IDs for the advisory lock
    const lockHash = crypto.createHash('sha256')
      .update(`${lowId}_${highId}`)
      .digest()
      .readUInt32BE(0);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [lockHash]);
      
      // Check for existing connection in canonicalized order
      const existingQuery = `
        SELECT * FROM connections
        WHERE (requester_id = $1 AND addressee_id = $2)
           OR (requester_id = $2 AND addressee_id = $1)
      `;
      const existingResult = await client.query(existingQuery, [lowId, highId]);
      
      if (existingResult.rows.length > 0) {
        await client.query('COMMIT');
        return existingResult.rows[0];
      }
      
      // Insert with original requester/addressee order to preserve semantic meaning
      const insertQuery = `
        INSERT INTO connections (requester_id, addressee_id, status)
        VALUES ($1, $2, 'pending')
        ON CONFLICT (requester_id, addressee_id) DO NOTHING
        RETURNING *
      `;
      const insertResult = await client.query(insertQuery, [requesterId, addresseeId]);
      
      if (insertResult.rows.length > 0) {
        await client.query('COMMIT');
        return insertResult.rows[0];
      }
      
      // If INSERT didn't return a row (conflict), fetch existing
      const fetchResult = await client.query(existingQuery, [lowId, highId]);
      await client.query('COMMIT');
      return fetchResult.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
               WHEN c.requester_id = $1 THEN u2.username
               ELSE u1.username
             END as connection_username,
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

// Find pending incoming requests for a user
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

// Find pending outgoing requests from a user
const findOutgoingRequests = async (userId) => {
  try {
    const query = `
      SELECT c.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM connections c
      JOIN users u ON c.addressee_id = u.id
      WHERE c.requester_id = $1 AND c.status = 'pending'
      ORDER BY c.requested_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding outgoing requests:', error.message);
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

// Find mutual connections between two users
const findMutualConnections = async (userId1, userId2) => {
  try {
    const query = `
      SELECT DISTINCT u.id, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM users u
      WHERE u.id IN (
        SELECT CASE 
          WHEN c1.requester_id = $1 THEN c1.addressee_id
          ELSE c1.requester_id
        END
        FROM connections c1
        WHERE ((c1.requester_id = $1 OR c1.addressee_id = $1) AND c1.status = 'connected')
      )
      AND u.id IN (
        SELECT CASE 
          WHEN c2.requester_id = $2 THEN c2.addressee_id
          ELSE c2.requester_id
        END
        FROM connections c2
        WHERE ((c2.requester_id = $2 OR c2.addressee_id = $2) AND c2.status = 'connected')
      )
      AND u.id != $1
      AND u.id != $2
    `;
    const result = await pool.query(query, [userId1, userId2]);
    return result.rows;
  } catch (error) {
    console.error('Error finding mutual connections:', error.message);
    throw error;
  }
};

// Find second-degree connections (connections of connections)
const findSecondDegreeConnections = async (userId, limit = 50) => {
  try {
    const query = `
      SELECT DISTINCT u.id, u.first_name, u.last_name, u.profile_image_url, u.headline,
             COUNT(*) as mutual_count
      FROM users u
      JOIN connections c2 ON (
        (c2.requester_id = u.id OR c2.addressee_id = u.id) 
        AND c2.status = 'connected'
      )
      JOIN connections c1 ON (
        ((c1.requester_id = $1 OR c1.addressee_id = $1) AND c1.status = 'connected')
        AND (
          (c1.requester_id = $1 AND c1.addressee_id = c2.requester_id)
          OR (c1.requester_id = $1 AND c1.addressee_id = c2.addressee_id)
          OR (c1.addressee_id = $1 AND c1.requester_id = c2.requester_id)
          OR (c1.addressee_id = $1 AND c1.requester_id = c2.addressee_id)
        )
      )
      WHERE u.id != $1
        AND u.id NOT IN (
          SELECT CASE 
            WHEN c.requester_id = $1 THEN c.addressee_id
            ELSE c.requester_id
          END
          FROM connections c
          WHERE (c.requester_id = $1 OR c.addressee_id = $1) AND c.status = 'connected'
        )
      GROUP BY u.id, u.first_name, u.last_name, u.profile_image_url, u.headline
      ORDER BY mutual_count DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error finding second-degree connections:', error.message);
    throw error;
  }
};

// Get network statistics for a user
const getNetworkStats = async (userId) => {
  try {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM connections 
         WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'connected') as connection_count,
        (SELECT COUNT(*) FROM connections 
         WHERE requester_id = $1 AND status = 'pending') as outgoing_requests,
        (SELECT COUNT(*) FROM connections 
         WHERE addressee_id = $1 AND status = 'pending') as incoming_requests
    `;
    const result = await pool.query(query, [userId]);
    return {
      connection_count: parseInt(result.rows[0].connection_count),
      outgoing_requests: parseInt(result.rows[0].outgoing_requests),
      incoming_requests: parseInt(result.rows[0].incoming_requests),
    };
  } catch (error) {
    console.error('Error getting network stats:', error.message);
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
  findOutgoingRequests,
  getConnectionCount,
  findMutualConnections,
  findSecondDegreeConnections,
  getNetworkStats,
};
