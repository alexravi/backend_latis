// Image Processing Service - Resize, optimize, and generate variants using Sharp
const sharp = require('sharp');
const { uploadBlob, generateBlobName } = require('./azureBlobService');
const { extractAspectRatio, extractDominantColor, extractImageMetadata } = require('../utils/imageUtils');
const logger = require('../utils/logger');

// Variant configurations
const VARIANTS = {
  thumb: {
    width: 150,
    height: 150,
    fit: 'cover', // Square crop
    quality: 85,
  },
  feed: {
    width: 400,
    height: null, // Maintain aspect ratio
    fit: 'inside',
    quality: 90,
  },
  full: {
    width: 1200,
    height: null, // Maintain aspect ratio
    fit: 'inside',
    quality: 95,
  },
};

/**
 * Process image and generate variants
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string} mediaId - Unique media ID
 * @param {string} originalFormat - Original image format (jpg, png, etc.)
 * @returns {Object} Processing results with variant URLs and metadata
 */
const processImage = async (imageBuffer, mediaId, originalFormat = 'jpg') => {
  try {
    const results = {
      variants: {},
      metadata: {},
      aspectRatio: null,
      dominantColor: null,
    };

    // Extract metadata from original
    const metadata = await extractImageMetadata(imageBuffer);
    if (metadata) {
      results.metadata = metadata;
      // Guard against division-by-zero when computing aspect ratio
      if (metadata.height && metadata.height > 0 && isFinite(metadata.height) && 
          metadata.width && metadata.width > 0 && isFinite(metadata.width)) {
        results.aspectRatio = metadata.width / metadata.height;
      } else {
        results.aspectRatio = null;
        logger.warn('Invalid image dimensions for aspect ratio calculation', {
          width: metadata.width,
          height: metadata.height,
        });
      }
    }

    // Extract dominant color
    results.dominantColor = await extractDominantColor(imageBuffer);

    // Process each variant
    for (const [variantName, config] of Object.entries(VARIANTS)) {
      try {
        let sharpInstance = sharp(imageBuffer);

        // Resize based on variant config
        if (config.height) {
          // Square crop for thumbnails
          sharpInstance = sharpInstance.resize(config.width, config.height, {
            fit: config.fit,
            position: 'center',
          });
        } else {
          // Maintain aspect ratio for feed and full
          sharpInstance = sharpInstance.resize(config.width, null, {
            fit: config.fit,
          });
        }

        // Determine output format (prefer WebP, fallback to JPEG)
        const outputFormat = 'webp'; // Always use WebP for variants
        const mimeType = `image/${outputFormat}`;

        // Apply format-specific optimizations
        if (outputFormat === 'webp') {
          sharpInstance = sharpInstance.webp({ quality: config.quality });
        } else {
          sharpInstance = sharpInstance.jpeg({ 
            quality: config.quality,
            progressive: true, // Progressive JPEG
          });
        }

        // Generate variant buffer
        const variantBuffer = await sharpInstance.toBuffer();

        // Generate blob name with version
        const blobName = generateBlobName('image', mediaId, 1, outputFormat);
        const variantBlobName = blobName.replace(`_v1.${outputFormat}`, `_${variantName}_v1.${outputFormat}`);

        // Upload to public container
        const uploadResult = await uploadBlob(
          'public',
          variantBlobName,
          variantBuffer,
          mimeType,
          {
            variant: variantName,
            mediaId: mediaId,
            originalFormat: originalFormat,
          }
        );

        results.variants[variantName] = uploadResult.url;

        logger.debug('Image variant processed', {
          variant: variantName,
          mediaId,
          size: variantBuffer.length,
          url: uploadResult.url,
        });
      } catch (variantError) {
        logger.error(`Failed to process variant ${variantName}`, {
          error: variantError.message,
          mediaId,
          variant: variantName,
        });
        // Continue with other variants even if one fails
      }
    }

    return results;
  } catch (error) {
    logger.error('Image processing failed', {
      error: error.message,
      mediaId,
    });
    throw error;
  }
};

/**
 * Process image from Azure blob (download, process, upload variants)
 * @param {string} blobName - Name of the blob in private container
 * @param {string} mediaId - Unique media ID
 * @returns {Object} Processing results
 */
const processImageFromBlob = async (blobName, mediaId) => {
  try {
    const { downloadBlob } = require('./azureBlobService');
    
    // Download original from private container
    const { buffer, contentType } = await downloadBlob('private', blobName);
    
    // Determine format from content type or blob name
    const format = blobName.split('.').pop() || 'jpg';
    
    // Process image
    const results = await processImage(buffer, mediaId, format);
    
    // Add original blob name to results
    results.originalBlobName = blobName;
    results.originalContentType = contentType;
    
    return results;
  } catch (error) {
    logger.error('Failed to process image from blob', {
      error: error.message,
      blobName,
      mediaId,
    });
    throw error;
  }
};

/**
 * Generate thumbnail only (for quick preview)
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string} mediaId - Unique media ID
 * @returns {string} Thumbnail URL
 */
const generateThumbnail = async (imageBuffer, mediaId) => {
  try {
    const config = VARIANTS.thumb;
    const sharpInstance = sharp(imageBuffer)
      .resize(config.width, config.height, {
        fit: config.fit,
        position: 'center',
      })
      .webp({ quality: config.quality });

    const thumbnailBuffer = await sharpInstance.toBuffer();
    const blobName = generateBlobName('image', mediaId, 1, 'webp');
    const thumbnailBlobName = blobName.replace('_v1.webp', '_thumb_v1.webp');

    const uploadResult = await uploadBlob(
      'public',
      thumbnailBlobName,
      thumbnailBuffer,
      'image/webp',
      {
        variant: 'thumb',
        mediaId: mediaId,
      }
    );

    return uploadResult.url;
  } catch (error) {
    logger.error('Failed to generate thumbnail', {
      error: error.message,
      mediaId,
    });
    throw error;
  }
};

module.exports = {
  processImage,
  processImageFromBlob,
  generateThumbnail,
  VARIANTS,
};
