// Medical Skill model - Skills and specializations
const { pool } = require('../config/database');

// Initialize medical_skills table
const initializeMedicalSkillsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS medical_skills (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Medical skills table initialized');
  } catch (error) {
    console.error('❌ Error initializing medical skills table:', error.message);
    throw error;
  }
};

// Create medical skill
const create = async (skillData) => {
  try {
    const query = `
      INSERT INTO medical_skills (name, category, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO UPDATE SET
        category = EXCLUDED.category,
        description = EXCLUDED.description
      RETURNING *
    `;
    const result = await pool.query(query, [
      skillData.name,
      skillData.category || null,
      skillData.description || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating medical skill:', error.message);
    throw error;
  }
};

// Find skill by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM medical_skills WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding medical skill by ID:', error.message);
    throw error;
  }
};

// Find skill by name
const findByName = async (name) => {
  try {
    const query = 'SELECT * FROM medical_skills WHERE name = $1';
    const result = await pool.query(query, [name]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding medical skill by name:', error.message);
    throw error;
  }
};

// Find all skills
const findAll = async (category = null) => {
  try {
    let query = 'SELECT * FROM medical_skills';
    const params = [];
    
    if (category) {
      query += ' WHERE category = $1';
      params.push(category);
    }
    
    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error finding all medical skills:', error.message);
    throw error;
  }
};

// Search skills
const search = async (searchTerm) => {
  try {
    const query = `
      SELECT * FROM medical_skills
      WHERE name ILIKE $1 OR description ILIKE $1
      ORDER BY name ASC
      LIMIT 50
    `;
    const result = await pool.query(query, [`%${searchTerm}%`]);
    return result.rows;
  } catch (error) {
    console.error('Error searching medical skills:', error.message);
    throw error;
  }
};

// Bulk upsert skills (case-insensitive deduplication)
const bulkUpsertSkills = async (client, skills) => {
  if (!skills || skills.length === 0) {
    return [];
  }

  try {
    // Get unique skill names (case-insensitive deduplication already done in normalization)
    const uniqueNames = [...new Set(skills.map(s => s.name.toLowerCase()))];
    
    // Fetch existing skills in bulk (case-insensitive)
    const findPlaceholders = uniqueNames.map((_, i) => `$${i + 1}`).join(',');
    const findQuery = `
      SELECT * FROM medical_skills 
      WHERE LOWER(name) IN (${findPlaceholders})
    `;
    const findResult = await client.query(findQuery, uniqueNames);
    
    const existingMap = new Map();
    findResult.rows.forEach(row => {
      existingMap.set(row.name.toLowerCase(), row);
    });

    // Separate new skills from existing ones
    const newSkills = skills.filter(skill => !existingMap.has(skill.name.toLowerCase()));
    const skillMap = new Map(existingMap);

    // Bulk insert new skills
    if (newSkills.length > 0) {
      const insertValues = [];
      const insertPlaceholders = [];
      let insertParamCount = 1;

      newSkills.forEach((skill) => {
        insertPlaceholders.push(`($${insertParamCount}, $${insertParamCount + 1}, $${insertParamCount + 2})`);
        insertValues.push(skill.name, skill.category || null, null);
        insertParamCount += 3;
      });

      const insertQuery = `
        INSERT INTO medical_skills (name, category, description)
        VALUES ${insertPlaceholders.join(', ')}
        RETURNING *
      `;
      
      const insertResult = await client.query(insertQuery, insertValues);
      insertResult.rows.forEach(row => {
        skillMap.set(row.name.toLowerCase(), row);
      });
    }

    // Return all skills (existing + newly created) in the order requested
    return skills.map(skill => skillMap.get(skill.name.toLowerCase())).filter(Boolean);
  } catch (error) {
    console.error('Error bulk upserting skills:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMedicalSkillsTable,
  create,
  findById,
  findByName,
  findAll,
  search,
  bulkUpsertSkills,
};
