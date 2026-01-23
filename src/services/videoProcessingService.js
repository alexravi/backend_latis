// Video Processing Service - Extract poster, transcode variants using FFmpeg
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { uploadBlob, generateBlobName } = require('./azureBlobService');
const { processImage } = require('./imageProcessingService');
const logger = require('../utils/logger');
const { Readable } = require('stream');

// Set FFmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// Video variant configurations
const VIDEO_VARIANTS = {
  '480p': {
    width: 854,
    height: 480,
    bitrate: '1000k',
  },
  '720p': {
    width: 1280,
    height: 720,
    bitrate: '2500k',
  },
};

/**
 * Extract poster image (first keyframe) from video
 * @param {Buffer} videoBuffer - Video buffer
 * @param {string} mediaId - Unique media ID
 * @returns {string} Poster image URL
 */
const extractPoster = async (videoBuffer, mediaId) => {
  return new Promise((resolve, reject) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      // Create temporary file for video
      const tempDir = os.tmpdir();
      const tempVideoPath = path.join(tempDir, `video_${mediaId}_${Date.now()}.mp4`);
      const tempPosterPath = path.join(tempDir, `poster_${mediaId}_${Date.now()}.jpg`);
      
      // Write video buffer to temp file
      fs.writeFileSync(tempVideoPath, videoBuffer);
      
      ffmpeg(tempVideoPath)
        .screenshots({
          timestamps: ['00:00:00.000'],
          filename: path.basename(tempPosterPath),
          folder: tempDir,
          size: '1280x720',
        })
        .on('end', async () => {
          try {
            // Read the extracted frame
            const frameBuffer = fs.readFileSync(tempPosterPath);
            
            // Process as image to generate variants
            const imageResults = await processImage(frameBuffer, `${mediaId}_poster`, 'jpg');
            
            // Use the feed variant as poster URL
            const posterUrl = imageResults.variants.feed || imageResults.variants.full;
            
            // Cleanup temp files (use async unlink with error handling)
            try {
              await fs.promises.unlink(tempVideoPath);
            } catch (err) {
              // Ignore cleanup errors
            }
            try {
              await fs.promises.unlink(tempPosterPath);
            } catch (err) {
              // Ignore cleanup errors
            }
            
            resolve(posterUrl);
          } catch (error) {
            // Cleanup on error (use async unlink with error handling)
            try {
              await fs.promises.unlink(tempVideoPath);
            } catch (err) {
              // Ignore cleanup errors
            }
            try {
              await fs.promises.unlink(tempPosterPath);
            } catch (err) {
              // Ignore cleanup errors
            }
            logger.error('Failed to process poster image', { error: error.message, mediaId });
            reject(error);
          }
        })
        .on('error', async (error) => {
          // Cleanup on error (use async unlink with error handling)
          try {
            await fs.promises.unlink(tempVideoPath);
          } catch (err) {
            // Ignore cleanup errors
          }
          try {
            await fs.promises.unlink(tempPosterPath);
          } catch (err) {
            // Ignore cleanup errors
          }
          logger.error('Failed to extract poster', { error: error.message, mediaId });
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Transcode video to specific variant
 * @param {Buffer} videoBuffer - Original video buffer
 * @param {string} variantName - Variant name (480p, 720p)
 * @param {string} mediaId - Unique media ID
 * @returns {Buffer} Transcoded video buffer
 */
const transcodeVideo = async (videoBuffer, variantName, mediaId) => {
  return new Promise((resolve, reject) => {
    try {
      const config = VIDEO_VARIANTS[variantName];
      if (!config) {
        reject(new Error(`Unknown variant: ${variantName}`));
        return;
      }

      const videoStream = Readable.from(videoBuffer);
      const outputChunks = [];
      
      ffmpeg(videoStream)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${config.width}x${config.height}`)
        .videoBitrate(config.bitrate)
        .format('mp4')
        .outputOptions([
          '-movflags faststart', // Fast-start MP4 (moov atom at front)
          '-preset fast',
          '-crf 23',
        ])
        .on('start', (commandLine) => {
          logger.debug(`FFmpeg transcoding started for ${variantName}`, { mediaId, commandLine });
        })
        .on('progress', (progress) => {
          logger.debug(`FFmpeg progress for ${variantName}`, { mediaId, progress });
        })
        .on('end', () => {
          const outputBuffer = Buffer.concat(outputChunks);
          resolve(outputBuffer);
        })
        .on('error', (error) => {
          logger.error(`FFmpeg transcoding failed for ${variantName}`, { error: error.message, mediaId });
          reject(error);
        })
        .pipe()
        .on('data', (chunk) => {
          outputChunks.push(chunk);
        });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get video metadata (duration, dimensions, etc.)
 * @param {Buffer} videoBuffer - Video buffer
 * @returns {Object} Video metadata
 */
const getVideoMetadata = async (videoBuffer) => {
  return new Promise((resolve, reject) => {
    try {
      const videoStream = Readable.from(videoBuffer);
      
      ffmpeg(videoStream)
        .ffprobe((err, metadata) => {
          if (err) {
            reject(err);
            return;
          }
          
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          
          resolve({
            duration: metadata.format.duration,
            width: videoStream?.width,
            height: videoStream?.height,
            aspectRatio: videoStream?.width && videoStream?.height 
              ? videoStream.width / videoStream.height 
              : null,
            codec: videoStream?.codec_name,
            bitrate: metadata.format.bit_rate,
            size: metadata.format.size,
            hasAudio: !!audioStream,
          });
        });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Process video and generate variants
 * @param {Buffer} videoBuffer - Original video buffer
 * @param {string} mediaId - Unique media ID
 * @returns {Object} Processing results with variant URLs and metadata
 */
const processVideo = async (videoBuffer, mediaId) => {
  try {
    const results = {
      variants: {},
      posterUrl: null,
      metadata: {},
      aspectRatio: null,
    };

    // Extract metadata
    const metadata = await getVideoMetadata(videoBuffer);
    results.metadata = metadata;
    results.aspectRatio = metadata.aspectRatio;

    // Extract poster image
    results.posterUrl = await extractPoster(videoBuffer, mediaId);

    // Transcode variants
    for (const [variantName, config] of Object.entries(VIDEO_VARIANTS)) {
      try {
        const transcodedBuffer = await transcodeVideo(videoBuffer, variantName, mediaId);
        
        // Generate blob name
        const blobName = generateBlobName('video', mediaId, 1, 'mp4');
        const variantBlobName = blobName.replace('_v1.mp4', `_${variantName}_v1.mp4`);

        // Upload to public container
        const uploadResult = await uploadBlob(
          'public',
          variantBlobName,
          transcodedBuffer,
          'video/mp4',
          {
            variant: variantName,
            mediaId: mediaId,
          }
        );

        results.variants[variantName] = uploadResult.url;

        logger.debug('Video variant processed', {
          variant: variantName,
          mediaId,
          size: transcodedBuffer.length,
          url: uploadResult.url,
        });
      } catch (variantError) {
        logger.error(`Failed to process video variant ${variantName}`, {
          error: variantError.message,
          mediaId,
          variant: variantName,
        });
        // Continue with other variants even if one fails
      }
    }

    return results;
  } catch (error) {
    logger.error('Video processing failed', {
      error: error.message,
      mediaId,
    });
    throw error;
  }
};

/**
 * Process video from Azure blob (download, process, upload variants)
 * @param {string} blobName - Name of the blob in private container
 * @param {string} mediaId - Unique media ID
 * @returns {Object} Processing results
 */
const processVideoFromBlob = async (blobName, mediaId) => {
  try {
    const { downloadBlob } = require('./azureBlobService');
    
    // Download original from private container
    const { buffer, contentType } = await downloadBlob('private', blobName);
    
    // Process video
    const results = await processVideo(buffer, mediaId);
    
    // Add original blob name to results
    results.originalBlobName = blobName;
    results.originalContentType = contentType;
    
    return results;
  } catch (error) {
    logger.error('Failed to process video from blob', {
      error: error.message,
      blobName,
      mediaId,
    });
    throw error;
  }
};

module.exports = {
  processVideo,
  processVideoFromBlob,
  extractPoster,
  transcodeVideo,
  getVideoMetadata,
  VIDEO_VARIANTS,
};
