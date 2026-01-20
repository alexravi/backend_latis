// PostgreSQL full-text search service
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Search users by name, headline, or specialization
 */
const searchUsers = async (query, limit = 20, offset = 0) => {
  try {
    const searchQuery = `
      SELECT 
        id,
        first_name,
        last_name,
        headline,
        profile_image_url,
        specialization,
        location,
        ts_rank(
          to_tsvector('english', 
            COALESCE(first_name, '') || ' ' || 
            COALESCE(last_name, '') || ' ' || 
            COALESCE(headline, '') || ' ' || 
            COALESCE(specialization, '')
          ),
          plainto_tsquery('english', $1)
        ) as rank
      FROM users
      WHERE 
        is_active = TRUE
        AND (
          to_tsvector('english', 
            COALESCE(first_name, '') || ' ' || 
            COALESCE(last_name, '') || ' ' || 
            COALESCE(headline, '') || ' ' || 
            COALESCE(specialization, '')
          ) @@ plainto_tsquery('english', $1)
          OR first_name ILIKE $2
          OR last_name ILIKE $2
          OR headline ILIKE $2
          OR specialization ILIKE $2
        )
      ORDER BY rank DESC, first_name, last_name
      LIMIT $3 OFFSET $4
    `;
    
    const searchTerm = `%${query}%`;
    const result = await pool.query(searchQuery, [query, searchTerm, limit, offset]);
    
    return result.rows;
  } catch (error) {
    logger.logError(error, { context: 'searchUsers', query });
    throw error;
  }
};

/**
 * Search posts by content
 */
const searchPosts = async (query, limit = 20, offset = 0, userId = null) => {
  try {
    let searchQuery = `
      SELECT 
        p.id,
        p.user_id,
        p.content,
        p.post_type,
        p.created_at,
        p.score,
        p.comments_count,
        u.first_name,
        u.last_name,
        u.profile_image_url,
        ts_rank(
          to_tsvector('english', p.content),
          plainto_tsquery('english', $1)
        ) as rank
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE 
        p.parent_post_id IS NULL
        AND (
          to_tsvector('english', p.content) @@ plainto_tsquery('english', $1)
          OR p.content ILIKE $2
        )
    `;
    
    const params = [query, `%${query}%`];
    let paramCount = 3;
    
    // Add visibility filter if userId provided
    if (userId) {
      searchQuery += `
        AND (
          p.visibility = 'public'
          OR p.user_id = $${paramCount}
          OR EXISTS (
            SELECT 1 FROM connections c
            WHERE (
              (c.requester_id = $${paramCount} AND c.addressee_id = p.user_id) OR
              (c.requester_id = p.user_id AND c.addressee_id = $${paramCount})
            ) AND c.status = 'connected' AND p.visibility = 'connections'
          )
        )
      `;
      params.push(userId);
      paramCount++;
    } else {
      searchQuery += ` AND p.visibility = 'public'`;
    }
    
    searchQuery += `
      ORDER BY rank DESC, p.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);
    
    const result = await pool.query(searchQuery, params);
    return result.rows;
  } catch (error) {
    logger.logError(error, { context: 'searchPosts', query });
    throw error;
  }
};

/**
 * Search job postings
 */
const searchJobPostings = async (query, filters = {}, limit = 20, offset = 0) => {
  try {
    let searchQuery = `
      SELECT 
        jp.*,
        mo.name as organization_name,
        mo.logo_url as organization_logo,
        ts_rank(
          to_tsvector('english', 
            COALESCE(jp.title, '') || ' ' || 
            COALESCE(jp.description, '') || ' ' || 
            COALESCE(jp.specialty, '') || ' ' || 
            COALESCE(jp.location, '')
          ),
          plainto_tsquery('english', $1)
        ) as rank
      FROM job_postings jp
      LEFT JOIN medical_organizations mo ON jp.organization_id = mo.id
      WHERE 
        jp.is_active = TRUE
        AND (
          to_tsvector('english', 
            COALESCE(jp.title, '') || ' ' || 
            COALESCE(jp.description, '') || ' ' || 
            COALESCE(jp.specialty, '') || ' ' || 
            COALESCE(jp.location, '')
          ) @@ plainto_tsquery('english', $1)
          OR jp.title ILIKE $2
          OR jp.description ILIKE $2
          OR jp.specialty ILIKE $2
        )
    `;
    
    const params = [query, `%${query}%`];
    let paramCount = 3;
    
    // Add filters
    if (filters.specialty) {
      searchQuery += ` AND jp.specialty = $${paramCount}`;
      params.push(filters.specialty);
      paramCount++;
    }
    
    if (filters.job_type) {
      searchQuery += ` AND jp.job_type = $${paramCount}`;
      params.push(filters.job_type);
      paramCount++;
    }
    
    if (filters.location) {
      searchQuery += ` AND (jp.location ILIKE $${paramCount} OR jp.city ILIKE $${paramCount} OR jp.state ILIKE $${paramCount})`;
      params.push(`%${filters.location}%`);
      paramCount++;
    }
    
    if (filters.is_remote !== undefined) {
      searchQuery += ` AND jp.is_remote = $${paramCount}`;
      params.push(filters.is_remote);
      paramCount++;
    }
    
    searchQuery += `
      ORDER BY rank DESC, jp.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);
    
    const result = await pool.query(searchQuery, params);
    return result.rows;
  } catch (error) {
    logger.logError(error, { context: 'searchJobPostings', query, filters });
    throw error;
  }
};

/**
 * Universal search (searches across users, posts, and jobs)
 */
const universalSearch = async (query, limit = 10, offset = 0, userId = null) => {
  try {
    const [users, posts, jobs] = await Promise.all([
      searchUsers(query, Math.ceil(limit / 3), offset),
      searchPosts(query, Math.ceil(limit / 3), offset, userId),
      searchJobPostings(query, {}, Math.ceil(limit / 3), offset),
    ]);
    
    return {
      users: users.slice(0, Math.ceil(limit / 3)),
      posts: posts.slice(0, Math.ceil(limit / 3)),
      jobs: jobs.slice(0, Math.ceil(limit / 3)),
      total: users.length + posts.length + jobs.length,
    };
  } catch (error) {
    logger.logError(error, { context: 'universalSearch', query });
    throw error;
  }
};

module.exports = {
  searchUsers,
  searchPosts,
  searchJobPostings,
  universalSearch,
};
