// Azure Blob Storage configuration
require('dotenv').config();
const { BlobServiceClient } = require('@azure/storage-blob');

// Safe logger - may not be initialized yet during module load
let logger = null;
try {
  logger = require('../utils/logger');
} catch (error) {
  // Logger not available yet, will use console
  logger = {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    debug: (...args) => {},
  };
}

// Azure Blob Storage configuration
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
// Accept either:
// 1) SAS service URL form: https://{account}.blob.core.windows.net/?sv=...
// 2) SAS connection string form: BlobEndpoint=...;SharedAccessSignature=sv=...
const sasTokenUrlOrConnectionString = process.env.AZURE_STORAGE_SAS_TOKEN_URL;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME; // Required for SAS URL form
const containerPrivate = process.env.AZURE_STORAGE_CONTAINER_PRIVATE || 'private-originals';
const containerPublic = process.env.AZURE_STORAGE_CONTAINER_PUBLIC || 'public-media';
const cdnEndpoint = process.env.AZURE_CDN_ENDPOINT || '';

// Initialize Blob Service Client
let blobServiceClient = null;
let authMethod = null; // 'connection_string' | 'sas_token' | null

// Prefer SAS token if provided (lets us bypass account-key / IAM issues in dev)
if (sasTokenUrlOrConnectionString) {
  // Use SAS token authentication
  try {
    // If the value looks like a connection string, use the SDK helper.
    // Example:
    // BlobEndpoint=https://{account}.blob.core.windows.net/;...;SharedAccessSignature=sv=...
    if (sasTokenUrlOrConnectionString.startsWith('BlobEndpoint=')) {
      blobServiceClient = BlobServiceClient.fromConnectionString(sasTokenUrlOrConnectionString);
      authMethod = 'sas_connection_string';
      console.log('✅ Azure Blob Storage client initialized (using SAS connection string)');
      if (logger && logger.info) {
        logger.info('Azure Blob Storage client initialized (using SAS connection string)');
      }
    } else {
      // Otherwise treat it as a SAS service URL
      if (!accountName) {
        throw new Error('AZURE_STORAGE_ACCOUNT_NAME is required when using SAS URL');
      }

      const url = new URL(sasTokenUrlOrConnectionString);
      const sasQuery = url.search; // includes '?'
      if (!sasQuery) {
        throw new Error('AZURE_STORAGE_SAS_TOKEN_URL must include query parameters (e.g. ?sv=...)');
      }

      const baseUrl = `https://${accountName}.blob.core.windows.net${sasQuery}`;
      blobServiceClient = new BlobServiceClient(baseUrl);
      authMethod = 'sas_url';
      console.log('✅ Azure Blob Storage client initialized (using SAS URL)');
      if (logger && logger.info) {
        logger.info('Azure Blob Storage client initialized (using SAS URL)');
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize Azure Blob Storage client with SAS token:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    if (logger && logger.error) {
      logger.error('Failed to initialize Azure Blob Storage client with SAS token', { error: error.message, stack: error.stack });
    }
    blobServiceClient = null;
  }
} else if (connectionString) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    authMethod = 'connection_string';
    if (blobServiceClient) {
      console.log('✅ Azure Blob Storage client initialized (using connection string)');
      if (logger && logger.info) {
        logger.info('Azure Blob Storage client initialized (using connection string)');
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize Azure Blob Storage client with connection string:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    if (logger && logger.error) {
      logger.error('Failed to initialize Azure Blob Storage client', { error: error.message, stack: error.stack });
    }
    blobServiceClient = null;
  }
} else {
  console.log('⚠️  Azure Blob Storage not configured');
  console.log('   Provide either:');
  console.log('   - AZURE_STORAGE_CONNECTION_STRING (recommended for full access)');
  console.log('   - AZURE_STORAGE_SAS_TOKEN_URL + AZURE_STORAGE_ACCOUNT_NAME (for SAS token auth)');
  if (logger && logger.warn) {
    logger.warn('Azure Blob Storage not configured');
  }
}

/**
 * Get or create container
 */
const getOrCreateContainer = async (containerName, isPublic = false) => {
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage client not initialized');
  }

  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Check if container exists
    const exists = await containerClient.exists();
    
    if (!exists) {
      // Create container with appropriate access level
      const options = {
        access: isPublic ? 'blob' : 'private', // 'blob' allows public read, 'private' is fully private
      };
      try {
        await containerClient.create(options);
        if (logger && logger.info) {
          logger.info(`Created Azure container: ${containerName} (access: ${options.access})`);
        } else {
          console.log(`Created Azure container: ${containerName} (access: ${options.access})`);
        }
      } catch (createError) {
        // If container creation fails due to permissions, provide helpful error
        if (createError.statusCode === 403) {
          const errorMsg = `Permission denied: Cannot create container '${containerName}'. ` +
            `Please check Azure Storage account permissions. ` +
            `Required role: Storage Blob Data Contributor or Storage Account Contributor. ` +
            `Error: ${createError.message}`;
          throw new Error(errorMsg);
        }
        throw createError;
      }
    }
    
    return containerClient;
  } catch (error) {
    const errorMsg = `Failed to get/create container ${containerName}: ${error.message}`;
    if (logger && logger.error) {
      logger.error(errorMsg, { error: error.message });
    } else {
      console.error(errorMsg);
    }
    throw error;
  }
};

