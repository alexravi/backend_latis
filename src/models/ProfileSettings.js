// Profile Settings model - User profile settings (privacy, visibility)
const { pool } = require('../config/database');

// Initialize profile_settings table
const initializeProfileSettingsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS profile_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_visibility VARCHAR(50) DEFAULT 'public',
        show_email BOOLEAN DEFAULT FALSE,
        show_phone BOOLEAN DEFAULT FALSE,
        show_location BOOLEAN DEFAULT TRUE,
        show_connections BOOLEAN DEFAULT TRUE,
        show_experience BOOLEAN DEFAULT TRUE,
        show_education BOOLEAN DEFAULT TRUE,
        show_skills BOOLEAN DEFAULT TRUE,
        show_certifications BOOLEAN DEFAULT TRUE,
        show_publications BOOLEAN DEFAULT TRUE,
        show_projects BOOLEAN DEFAULT TRUE,
        show_awards BOOLEAN DEFAULT TRUE,
        allow_connection_requests BOOLEAN DEFAULT TRUE,
        allow_messages_from VARCHAR(50) DEFAULT 'connections',
        allow_endorsements BOOLEAN DEFAULT TRUE,
        allow_recommendations BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Profile settings table initialized');
  } catch (error) {
    console.error('❌ Error initializing profile settings table:', error.message);
    throw error;
  }
};

// Create or update profile settings
const upsert = async (userId, settings, client = null) => {
  try {
    const allowedFields = [
      'profile_visibility', 'show_email', 'show_phone', 'show_location',
      'show_connections', 'show_experience', 'show_education', 'show_skills',
      'show_certifications', 'show_publications', 'show_projects', 'show_awards',
      'allow_connection_requests', 'allow_messages_from', 'allow_endorsements',
      'allow_recommendations'
    ];

    // Defaults for new records
    const defaults = {
      profile_visibility: 'public',
      show_email: false,
      show_phone: false,
      show_location: true,
      show_connections: true,
      show_experience: true,
      show_education: true,
      show_skills: true,
      show_certifications: true,
      show_publications: true,
      show_projects: true,
      show_awards: true,
      allow_connection_requests: true,
      allow_messages_from: 'connections',
      allow_endorsements: true,
      allow_recommendations: true
    };
    
    // Merge defaults with provided settings
    const mergedSettings = { ...defaults, ...settings };
    const values = [userId];
    const fieldNames = ['user_id'];
    const placeholders = ['$1'];
    const updateParts = [];
    let paramCount = 2;

    allowedFields.forEach(field => {
      fieldNames.push(field);
      placeholders.push(`$${paramCount}`);
      values.push(mergedSettings[field] !== undefined ? mergedSettings[field] : defaults[field]);
      updateParts.push(`${field} = EXCLUDED.${field}`);
      paramCount++;
    });

    const query = `
      INSERT INTO profile_settings (${fieldNames.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (user_id) DO UPDATE SET
        ${updateParts.join(', ')},
        updated_at = NOW()
      RETURNING *
    `;
    
    const db = client || pool;
    const result = await db.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error upserting profile settings:', error.message);
    throw error;
  }
};

// Find settings by user ID
const findByUserId = async (userId) => {
  try {
    const query = 'SELECT * FROM profile_settings WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding profile settings by user ID:', error.message);
    throw error;
  }
};

// Update profile settings
const update = async (userId, settings) => {
  try {
    const allowedFields = [
      'profile_visibility', 'show_email', 'show_phone', 'show_location',
      'show_connections', 'show_experience', 'show_education', 'show_skills',
      'show_certifications', 'show_publications', 'show_projects', 'show_awards',
      'allow_connection_requests', 'allow_messages_from', 'allow_endorsements',
      'allow_recommendations'
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(settings)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return await findByUserId(userId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE profile_settings
      SET ${fields.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating profile settings:', error.message);
    throw error;
  }
};

module.exports = {
  initializeProfileSettingsTable,
  upsert,
  findByUserId,
  update,
};
