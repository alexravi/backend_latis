// Medical Publication model - Research papers, case studies, journal articles
const { pool } = require('../config/database');

// Initialize medical_publications table
const initializeMedicalPublicationsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS medical_publications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        publication_type VARCHAR(100) NOT NULL,
        title VARCHAR(500) NOT NULL,
        authors TEXT[] NOT NULL,
        author_order INTEGER,
        journal_name VARCHAR(255),
        publisher VARCHAR(255),
        publication_date DATE,
        doi VARCHAR(255),
        url VARCHAR(500),
        abstract TEXT,
        keywords TEXT[],
        impact_factor DECIMAL(5,2),
        citation_count INTEGER DEFAULT 0,
        is_peer_reviewed BOOLEAN DEFAULT FALSE,
        volume VARCHAR(50),
        issue VARCHAR(50),
        pages VARCHAR(50),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await pool.query(query);
    console.log('✅ Medical publications table initialized');
  } catch (error) {
    console.error('❌ Error initializing medical publications table:', error.message);
    throw error;
  }
};

// Create medical publication
const create = async (publicationData) => {
  try {
    const query = `
      INSERT INTO medical_publications (
        user_id, publication_type, title, authors, author_order, journal_name,
        publisher, publication_date, doi, url, abstract, keywords, impact_factor,
        citation_count, is_peer_reviewed, volume, issue, pages, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;
    const result = await pool.query(query, [
      publicationData.user_id,
      publicationData.publication_type,
      publicationData.title,
      publicationData.authors || [],
      publicationData.author_order || null,
      publicationData.journal_name || null,
      publicationData.publisher || null,
      publicationData.publication_date || null,
      publicationData.doi || null,
      publicationData.url || null,
      publicationData.abstract || null,
      publicationData.keywords || [],
      publicationData.impact_factor || null,
      publicationData.citation_count || 0,
      publicationData.is_peer_reviewed || false,
      publicationData.volume || null,
      publicationData.issue || null,
      publicationData.pages || null,
      publicationData.description || null
    ]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating medical publication:', error.message);
    throw error;
  }
};

// Find publications by user ID
const findByUserId = async (userId) => {
  try {
    const query = `
      SELECT * FROM medical_publications
      WHERE user_id = $1
      ORDER BY publication_date DESC NULLS LAST, created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error finding medical publications by user ID:', error.message);
    throw error;
  }
};

// Find publication by ID
const findById = async (id) => {
  try {
    const query = 'SELECT * FROM medical_publications WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error finding medical publication by ID:', error.message);
    throw error;
  }
};

// Update citation count
const updateCitationCount = async (id, count) => {
  try {
    const query = `
      UPDATE medical_publications
      SET citation_count = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [count, id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating citation count:', error.message);
    throw error;
  }
};

// Update medical publication
const update = async (id, publicationData) => {
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'publication_type', 'title', 'authors', 'author_order', 'journal_name',
      'publisher', 'publication_date', 'doi', 'url', 'abstract', 'keywords',
      'impact_factor', 'is_peer_reviewed', 'volume', 'issue', 'pages', 'description'
    ];

    for (const [key, value] of Object.entries(publicationData)) {
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
      UPDATE medical_publications
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating medical publication:', error.message);
    throw error;
  }
};

// Delete medical publication
const remove = async (id) => {
  try {
    const query = 'DELETE FROM medical_publications WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting medical publication:', error.message);
    throw error;
  }
};

// Bulk create medical publications
const bulkCreate = async (client, userId, publications) => {
  if (!publications || publications.length === 0) {
    return [];
  }

  try {
    const values = [];
    const placeholders = [];
    let paramCount = 1;

    publications.forEach((pub) => {
      placeholders.push(
        `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, $${paramCount + 7}, $${paramCount + 8}, $${paramCount + 9}, $${paramCount + 10}, $${paramCount + 11}, $${paramCount + 12}, $${paramCount + 13}, $${paramCount + 14}, $${paramCount + 15}, $${paramCount + 16}, $${paramCount + 17}, $${paramCount + 18})`
      );
      values.push(
        userId,
        pub.publication_type,
        pub.title,
        pub.authors || [],
        pub.author_order || null,
        pub.journal_name || null,
        pub.publisher || null,
        pub.publication_date || null,
        pub.doi || null,
        pub.url || null,
        pub.abstract || null,
        pub.keywords || [],
        pub.impact_factor || null,
        pub.citation_count || 0,
        pub.is_peer_reviewed || false,
        pub.volume || null,
        pub.issue || null,
        pub.pages || null,
        pub.description || null
      );
      paramCount += 19;
    });

    const query = `
      INSERT INTO medical_publications (
        user_id, publication_type, title, authors, author_order, journal_name,
        publisher, publication_date, doi, url, abstract, keywords, impact_factor,
        citation_count, is_peer_reviewed, volume, issue, pages, description
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await client.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Error bulk creating medical publications:', error.message);
    throw error;
  }
};

module.exports = {
  initializeMedicalPublicationsTable,
  create,
  findByUserId,
  findById,
  updateCitationCount,
  update,
  remove,
  bulkCreate,
};