/**
 * Initialize containers (called on startup)
 */
const initializeContainers = async () => {
  if (!blobServiceClient) {
    const msg = 'Skipping container initialization - Azure Blob Storage not configured';
    if (logger && logger.warn) {
      logger.warn(msg);
    } else {
      console.warn(msg);
    }
    return;
  }

  try {
    let containersInitialized = 0;
    let hasPermissionError = false;
    
    // Initialize private container (no public access)
    try {
      await getOrCreateContainer(containerPrivate, false);
      console.log(`✅ Private container '${containerPrivate}' ready`);
      containersInitialized++;
    } catch (error) {
      const is403 = error.statusCode === 403 || error.message?.includes('not authorized') || error.message?.includes('403');
      if (is403) {
        hasPermissionError = true;
        console.error(`\n❌ PERMISSION ERROR: Cannot access private container '${containerPrivate}'`);
        console.error(`   Error: ${error.message}`);
      } else {
        console.error(`❌ Failed to initialize private container '${containerPrivate}':`, error.message);
      }
      // Continue with public container even if private fails
    }
    
    // Initialize public container (CDN-backed)
    try {
      await getOrCreateContainer(containerPublic, true);
      console.log(`✅ Public container '${containerPublic}' ready`);
      containersInitialized++;
    } catch (error) {
      const is403 = error.statusCode === 403 || error.message?.includes('not authorized') || error.message?.includes('403');
      if (is403) {
        hasPermissionError = true;
        console.error(`\n❌ PERMISSION ERROR: Cannot access public container '${containerPublic}'`);
        console.error(`   Error: ${error.message}`);
      } else {
        console.error(`❌ Failed to initialize public container '${containerPublic}':`, error.message);
      }
    }
    
    // Show infrastructure fix instructions if permission errors occurred
    if (hasPermissionError) {
      console.error(`\n   🔧 INFRASTRUCTURE FIX REQUIRED:`);
      console.error(`   1. Go to Azure Portal → Storage Account 'medialatis'`);
      console.error(`   2. Navigate to Access Control (IAM)`);
      console.error(`   3. Assign 'Storage Blob Data Contributor' role to your account/service principal`);
      console.error(`   4. Check Networking → Allow access from your IP or enable 'All networks'`);
      console.error(`   5. Verify Storage Account is Active and Account Kind is 'StorageV2'`);
      console.error(`   6. Verify AccountKey in Azure Portal matches your .env file`);
      console.error(`\n   See AZURE_STORAGE_SETUP.md for detailed instructions\n`);
    }
    
    if (containersInitialized === 2) {
      if (logger && logger.info) {
        logger.info('Azure Blob Storage containers initialized');
      } else {
        console.log('✅ Azure Blob Storage containers initialized');
      }
    } else if (containersInitialized === 0) {
      console.warn('\n⚠️  WARNING: No Azure containers initialized. Media upload features will not work.');
      if (!hasPermissionError) {
        console.warn('   Please check Azure Storage configuration\n');
      }
    } else {
      console.warn(`\n⚠️  WARNING: Only ${containersInitialized}/2 containers initialized. Some features may not work.\n`);
    }
  } catch (error) {
    const errorMsg = `Failed to initialize Azure containers: ${error.message}`;
    console.error('❌', errorMsg);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    if (logger && logger.error) {
      logger.error(errorMsg, { error: error.message, stack: error.stack });
    }
    // Don't throw - allow server to continue without Azure Storage
  }
};

/**
 * Get private container client
 */
const getPrivateContainer = async () => {
  return getOrCreateContainer(containerPrivate, false);
};

/**
 * Get public container client
 */
const getPublicContainer = async () => {
  return getOrCreateContainer(containerPublic, true);
};

/**
 * Test Azure Blob Storage connection
 */
const testConnection = async () => {
  if (!blobServiceClient) {
    return { success: false, error: 'Azure Blob Storage not configured' };
  }

  try {
    // Try to list containers
    const containers = [];
    for await (const container of blobServiceClient.listContainers()) {
      containers.push(container.name);
    }
    
    return {
      success: true,
      containers: containers,
      privateContainer: containerPrivate,
      publicContainer: containerPublic,
    };
  } catch (error) {
    const errorMsg = `Azure Blob Storage connection test failed: ${error.message}`;
    if (logger && logger.error) {
      logger.error(errorMsg, { error: error.message });
    } else {
      console.error(errorMsg);
    }
    return { success: false, error: error.message };
  }
};

module.exports = {
  blobServiceClient,
  containerPrivate,
  containerPublic,
  cdnEndpoint,
  getPrivateContainer,
  getPublicContainer,
  initializeContainers,
  testConnection,
};
