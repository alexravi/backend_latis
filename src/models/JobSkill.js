// Job Skill model - Required skills for job postings
const { pool } = require('../config/database');

// Initialize job_skills table
const initializeJobSkillsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS job_skills (
        id SERIAL PRIMARY KEY,
        job_posting_id INTEGER NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
        skill_id INTEGER NOT NULL REFERENCES medical_skills(id) ON DELETE CASCADE,
        is_required BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(job_posting_id, skill_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Job skills table initialized');
  } catch (error) {
    console.error('❌ Error initializing job skills table:', error.message);
    throw error;
  }
};

// Add skill to job posting
const addSkill = async (jobPostingId, skillId, isRequired = true) => {
  try {
    const query = `
      INSERT INTO job_skills (job_posting_id, skill_id, is_required)
      VALUES ($1, $2, $3)
      ON CONFLICT (job_posting_id, skill_id) DO UPDATE SET
        is_required = EXCLUDED.is_required
      RETURNING *
    `;
    const result = await pool.query(query, [jobPostingId, skillId, isRequired]);
    return result.rows[0];
  } catch (error) {
    console.error('Error adding skill to job posting:', error.message);
    throw error;
  }
};

// Remove skill from job posting
const removeSkill = async (jobPostingId, skillId) => {
  try {
    const query = `
      DELETE FROM job_skills
      WHERE job_posting_id = $1 AND skill_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [jobPostingId, skillId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error removing skill from job posting:', error.message);
    throw error;
  }
};

// Find skills by job posting ID
const findByJobPostingId = async (jobPostingId) => {
  try {
    const query = `
      SELECT js.*, ms.name, ms.category, ms.description
      FROM job_skills js
      JOIN medical_skills ms ON js.skill_id = ms.id
      WHERE js.job_posting_id = $1
      ORDER BY js.is_required DESC, ms.name ASC
    `;
    const result = await pool.query(query, [jobPostingId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding skills by job posting ID:', error.message);
    throw error;
  }
};

// Remove all skills from job posting
const removeByJobPostingId = async (jobPostingId) => {
  try {
    const query = 'DELETE FROM job_skills WHERE job_posting_id = $1 RETURNING *';
    const result = await pool.query(query, [jobPostingId]);
    return result.rows;
  } catch (error) {
    console.error('Error removing skills by job posting ID:', error.message);
    throw error;
  }
};

module.exports = {
  initializeJobSkillsTable,
  addSkill,
  removeSkill,
  findByJobPostingId,
  removeByJobPostingId,
};
