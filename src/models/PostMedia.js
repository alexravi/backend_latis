// Post Media model - Images, documents, videos attached to posts
const { pool } = require('../config/database');

// Initialize post_media table
const initializePostMediaTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS post_media (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        media_type VARCHAR(50) NOT NULL,
        media_url VARCHAR(500) NOT NULL,
        thumbnail_url VARCHAR(500),
        file_name VARCHAR(255),
        file_size INTEGER,
        mime_type VARCHAR(100),
        width INTEGER,
        height INTEGER,
        duration INTEGER,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    
    // Add new columns if they don't exist (migration)
    try {
      await pool.query(`
        ALTER TABLE post_media
          ADD COLUMN IF NOT EXISTS aspect_ratio FLOAT,
          ADD COLUMN IF NOT EXISTS dominant_color VARCHAR(7),
          ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'uploaded',
          ADD COLUMN IF NOT EXISTS processing_error TEXT,
          ADD COLUMN IF NOT EXISTS variants JSONB,
          ADD COLUMN IF NOT EXISTS original_blob_name VARCHAR(500);
      `);
      
      // Add status constraint if it doesn't exist (check specifically for post_media table)
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'post_media' 
              AND c.conname = 'check_status'
          ) THEN
            ALTER TABLE post_media
              ADD CONSTRAINT check_status 
              CHECK (status IN ('uploaded', 'processing', 'ready', 'failed'));
          END IF;
        END $$;
      `);
      
      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_post_media_status ON post_media(status);
        CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
        CREATE INDEX IF NOT EXISTS idx_post_media_type ON post_media(media_type);
      `);
      
      console.log('✅ Post media table migration completed');
    } catch (migrationError) {
      console.log('Migration note: Some columns may already exist', migrationError.message);
    }
    
    console.log('✅ Post media table initialized');
  } catch (error) {
    console.error('❌ Error initializing post media table:', error.message);
    throw error;
  }
};

// Create post media
const create = async (mediaData) => {
  try {
    const query = `
      INSERT INTO post_media (
        post_id, media_type, media_url, thumbnail_url, file_name,
        file_size, mime_type, width, height, duration, display_order,
        aspect_ratio, dominant_color, status, variants, original_blob_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    const result = await pool.query(query, [
      mediaData.post_id,
      mediaData.media_type,
      mediaData.media_url || null,
      mediaData.thumbnail_url || null,
      mediaData.file_name || null,
      mediaData.file_size || null,
      mediaData.mime_type || null,
      mediaData.width || null,
      mediaData.height || null,
      mediaData.duration || null,
      mediaData.display_order || 0,
      mediaData.aspect_ratio || null,
      mediaData.dominant_color || null,
      mediaData.status || 'uploaded',
      mediaData.variants ? JSON.stringify(mediaData.variants) : null,
      mediaData.original_blob_name || null,
    ]);
    
    // Parse variants JSON if present
    const row = result.rows[0];
    if (row.variants) {
      row.variants = typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants;
    }
    
    return row;
  } catch (error) {
    console.error('Error creating post media:', error.message);
    throw error;
  }
};

// Find media by post ID
const findByPostId = async (postId) => {
  try {
    const query = `
      SELECT * FROM post_media
      WHERE post_id = $1
      ORDER BY display_order ASC, created_at ASC
    `;
    const result = await pool.query(query, [postId]);
    
    // Parse variants JSON for each row
    return result.rows.map(row => {
      if (row.variants) {
        row.variants = typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants;
      }
      return row;
    });
  } catch (error) {
    console.error('Error finding post media by post ID:', error.message);
    throw error;
  }
};

// Update post media status
const updateStatus = async (id, status, error = null, variants = null, metadata = {}) => {
  try {
    const fields = [`status = $1`];
    const values = [status];
    let paramCount = 2;

    if (error !== null) {
      fields.push(`processing_error = $${paramCount}`);
      values.push(error);
      paramCount++;
    }

    if (variants !== null) {
      fields.push(`variants = $${paramCount}`);
      values.push(JSON.stringify(variants));
      paramCount++;
    }

    // Update metadata fields if provided
    if (metadata.aspect_ratio !== undefined) {
      fields.push(`aspect_ratio = $${paramCount}`);
      values.push(metadata.aspect_ratio);
      paramCount++;
    }

    if (metadata.dominant_color !== undefined) {
      fields.push(`dominant_color = $${paramCount}`);
      values.push(metadata.dominant_color);
      paramCount++;
    }

    if (metadata.width !== undefined) {
      fields.push(`width = $${paramCount}`);
      values.push(metadata.width);
      paramCount++;
    }

    if (metadata.height !== undefined) {
      fields.push(`height = $${paramCount}`);
      values.push(metadata.height);
      paramCount++;
    }

    if (metadata.duration !== undefined) {
      fields.push(`duration = $${paramCount}`);
      values.push(metadata.duration);
      paramCount++;
    }

    values.push(id);

    const query = `
      UPDATE post_media
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    
    const row = result.rows[0];
    if (row && row.variants) {
      row.variants = typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants;
    }
    
    return row;
  } catch (error) {
    console.error('Error updating post media status:', error.message);
    throw error;
  }
};

// Convert PostMedia to descriptor format
const toDescriptor = (media) => {
  if (!media) return null;

  return {
    id: media.id,
    type: media.media_type,
    status: media.status || 'uploaded',
    aspect_ratio: media.aspect_ratio,
    dominant_color: media.dominant_color,
    variants: media.variants || {},
    poster_url: media.thumbnail_url || (media.variants?.poster || null),
    duration: media.duration,
    width: media.width,
    height: media.height,
  };
};

// Find media by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM post_media WHERE id = $1';
    const result = await pool.query(query, [id]);
    const row = result.rows[0] || null;
    
    // Parse variants JSON if present
    if (row && row.variants) {
      row.variants = typeof row.variants === 'string' ? JSON.parse(row.variants) : row.variants;
    }
    
    return row;
  } catch (error) {
    console.error('Error finding post media by ID:', error.message);
    throw error;
  }
};

// Delete post media
const remove = async (id) => {
  try {
    const query = 'DELETE FROM post_media WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting post media:', error.message);
    throw error;
  }
};

// Delete all media for a post
const removeByPostId = async (postId) => {
  try {
    const query = 'DELETE FROM post_media WHERE post_id = $1 RETURNING *';
    const result = await pool.query(query, [postId]);
    return result.rows;
  } catch (error) {
    console.error('Error deleting post media by post ID:', error.message);
    throw error;
  }
};

module.exports = {
  initializePostMediaTable,
  create,
  findByPostId,
  findById,
  remove,
  removeByPostId,
  updateStatus,
  toDescriptor,
};
