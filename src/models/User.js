// User model and database operations
const { pool } = require('../config/database');

// Initialize users table
const initializeUsersTable = async () => {
  try {
    // Create table if it doesn't exist
    const createQuery = `
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
        "current_role" VARCHAR(100),
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
    await pool.query(createQuery);

    // Add missing columns if they don't exist (for existing tables)
    const columnsToAdd = [
      { name: 'first_name', type: 'VARCHAR(100)' },
      { name: 'last_name', type: 'VARCHAR(100)' },
      { name: 'headline', type: 'VARCHAR(255)' },
      { name: 'summary', type: 'TEXT' },
      { name: 'profile_image_url', type: 'VARCHAR(500)' },
      { name: 'cover_image_url', type: 'VARCHAR(500)' },
      { name: 'location', type: 'VARCHAR(255)' },
      { name: 'phone', type: 'VARCHAR(20)' },
      { name: 'website', type: 'VARCHAR(255)' },
      { name: 'current_role', type: 'VARCHAR(100)' },
      { name: 'specialization', type: 'VARCHAR(255)' },
      { name: 'subspecialization', type: 'VARCHAR(255)' },
      { name: 'years_of_experience', type: 'INTEGER' },
      { name: 'medical_school_graduation_year', type: 'INTEGER' },
      { name: 'residency_completion_year', type: 'INTEGER' },
      { name: 'fellowship_completion_year', type: 'INTEGER' },
      { name: 'is_verified', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'created_at', type: 'TIMESTAMP DEFAULT NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP DEFAULT NOW()' },
    ];

    const addedColumns = [];
    const existingColumns = [];
    const failedColumns = [];

    for (const column of columnsToAdd) {
      try {
        // Check if column exists - explicitly check public schema
        const checkColumnQuery = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'users' 
            AND column_name = $1
        `;
        const result = await pool.query(checkColumnQuery, [column.name]);

        if (result.rows.length === 0) {
          // Column doesn't exist, add it
          try {
            // Quote column name to handle reserved keywords like 'current_role'
            const alterQuery = `ALTER TABLE users ADD COLUMN "${column.name}" ${column.type}`;
            await pool.query(alterQuery);
            addedColumns.push(column.name);
            console.log(`✅ Added column '${column.name}' (${column.type}) to users table`);
          } catch (alterError) {
            failedColumns.push({ name: column.name, error: alterError.message });
            console.error(`❌ Failed to add column '${column.name}': ${alterError.message}`);
          }
        } else {
          existingColumns.push(column.name);
          console.log(`✓ Column '${column.name}' already exists`);
        }
      } catch (checkError) {
        failedColumns.push({ name: column.name, error: checkError.message });
        console.error(`❌ Error checking column '${column.name}': ${checkError.message}`);
      }
    }

    // Summary log
    if (addedColumns.length > 0) {
      console.log(`\n📊 Migration Summary: Added ${addedColumns.length} column(s): ${addedColumns.join(', ')}`);
    }
    if (failedColumns.length > 0) {
      console.warn(`\n⚠️  Migration Warning: ${failedColumns.length} column(s) could not be processed:`);
      failedColumns.forEach(col => {
        console.warn(`   - ${col.name}: ${col.error}`);
      });
    }
    if (addedColumns.length === 0 && failedColumns.length === 0) {
      console.log(`\n✓ All required columns already exist in users table`);
    }

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
const updateProfile = async (id, profileData, client = null) => {
  try {
    const db = client || pool;
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
        // Quote column name if it's a reserved keyword like 'current_role'
        const quotedKey = key === 'current_role' ? `"${key}"` : key;
        fields.push(`${quotedKey} = $${paramCount}`);
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
    const result = await db.query(query, values);
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
