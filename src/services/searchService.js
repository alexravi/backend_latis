// PostgreSQL full-text search service
const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Search users by name, headline, or specialization
 * Enhanced with connection/follower counts, filters, and improved ranking
 */
const searchUsers = async (query, limit = 20, offset = 0, filters = {}) => {
  try {
    let searchQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.headline,
        u.profile_image_url,
        u.specialization,
        u.location,
        u.current_role,
        u.is_verified,
        (
          SELECT COUNT(*)
          FROM connections c
          WHERE (c.requester_id = u.id OR c.addressee_id = u.id)
            AND c.status = 'connected'
        ) as connection_count,
        (
          SELECT COUNT(*)
          FROM follows f
          WHERE f.following_id = u.id
        ) as follower_count,
        ts_rank(
          to_tsvector('english', 
            COALESCE(u.first_name, '') || ' ' || 
            COALESCE(u.last_name, '') || ' ' || 
            COALESCE(u.headline, '') || ' ' || 
            COALESCE(u.specialization, '') || ' ' ||
            COALESCE(u.current_role, '')
          ),
          plainto_tsquery('english', $1)
        ) as text_rank,
        CASE 
          WHEN LOWER(u.first_name || ' ' || u.last_name) = LOWER($1) THEN 10
          WHEN LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($2) THEN 5
          ELSE 1
        END as exact_match_boost
      FROM users u
      WHERE 
        u.is_active = TRUE
        AND (
          to_tsvector('english', 
            COALESCE(u.first_name, '') || ' ' || 
            COALESCE(u.last_name, '') || ' ' || 
            COALESCE(u.headline, '') || ' ' || 
            COALESCE(u.specialization, '') || ' ' ||
            COALESCE(u.current_role, '')
          ) @@ plainto_tsquery('english', $1)
          OR u.first_name ILIKE $3
          OR u.last_name ILIKE $3
          OR u.headline ILIKE $3
          OR u.specialization ILIKE $3
          OR u.current_role ILIKE $3
        )
    `;
    
    const params = [query, query, `%${query}%`];
    let paramCount = 4;
    
    // Add filters
    if (filters.location) {
      searchQuery += ` AND u.location ILIKE $${paramCount}`;
      params.push(`%${filters.location}%`);
      paramCount++;
    }
    
    if (filters.specialization) {
      searchQuery += ` AND u.specialization ILIKE $${paramCount}`;
      params.push(`%${filters.specialization}%`);
      paramCount++;
    }
    
    if (filters.current_role) {
      searchQuery += ` AND u.current_role ILIKE $${paramCount}`;
      params.push(`%${filters.current_role}%`);
      paramCount++;
    }
    
    // Enhanced ranking: combine text rank, popularity, verification, and exact matches
    searchQuery += `
      ORDER BY 
        (ts_rank(
          to_tsvector('english', 
            COALESCE(u.first_name, '') || ' ' || 
            COALESCE(u.last_name, '') || ' ' || 
            COALESCE(u.headline, '') || ' ' || 
            COALESCE(u.specialization, '') || ' ' ||
            COALESCE(u.current_role, '')
          ),
          plainto_tsquery('english', $1)
        ) * 
        CASE 
          WHEN LOWER(u.first_name || ' ' || u.last_name) = LOWER($1) THEN 10
          WHEN LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($2) THEN 5
          ELSE 1
        END * 
         (1 + CASE WHEN u.is_verified THEN 2 ELSE 0 END) *
         (1 + LN(1 + (
           SELECT COUNT(*) FROM connections c
           WHERE (c.requester_id = u.id OR c.addressee_id = u.id) AND c.status = 'connected'
         ) + (
           SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id
         ))) 
        ) DESC,
        u.first_name, 
        u.last_name
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);
    
    const result = await pool.query(searchQuery, params);
    
    // Convert counts to integers
    result.rows.forEach(row => {
      row.connection_count = parseInt(row.connection_count) || 0;
      row.follower_count = parseInt(row.follower_count) || 0;
    });
    
    return result.rows;
  } catch (error) {
    logger.logError(error, { context: 'searchUsers', query, filters });
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
 * Search organizations/companies
 */
const searchOrganizations = async (query, limit = 20, offset = 0, filters = {}) => {
  try {
    let searchQuery = `
      SELECT 
        id,
        name,
        organization_type,
        description,
        logo_url,
        location,
        city,
        state,
        country,
        employee_count,
        is_verified,
        specialties,
        ts_rank(
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(location, '')
          ),
          plainto_tsquery('english', $1)
        ) as text_rank,
        CASE 
          WHEN LOWER(name) = LOWER($1) THEN 10
          WHEN LOWER(name) LIKE LOWER($2) THEN 5
          ELSE 1
        END as exact_match_boost
      FROM medical_organizations
      WHERE 
        (
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(location, '')
          ) @@ plainto_tsquery('english', $1)
          OR name ILIKE $3
          OR description ILIKE $3
          OR location ILIKE $3
        )
    `;
    
    const params = [query, query, `%${query}%`];
    let paramCount = 4;
    
    // Add filters
    if (filters.organization_type) {
      searchQuery += ` AND organization_type = $${paramCount}`;
      params.push(filters.organization_type);
      paramCount++;
    }
    
    if (filters.location) {
      searchQuery += ` AND (location ILIKE $${paramCount} OR city ILIKE $${paramCount} OR state ILIKE $${paramCount})`;
      params.push(`%${filters.location}%`);
      paramCount++;
    }
    
    if (filters.specialty) {
      searchQuery += ` AND $${paramCount} = ANY(specialties)`;
      params.push(filters.specialty);
      paramCount++;
    }
    
    // Enhanced ranking: text rank, verification, employee count, exact matches
    searchQuery += `
      ORDER BY 
        (ts_rank(
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(location, '')
          ),
          plainto_tsquery('english', $1)
        ) * 
        CASE 
          WHEN LOWER(name) = LOWER($1) THEN 10
          WHEN LOWER(name) LIKE LOWER($2) THEN 5
          ELSE 1
        END * 
         (1 + CASE WHEN is_verified THEN 2 ELSE 0 END) *
         (1 + LN(1 + COALESCE(employee_count, 0)))
        ) DESC,
        name ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);
    
    const result = await pool.query(searchQuery, params);
    return result.rows;
  } catch (error) {
    logger.logError(error, { context: 'searchOrganizations', query, filters });
    throw error;
  }
};

/**
 * Search colleges/universities from both medical_education and medical_organizations
 */
const searchColleges = async (query, limit = 20, offset = 0, filters = {}) => {
  try {
    // Search from medical_education (aggregated unique institutions)
    let educationQuery = `
      SELECT DISTINCT ON (institution_name)
        institution_name as name,
        institution_type,
        location,
        COUNT(DISTINCT user_id) as alumni_count,
        'education' as source,
        ts_rank(
          to_tsvector('english', 
            COALESCE(institution_name, '') || ' ' || 
            COALESCE(location, '')
          ),
          plainto_tsquery('english', $1)
        ) as text_rank,
        CASE 
          WHEN LOWER(institution_name) = LOWER($1) THEN 10
          WHEN LOWER(institution_name) LIKE LOWER($2) THEN 5
          ELSE 1
        END as exact_match_boost
      FROM medical_education
      WHERE 
        (
          to_tsvector('english', 
            COALESCE(institution_name, '') || ' ' || 
            COALESCE(location, '')
          ) @@ plainto_tsquery('english', $1)
          OR institution_name ILIKE $3
        )
    `;
    
    const eduParams = [query, query, `%${query}%`];
    let eduParamCount = 4;
    
    if (filters.location) {
      educationQuery += ` AND location ILIKE $${eduParamCount}`;
      eduParams.push(`%${filters.location}%`);
      eduParamCount++;
    }
    
    if (filters.institution_type) {
      educationQuery += ` AND institution_type = $${eduParamCount}`;
      eduParams.push(filters.institution_type);
      eduParamCount++;
    }
    
    educationQuery += `
      GROUP BY institution_name, institution_type, location
      ORDER BY institution_name, 
        ts_rank(
          to_tsvector('english', 
            COALESCE(institution_name, '') || ' ' || 
            COALESCE(location, '')
          ),
          plainto_tsquery('english', $1)
        ) DESC
    `;
    
    // Search from medical_organizations (where type indicates educational)
    let orgQuery = `
      SELECT 
        name,
        organization_type as institution_type,
        location,
        0 as alumni_count,
        'organization' as source,
        ts_rank(
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(location, '')
          ),
          plainto_tsquery('english', $1)
        ) as text_rank,
        CASE 
          WHEN LOWER(name) = LOWER($1) THEN 10
          WHEN LOWER(name) LIKE LOWER($2) THEN 5
          ELSE 1
        END as exact_match_boost
      FROM medical_organizations
      WHERE 
        organization_type IN ('Medical School', 'University', 'College', 'Educational Institution')
        AND (
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(location, '')
          ) @@ plainto_tsquery('english', $1)
          OR name ILIKE $3
        )
    `;
    
    const orgParams = [query, query, `%${query}%`];
    let orgParamCount = 4;
    
    if (filters.location) {
      orgQuery += ` AND (location ILIKE $${orgParamCount} OR city ILIKE $${orgParamCount})`;
      orgParams.push(`%${filters.location}%`);
      orgParamCount++;
    }
    
    // Execute both queries
    const [educationResults, orgResults] = await Promise.all([
      pool.query(educationQuery, eduParams),
      pool.query(orgQuery, orgParams),
    ]);
    
    // Combine and deduplicate results
    const combined = [];
    const seen = new Set();
    
    // Process education results
    educationResults.rows.forEach(row => {
      const key = row.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({
          name: row.name,
          institution_type: row.institution_type,
          location: row.location,
          alumni_count: parseInt(row.alumni_count) || 0,
          source: row.source,
          text_rank: row.text_rank,
          exact_match_boost: row.exact_match_boost,
        });
      }
    });
    
    // Process organization results
    orgResults.rows.forEach(row => {
      const key = row.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push({
          name: row.name,
          institution_type: row.institution_type,
          location: row.location,
          alumni_count: parseInt(row.alumni_count) || 0,
          source: row.source,
          text_rank: row.text_rank,
          exact_match_boost: row.exact_match_boost,
        });
      }
    });
    
    // Sort by ranking and limit
    combined.sort((a, b) => {
      const scoreA = a.text_rank * a.exact_match_boost * (1 + Math.log(1 + a.alumni_count));
      const scoreB = b.text_rank * b.exact_match_boost * (1 + Math.log(1 + b.alumni_count));
      return scoreB - scoreA;
    });
    
    // Apply pagination
    const paginated = combined.slice(offset, offset + limit);
    
    return paginated;
  } catch (error) {
    logger.logError(error, { context: 'searchColleges', query, filters });
    throw error;
  }
};

/**
 * Search groups
 */
const searchGroups = async (query, limit = 20, offset = 0, filters = {}) => {
  try {
    let searchQuery = `
      SELECT 
        id,
        name,
        description,
        group_type,
        specialty,
        logo_url,
        location,
        member_count,
        is_verified,
        ts_rank(
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(specialty, '')
          ),
          plainto_tsquery('english', $1)
        ) as text_rank,
        CASE 
          WHEN LOWER(name) = LOWER($1) THEN 10
          WHEN LOWER(name) LIKE LOWER($2) THEN 5
          ELSE 1
        END as exact_match_boost
      FROM medical_groups
      WHERE 
        (
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(specialty, '')
          ) @@ plainto_tsquery('english', $1)
          OR name ILIKE $3
          OR description ILIKE $3
        )
    `;
    
    const params = [query, query, `%${query}%`];
    let paramCount = 4;
    
    // Add filters
    if (filters.group_type) {
      searchQuery += ` AND group_type = $${paramCount}`;
      params.push(filters.group_type);
      paramCount++;
    }
    
    if (filters.specialty) {
      searchQuery += ` AND specialty = $${paramCount}`;
      params.push(filters.specialty);
      paramCount++;
    }
    
    if (filters.location) {
      searchQuery += ` AND location ILIKE $${paramCount}`;
      params.push(`%${filters.location}%`);
      paramCount++;
    }
    
    // Enhanced ranking: text rank, verification, member count, exact matches
    searchQuery += `
      ORDER BY 
        (ts_rank(
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '') || ' ' || 
            COALESCE(specialty, '')
          ),
          plainto_tsquery('english', $1)
        ) * 
        CASE 
          WHEN LOWER(name) = LOWER($1) THEN 10
          WHEN LOWER(name) LIKE LOWER($2) THEN 5
          ELSE 1
        END * 
         (1 + CASE WHEN is_verified THEN 2 ELSE 0 END) *
         (1 + LN(1 + COALESCE(member_count, 0)))
        ) DESC,
        name ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);
    
    const result = await pool.query(searchQuery, params);
    return result.rows;
  } catch (error) {
    logger.logError(error, { context: 'searchGroups', query, filters });
    throw error;
  }
};

