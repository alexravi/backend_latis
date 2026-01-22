// SAS Token Service - Generate SAS tokens for direct client-to-Azure uploads
const {
  getPrivateContainer,
  containerPrivate,
  blobServiceClient,
} = require('../config/azureStorage');
const { BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { generateBlobName } = require('./azureBlobService');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Get storage account name and key
// Supports both connection string and separate environment variables
const getStorageAccountInfo = () => {
  // Option 1: Use connection string (preferred)
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) {
    // Parse connection string
    const parts = connectionString.split(';');
    
    // Extract account name (everything after first =)
    const accountNamePart = parts.find(p => p.startsWith('AccountName='));
    const accountName = accountNamePart ? accountNamePart.substring('AccountName='.length) : null;
    
    // Extract account key (everything after first =, as key may contain = characters)
    const accountKeyPart = parts.find(p => p.startsWith('AccountKey='));
    const accountKey = accountKeyPart ? accountKeyPart.substring('AccountKey='.length) : null;

    if (!accountName || !accountKey) {
      throw new Error('Invalid Azure Storage connection string format');
    }

    return { accountName, accountKey };
  }

  // Option 2: Use separate environment variables
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

  if (!accountName || !accountKey) {
    throw new Error(
      'Azure Storage credentials not configured. ' +
      'Provide either AZURE_STORAGE_CONNECTION_STRING or both AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY'
    );
  }

  return { accountName, accountKey };
};

/**
 * Generate SAS token for direct upload to private container
 * @param {string} blobName - Name of the blob to upload
 * @param {string} contentType - MIME type of the file
 * @param {number} fileSize - Size of the file in bytes
 * @returns {Object} SAS token details
 */
const generateSasToken = async (blobName, contentType, fileSize = null) => {
  try {
    const { accountName, accountKey } = getStorageAccountInfo();
    
    // Validate file size if provided
    const maxImageSize = parseInt(process.env.MAX_IMAGE_SIZE) || 10 * 1024 * 1024; // 10MB
    const maxVideoSize = parseInt(process.env.MAX_VIDEO_SIZE) || 100 * 1024 * 1024; // 100MB
    const maxSize = contentType?.startsWith('video/') ? maxVideoSize : maxImageSize;
    
    if (fileSize && fileSize > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
    }

    // Get container client
    const containerClient = await getPrivateContainer();
    
    // Generate SAS token permissions (write-only)
    const permissions = BlobSASPermissions.parse('w'); // write only
    
    // Set expiry time (default 5 minutes, configurable)
    const expiryMinutes = parseInt(process.env.SAS_TOKEN_EXPIRY_MINUTES) || 5;
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);
    
    // Create shared key credential
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    
    // Generate SAS token
    const sasQueryParams = generateBlobSASQueryParameters(
      {
        containerName: containerPrivate,
        blobName: blobName,
        permissions: permissions,
        expiresOn: expiresOn,
        contentType: contentType,
      },
      sharedKeyCredential
    );
    
    // Construct full SAS URL
    const blobClient = containerClient.getBlobClient(blobName);
    const sasUrl = `${blobClient.url}?${sasQueryParams.toString()}`;
    
    // Generate unique upload ID
    const uploadId = `upload_${crypto.randomBytes(16).toString('hex')}`;
    
    logger.debug('SAS token generated', { 
      blobName, 
      contentType, 
      expiresIn: `${expiryMinutes} minutes`,
      uploadId 
    });
    
    return {
      upload_id: uploadId,
      sas_url: sasUrl,
      blob_name: blobName,
      expires_at: expiresOn.toISOString(),
      expires_in: expiryMinutes * 60, // seconds
    };
  } catch (error) {
    logger.error('Failed to generate SAS token', { error: error.message, blobName });
    throw error;
  }
};

/**
 * Generate SAS token for media upload
 * Creates a unique blob name and returns SAS token for direct upload
 * @param {string} mediaType - Type of media (image, video)
 * @param {string} contentType - MIME type
 * @param {number} fileSize - File size in bytes
 * @returns {Object} Upload token details
 */
const generateUploadToken = async (mediaType, contentType, fileSize = null) => {
  try {
    // Generate unique media ID
    const mediaId = crypto.randomBytes(12).toString('hex');
    
    // Determine file extension from content type
    const extensionMap = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
    };
    
    const extension = extensionMap[contentType] || 'bin';
    const prefix = mediaType === 'video' ? 'video' : 'image';
    
    // Generate blob name
    const blobName = generateBlobName(prefix, mediaId, 1, extension);
    
    // Generate SAS token
    const sasToken = await generateSasToken(blobName, contentType, fileSize);
    
    return {
      ...sasToken,
      media_id: mediaId,
      media_type: mediaType,
      content_type: contentType,
    };
  } catch (error) {
    logger.error('Failed to generate upload token', { error: error.message, mediaType, contentType });
    throw error;
  }
};

/**
 * Validate file type and size before generating token
 */
const validateUploadRequest = (contentType, fileSize) => {
  // Allowed content types
  const allowedImageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];
  
  const allowedVideoTypes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
  ];
  
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
  
  if (!allowedTypes.includes(contentType)) {
    throw new Error(`Content type ${contentType} is not allowed`);
  }
  
  // Validate file size
  const maxImageSize = parseInt(process.env.MAX_IMAGE_SIZE) || 10 * 1024 * 1024; // 10MB
  const maxVideoSize = parseInt(process.env.MAX_VIDEO_SIZE) || 100 * 1024 * 1024; // 100MB
  const maxSize = contentType.startsWith('video/') ? maxVideoSize : maxImageSize;
  
  if (fileSize && fileSize > maxSize) {
    throw new Error(`File size ${fileSize} exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
  }
  
  return {
    mediaType: contentType.startsWith('video/') ? 'video' : 'image',
    maxSize,
  };
};

module.exports = {
  generateSasToken,
  generateUploadToken,
  validateUploadRequest,
};
