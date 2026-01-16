// Medical Group model - Professional societies, specialty groups, study groups
const { pool } = require('../config/database');

// Initialize medical_groups table
const initializeMedicalGroupsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS medical_groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        group_type VARCHAR(100) NOT NULL,
        specialty VARCHAR(255),
        cover_image_url VARCHAR(500),
        logo_url VARCHAR(500),
        website VARCHAR(500),
        location VARCHAR(255),
        is_private BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        member_count INTEGER DEFAULT 0,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Medical groups table initialized');
  } catch (error) {
    console.error('❌ Error initializing medical groups table:', error.message);
    throw error;
  }
};

// Create medical group
const create = async (groupData) => {
  try {
    const query = `
      INSERT INTO medical_groups (
        name, description, group_type, specialty, cover_image_url, logo_url,
        website, location, is_private, is_verified, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await pool.query(query, [
      groupData.name,
      groupData.description || null,
      groupData.group_type,
      groupData.specialty || null,
      groupData.cover_image_url || null,
      groupData.logo_url || null,
      groupData.website || null,
      groupData.location || null,
      groupData.is_private || false,
      groupData.is_verified || false,
      groupData.created_by || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating medical group:', error.message);
    throw error;
  }
};

// Find group by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM medical_groups WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding medical group by ID:', error.message);
    throw error;
  }
};

// Search groups
const search = async (searchTerm, groupType = null, specialty = null) => {
  try {
    let query = `
      SELECT * FROM medical_groups
      WHERE (name ILIKE $1 OR description ILIKE $1)
    `;
    const params = [`%${searchTerm}%`];
    let paramCount = 2;

    if (groupType) {
      query += ` AND group_type = $${paramCount}`;
      params.push(groupType);
      paramCount++;
    }

    if (specialty) {
      query += ` AND specialty = $${paramCount}`;
      params.push(specialty);
    }

    query += ' ORDER BY member_count DESC, name ASC LIMIT 50';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error searching medical groups:', error.message);
    throw error;
  }
};

// Update member count
const updateMemberCount = async (groupId, increment = 1) => {
  try {
    const query = `
      UPDATE medical_groups
      SET member_count = member_count + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [increment, groupId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating member count:', error.message);
    throw error;
  }
};

// Update medical group
const update = async (id, groupData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'name', 'description', 'group_type', 'specialty', 'cover_image_url',
      'logo_url', 'website', 'location', 'is_private', 'is_verified'
    ];

    for (const [key, value] of Object.entries(groupData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return await findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE medical_groups
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating medical group:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMedicalGroupsTable,
  create,
  findById,
  search,
  updateMemberCount,
  update,
};
