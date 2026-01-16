// Post model - User posts/content (medical discussions, case studies, updates, articles)
const { pool } = require('../config/database');

// Initialize posts table
const initializePostsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        post_type VARCHAR(50) DEFAULT 'post',
        visibility VARCHAR(50) DEFAULT 'public',
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        shares_count INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        is_edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMP,
        is_pinned BOOLEAN DEFAULT FALSE,
        parent_post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Posts table initialized');
  } catch (error) {
    console.error('❌ Error initializing posts table:', error.message);
    throw error;
  }
};

// Create post
const create = async (postData) => {
  try {
    const query = `
      INSERT INTO posts (
        user_id, content, post_type, visibility, parent_post_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [
      postData.user_id,
      postData.content,
      postData.post_type || 'post',
      postData.visibility || 'public',
      postData.parent_post_id || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating post:', error.message);
    throw error;
  }
};

// Find post by ID
const findById = async (id) => {
  try {
    const query = `
      SELECT p.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding post by ID:', error.message);
    throw error;
  }
};

// Find posts by user ID
const findByUserId = async (userId, limit = 20, offset = 0) => {
  try {
    const query = `
      SELECT p.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = $1 AND p.parent_post_id IS NULL
      ORDER BY p.is_pinned DESC, p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding posts by user ID:', error.message);
    throw error;
  }
};

// Find feed posts (for home feed)
const findFeed = async (userId, limit = 20, offset = 0) => {
  try {
    const query = `
      SELECT DISTINCT p.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN follows f ON f.following_id = p.user_id AND f.follower_id = $1
      LEFT JOIN connections c ON (
        (c.requester_id = $1 AND c.addressee_id = p.user_id) OR
        (c.requester_id = p.user_id AND c.addressee_id = $1)
      ) AND c.status = 'connected'
      WHERE p.parent_post_id IS NULL
        AND (
          p.user_id = $1
          OR (p.visibility = 'public')
          OR (p.visibility = 'connections' AND c.id IS NOT NULL)
        )
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding feed posts:', error.message);
    throw error;
  }
};

// Update post
const update = async (id, postData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['content', 'post_type', 'visibility', 'is_pinned'];

    for (const [key, value] of Object.entries(postData)) {
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
      UPDATE posts
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating post:', error.message);
    throw error;
  }
};

// Increment likes count
const incrementLikes = async (id, increment = 1) => {
  try {
    // Validate increment is a positive integer
    if (!Number.isInteger(increment) || increment <= 0) {
      throw new Error('increment must be a positive integer');
    }
    
    const query = `
      UPDATE posts
      SET likes_count = likes_count + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing likes:', error.message);
    throw error;
  }
};

// Increment comments count
const incrementComments = async (id, increment = 1) => {
  try {
    // Validate increment is a positive integer
    if (!Number.isInteger(increment) || increment <= 0) {
      throw new Error('increment must be a positive integer');
    }
    
    const query = `
      UPDATE posts
      SET comments_count = comments_count + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing comments:', error.message);
    throw error;
  }
};

// Increment shares count
const incrementShares = async (id, increment = 1) => {
  try {
    // Validate increment is a positive integer
    if (!Number.isInteger(increment) || increment <= 0) {
      throw new Error('increment must be a positive integer');
    }
    
    const query = `
      UPDATE posts
      SET shares_count = shares_count + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing shares:', error.message);
    throw error;
  }
};

// Increment views count
const incrementViews = async (id) => {
  try {
    const query = `
      UPDATE posts
      SET views_count = views_count + 1, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing views:', error.message);
    throw error;
  }
};

// Delete post
const remove = async (id) => {
  try {
    const query = 'DELETE FROM posts WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting post:', error.message);
    throw error;
  }
};

module.exports = {
  initializePostsTable,
  create,
  findById,
  findByUserId,
  findFeed,
  update,
  incrementLikes,
  incrementComments,
  incrementShares,
  incrementViews,
  remove,
};
