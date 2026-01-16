// Saved Job model - User-saved job postings
const { pool } = require('../config/database');

// Initialize saved_jobs table
const initializeSavedJobsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS saved_jobs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_posting_id INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, job_posting_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Saved jobs table initialized');
  } catch (error) {
    console.error('❌ Error initializing saved jobs table:', error.message);
    throw error;
  }
};

// Save job
const save = async (userId, jobPostingId, notes = null) => {
  try {
    const query = `
      INSERT INTO saved_jobs (user_id, job_posting_id, notes)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, job_posting_id) DO UPDATE SET
        notes = EXCLUDED.notes
      RETURNING *
    `;
    const result = await pool.query(query, [userId, jobPostingId, notes]);
    return result.rows[0];
  } catch (error) {
    console.error('Error saving job:', error.message);
    throw error;
  }
};

// Unsave job
const unsave = async (userId, jobPostingId) => {
  try {
    const query = `
      DELETE FROM saved_jobs
      WHERE user_id = $1 AND job_posting_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [userId, jobPostingId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error unsaving job:', error.message);
    throw error;
  }
};

// Find saved jobs by user ID
const findByUserId = async (userId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT 
        sj.id AS saved_id,
        sj.user_id,
        sj.job_posting_id,
        sj.notes,
        sj.created_at AS saved_created_at,
        jp.id AS job_id,
        jp.title,
        jp.description,
        jp.job_type,
        jp.location,
        jp.salary_min,
        jp.salary_max,
        jp.is_active,
        jp.created_at AS job_created_at,
        jp.updated_at AS job_updated_at,
        jp.organization_id,
        mo.name AS organization_name,
        mo.logo_url AS organization_logo
      FROM saved_jobs sj
      JOIN job_postings jp ON sj.job_posting_id = jp.id
      LEFT JOIN medical_organizations mo ON jp.organization_id = mo.id
      WHERE sj.user_id = $1 AND jp.is_active = TRUE
      ORDER BY sj.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding saved jobs by user ID:', error.message);
    throw error;
  }
};

// Check if job is saved
const isSaved = async (userId, jobPostingId) => {
  try {
    const query = `
      SELECT * FROM saved_jobs
      WHERE user_id = $1 AND job_posting_id = $2
    `;
    const result = await pool.query(query, [userId, jobPostingId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking if job is saved:', error.message);
    throw error;
  }
};

module.exports = {
  initializeSavedJobsTable,
  save,
  unsave,
  findByUserId,
  isSaved,
};
