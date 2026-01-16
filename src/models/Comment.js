// Comment model - Comments on posts
const { pool } = require('../config/database');

// Initialize comments table
const initializeCommentsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        parent_comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        likes_count INTEGER DEFAULT 0,
        replies_count INTEGER DEFAULT 0,
        is_edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Comments table initialized');
  } catch (error) {
    console.error('❌ Error initializing comments table:', error.message);
    throw error;
  }
};

// Create comment
const create = async (commentData) => {
  try {
    const query = `
      INSERT INTO comments (post_id, user_id, content, parent_comment_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [
      commentData.post_id,
      commentData.user_id,
      commentData.content,
      commentData.parent_comment_id || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating comment:', error.message);
    throw error;
  }
};

// Find comment by ID
const findById = async (id) => {
  try {
    const query = `
      SELECT c.*, u.first_name, u.last_name, u.profile_image_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding comment by ID:', error.message);
    throw error;
  }
};

// Find comments by post ID
const findByPostId = async (postId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT c.*, u.first_name, u.last_name, u.profile_image_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [postId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding comments by post ID:', error.message);
    throw error;
  }
};

// Find replies to a comment
const findReplies = async (commentId, limit = 20, offset = 0) => {
  try {
    const query = `
      SELECT c.*, u.first_name, u.last_name, u.profile_image_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.parent_comment_id = $1
      ORDER BY c.created_at ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [commentId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding comment replies:', error.message);
    throw error;
  }
};

// Update comment
const update = async (id, commentData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['content'];

    for (const [key, value] of Object.entries(commentData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return await findById(id);
    }

    fields.push(`is_edited = TRUE`);
    fields.push(`edited_at = NOW()`);
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE comments
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating comment:', error.message);
    throw error;
  }
};

// Increment likes count
const incrementLikes = async (id, increment = 1) => {
  try {
    const query = `
      UPDATE comments
      SET likes_count = GREATEST(likes_count + $1, 0), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing comment likes:', error.message);
    throw error;
  }
};

// Increment replies count
const incrementReplies = async (id, increment = 1) => {
  try {
    const query = `
      UPDATE comments
      SET replies_count = GREATEST(replies_count + $1, 0), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing comment replies:', error.message);
    throw error;
  }
};

// Delete comment
const remove = async (id) => {
  try {
    const query = 'DELETE FROM comments WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting comment:', error.message);
    throw error;
  }
};

module.exports = {
  initializeCommentsTable,
  create,
  findById,
  findByPostId,
  findReplies,
  update,
  incrementLikes,
  incrementReplies,
  remove,
};
