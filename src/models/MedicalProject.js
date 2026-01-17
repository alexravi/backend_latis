// Medical Project model - Research projects, clinical trials, quality improvement initiatives
const { pool } = require('../config/database');

// Initialize medical_projects table
const initializeMedicalProjectsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS medical_projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id INTEGER REFERENCES medical_organizations(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        project_type VARCHAR(100) NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        is_current BOOLEAN DEFAULT FALSE,
        role VARCHAR(255),
        responsibilities TEXT,
        outcomes TEXT,
        technologies_used TEXT[],
        collaborators TEXT[],
        funding_source VARCHAR(255),
        grant_number VARCHAR(100),
        url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Medical projects table initialized');
  } catch (error) {
    console.error('❌ Error initializing medical projects table:', error.message);
    throw error;
  }
};

// Create medical project
const create = async (projectData) => {
  try {
    const query = `
      INSERT INTO medical_projects (
        user_id, organization_id, title, project_type, description, start_date,
        end_date, is_current, role, responsibilities, outcomes, technologies_used,
        collaborators, funding_source, grant_number, url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    const result = await pool.query(query, [
      projectData.user_id,
      projectData.organization_id || null,
      projectData.title,
      projectData.project_type,
      projectData.description || null,
      projectData.start_date || null,
      projectData.end_date || null,
      projectData.is_current || false,
      projectData.role || null,
      projectData.responsibilities || null,
      projectData.outcomes || null,
      projectData.technologies_used || [],
      projectData.collaborators || [],
      projectData.funding_source || null,
      projectData.grant_number || null,
      projectData.url || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating medical project:', error.message);
    throw error;
  }
};

// Find projects by user ID
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT * FROM medical_projects
      WHERE user_id = $1
      ORDER BY start_date DESC NULLS LAST, created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding medical projects by user ID:', error.message);
    throw error;
  }
};

// Find project by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM medical_projects WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding medical project by ID:', error.message);
    throw error;
  }
};

// Update medical project
const update = async (id, projectData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'organization_id', 'title', 'project_type', 'description', 'start_date',
      'end_date', 'is_current', 'role', 'responsibilities', 'outcomes',
      'technologies_used', 'collaborators', 'funding_source', 'grant_number', 'url'
    ];

    for (const [key, value] of Object.entries(projectData)) {
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
      UPDATE medical_projects
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating medical project:', error.message);
    throw error;
  }
};

// Delete medical project
const remove = async (id) => {
  try {
    const query = 'DELETE FROM medical_projects WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting medical project:', error.message);
    throw error;
  }
};

// Bulk create medical projects
const bulkCreate = async (client, userId, projects) => {
  if (!projects || projects.length === 0) {
    return [];
  }

  try {
    const values = [];
    const placeholders = [];
    let paramCount = 1;

    projects.forEach((proj) => {
      placeholders.push(
        `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, $${paramCount + 7}, $${paramCount + 8}, $${paramCount + 9}, $${paramCount + 10}, $${paramCount + 11}, $${paramCount + 12}, $${paramCount + 13}, $${paramCount + 14}, $${paramCount + 15})`
      );
      values.push(
        userId,
        proj.organization_id || null,
        proj.title,
        proj.project_type,
        proj.description || null,
        proj.start_date || null,
        proj.end_date || null,
        proj.is_current || false,
        proj.role || null,
        proj.responsibilities || null,
        proj.outcomes || null,
        proj.technologies_used || [],
        proj.collaborators || [],
        proj.funding_source || null,
        proj.grant_number || null,
        proj.url || null
      );
      paramCount += 16;
    });

    const query = `
      INSERT INTO medical_projects (
        user_id, organization_id, title, project_type, description, start_date,
        end_date, is_current, role, responsibilities, outcomes, technologies_used,
        collaborators, funding_source, grant_number, url
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await client.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error bulk creating medical projects:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMedicalProjectsTable,
  create,
  findByUserId,
  findById,
  update,
  remove,
  bulkCreate,
};
