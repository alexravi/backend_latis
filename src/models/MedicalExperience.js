// Medical Experience model - Professional experience (residencies, fellowships, clinical positions)
const { pool } = require('../config/database');

// Initialize medical_experiences table
const initializeMedicalExperiencesTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS medical_experiences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES medical_organizations(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        position_type VARCHAR(100) NOT NULL,
        department VARCHAR(255),
        specialty VARCHAR(255),
        subspecialty VARCHAR(255),
        institution_name VARCHAR(255) NOT NULL,
        institution_type VARCHAR(100),
        location VARCHAR(255),
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE,
        is_current BOOLEAN DEFAULT FALSE,
        patient_care_responsibilities TEXT,
        research_focus_areas TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Medical experiences table initialized');
  } catch (error) {
    console.error('❌ Error initializing medical experiences table:', error.message);
    throw error;
  }
};

// Create medical experience
const create = async (experienceData) => {
  try {
    const query = `
      INSERT INTO medical_experiences (
        user_id, organization_id, title, position_type, department, specialty,
        subspecialty, institution_name, institution_type, location, description,
        start_date, end_date, is_current, patient_care_responsibilities, research_focus_areas
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    const result = await pool.query(query, [
      experienceData.user_id,
      experienceData.organization_id || null,
      experienceData.title,
      experienceData.position_type,
      experienceData.department || null,
      experienceData.specialty || null,
      experienceData.subspecialty || null,
      experienceData.institution_name,
      experienceData.institution_type || null,
      experienceData.location || null,
      experienceData.description || null,
      experienceData.start_date,
      experienceData.end_date || null,
      experienceData.is_current || false,
      experienceData.patient_care_responsibilities || null,
      experienceData.research_focus_areas || []
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating medical experience:', error.message);
    throw error;
  }
};

// Find experiences by user ID
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT * FROM medical_experiences
      WHERE user_id = $1
      ORDER BY start_date DESC, created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding medical experiences by user ID:', error.message);
    throw error;
  }
};

// Find experience by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM medical_experiences WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding medical experience by ID:', error.message);
    throw error;
  }
};

// Update medical experience
const update = async (id, experienceData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'organization_id', 'title', 'position_type', 'department', 'specialty',
      'subspecialty', 'institution_name', 'institution_type', 'location',
      'description', 'start_date', 'end_date', 'is_current',
      'patient_care_responsibilities', 'research_focus_areas'
    ];

    for (const [key, value] of Object.entries(experienceData)) {
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
      UPDATE medical_experiences
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating medical experience:', error.message);
    throw error;
  }
};

// Delete medical experience
const remove = async (id) => {
  try {
    const query = 'DELETE FROM medical_experiences WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting medical experience:', error.message);
    throw error;
  }
};

// Bulk create medical experiences
const bulkCreate = async (client, userId, experiences) => {
  if (!experiences || experiences.length === 0) {
    return [];
  }

  try {
    const values = [];
    const placeholders = [];
    let paramCount = 1;

    experiences.forEach((exp, index) => {
      placeholders.push(
        `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, $${paramCount + 7}, $${paramCount + 8}, $${paramCount + 9}, $${paramCount + 10}, $${paramCount + 11}, $${paramCount + 12}, $${paramCount + 13}, $${paramCount + 14}, $${paramCount + 15})`
      );
      values.push(
        userId,
        exp.organization_id || null,
        exp.title,
        exp.position_type,
        exp.department || null,
        exp.specialty || null,
        exp.subspecialty || null,
        exp.institution_name,
        exp.institution_type || null,
        exp.location || null,
        exp.description || null,
        exp.start_date,
        exp.end_date || null,
        exp.is_current || false,
        exp.patient_care_responsibilities || null,
        exp.research_focus_areas || []
      );
      paramCount += 16;
    });

    const query = `
      INSERT INTO medical_experiences (
        user_id, organization_id, title, position_type, department, specialty,
        subspecialty, institution_name, institution_type, location, description,
        start_date, end_date, is_current, patient_care_responsibilities, research_focus_areas
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await client.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error bulk creating medical experiences:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMedicalExperiencesTable,
  create,
  findByUserId,
  findById,
  update,
  remove,
  bulkCreate,
};
