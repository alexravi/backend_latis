// Recommendation model - Professional recommendations and endorsements
const { pool } = require('../config/database');

// Initialize recommendations table
const initializeRecommendationsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS recommendations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recommender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        relationship_type VARCHAR(100),
        recommendation_text TEXT NOT NULL,
        is_visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (user_id != recommender_id)
      );
    `;
    await pool.query(query);
    console.log('✅ Recommendations table initialized');
  } catch (error) {
    console.error('❌ Error initializing recommendations table:', error.message);
    throw error;
  }
};

// Create recommendation
const create = async (recommendationData) => {
  try {
    const query = `
      INSERT INTO recommendations (user_id, recommender_id, relationship_type, recommendation_text, is_visible)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [
      recommendationData.user_id,
      recommendationData.recommender_id,
      recommendationData.relationship_type || null,
      recommendationData.recommendation_text,
      recommendationData.is_visible !== undefined ? recommendationData.is_visible : true
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating recommendation:', error.message);
    throw error;
  }
};

// Find recommendations by user ID
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT r.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM recommendations r
      JOIN users u ON r.recommender_id = u.id
      WHERE r.user_id = $1 AND r.is_visible = TRUE
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding recommendations by user ID:', error.message);
    throw error;
  }
};

// Find recommendation by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM recommendations WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding recommendation by ID:', error.message);
    throw error;
  }
};

// Update recommendation
const update = async (id, recommendationData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['relationship_type', 'recommendation_text', 'is_visible'];

    for (const [key, value] of Object.entries(recommendationData)) {
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
      UPDATE recommendations
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating recommendation:', error.message);
    throw error;
  }
};

// Delete recommendation
const remove = async (id) => {
  try {
    const query = 'DELETE FROM recommendations WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting recommendation:', error.message);
    throw error;
  }
};

module.exports = {
  initializeRecommendationsTable,
  create,
  findByUserId,
  findById,
  update,
  remove,
};
