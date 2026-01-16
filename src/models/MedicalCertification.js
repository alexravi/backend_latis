// Medical Certification model - Certifications and licenses
const { pool } = require('../config/database');

// Initialize medical_certifications table
const initializeMedicalCertificationsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS medical_certifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        certification_type VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        issuing_organization VARCHAR(255) NOT NULL,
        certification_board VARCHAR(255),
        license_number VARCHAR(100),
        credential_id VARCHAR(100),
        issue_date DATE,
        expiration_date DATE,
        status VARCHAR(50) DEFAULT 'Active',
        verification_url VARCHAR(500),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Medical certifications table initialized');
  } catch (error) {
    console.error('❌ Error initializing medical certifications table:', error.message);
    throw error;
  }
};

// Create medical certification
const create = async (certificationData) => {
  try {
    const query = `
      INSERT INTO medical_certifications (
        user_id, certification_type, name, issuing_organization, certification_board,
        license_number, credential_id, issue_date, expiration_date, status,
        verification_url, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const result = await pool.query(query, [
      certificationData.user_id,
      certificationData.certification_type,
      certificationData.name,
      certificationData.issuing_organization,
      certificationData.certification_board || null,
      certificationData.license_number || null,
      certificationData.credential_id || null,
      certificationData.issue_date || null,
      certificationData.expiration_date || null,
      certificationData.status || 'Active',
      certificationData.verification_url || null,
      certificationData.description || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating medical certification:', error.message);
    throw error;
  }
};

// Find certifications by user ID
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT * FROM medical_certifications
      WHERE user_id = $1
      ORDER BY expiration_date ASC NULLS LAST, issue_date DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding medical certifications by user ID:', error.message);
    throw error;
  }
};

// Find certification by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM medical_certifications WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding medical certification by ID:', error.message);
    throw error;
  }
};

// Find expiring certifications
const findExpiring = async (daysAhead = 90, userId = null) => {
  try {
    // Validate and coerce daysAhead to integer
    const daysAheadInt = parseInt(daysAhead, 10);
    if (isNaN(daysAheadInt) || daysAheadInt < 1) {
      throw new Error('daysAhead must be a positive integer');
    }

    let query = `
      SELECT * FROM medical_certifications
      WHERE expiration_date IS NOT NULL
        AND expiration_date <= CURRENT_DATE + make_interval(days => $1)
        AND expiration_date >= CURRENT_DATE
        AND status = 'Active'
    `;
    const params = [daysAheadInt];

    if (userId) {
      query += ` AND user_id = $2`;
      params.push(userId);
    }

    query += ` ORDER BY expiration_date ASC`;
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error finding expiring certifications:', error.message);
    throw error;
  }
};

// Update medical certification
const update = async (id, certificationData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'certification_type', 'name', 'issuing_organization', 'certification_board',
      'license_number', 'credential_id', 'issue_date', 'expiration_date', 'status',
      'verification_url', 'description'
    ];

    for (const [key, value] of Object.entries(certificationData)) {
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
      UPDATE medical_certifications
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating medical certification:', error.message);
    throw error;
  }
};

// Delete medical certification
const remove = async (id) => {
  try {
    const query = 'DELETE FROM medical_certifications WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting medical certification:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMedicalCertificationsTable,
  create,
  findByUserId,
  findById,
  findExpiring,
  update,
  remove,
};
