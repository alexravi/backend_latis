// Image Processing Job - Background worker for processing uploaded images
const { Worker } = require('bullmq');
const { redisClient, getRedisConnectionConfig } = require('../config/redis');
const { processImageFromBlob } = require('../services/imageProcessingService');
const PostMedia = require('../models/PostMedia');
const logger = require('../utils/logger');

// Connection for BullMQ
const connection = getRedisConnectionConfig();

/**
 * Process image processing job
 */
const processImageJob = async (job) => {
  const { mediaId, blobName, postMediaId } = job.data;
  
  try {
    logger.info('Starting image processing job', { mediaId, blobName, postMediaId });
    
    // Update status to processing
    if (postMediaId) {
      await PostMedia.updateStatus(postMediaId, 'processing');
    }
    
    // Process image from blob
    const results = await processImageFromBlob(blobName, mediaId);
    
    // Update PostMedia with results
    if (postMediaId) {
      await PostMedia.updateStatus(
        postMediaId,
        'ready',
        null, // no error
        results.variants,
        {
          aspect_ratio: results.aspectRatio,
          dominant_color: results.dominantColor,
          width: results.metadata.width,
          height: results.metadata.height,
        }
      );
    }
    
    logger.info('Image processing job completed', { 
      mediaId, 
      postMediaId,
      variants: Object.keys(results.variants).length 
    });
    
    return {
      success: true,
      mediaId,
      variants: results.variants,
      aspectRatio: results.aspectRatio,
      dominantColor: results.dominantColor,
    };
  } catch (error) {
    logger.error('Image processing job failed', {
      error: error.message,
      mediaId,
      postMediaId,
      stack: error.stack,
    });
    
    // Update status to failed
    if (postMediaId) {
      await PostMedia.updateStatus(
        postMediaId,
        'failed',
        error.message
      );
    }
    
    throw error;
  }
};

/**
 * Create and start image processing worker
 */
const createImageProcessingWorker = () => {
  const queueName = process.env.IMAGE_PROCESSING_QUEUE || 'image-processing';
  
  const worker = new Worker(
    queueName,
    processImageJob,
    {
      connection,
      concurrency: parseInt(process.env.IMAGE_PROCESSING_CONCURRENCY) || 2,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );
  
  worker.on('completed', (job) => {
    logger.debug('Image processing job completed', { jobId: job.id, mediaId: job.data.mediaId });
  });
  
  worker.on('failed', (job, err) => {
    logger.error('Image processing job failed', {
      jobId: job?.id,
      mediaId: job?.data?.mediaId,
      error: err.message,
    });
  });
  
  worker.on('error', (err) => {
    logger.error('Image processing worker error', { error: err.message });
  });
  
  logger.info(`Image processing worker started for queue: ${queueName}`);
  
  return worker;
};

module.exports = {
  createImageProcessingWorker,
  processImageJob,
};
