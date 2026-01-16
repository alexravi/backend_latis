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
    const query = 'SELECT id, email, created_at, updated_at FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding user by id:', error.message);
    throw error;
  }
};

// Create new user
const create = async (email, hashedPassword) => {
  try {
    const query = `
      INSERT INTO users (email, password)
      VALUES ($1, $2)
      RETURNING id, email, created_at, updated_at
    `;
    const result = await pool.query(query, [email, hashedPassword]);
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
};
