// Post model - User posts/content (medical discussions, case studies, updates, articles)
const { pool } = require('../config/database');
const logger = require('../utils/logger');

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
        upvotes_count INTEGER DEFAULT 0,
        downvotes_count INTEGER DEFAULT 0,
        score INTEGER DEFAULT 0,
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
    
    // Add new columns if they don't exist (migration)
    try {
      await pool.query(`
        ALTER TABLE posts 
        ADD COLUMN IF NOT EXISTS upvotes_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS downvotes_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
      `);
      
      // Update score for existing posts
      await pool.query(`
        UPDATE posts 
        SET score = COALESCE(upvotes_count, 0) - COALESCE(downvotes_count, 0)
        WHERE score IS NULL OR score != (COALESCE(upvotes_count, 0) - COALESCE(downvotes_count, 0));
      `);
    } catch (migrationError) {
      // Columns might already exist, ignore
      console.log('Migration note: Vote columns may already exist');
    }
    
    console.log('✅ Posts table initialized');
  } catch (error) {
    console.error('❌ Error initializing posts table:', error.message);
    throw error;
  }
};

// Create post
const create = async (postData, client = null) => {
  try {
    const queryClient = client || pool;
    const query = `
      INSERT INTO posts (
        user_id, content, post_type, visibility, parent_post_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await queryClient.query(query, [
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
const incrementComments = async (id, increment = 1, client = null) => {
  try {
    // Validate increment is an integer
    if (!Number.isInteger(increment)) {
      throw new Error('increment must be an integer');
    }
    
    const queryClient = client || pool;
    const query = `
      UPDATE posts
      SET comments_count = GREATEST(comments_count + $1, 0), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await queryClient.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing comments:', error.message);
    throw error;
  }
};

// Increment shares count
const incrementShares = async (id, increment = 1, client = null) => {
  try {
    // Validate increment is an integer
    if (!Number.isInteger(increment)) {
      throw new Error('increment must be an integer');
    }
    
    const queryClient = client || pool;
    const query = `
      UPDATE posts
      SET shares_count = GREATEST(shares_count + $1, 0), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await queryClient.query(query, [increment, id]);
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

// Increment upvotes count and update score
const incrementUpvotes = async (id, increment = 1, client = null) => {
  try {
    const queryClient = client || pool;
    const query = `
      UPDATE posts
      SET upvotes_count = GREATEST(upvotes_count + $1, 0),
          score = GREATEST(upvotes_count + $1, 0) - GREATEST(downvotes_count, 0),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await queryClient.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing upvotes:', error.message);
    throw error;
  }
};

