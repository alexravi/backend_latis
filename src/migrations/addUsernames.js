// Migration script to add username column and backfill existing users
const { pool } = require('../config/database');
const { generateUsername } = require('../utils/userUtils');
const logger = require('../utils/logger');

/**
 * Migration to add username column and generate usernames for existing users
 * This script:
 * 1. Adds username column to users table if it doesn't exist
 * 2. Generates unique usernames for all existing users without usernames
 * 3. Sets username as NOT NULL after backfill
 * 4. Adds unique constraint and index
 */
const addUsernames = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    logger.info('Starting username migration...');

    // Step 1: Add username column if it doesn't exist
    logger.info('Checking if username column exists...');
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'username'
    `);

    if (columnCheck.rows.length === 0) {
      logger.info('Adding username column...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN username VARCHAR(50) UNIQUE
      `);
      logger.info('Username column added successfully');
    } else {
      logger.info('Username column already exists');
    }

    // Step 2: Create index on username for fast lookups
    logger.info('Creating index on username...');
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_username 
        ON users(LOWER(username))
      `);
      logger.info('Username index created successfully');
    } catch (indexError) {
      logger.warn('Index may already exist or error creating index:', indexError.message);
    }

    // Step 3: Get all users without usernames
    logger.info('Finding users without usernames...');
    const usersWithoutUsernames = await client.query(`
      SELECT id, first_name, last_name, email
      FROM users
      WHERE username IS NULL OR username = ''
      ORDER BY id
    `);

    logger.info(`Found ${usersWithoutUsernames.rows.length} users without usernames`);

    // Step 4: Generate usernames for each user
    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutUsernames.rows) {
      try {
        const username = await generateUsername(
          user.first_name || '',
          user.last_name || '',
          user.id
        );

        // Update user with generated username
        await client.query(
          'UPDATE users SET username = $1 WHERE id = $2',
          [username, user.id]
        );

        successCount++;
        if (successCount % 100 === 0) {
          logger.info(`Processed ${successCount} users...`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`Error generating username for user ${user.id} (${user.email}):`, error.message);
        
        // Fallback: use timestamp-based username
        try {
          const fallbackUsername = `user${user.id}_${Date.now().toString().slice(-6)}`;
          await client.query(
            'UPDATE users SET username = $1 WHERE id = $2',
            [fallbackUsername, user.id]
          );
          logger.info(`Used fallback username for user ${user.id}: ${fallbackUsername}`);
          successCount++;
          errorCount--;
        } catch (fallbackError) {
          logger.error(`Fallback username generation also failed for user ${user.id}:`, fallbackError.message);
        }
      }
    }

    logger.info(`Username generation complete: ${successCount} succeeded, ${errorCount} failed`);

    // Step 5: Verify all users have usernames
    const remainingNulls = await client.query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE username IS NULL OR username = ''
    `);

    if (parseInt(remainingNulls.rows[0].count) > 0) {
      logger.warn(`Warning: ${remainingNulls.rows[0].count} users still without usernames`);
      
      // Generate usernames for remaining users using ID-only format
      const remainingUsers = await client.query(`
        SELECT id, first_name, last_name
        FROM users
        WHERE username IS NULL OR username = ''
      `);

      for (const user of remainingUsers.rows) {
        const fallbackUsername = `user${user.id}`;
        try {
          await client.query(
            'UPDATE users SET username = $1 WHERE id = $2',
            [fallbackUsername, user.id]
          );
        } catch (error) {
          logger.error(`Failed to set fallback username for user ${user.id}:`, error.message);
        }
      }
    }

    // Step 6: Add NOT NULL constraint (optional - can be deferred if you want to allow NULL for new users)
    // Uncomment below if you want to enforce NOT NULL
    /*
    logger.info('Adding NOT NULL constraint to username...');
    try {
      await client.query(`
        ALTER TABLE users 
        ALTER COLUMN username SET NOT NULL
      `);
      logger.info('NOT NULL constraint added successfully');
    } catch (constraintError) {
      logger.warn('Could not add NOT NULL constraint:', constraintError.message);
    }
    */

    // Step 7: Ensure unique constraint exists
    logger.info('Verifying unique constraint...');
    try {
      // Check if unique constraint already exists
      const constraintCheck = await client.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND constraint_type = 'UNIQUE'
          AND constraint_name LIKE '%username%'
      `);

      if (constraintCheck.rows.length === 0) {
        // Add unique constraint if it doesn't exist
        await client.query(`
          ALTER TABLE users 
          ADD CONSTRAINT users_username_unique UNIQUE (username)
        `);
        logger.info('Unique constraint added successfully');
      } else {
        logger.info('Unique constraint already exists');
      }
    } catch (constraintError) {
      logger.warn('Could not add unique constraint (may already exist):', constraintError.message);
    }

    await client.query('COMMIT');
    logger.info('✅ Username migration completed successfully');
    
    return {
      success: true,
      message: 'Username migration completed',
      usersProcessed: successCount,
      errors: errorCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Username migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Run migration if called directly
if (require.main === module) {
  addUsernames()
    .then((result) => {
      console.log('Migration result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = { addUsernames };
