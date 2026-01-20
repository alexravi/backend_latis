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
        upvotes_count INTEGER DEFAULT 0,
        downvotes_count INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
        replies_count INTEGER DEFAULT 0,
        is_edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    
    // Add new columns if they don't exist (migration)
    try {
      await pool.query(`
        ALTER TABLE comments 
        ADD COLUMN IF NOT EXISTS upvotes_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS downvotes_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
      `);
      
      // Update score for existing comments
      await pool.query(`
        UPDATE comments 
        SET score = COALESCE(upvotes_count, 0) - COALESCE(downvotes_count, 0)
        WHERE score IS NULL OR score != (COALESCE(upvotes_count, 0) - COALESCE(downvotes_count, 0));
      `);
    } catch (migrationError) {
      // Columns might already exist, ignore
      console.log('Migration note: Vote columns may already exist');
    }
    
    console.log('✅ Comments table initialized');
  } catch (error) {
    console.error('❌ Error initializing comments table:', error.message);
    throw error;
  }
};

// Create comment
const create = async (commentData, options = {}) => {
  try {
    const queryClient = options.client || options.transaction || pool;
    const query = `
      INSERT INTO comments (post_id, user_id, content, parent_comment_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await queryClient.query(query, [
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
const incrementReplies = async (id, increment = 1, client = null) => {
  try {
    const queryClient = client || pool;
    const query = `
      UPDATE comments
      SET replies_count = GREATEST(replies_count + $1, 0), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await queryClient.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing comment replies:', error.message);
    throw error;
  }
};

// Increment upvotes count and update score
const incrementUpvotes = async (id, increment = 1, client = null) => {
  try {
    const queryClient = client || pool;
    const query = `
      UPDATE comments
      SET upvotes_count = GREATEST(upvotes_count + $1, 0),
          score = GREATEST(upvotes_count + $1, 0) - GREATEST(downvotes_count, 0),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await queryClient.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing comment upvotes:', error.message);
    throw error;
  }
};

// Increment downvotes count and update score
const incrementDownvotes = async (id, increment = 1, client = null) => {
  try {
    const queryClient = client || pool;
    const query = `
      UPDATE comments
      SET downvotes_count = GREATEST(downvotes_count + $1, 0),
          score = GREATEST(upvotes_count, 0) - GREATEST(downvotes_count + $1, 0),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await queryClient.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing comment downvotes:', error.message);
    throw error;
  }
};

// Calculate Wilson score confidence interval (Reddit's "best" algorithm)
// This prevents comments with few votes from ranking above well-voted comments
const calculateWilsonScore = (upvotes, downvotes) => {
  const n = upvotes + downvotes;
  if (n === 0) return 0;
  
  const z = 1.96; // 95% confidence interval
  const p = upvotes / n;
  
  const numerator = p + (z * z) / (2 * n);
  const denominator = 1 + (z * z) / n;
  const score = numerator / denominator;
  
  const correction = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denominator;
  
  return score - correction;
};

