// Reaction model - Upvotes and downvotes on posts and comments (Reddit-style)
const { pool } = require('../config/database');
const Post = require('./Post');
const Comment = require('./Comment');

// Initialize reactions table
const initializeReactionsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        reaction_type VARCHAR(50) DEFAULT 'upvote',
        created_at TIMESTAMP DEFAULT NOW(),
        CHECK (
          (post_id IS NOT NULL AND comment_id IS NULL) OR
          (post_id IS NULL AND comment_id IS NOT NULL)
        ),
        CHECK (reaction_type IN ('upvote', 'downvote'))
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

// Create or update reaction (handle vote toggling)
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
    let reactionType = reactionData.reaction_type || 'upvote';
    
    // Validate reaction type
    if (reactionType !== 'upvote' && reactionType !== 'downvote') {
      throw new Error('reaction_type must be either "upvote" or "downvote"');
    }
    
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    
    // Find existing reaction
    let existingQuery, existingResult;
    if (postId) {
      existingQuery = `
        SELECT * FROM reactions
        WHERE user_id = $1 AND post_id = $2 AND comment_id IS NULL
      `;
      existingResult = await client.query(existingQuery, [userId, postId]);
    } else if (commentId) {
      existingQuery = `
        SELECT * FROM reactions
        WHERE user_id = $1 AND comment_id = $2 AND post_id IS NULL
      `;
      existingResult = await client.query(existingQuery, [userId, commentId]);
    } else {
      await client.query('ROLLBACK');
      throw new Error('Either post_id or comment_id must be provided');
    }
    
    const existingReaction = existingResult.rows[0];
    
    // Handle vote toggling logic
    if (existingReaction) {
      if (existingReaction.reaction_type === reactionType) {
        // Same vote - remove it
        await client.query('ROLLBACK');
        return await remove(userId, postId, commentId);
      } else {
        // Different vote - toggle it
        const updateQuery = `
          UPDATE reactions
          SET reaction_type = $1
          WHERE id = $2
          RETURNING *
        `;
        const updateResult = await client.query(updateQuery, [reactionType, existingReaction.id]);
        
        // Update vote counts using transaction client
        if (postId) {
          const oldType = existingReaction.reaction_type;
          if (oldType === 'upvote') {
            await Post.incrementUpvotes(postId, -1, client);
          } else {
            await Post.incrementDownvotes(postId, -1, client);
          }
          if (reactionType === 'upvote') {
            await Post.incrementUpvotes(postId, 1, client);
          } else {
            await Post.incrementDownvotes(postId, 1, client);
          }
        } else if (commentId) {
          const oldType = existingReaction.reaction_type;
          if (oldType === 'upvote') {
            await Comment.incrementUpvotes(commentId, -1, client);
          } else {
            await Comment.incrementDownvotes(commentId, -1, client);
          }
          if (reactionType === 'upvote') {
            await Comment.incrementUpvotes(commentId, 1, client);
          } else {
            await Comment.incrementDownvotes(commentId, 1, client);
          }
        }
        
        await client.query('COMMIT');
        return updateResult.rows[0];
      }
    } else {
      // New reaction - insert it
      const insertQuery = `
        INSERT INTO reactions (user_id, post_id, comment_id, reaction_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const insertResult = await client.query(insertQuery, [userId, postId, commentId, reactionType]);
      
      // Update vote counts using transaction client
      if (postId) {
        if (reactionType === 'upvote') {
          await Post.incrementUpvotes(postId, 1, client);
        } else {
          await Post.incrementDownvotes(postId, 1, client);
        }
      } else if (commentId) {
        if (reactionType === 'upvote') {
          await Comment.incrementUpvotes(commentId, 1, client);
        } else {
          await Comment.incrementDownvotes(commentId, 1, client);
        }
      }
      
      await client.query('COMMIT');
      return insertResult.rows[0];
    }
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
  const client = await pool.connect();
  try {
    // Validate userId is present and not null/undefined
    if (userId === null || userId === undefined) {
      throw new Error('user_id is required');
    }
    
    // Validate that at least one of postId or commentId is provided
    if (!postId && !commentId) {
      throw new Error('Either postId or commentId must be provided');
    }
    
    await client.query('BEGIN');
    
    // Get the reaction first to know what type it was
    let query = 'SELECT * FROM reactions WHERE user_id = $1';
    const params = [userId];
    
    if (postId) {
      query += ' AND post_id = $2 AND comment_id IS NULL';
      params.push(postId);
    } else if (commentId) {
      query += ' AND comment_id = $2 AND post_id IS NULL';
      params.push(commentId);
    }
    
    const selectResult = await client.query(query, params);
    const reaction = selectResult.rows[0];
    
    if (!reaction) {
      await client.query('ROLLBACK');
      return null;
    }
    
    // Delete the reaction
    let deleteQuery = 'DELETE FROM reactions WHERE user_id = $1';
    const deleteParams = [userId];
    
    if (postId) {
      deleteQuery += ' AND post_id = $2 AND comment_id IS NULL';
      deleteParams.push(postId);
    } else if (commentId) {
      deleteQuery += ' AND comment_id = $2 AND post_id IS NULL';
      deleteParams.push(commentId);
    }
    
    deleteQuery += ' RETURNING *';
    const deleteResult = await client.query(deleteQuery, deleteParams);
    
    // Update vote counts using transaction client
    if (reaction.reaction_type === 'upvote') {
      if (postId) {
        await Post.incrementUpvotes(postId, -1, client);
      } else if (commentId) {
        await Comment.incrementUpvotes(commentId, -1, client);
      }
    } else if (reaction.reaction_type === 'downvote') {
      if (postId) {
        await Post.incrementDownvotes(postId, -1, client);
      } else if (commentId) {
        await Comment.incrementDownvotes(commentId, -1, client);
      }
    }
    
    await client.query('COMMIT');
    return deleteResult.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error removing reaction:', error.message);
    throw error;
  } finally {
    client.release();
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

// Find reactions by user and post IDs (batch)
const findReactionsByPostIds = async (userId, postIds) => {
  try {
    if (!postIds || postIds.length === 0) {
      return [];
    }
    const query = `
      SELECT * FROM reactions
      WHERE user_id = $1 AND post_id = ANY($2::integer[]) AND comment_id IS NULL
    `;
    const result = await pool.query(query, [userId, postIds]);
    return result.rows;
  } catch (error) {
    console.error('Error finding reactions by post IDs:', error.message);
    throw error;
  }
};

// Find reactions by user and comment IDs (batch)
const findReactionsByCommentIds = async (userId, commentIds) => {
  try {
    if (!commentIds || commentIds.length === 0) {
      return [];
    }
    const query = `
      SELECT * FROM reactions
      WHERE user_id = $1 AND comment_id = ANY($2::integer[]) AND post_id IS NULL
    `;
    const result = await pool.query(query, [userId, commentIds]);
    return result.rows;
  } catch (error) {
    console.error('Error finding reactions by comment IDs:', error.message);
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
  findReactionsByPostIds,
  findReactionsByCommentIds,
};
