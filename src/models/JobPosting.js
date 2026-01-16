// Job Posting model - Medical job listings (positions, residencies, fellowships)
const { pool } = require('../config/database');

// Initialize job_postings table
const initializeJobPostingsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS job_postings (
        id SERIAL PRIMARY KEY,
        posted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        organization_id INTEGER REFERENCES medical_organizations(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        job_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT,
        responsibilities TEXT,
        location VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        is_remote BOOLEAN DEFAULT FALSE,
        salary_min DECIMAL(12,2),
        salary_max DECIMAL(12,2),
        salary_currency VARCHAR(10),
        employment_type VARCHAR(50),
        specialty VARCHAR(255),
        department VARCHAR(255),
        experience_level VARCHAR(100),
        application_deadline DATE,
        start_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        views_count INTEGER DEFAULT 0,
        applications_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Job postings table initialized');
  } catch (error) {
    console.error('❌ Error initializing job postings table:', error.message);
    throw error;
  }
};

// Create job posting
const create = async (jobData) => {
  try {
    const query = `
      INSERT INTO job_postings (
        posted_by, organization_id, title, job_type, description, requirements,
        responsibilities, location, city, state, country, is_remote,
        salary_min, salary_max, salary_currency, employment_type, specialty,
        department, experience_level, application_deadline, start_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `;
    const result = await pool.query(query, [
      jobData.posted_by || null,
      jobData.organization_id || null,
      jobData.title,
      jobData.job_type,
      jobData.description,
      jobData.requirements || null,
      jobData.responsibilities || null,
      jobData.location || null,
      jobData.city || null,
      jobData.state || null,
      jobData.country || null,
      jobData.is_remote || false,
      jobData.salary_min || null,
      jobData.salary_max || null,
      jobData.salary_currency || null,
      jobData.employment_type || null,
      jobData.specialty || null,
      jobData.department || null,
      jobData.experience_level || null,
      jobData.application_deadline || null,
      jobData.start_date || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating job posting:', error.message);
    throw error;
  }
};

// Find job posting by ID
const findById = async (id) => {
  try {
    const query = `
      SELECT jp.*, u.first_name as posted_by_first_name, u.last_name as posted_by_last_name,
             mo.name as organization_name, mo.logo_url as organization_logo
      FROM job_postings jp
      LEFT JOIN users u ON jp.posted_by = u.id
      LEFT JOIN medical_organizations mo ON jp.organization_id = mo.id
      WHERE jp.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding job posting by ID:', error.message);
    throw error;
  }
};

// Search job postings
const search = async (filters = {}, limit = 20, offset = 0) => {
  try {
    let query = `
      SELECT jp.*, mo.name as organization_name, mo.logo_url as organization_logo
      FROM job_postings jp
      LEFT JOIN medical_organizations mo ON jp.organization_id = mo.id
      WHERE jp.is_active = TRUE
    `;
    const params = [];
    let paramCount = 1;

    if (filters.specialty) {
      query += ` AND jp.specialty = $${paramCount}`;
      params.push(filters.specialty);
      paramCount++;
    }

    if (filters.job_type) {
      query += ` AND jp.job_type = $${paramCount}`;
      params.push(filters.job_type);
      paramCount++;
    }

    if (filters.location) {
      query += ` AND (jp.location ILIKE $${paramCount} OR jp.city ILIKE $${paramCount} OR jp.state ILIKE $${paramCount})`;
      params.push(`%${filters.location}%`);
      paramCount++;
    }

    if (filters.is_remote !== undefined) {
      query += ` AND jp.is_remote = $${paramCount}`;
      params.push(filters.is_remote);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (jp.title ILIKE $${paramCount} OR jp.description ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ` ORDER BY jp.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error searching job postings:', error.message);
    throw error;
  }
};

// Find job postings by organization
const findByOrganizationId = async (organizationId, limit = 20, offset = 0) => {
  try {
    const query = `
      SELECT * FROM job_postings
      WHERE organization_id = $1 AND is_active = TRUE
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [organizationId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding job postings by organization ID:', error.message);
    throw error;
  }
};

// Increment views
const incrementViews = async (id) => {
  try {
    const query = `
      UPDATE job_postings
      SET views_count = views_count + 1, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing views:', error.message);
    throw error;
  }
};

// Increment applications count
const incrementApplications = async (id, increment = 1) => {
  try {
    const query = `
      UPDATE job_postings
      SET applications_count = applications_count + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing applications:', error.message);
    throw error;
  }
};

// Update job posting
const update = async (id, jobData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'title', 'job_type', 'description', 'requirements', 'responsibilities',
      'location', 'city', 'state', 'country', 'is_remote', 'salary_min',
      'salary_max', 'salary_currency', 'employment_type', 'specialty',
      'department', 'experience_level', 'application_deadline', 'start_date', 'is_active'
    ];

    for (const [key, value] of Object.entries(jobData)) {
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
      UPDATE job_postings
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating job posting:', error.message);
    throw error;
  }
};

// Delete job posting
const remove = async (id) => {
  try {
    const query = 'DELETE FROM job_postings WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting job posting:', error.message);
    throw error;
  }
};

module.exports = {
  initializeJobPostingsTable,
  create,
  findById,
  search,
  findByOrganizationId,
  incrementViews,
  incrementApplications,
  update,
  remove,
};