/**
 * Search hashtags/topics
 */
const searchHashtags = async (query, limit = 20, offset = 0) => {
  try {
    // Escape SQL LIKE wildcards
    const escapedTerm = query
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    
    const searchQuery = `
      SELECT 
        id,
        name,
        description,
        posts_count,
        ts_rank(
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '')
          ),
          plainto_tsquery('english', $1)
        ) as text_rank,
        CASE 
          WHEN LOWER(name) = LOWER($1) THEN 10
          WHEN LOWER(name) LIKE LOWER($2) THEN 5
          ELSE 1
        END as exact_match_boost
      FROM hashtags
      WHERE 
        (
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '')
          ) @@ plainto_tsquery('english', $1)
          OR name ILIKE $3 ESCAPE '\\'
        )
      ORDER BY 
        (ts_rank(
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(description, '')
          ),
          plainto_tsquery('english', $1)
        ) * 
        CASE 
          WHEN LOWER(name) = LOWER($1) THEN 10
          WHEN LOWER(name) LIKE LOWER($2) THEN 5
          ELSE 1
        END * 
         (1 + LN(1 + COALESCE(posts_count, 0)))
        ) DESC,
        name ASC
      LIMIT $4 OFFSET $5
    `;
    
    const result = await pool.query(searchQuery, [
      query,
      query,
      `%${escapedTerm}%`,
      limit,
      offset,
    ]);
    
    return result.rows;
  } catch (error) {
    logger.logError(error, { context: 'searchHashtags', query });
    throw error;
  }
};

