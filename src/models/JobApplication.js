// Job Application model - Applications to job postings
const { pool } = require('../config/database');

// Initialize job_applications table
const initializeJobApplicationsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS job_applications (
        id SERIAL PRIMARY KEY,
        job_posting_id INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
        applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cover_letter TEXT,
        resume_url VARCHAR(500),
        status VARCHAR(50) DEFAULT 'pending',
        applied_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(job_posting_id, applicant_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Job applications table initialized');
  } catch (error) {
    console.error('❌ Error initializing job applications table:', error.message);
    throw error;
  }
};

// Create job application
const create = async (applicationData) => {
  try {
    const query = `
      INSERT INTO job_applications (job_posting_id, applicant_id, cover_letter, resume_url, status)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (job_posting_id, applicant_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [
      applicationData.job_posting_id,
      applicationData.applicant_id,
      applicationData.cover_letter || null,
      applicationData.resume_url || null,
      applicationData.status || 'pending'
    ]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error creating job application:', error.message);
    throw error;
  }
};

// Find application by ID
const findById = async (id) => {
  try {
    const query = `
      SELECT ja.*, u.first_name, u.last_name, u.profile_image_url, u.headline,
             jp.title as job_title, jp.organization_id
      FROM job_applications ja
      JOIN users u ON ja.applicant_id = u.id
      JOIN job_postings jp ON ja.job_posting_id = jp.id
      WHERE ja.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding job application by ID:', error.message);
    throw error;
  }
};

// Find applications by job posting ID
const findByJobPostingId = async (jobPostingId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT ja.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM job_applications ja
      JOIN users u ON ja.applicant_id = u.id
      WHERE ja.job_posting_id = $1
      ORDER BY ja.applied_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [jobPostingId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding job applications by job posting ID:', error.message);
    throw error;
  }
};

// Find applications by applicant ID
const findByApplicantId = async (applicantId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT ja.*, jp.title, jp.job_type, jp.organization_id,
             mo.name as organization_name
      FROM job_applications ja
      JOIN job_postings jp ON ja.job_posting_id = jp.id
      LEFT JOIN medical_organizations mo ON jp.organization_id = mo.id
      WHERE ja.applicant_id = $1
      ORDER BY ja.applied_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [applicantId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding job applications by applicant ID:', error.message);
    throw error;
  }
};

// Check if user has applied
const hasApplied = async (applicantId, jobPostingId) => {
  try {
    const query = `
      SELECT * FROM job_applications
      WHERE applicant_id = $1 AND job_posting_id = $2
    `;
    const result = await pool.query(query, [applicantId, jobPostingId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking if user has applied:', error.message);
    throw error;
  }
};

// Update application status
const updateStatus = async (id, status) => {
  try {
    const query = `
      UPDATE job_applications
      SET status = $1, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [status, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating application status:', error.message);
    throw error;
  }
};

// Update application
const update = async (id, applicationData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['cover_letter', 'resume_url', 'status'];

    for (const [key, value] of Object.entries(applicationData)) {
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
      UPDATE job_applications
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    
    // Return enriched data to match findById shape
    if (result.rows[0]) {
      return await findById(id);
    }
    return null;
  } catch (error) {
    console.error('Error updating job application:', error.message);
    throw error;
  }
};

// Delete application
const remove = async (id) => {
  try {
    const query = 'DELETE FROM job_applications WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting job application:', error.message);
    throw error;
  }
};

module.exports = {
  initializeJobApplicationsTable,
  create,
  findById,
  findByJobPostingId,
  findByApplicantId,
  hasApplied,
  updateStatus,
  update,
  remove,
};
