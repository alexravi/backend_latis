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

// Create or update profile (only updates fields that are explicitly provided)
const upsertProfile = async (userId, profileData, client = null) => {
  try {
    const db = client || pool;
    
    // First, check if profile exists to determine if we should INSERT or UPDATE
    const existingProfile = await findByUserId(userId);
    
    if (!existingProfile) {
      // INSERT new profile - use provided values or defaults
      const query = `
        INSERT INTO profiles (user_id, bio, languages, interests, volunteer_experiences, causes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await db.query(query, [
        userId,
        profileData.bio ?? null,
        profileData.languages ?? [],
        profileData.interests ?? [],
        profileData.volunteer_experiences ?? null,
        profileData.causes ?? []
      ]);
      return result.rows[0];
    } else {
      // UPDATE existing profile - only update fields that are explicitly provided
      const fields = [];
      const values = [];
      let paramCount = 1;
      
      if (profileData.bio !== undefined) {
        fields.push(`bio = $${paramCount}`);
        values.push(profileData.bio);
        paramCount++;
      }
      if (profileData.languages !== undefined) {
        fields.push(`languages = $${paramCount}`);
        values.push(profileData.languages);
        paramCount++;
      }
      if (profileData.interests !== undefined) {
        fields.push(`interests = $${paramCount}`);
        values.push(profileData.interests);
        paramCount++;
      }
      if (profileData.volunteer_experiences !== undefined) {
        fields.push(`volunteer_experiences = $${paramCount}`);
        values.push(profileData.volunteer_experiences);
        paramCount++;
      }
      if (profileData.causes !== undefined) {
        fields.push(`causes = $${paramCount}`);
        values.push(profileData.causes);
        paramCount++;
      }
      
      // Only update if there are fields to update
      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        values.push(userId);
        
        const query = `
          UPDATE profiles
          SET ${fields.join(', ')}
          WHERE user_id = $${paramCount}
          RETURNING *
        `;
        const result = await db.query(query, values);
        return result.rows[0];
      }
      
      return existingProfile;
    }
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