// Find comments by post ID with "best" sorting (Reddit's algorithm)
const findByPostIdSorted = async (postId, sortBy = 'best', limit = 50, offset = 0) => {
  try {
    let orderClause = 'c.created_at ASC';
    
    if (sortBy === 'best') {
      // Use Wilson score for best sorting
      orderClause = `
        (CASE 
          WHEN (c.upvotes_count + c.downvotes_count) = 0 THEN 0
          ELSE (
            (c.upvotes_count::FLOAT / NULLIF(c.upvotes_count + c.downvotes_count, 0) + 1.96 * 1.96 / (2 * NULLIF(c.upvotes_count + c.downvotes_count, 0))) / 
            (1 + 1.96 * 1.96 / NULLIF(c.upvotes_count + c.downvotes_count, 0)) -
            1.96 * SQRT((c.upvotes_count::FLOAT / NULLIF(c.upvotes_count + c.downvotes_count, 0) * 
            (1 - c.upvotes_count::FLOAT / NULLIF(c.upvotes_count + c.downvotes_count, 0)) + 
            1.96 * 1.96 / (4 * NULLIF(c.upvotes_count + c.downvotes_count, 0))) / 
            NULLIF(c.upvotes_count + c.downvotes_count, 0)) / 
            (1 + 1.96 * 1.96 / NULLIF(c.upvotes_count + c.downvotes_count, 0))
          )
        END) DESC, c.created_at DESC
      `;
    } else if (sortBy === 'top') {
      orderClause = 'c.score DESC, c.created_at DESC';
    } else if (sortBy === 'new') {
      orderClause = 'c.created_at DESC';
    }
    
    const query = `
      SELECT c.*, u.first_name, u.last_name, u.profile_image_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
      ORDER BY ${orderClause}
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [postId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding comments by post ID:', error.message);
    throw error;
  }
};

// Find replies with sorting
const findRepliesSorted = async (commentId, sortBy = 'best', limit = 20, offset = 0) => {
  try {
    let orderClause = 'c.created_at ASC';
    
    if (sortBy === 'best') {
      orderClause = `
        (CASE 
          WHEN (c.upvotes_count + c.downvotes_count) = 0 THEN 0
          ELSE (
            (c.upvotes_count::FLOAT / NULLIF(c.upvotes_count + c.downvotes_count, 0) + 1.96 * 1.96 / (2 * NULLIF(c.upvotes_count + c.downvotes_count, 0))) / 
            (1 + 1.96 * 1.96 / NULLIF(c.upvotes_count + c.downvotes_count, 0)) -
            1.96 * SQRT((c.upvotes_count::FLOAT / NULLIF(c.upvotes_count + c.downvotes_count, 0) * 
            (1 - c.upvotes_count::FLOAT / NULLIF(c.upvotes_count + c.downvotes_count, 0)) + 
            1.96 * 1.96 / (4 * NULLIF(c.upvotes_count + c.downvotes_count, 0))) / 
            NULLIF(c.upvotes_count + c.downvotes_count, 0)) / 
            (1 + 1.96 * 1.96 / NULLIF(c.upvotes_count + c.downvotes_count, 0))
          )
        END) DESC, c.created_at DESC
      `;
    } else if (sortBy === 'top') {
      orderClause = 'c.score DESC, c.created_at DESC';
    } else if (sortBy === 'new') {
      orderClause = 'c.created_at DESC';
    }
    
    const query = `
      SELECT c.*, u.first_name, u.last_name, u.profile_image_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.parent_comment_id = $1
      ORDER BY ${orderClause}
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [commentId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding comment replies:', error.message);
    throw error;
  }
};

// Find all comments for a post (including all nested replies)
const findAllByPostId = async (postId) => {
  try {
    const query = `
      SELECT c.*, u.first_name, u.last_name, u.profile_image_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `;
    const result = await pool.query(query, [postId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding all comments by post ID:', error.message);
    throw error;
  }
};

// Build comment tree recursively (unlimited depth)
const buildCommentTree = (comments, parentId = null, sortBy = 'best') => {
  // Filter comments by parent
  const filtered = comments.filter(c => {
    if (parentId === null) {
      return c.parent_comment_id === null;
    }
    return c.parent_comment_id === parentId;
  });

  // Sort comments based on sortBy
  const sorted = filtered.sort((a, b) => {
    switch (sortBy) {
      case 'best':
        // Use Wilson score if available, otherwise use score
        const scoreA = calculateWilsonScore(a.upvotes_count || 0, a.downvotes_count || 0);
        const scoreB = calculateWilsonScore(b.upvotes_count || 0, b.downvotes_count || 0);
        if (Math.abs(scoreA - scoreB) < 0.0001) {
          return new Date(b.created_at) - new Date(a.created_at);
        }
        return scoreB - scoreA;
      case 'top':
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        return new Date(b.created_at) - new Date(a.created_at);
      case 'new':
      default:
        return new Date(b.created_at) - new Date(a.created_at);
    }
  });

  // Recursively build tree for each comment
  return sorted.map(comment => ({
    ...comment,
    replies: buildCommentTree(comments, comment.id, sortBy),
  }));
};

// Find comments by post ID with nested tree structure
const findByPostIdTree = async (postId, sortBy = 'best') => {
  try {
    // Fetch all comments for the post at once
    const allComments = await findAllByPostId(postId);
    
    // Build tree structure
    const tree = buildCommentTree(allComments, null, sortBy);
    
    return tree;
  } catch (error) {
    console.error('Error building comment tree:', error.message);
    throw error;
  }
};

// Find comment tree starting from a specific comment
const findCommentTree = async (commentId, sortBy = 'best') => {
  try {
    // Get the comment
    const comment = await findById(commentId);
    if (!comment) {
      return null;
    }

    // Get all comments for the same post
    const allComments = await findAllByPostId(comment.post_id);
    
    // Build tree starting from this comment
    const tree = {
      ...comment,
      replies: buildCommentTree([...allComments], commentId, sortBy),
    };

    return tree;
  } catch (error) {
    console.error('Error building comment tree:', error.message);
    throw error;
  }
};

// Delete comment
const remove = async (id, client = null) => {
  try {
    const queryClient = client || pool;
    const query = 'DELETE FROM comments WHERE id = $1 RETURNING *';
    const result = await queryClient.query(query, [id]);
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
  findByPostIdSorted,
  findByPostIdTree,
  findAllByPostId,
  findCommentTree,
  buildCommentTree,
  findReplies,
  findRepliesSorted,
  update,
  incrementLikes,
  incrementUpvotes,
  incrementDownvotes,
  incrementReplies,
  calculateWilsonScore,
  remove,
};
