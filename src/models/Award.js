// Award model - Medical awards, recognitions, grants, scholarships
const { pool } = require('../config/database');

// Initialize awards table
const initializeAwardsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS awards (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES medical_organizations(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        award_type VARCHAR(100) NOT NULL,
        issuing_organization VARCHAR(255),
        description TEXT,
        date_received DATE,
        year INTEGER,
        monetary_value DECIMAL(12,2),
        currency VARCHAR(10),
        url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Awards table initialized');
  } catch (error) {
    console.error('❌ Error initializing awards table:', error.message);
    throw error;
  }
};

// Create award
const create = async (awardData) => {
  try {
    const query = `
      INSERT INTO awards (
        user_id, organization_id, title, award_type, issuing_organization,
        description, date_received, year, monetary_value, currency, url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await pool.query(query, [
      awardData.user_id,
      awardData.organization_id || null,
      awardData.title,
      awardData.award_type,
      awardData.issuing_organization || null,
      awardData.description || null,
      awardData.date_received || null,
      awardData.year || null,
      awardData.monetary_value || null,
      awardData.currency || null,
      awardData.url || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating award:', error.message);
    throw error;
  }
};

// Find awards by user ID
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT * FROM awards
      WHERE user_id = $1
      ORDER BY date_received DESC NULLS LAST, year DESC NULLS LAST, created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding awards by user ID:', error.message);
    throw error;
  }
};

// Find award by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM awards WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding award by ID:', error.message);
    throw error;
  }
};

// Update award
const update = async (id, awardData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'organization_id', 'title', 'award_type', 'issuing_organization',
      'description', 'date_received', 'year', 'monetary_value', 'currency', 'url'
    ];

    for (const [key, value] of Object.entries(awardData)) {
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
      UPDATE awards
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating award:', error.message);
    throw error;
  }
};

// Delete award
const remove = async (id) => {
  try {
    const query = 'DELETE FROM awards WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting award:', error.message);
    throw error;
  }
};

module.exports = {
  initializeAwardsTable,
  create,
  findByUserId,
  findById,
  update,
  remove,
};
