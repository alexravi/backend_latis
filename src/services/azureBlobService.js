// Azure Blob Storage service - Operations for uploading, downloading, and managing blobs
const {
  getPrivateContainer,
  getPublicContainer,
  cdnEndpoint,
} = require('../config/azureStorage');
const logger = require('../utils/logger');

/**
 * Generate a unique blob name with versioning
 * Format: {prefix}_{unique_id}_v{version}.{ext}
 */
const generateBlobName = (prefix, mediaId, version = 1, extension = '') => {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1E9);
  const uniqueId = `${timestamp}_${random}`;
  const ext = extension ? `.${extension}` : '';
  return `${prefix}_${mediaId}_v${version}${ext}`;
};

/**
 * Generate CDN URL for a blob
 */
const generateCdnUrl = (blobName) => {
  if (!cdnEndpoint) {
    return null;
  }
  
  // Remove trailing slash from CDN endpoint if present
  const endpoint = cdnEndpoint.replace(/\/$/, '');
  return `${endpoint}/${blobName}`;
};

/**
 * Generate direct blob URL (fallback if CDN not available)
 */
const generateBlobUrl = async (containerName, blobName) => {
  try {
    const container = containerName === 'private' 
      ? await getPrivateContainer() 
      : await getPublicContainer();
    
    const blobClient = container.getBlobClient(blobName);
    return blobClient.url;
  } catch (error) {
    logger.error('Failed to generate blob URL', { error: error.message, containerName, blobName });
    throw error;
  }
};

/**
 * Upload blob to container
 */
const uploadBlob = async (containerName, blobName, buffer, contentType, metadata = {}) => {
  try {
    const container = containerName === 'private' 
      ? await getPrivateContainer() 
      : await getPublicContainer();
    
    const blobClient = container.getBlobClient(blobName);
    const blockBlobClient = blobClient.getBlockBlobClient();
    
    // Upload with content type and metadata
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: contentType,
        // Set cache headers for public container
        cacheControl: containerName === 'public' 
          ? 'public, max-age=31536000, immutable' 
          : 'no-cache',
      },
      metadata: metadata,
    };
    
    await blockBlobClient.upload(buffer, buffer.length, uploadOptions);
    
    // Generate URL (prefer CDN for public, direct blob URL for private)
    const url = containerName === 'public' && cdnEndpoint
      ? generateCdnUrl(blobName)
      : blobClient.url;
    
    logger.debug('Blob uploaded successfully', { containerName, blobName, size: buffer.length });
    
    return {
      url,
      blobName,
      size: buffer.length,
      contentType,
    };
  } catch (error) {
    logger.error('Failed to upload blob', { error: error.message, containerName, blobName });
    throw error;
  }
};

/**
 * Download blob from container
 */
const downloadBlob = async (containerName, blobName) => {
  try {
    const container = containerName === 'private' 
      ? await getPrivateContainer() 
      : await getPublicContainer();
    
    const blobClient = container.getBlobClient(blobName);
    const downloadResponse = await blobClient.download();
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    return {
      buffer,
      contentType: downloadResponse.contentType,
      contentLength: downloadResponse.contentLength,
      metadata: downloadResponse.metadata,
    };
  } catch (error) {
    logger.error('Failed to download blob', { error: error.message, containerName, blobName });
    throw error;
  }
};

/**
 * Delete blob from container
 */
const deleteBlob = async (containerName, blobName) => {
  try {
    const container = containerName === 'private' 
      ? await getPrivateContainer() 
      : await getPublicContainer();
    
    const blobClient = container.getBlobClient(blobName);
    await blobClient.delete();
    
    logger.debug('Blob deleted successfully', { containerName, blobName });
    return true;
  } catch (error) {
    // If blob doesn't exist, that's okay
    if (error.statusCode === 404) {
      logger.debug('Blob not found for deletion', { containerName, blobName });
      return false;
    }
    logger.error('Failed to delete blob', { error: error.message, containerName, blobName });
    throw error;
  }
};

/**
 * Check if blob exists
 */
const blobExists = async (containerName, blobName) => {
  try {
    const container = containerName === 'private' 
      ? await getPrivateContainer() 
      : await getPublicContainer();
    
    const blobClient = container.getBlobClient(blobName);
    return await blobClient.exists();
  } catch (error) {
    logger.error('Failed to check blob existence', { error: error.message, containerName, blobName });
    return false;
  }
};

/**
 * Get blob properties
 */
const getBlobProperties = async (containerName, blobName) => {
  try {
    const container = containerName === 'private' 
      ? await getPrivateContainer() 
      : await getPublicContainer();
    
    const blobClient = container.getBlobClient(blobName);
    const properties = await blobClient.getProperties();
    
    return {
      contentType: properties.contentType,
      contentLength: properties.contentLength,
      lastModified: properties.lastModified,
      metadata: properties.metadata,
      url: containerName === 'public' && cdnEndpoint
        ? generateCdnUrl(blobName)
        : blobClient.url,
    };
  } catch (error) {
    logger.error('Failed to get blob properties', { error: error.message, containerName, blobName });
    throw error;
  }
};

/**
 * List blobs in container (with optional prefix)
 */
const listBlobs = async (containerName, prefix = '', maxResults = 100) => {
  try {
    const container = containerName === 'private' 
      ? await getPrivateContainer() 
      : await getPublicContainer();
    
    const blobs = [];
    for await (const blob of container.listBlobsFlat({ prefix, maxResults })) {
      blobs.push({
        name: blob.name,
        size: blob.properties.contentLength,
        contentType: blob.properties.contentType,
        lastModified: blob.properties.lastModified,
        url: containerName === 'public' && cdnEndpoint
          ? generateCdnUrl(blob.name)
          : `${container.url}/${blob.name}`,
      });
    }
    
    return blobs;
  } catch (error) {
    logger.error('Failed to list blobs', { error: error.message, containerName, prefix });
    throw error;
  }
};

module.exports = {
  generateBlobName,
  generateCdnUrl,
  generateBlobUrl,
  uploadBlob,
  downloadBlob,
  deleteBlob,
  blobExists,
  getBlobProperties,
  listBlobs,
};