/**
 * Autocomplete search - fast suggestions across all types
 */
const autocompleteSearch = async (query, limitPerType = 5) => {
  try {
    if (!query || query.trim().length === 0) {
      return {
        people: [],
        companies: [],
        colleges: [],
        groups: [],
        topics: [],
      };
    }
    
    const trimmedQuery = query.trim();
    
    // Run all searches in parallel with limited results per type
    const [people, organizations, colleges, groups, hashtags] = await Promise.all([
      searchUsers(trimmedQuery, limitPerType, 0, {}).catch(() => []),
      searchOrganizations(trimmedQuery, limitPerType, 0, {}).catch(() => []),
      searchColleges(trimmedQuery, limitPerType, 0, {}).catch(() => []),
      searchGroups(trimmedQuery, limitPerType, 0, {}).catch(() => []),
      searchHashtags(trimmedQuery, limitPerType, 0).catch(() => []),
    ]);
    
    return {
      people: people.slice(0, limitPerType),
      companies: organizations.slice(0, limitPerType),
      colleges: colleges.slice(0, limitPerType),
      groups: groups.slice(0, limitPerType),
      topics: hashtags.slice(0, limitPerType),
    };
  } catch (error) {
    logger.logError(error, { context: 'autocompleteSearch', query });
    throw error;
  }
};

