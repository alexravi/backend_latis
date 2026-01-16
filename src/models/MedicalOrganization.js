// Medical Organization model - Hospitals, clinics, research institutions, medical schools
const { pool } = require('../config/database');

// Initialize medical_organizations table
const initializeMedicalOrganizationsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS medical_organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        organization_type VARCHAR(100) NOT NULL,
        description TEXT,
        website VARCHAR(500),
        logo_url VARCHAR(500),
        location VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100),
        postal_code VARCHAR(20),
        phone VARCHAR(20),
        email VARCHAR(255),
        founded_year INTEGER,
        employee_count INTEGER,
        specialties TEXT[],
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Medical organizations table initialized');
  } catch (error) {
    console.error('❌ Error initializing medical organizations table:', error.message);
    throw error;
  }
};

// Create medical organization
const create = async (organizationData) => {
  try {
    const query = `
      INSERT INTO medical_organizations (
        name, organization_type, description, website, logo_url, location,
        address, city, state, country, postal_code, phone, email,
        founded_year, employee_count, specialties, is_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;
    const result = await pool.query(query, [
      organizationData.name,
      organizationData.organization_type,
      organizationData.description || null,
      organizationData.website || null,
      organizationData.logo_url || null,
      organizationData.location || null,
      organizationData.address || null,
      organizationData.city || null,
      organizationData.state || null,
      organizationData.country || null,
      organizationData.postal_code || null,
      organizationData.phone || null,
      organizationData.email || null,
      organizationData.founded_year || null,
      organizationData.employee_count || null,
      organizationData.specialties || [],
      organizationData.is_verified || false
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating medical organization:', error.message);
    throw error;
  }
};

// Find organization by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM medical_organizations WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding medical organization by ID:', error.message);
    throw error;
  }
};

// Find organization by name
const findByName = async (name) => {
  try {
    const query = 'SELECT * FROM medical_organizations WHERE name ILIKE $1';
    const result = await pool.query(query, [`%${name}%`]);
    return result.rows;
  } catch (error) {
    console.error('Error finding medical organization by name:', error.message);
    throw error;
  }
};

// Search organizations
const search = async (searchTerm, organizationType = null) => {
  try {
    let query = `
      SELECT * FROM medical_organizations
      WHERE (name ILIKE $1 OR description ILIKE $1)
    `;
    const params = [`%${searchTerm}%`];
    
    if (organizationType) {
      query += ' AND organization_type = $2';
      params.push(organizationType);
    }
    
    query += ' ORDER BY name ASC LIMIT 50';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error searching medical organizations:', error.message);
    throw error;
  }
};

// Update medical organization
const update = async (id, organizationData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'name', 'organization_type', 'description', 'website', 'logo_url', 'location',
      'address', 'city', 'state', 'country', 'postal_code', 'phone', 'email',
      'founded_year', 'employee_count', 'specialties', 'is_verified'
    ];

    for (const [key, value] of Object.entries(organizationData)) {
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
      UPDATE medical_organizations
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating medical organization:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMedicalOrganizationsTable,
  create,
  findById,
  findByName,
  search,
  update,
};
