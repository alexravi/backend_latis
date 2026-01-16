// Group Membership model - User-group relationships
const { pool } = require('../config/database');

// Initialize group_memberships table
const initializeGroupMembershipsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS group_memberships (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES medical_groups(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        status VARCHAR(50) DEFAULT 'active',
        joined_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, group_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Group memberships table initialized');
  } catch (error) {
    console.error('❌ Error initializing group memberships table:', error.message);
    throw error;
  }
};

// Join group
const joinGroup = async (userId, groupId, role = 'member') => {
  try {
    const query = `
      INSERT INTO group_memberships (user_id, group_id, role, status)
      VALUES ($1, $2, $3, 'active')
      ON CONFLICT (user_id, group_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'active',
        joined_at = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [userId, groupId, role]);
    return result.rows[0];
  } catch (error) {
    console.error('Error joining group:', error.message);
    throw error;
  }
};

// Leave group
const leaveGroup = async (userId, groupId) => {
  try {
    const query = `
      DELETE FROM group_memberships
      WHERE user_id = $1 AND group_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [userId, groupId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error leaving group:', error.message);
    throw error;
  }
};

// Find memberships by user ID
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT gm.*, mg.name, mg.description, mg.group_type, mg.specialty,
             mg.logo_url, mg.member_count
      FROM group_memberships gm
      JOIN medical_groups mg ON gm.group_id = mg.id
      WHERE gm.user_id = $1 AND gm.status = 'active'
      ORDER BY gm.joined_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding group memberships by user ID:', error.message);
    throw error;
  }
};

// Find members by group ID
const findByGroupId = async (groupId, limit = 100, offset = 0) => {
  try {
    const query = `
      SELECT gm.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM group_memberships gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1 AND gm.status = 'active'
      ORDER BY gm.role DESC, gm.joined_at ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [groupId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding group members by group ID:', error.message);
    throw error;
  }
};

// Check if user is member
const isMember = async (userId, groupId) => {
  try {
    const query = `
      SELECT * FROM group_memberships
      WHERE user_id = $1 AND group_id = $2 AND status = 'active'
    `;
    const result = await pool.query(query, [userId, groupId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking membership:', error.message);
    throw error;
  }
};

// Update membership role
const updateRole = async (userId, groupId, role) => {
  try {
    const query = `
      UPDATE group_memberships
      SET role = $3
      WHERE user_id = $1 AND group_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [userId, groupId, role]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating membership role:', error.message);
    throw error;
  }
};

module.exports = {
  initializeGroupMembershipsTable,
  joinGroup,
  leaveGroup,
  findByUserId,
  findByGroupId,
  isMember,
  updateRole,
};
