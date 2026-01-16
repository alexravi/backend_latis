// Profile model - Enhanced user profile information
const { pool } = require('../config/database');

// Initialize profiles table (this extends users table, but can store additional profile data)
const initializeProfilesTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bio TEXT,
        languages TEXT[],
        interests TEXT[],
        volunteer_experiences JSONB,
        causes TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Profiles table initialized');
  } catch (error) {
    console.error('❌ Error initializing profiles table:', error.message);
    throw error;
  }
};

// Create or update profile
const upsertProfile = async (userId, profileData) => {
  try {
    const query = `
      INSERT INTO profiles (user_id, bio, languages, interests, volunteer_experiences, causes)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id)
      DO UPDATE SET
        bio = EXCLUDED.bio,
        languages = EXCLUDED.languages,
        interests = EXCLUDED.interests,
        volunteer_experiences = EXCLUDED.volunteer_experiences,
        causes = EXCLUDED.causes,
        updated_at = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [
      userId,
      profileData.bio || null,
      profileData.languages || [],
      profileData.interests || [],
      profileData.volunteer_experiences || null,
      profileData.causes || []
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error upserting profile:', error.message);
    throw error;
  }
};

// Find profile by user ID
const findByUserId = async (userId) => {
  try {
    const query = 'SELECT * FROM profiles WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding profile by user ID:', error.message);
    throw error;
  }
};

module.exports = {
  initializeProfilesTable,
  upsertProfile,
  findByUserId,
};
