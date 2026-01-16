// Reaction model - Likes, reactions on posts and comments
const { pool } = require('../config/database');

// Initialize reactions table
const initializeReactionsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        reaction_type VARCHAR(50) DEFAULT 'like',
        created_at TIMESTAMP DEFAULT NOW(),
        CHECK (
          (post_id IS NOT NULL AND comment_id IS NULL) OR
          (post_id IS NULL AND comment_id IS NOT NULL)
        )
      );
      
      CREATE UNIQUE INDEX IF NOT EXISTS reactions_user_post_unique 
        ON reactions(user_id, post_id) 
        WHERE post_id IS NOT NULL AND comment_id IS NULL;
      
      CREATE UNIQUE INDEX IF NOT EXISTS reactions_user_comment_unique 
        ON reactions(user_id, comment_id) 
        WHERE comment_id IS NOT NULL AND post_id IS NULL;
    `;
    await pool.query(query);
    console.log('✅ Reactions table initialized');
  } catch (error) {
    console.error('❌ Error initializing reactions table:', error.message);
    throw error;
  }
};

// Create reaction
const create = async (reactionData) => {
  const client = await pool.connect();
  try {
    const userId = reactionData.user_id;
    
    // Validate userId is present and not null/undefined
    if (userId === null || userId === undefined) {
      throw new Error('user_id is required');
    }
    
    const postId = reactionData.post_id || null;
    const commentId = reactionData.comment_id || null;
    const reactionType = reactionData.reaction_type || 'like';
    
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    
    // Two-step upsert to handle NULL values properly
    // First try UPDATE
    let query, result;
    
    if (postId) {
      query = `
        UPDATE reactions
        SET reaction_type = $1
        WHERE user_id = $2 AND post_id = $3 AND comment_id IS NULL
        RETURNING *
      `;
      result = await client.query(query, [reactionType, userId, postId]);
    } else if (commentId) {
      query = `
        UPDATE reactions
        SET reaction_type = $1
        WHERE user_id = $2 AND comment_id = $3 AND post_id IS NULL
        RETURNING *
      `;
      result = await client.query(query, [reactionType, userId, commentId]);
    } else {
      await client.query('ROLLBACK');
      throw new Error('Either post_id or comment_id must be provided');
    }
    
    // If UPDATE didn't find a row, INSERT
    if (result.rows.length === 0) {
      query = `
        INSERT INTO reactions (user_id, post_id, comment_id, reaction_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      result = await client.query(query, [userId, postId, commentId, reactionType]);
    }
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating reaction:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Remove reaction
const remove = async (userId, postId = null, commentId = null) => {
  try {
    // Validate userId is present and not null/undefined
    if (userId === null || userId === undefined) {
      throw new Error('user_id is required');
    }
    
    // Validate that at least one of postId or commentId is provided
    if (!postId && !commentId) {
      throw new Error('Either postId or commentId must be provided');
    }
    
    let query = 'DELETE FROM reactions WHERE user_id = $1';
    const params = [userId];
    
    if (postId) {
      query += ' AND post_id = $2';
      params.push(postId);
    } else if (commentId) {
      query += ' AND comment_id = $2';
      params.push(commentId);
    }
    
    query += ' RETURNING *';
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error removing reaction:', error.message);
    throw error;
  }
};

// Find reaction
const findReaction = async (userId, postId = null, commentId = null) => {
  try {
    // Validate userId is present
    if (userId === null || userId === undefined) {
      return null;
    }
    
    // Validate that exactly one of postId or commentId is provided
    const hasPostId = postId !== null && postId !== undefined;
    const hasCommentId = commentId !== null && commentId !== undefined;
    
    if (!hasPostId && !hasCommentId) {
      return null;
    }
    
    if (hasPostId && hasCommentId) {
      return null;
    }
    
    // Build query based on which ID is provided
    let query = 'SELECT * FROM reactions WHERE user_id = $1';
    const params = [userId];
    
    if (hasPostId) {
      query += ' AND post_id = $2';
      params.push(postId);
    } else if (hasCommentId) {
      query += ' AND comment_id = $2';
      params.push(commentId);
    }
    
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding reaction:', error.message);
    throw error;
  }
};

// Find reactions by post ID
const findByPostId = async (postId) => {
  try {
    const query = `
      SELECT r.*, u.first_name, u.last_name, u.profile_image_url
      FROM reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.post_id = $1
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query, [postId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding reactions by post ID:', error.message);
    throw error;
  }
};

// Find reactions by comment ID
const findByCommentId = async (commentId) => {
  try {
    const query = `
      SELECT r.*, u.first_name, u.last_name, u.profile_image_url
      FROM reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.comment_id = $1
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query, [commentId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding reactions by comment ID:', error.message);
    throw error;
  }
};

module.exports = {
  initializeReactionsTable,
  create,
  remove,
  findReaction,
  findByPostId,
  findByCommentId,
};
