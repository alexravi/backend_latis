// PostgreSQL connection configuration
require('dotenv').config();
const { Pool } = require('pg');

// Enhanced pool configuration with better error handling
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX) || 20, // Maximum number of clients in the pool
  min: parseInt(process.env.DB_POOL_MIN) || 2, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000, // Return an error after 30 seconds if connection could not be established (increased from 10s)
  // Handle dropped connections
  allowExitOnIdle: false, // Don't exit when pool is idle
};

// Create PostgreSQL connection pool
const pool = new Pool(poolConfig);

// Enhanced error handling for pool events
pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle database client:', err.message);
  console.error('   Error code:', err.code);
  console.error('   Error details:', {
    message: err.message,
    code: err.code,
    stack: err.stack
  });
  // Don't exit the process, just log the error
  // The pool will handle reconnection automatically
});

pool.on('connect', (client) => {
  // Optional: Log successful connections in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Database client connected');
  }
});

pool.on('remove', (client) => {
  // Optional: Log client removal in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Database client removed from pool');
  }
});

// Retry logic helper
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      // Check if error is retryable
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'EADDRNOTAVAIL' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout');
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw lastError;
};

// Safe connection getter with retry logic
const getClient = async () => {
  return retryOperation(async () => {
    const client = await pool.connect();
    try {
      // Validate connection is still alive with a simple query
      await client.query('SELECT 1');
      return client;
    } catch (error) {
      // If connection is bad, release it immediately
      try {
        client.release();
      } catch (releaseError) {
        // Ignore release errors for bad connections
      }
      // If connection is bad, log it
      if (error.code === 'ECONNRESET' || error.code === 'EADDRNOTAVAIL' || error.code === 'ETIMEDOUT') {
        console.warn('Bad connection detected, will retry:', error.code);
      }
      throw error;
    }
  });
};

// Test database connection with retry
const testConnection = async () => {
  try {
    console.log('   Checking DATABASE_URL...', process.env.DATABASE_URL ? '✓ Set' : '✗ Missing');
    console.log('   Pool config:', {
      max: poolConfig.max,
      min: poolConfig.min,
      connectionTimeout: poolConfig.connectionTimeoutMillis + 'ms'
    });
    
    const result = await retryOperation(async () => {
      const client = await pool.connect();
      try {
        const queryResult = await client.query('SELECT NOW()');
        return queryResult.rows[0];
      } finally {
        client.release();
      }
    });
    return { success: true, timestamp: result.now };
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port
    });
    
    // Provide helpful troubleshooting tips
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   1. Check if PostgreSQL server is running');
      console.error('   2. Verify DATABASE_URL is correct in .env file');
      console.error('   3. Check network connectivity to database server');
      console.error('   4. Verify database credentials');
      console.error('   5. Check firewall settings');
    }
    
    return { success: false, error: error.message, code: error.code };
  }
};

// Enhanced transaction helper with retry logic and better error handling
const withTransaction = async (callback) => {
  const client = await getClient();
  let transactionStarted = false;
  
  try {
    // Start transaction
    await client.query('BEGIN');
    transactionStarted = true;
    
    // Execute callback
    const result = await callback(client);
    
    // Commit transaction
    await client.query('COMMIT');
    
    return result;
  } catch (error) {
    // Only rollback if transaction was started
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError.message);
        // If rollback fails, the connection is likely bad - it will be removed from pool
      }
    }
    throw error;
  } finally {
    // Always release the client back to the pool
    try {
      client.release();
    } catch (releaseError) {
      console.error('Error releasing client:', releaseError.message);
    }
  }
};

// Graceful shutdown handler
const closePool = async () => {
  try {
    await pool.end();
    console.log('Database pool closed gracefully');
  } catch (error) {
    console.error('Error closing database pool:', error.message);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

module.exports = {
  pool,
  testConnection,
  withTransaction,
  getClient,
  retryOperation,
  closePool,
};
