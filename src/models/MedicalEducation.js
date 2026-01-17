// Medical Education model - Education history (medical school, residency, fellowship programs)
const { pool } = require('../config/database');

// Initialize medical_education table
const initializeMedicalEducationTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS medical_education (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES medical_organizations(id) ON DELETE SET NULL,
        degree_type VARCHAR(50) NOT NULL,
        field_of_study VARCHAR(255),
        institution_name VARCHAR(255) NOT NULL,
        institution_type VARCHAR(100),
        location VARCHAR(255),
        program_name VARCHAR(255),
        specialty VARCHAR(255),
        subspecialty VARCHAR(255),
        start_date DATE,
        end_date DATE,
        graduation_date DATE,
        gpa DECIMAL(3,2),
        honors TEXT[],
        recognition TEXT,
        description TEXT,
        is_current BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Medical education table initialized');
  } catch (error) {
    console.error('❌ Error initializing medical education table:', error.message);
    throw error;
  }
};

// Create medical education entry
const create = async (educationData) => {
  try {
    const query = `
      INSERT INTO medical_education (
        user_id, organization_id, degree_type, field_of_study, institution_name,
        institution_type, location, program_name, specialty, subspecialty,
        start_date, end_date, graduation_date, gpa, honors, recognition,
        description, is_current
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;
    const result = await pool.query(query, [
      educationData.user_id,
      educationData.organization_id || null,
      educationData.degree_type,
      educationData.field_of_study || null,
      educationData.institution_name,
      educationData.institution_type || null,
      educationData.location || null,
      educationData.program_name || null,
      educationData.specialty || null,
      educationData.subspecialty || null,
      educationData.start_date || null,
      educationData.end_date || null,
      educationData.graduation_date || null,
      educationData.gpa || null,
      educationData.honors || [],
      educationData.recognition || null,
      educationData.description || null,
      educationData.is_current || false
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating medical education:', error.message);
    throw error;
  }
};

// Find education by user ID
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT * FROM medical_education
      WHERE user_id = $1
      ORDER BY graduation_date DESC NULLS LAST, end_date DESC NULLS LAST, created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding medical education by user ID:', error.message);
    throw error;
  }
};

// Find education by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM medical_education WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding medical education by ID:', error.message);
    throw error;
  }
};

// Update medical education
const update = async (id, educationData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'organization_id', 'degree_type', 'field_of_study', 'institution_name',
      'institution_type', 'location', 'program_name', 'specialty', 'subspecialty',
      'start_date', 'end_date', 'graduation_date', 'gpa', 'honors', 'recognition',
      'description', 'is_current'
    ];

    for (const [key, value] of Object.entries(educationData)) {
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
      UPDATE medical_education
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating medical education:', error.message);
    throw error;
  }
};

// Delete medical education
const remove = async (id) => {
  try {
    const query = 'DELETE FROM medical_education WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting medical education:', error.message);
    throw error;
  }
};

// Bulk create medical education
const bulkCreate = async (client, userId, education) => {
  if (!education || education.length === 0) {
    return [];
  }

  try {
    const values = [];
    const placeholders = [];
    let paramCount = 1;

    education.forEach((edu) => {
      placeholders.push(
        `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, $${paramCount + 7}, $${paramCount + 8}, $${paramCount + 9}, $${paramCount + 10}, $${paramCount + 11}, $${paramCount + 12}, $${paramCount + 13}, $${paramCount + 14}, $${paramCount + 15}, $${paramCount + 16}, $${paramCount + 17})`
      );
      values.push(
        userId,
        edu.organization_id || null,
        edu.degree_type,
        edu.field_of_study || null,
        edu.institution_name,
        edu.institution_type || null,
        edu.location || null,
        edu.program_name || null,
        edu.specialty || null,
        edu.subspecialty || null,
        edu.start_date || null,
        edu.end_date || null,
        edu.graduation_date || null,
        edu.gpa || null,
        edu.honors || [],
        edu.recognition || null,
        edu.description || null,
        edu.is_current || false
      );
      paramCount += 18;
    });

    const query = `
      INSERT INTO medical_education (
        user_id, organization_id, degree_type, field_of_study, institution_name,
        institution_type, location, program_name, specialty, subspecialty,
        start_date, end_date, graduation_date, gpa, honors, recognition,
        description, is_current
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await client.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error bulk creating medical education:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMedicalEducationTable,
  create,
  findByUserId,
  findById,
  update,
  remove,
  bulkCreate,
};
