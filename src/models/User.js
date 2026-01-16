// User model and database operations
const { pool } = require('../config/database');

// Initialize users table
const initializeUsersTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        headline VARCHAR(255),
        summary TEXT,
        profile_image_url VARCHAR(500),
        cover_image_url VARCHAR(500),
        location VARCHAR(255),
        phone VARCHAR(20),
        website VARCHAR(255),
        current_role VARCHAR(100),
        specialization VARCHAR(255),
        subspecialization VARCHAR(255),
        years_of_experience INTEGER,
        medical_school_graduation_year INTEGER,
        residency_completion_year INTEGER,
        fellowship_completion_year INTEGER,
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Users table initialized');
  } catch (error) {
    console.error('❌ Error initializing users table:', error.message);
    throw error;
  }
};

// Find user by email
const findByEmail = async (email) => {
  try {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by email:', error.message);
    throw error;
  }
};

// Find user by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by id:', error.message);
    throw error;
  }
};

// Update user profile
const updateProfile = async (id, profileData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'first_name', 'last_name', 'headline', 'summary', 'profile_image_url',
      'cover_image_url', 'location', 'phone', 'website', 'current_role',
      'specialization', 'subspecialization', 'years_of_experience',
      'medical_school_graduation_year', 'residency_completion_year',
      'fellowship_completion_year'
    ];

    for (const [key, value] of Object.entries(profileData)) {
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
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating user profile:', error.message);
    throw error;
  }
};

// Create new user
const create = async (email, hashedPassword, firstName = null, lastName = null) => {
  try {
    const query = `
      INSERT INTO users (email, password, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, first_name, last_name, created_at, updated_at
    `;
    const result = await pool.query(query, [email, hashedPassword, firstName, lastName]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating user:', error.message);
    throw error;
  }
};

module.exports = {
  initializeUsersTable,
  findByEmail,
  findById,
  create,
  updateProfile,
};