/**
 * Universal search (searches across all types)
 */
const universalSearch = async (query, limit = 10, offset = 0, userId = null, typeFilter = null) => {
  try {
    // Calculate limit per type (7 types total: people, companies, colleges, groups, topics, posts, jobs)
    const typesToSearch = typeFilter 
      ? typeFilter.split(',').map(t => t.trim().toLowerCase())
      : ['people', 'companies', 'colleges', 'groups', 'topics', 'posts', 'jobs'];
    
    const limitPerType = Math.ceil(limit / typesToSearch.length);
    
    const searchPromises = {};
    
    if (typesToSearch.includes('people')) {
      searchPromises.people = searchUsers(query, limitPerType, offset, {});
    }
    if (typesToSearch.includes('companies')) {
      searchPromises.companies = searchOrganizations(query, limitPerType, offset, {});
    }
    if (typesToSearch.includes('colleges')) {
      searchPromises.colleges = searchColleges(query, limitPerType, offset, {});
    }
    if (typesToSearch.includes('groups')) {
      searchPromises.groups = searchGroups(query, limitPerType, offset, {});
    }
    if (typesToSearch.includes('topics')) {
      searchPromises.topics = searchHashtags(query, limitPerType, offset);
    }
    if (typesToSearch.includes('posts')) {
      searchPromises.posts = searchPosts(query, limitPerType, offset, userId);
    }
    if (typesToSearch.includes('jobs')) {
      searchPromises.jobs = searchJobPostings(query, {}, limitPerType, offset);
    }
    
    const results = await Promise.all(Object.values(searchPromises));
    const keys = Object.keys(searchPromises);
    
    const resultObj = {};
    keys.forEach((key, index) => {
      resultObj[key] = results[index] || [];
    });
    
    // Ensure all expected keys exist
    const allKeys = ['people', 'companies', 'colleges', 'groups', 'topics', 'posts', 'jobs'];
    allKeys.forEach(key => {
      if (!resultObj[key]) {
        resultObj[key] = [];
      }
    });
    
    resultObj.total = Object.values(resultObj).reduce((sum, arr) => sum + arr.length, 0);
    
    return resultObj;
  } catch (error) {
    logger.logError(error, { context: 'universalSearch', query, typeFilter });
    throw error;
  }
};

module.exports = {
  searchUsers,
  searchPosts,
  searchJobPostings,
  searchOrganizations,
  searchColleges,
  searchGroups,
  searchHashtags,
  autocompleteSearch,
  universalSearch,
};