// Increment downvotes count and update score
const incrementDownvotes = async (id, increment = 1, client = null) => {
  try {
    const queryClient = client || pool;
    const query = `
      UPDATE posts
      SET downvotes_count = GREATEST(downvotes_count + $1, 0),
          score = GREATEST(upvotes_count, 0) - GREATEST(downvotes_count + $1, 0),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await queryClient.query(query, [increment, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error incrementing downvotes:', error.message);
    throw error;
  }
};

// Find original post when given a repost ID
const findOriginalPost = async (repostId) => {
  try {
    const query = `
      SELECT op.*, ou.first_name, ou.last_name, ou.profile_image_url, ou.headline
      FROM posts rp
      JOIN posts op ON rp.parent_post_id = op.id
      JOIN users ou ON op.user_id = ou.id
      WHERE rp.id = $1
    `;
    const result = await pool.query(query, [repostId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding original post:', error.message);
    throw error;
  }
};

// Find reposts of a specific post
const findByRepostId = async (originalPostId, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT p.*, u.first_name, u.last_name, u.profile_image_url, u.headline
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.parent_post_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [originalPostId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error('Error finding reposts:', error.message);
    throw error;
  }
};

// Check if user has reposted a post
const hasReposted = async (userId, originalPostId) => {
  try {
    const query = `
      SELECT * FROM posts
      WHERE user_id = $1 AND parent_post_id = $2
    `;
    const result = await pool.query(query, [userId, originalPostId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error checking if user has reposted:', error.message);
    throw error;
  }
};

// Find feed posts with sorting (includes reposts with original post data)
// Optimized query with better JOIN strategies and query time logging
const findFeedSorted = async (userId, sortBy = 'new', limit = 20, offset = 0) => {
  const startTime = Date.now();
  try {
    let orderClause = 'p.created_at DESC';
    
    switch (sortBy) {
      case 'best':
      case 'top':
        orderClause = 'p.score DESC, p.created_at DESC';
        break;
      case 'hot':
        // Hot algorithm: score / (hours_since_post + 2)^1.5
        orderClause = `(p.score::FLOAT / POWER(EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 + 2, 1.5)) DESC`;
        break;
      case 'new':
      default:
        orderClause = 'p.created_at DESC';
        break;
    }
    
    // Optimized query: Use EXISTS for connection checks (faster than LEFT JOIN + IS NOT NULL)
    // Pre-filter posts by visibility before joining to reduce dataset size
    const query = `
      WITH visible_posts AS (
        SELECT DISTINCT p.id
        FROM posts p
        WHERE p.parent_post_id IS NULL
          AND (
            p.user_id = $1
            OR p.visibility = 'public'
            OR (
              p.visibility = 'connections' AND EXISTS (
                SELECT 1 FROM connections c
                WHERE (
                  (c.requester_id = $1 AND c.addressee_id = p.user_id) OR
                  (c.requester_id = p.user_id AND c.addressee_id = $1)
                ) AND c.status = 'connected'
              )
            )
          )
        UNION
        SELECT DISTINCT p.id
        FROM posts p
        INNER JOIN posts op ON p.parent_post_id = op.id
        WHERE p.parent_post_id IS NOT NULL
          AND (
            p.user_id = $1
            OR p.visibility = 'public'
            OR (
              p.visibility = 'connections' AND EXISTS (
                SELECT 1 FROM connections c
                WHERE (
                  (c.requester_id = $1 AND c.addressee_id = p.user_id) OR
                  (c.requester_id = p.user_id AND c.addressee_id = $1)
                ) AND c.status = 'connected'
              )
            )
          )
          AND (
            op.visibility = 'public'
            OR (
              op.visibility = 'connections' AND EXISTS (
                SELECT 1 FROM connections oc
                WHERE (
                  (oc.requester_id = $1 AND oc.addressee_id = op.user_id) OR
                  (oc.requester_id = op.user_id AND oc.addressee_id = $1)
                ) AND oc.status = 'connected'
              )
            )
          )
      )
      SELECT 
        p.*, 
        u.first_name, 
        u.last_name, 
        u.profile_image_url, 
        u.headline,
        -- Original post data for reposts
        op.id as original_post_id,
        op.content as original_content,
        op.user_id as original_user_id,
        op.created_at as original_created_at,
        ou.first_name as original_first_name,
        ou.last_name as original_last_name,
        ou.profile_image_url as original_profile_image_url,
        ou.headline as original_headline
      FROM visible_posts vp
      INNER JOIN posts p ON vp.id = p.id
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN posts op ON p.parent_post_id = op.id
      LEFT JOIN users ou ON op.user_id = ou.id
      ORDER BY ${orderClause}
      LIMIT $2 OFFSET $3
    `;
    
    const result = await pool.query(query, [userId, limit, offset]);
    const duration = Date.now() - startTime;
    
    // Log slow queries (over 500ms)
    if (duration > 500) {
      logger.warn('Slow feed query detected', {
        userId,
        sortBy,
        limit,
        offset,
        duration: `${duration}ms`,
        rowCount: result.rows.length,
      });
    } else if (process.env.LOG_LEVEL === 'debug') {
      logger.logDatabaseQuery(query.substring(0, 200), duration, { userId, sortBy, limit, offset });
    }
    
    return result.rows;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logError(error, {
      context: 'findFeedSorted',
      userId,
      sortBy,
      limit,
      offset,
      duration: `${duration}ms`,
    });
    throw error;
  }
};

// Delete post
const remove = async (id, client = null) => {
  try {
    const queryClient = client || pool;
    const query = 'DELETE FROM posts WHERE id = $1 RETURNING *';
    const result = await queryClient.query(query, [id]);
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
  findFeedSorted,
  findOriginalPost,
  findByRepostId,
  hasReposted,
  update,
  incrementLikes,
  incrementUpvotes,
  incrementDownvotes,
  incrementComments,
  incrementShares,
  incrementViews,
  remove,
};
