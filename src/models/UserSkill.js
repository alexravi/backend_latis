// User Skill model - Junction table for user-skill relationships
const { pool } = require('../config/database');

// Initialize user_skills table
const initializeUserSkillsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS user_skills (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_id INTEGER NOT NULL REFERENCES medical_skills(id) ON DELETE CASCADE,
        proficiency_level VARCHAR(50),
        years_of_experience INTEGER,
        endorsements_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, skill_id)
      );
    `;
    await pool.query(query);
    console.log('✅ User skills table initialized');
  } catch (error) {
    console.error('❌ Error initializing user skills table:', error.message);
    throw error;
  }
};

// Add skill to user
const addSkill = async (userId, skillId, skillData = {}) => {
  try {
    const query = `
      INSERT INTO user_skills (user_id, skill_id, proficiency_level, years_of_experience)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, skill_id) DO UPDATE SET
        proficiency_level = EXCLUDED.proficiency_level,
        years_of_experience = EXCLUDED.years_of_experience
      RETURNING *
    `;
    const result = await pool.query(query, [
      userId,
      skillId,
      skillData.proficiency_level !== undefined ? skillData.proficiency_level : null,
      skillData.years_of_experience !== undefined ? skillData.years_of_experience : null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error adding skill to user:', error.message);
    throw error;
  }
};

// Find skills by user ID
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT us.*, ms.name, ms.category, ms.description
      FROM user_skills us
      JOIN medical_skills ms ON us.skill_id = ms.id
      WHERE us.user_id = $1
      ORDER BY us.endorsements_count DESC, ms.name ASC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding user skills by user ID:', error.message);
    throw error;
  }
};

// Remove skill from user
const removeSkill = async (userId, skillId) => {
  try {
    const query = `
      DELETE FROM user_skills
      WHERE user_id = $1 AND skill_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [userId, skillId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error removing skill from user:', error.message);
    throw error;
  }
};

// Increment endorsements count
const incrementEndorsements = async (userId, skillId) => {
  try {
    const query = `
      UPDATE user_skills
      SET endorsements_count = endorsements_count + 1
      WHERE user_id = $1 AND skill_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [userId, skillId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing endorsements:', error.message);
    throw error;
  }
};

module.exports = {
  initializeUserSkillsTable,
  addSkill,
  findByUserId,
  removeSkill,
  incrementEndorsements,
};
