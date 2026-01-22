// Video Processing Job - Background worker for processing uploaded videos
const { Worker } = require('bullmq');
const { redisClient, getRedisConnectionConfig } = require('../config/redis');
const { processVideoFromBlob } = require('../services/videoProcessingService');
const PostMedia = require('../models/PostMedia');
const logger = require('../utils/logger');

// Connection for BullMQ
const connection = getRedisConnectionConfig();

/**
 * Process video processing job
 */
const processVideoJob = async (job) => {
  const { mediaId, blobName, postMediaId } = job.data;
  
  try {
    logger.info('Starting video processing job', { mediaId, blobName, postMediaId });
    
    // Update status to processing
    if (postMediaId) {
      await PostMedia.updateStatus(postMediaId, 'processing');
    }
    
    // Process video from blob
    const results = await processVideoFromBlob(blobName, mediaId);
    
    // Combine video variants with poster
    const allVariants = {
      ...results.variants,
      poster: results.posterUrl,
    };
    
    // Update PostMedia with results
    if (postMediaId) {
      await PostMedia.updateStatus(
        postMediaId,
        'ready',
        null, // no error
        allVariants,
        {
          aspect_ratio: results.aspectRatio,
          width: results.metadata.width,
          height: results.metadata.height,
          duration: results.metadata.duration,
        }
      );
    }
    
    logger.info('Video processing job completed', { 
      mediaId, 
      postMediaId,
      variants: Object.keys(results.variants).length,
      duration: results.metadata.duration 
    });
    
    return {
      success: true,
      mediaId,
      variants: allVariants,
      aspectRatio: results.aspectRatio,
      duration: results.metadata.duration,
      posterUrl: results.posterUrl,
    };
  } catch (error) {
    logger.error('Video processing job failed', {
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
 * Create and start video processing worker
 */
const createVideoProcessingWorker = () => {
  const queueName = process.env.VIDEO_PROCESSING_QUEUE || 'video-processing';
  
  const worker = new Worker(
    queueName,
    processVideoJob,
    {
      connection,
      concurrency: parseInt(process.env.VIDEO_PROCESSING_CONCURRENCY) || 1, // Lower concurrency for video
      limiter: {
        max: 5,
        duration: 1000,
      },
    }
  );
  
  worker.on('completed', (job) => {
    logger.debug('Video processing job completed', { jobId: job.id, mediaId: job.data.mediaId });
  });
  
  worker.on('failed', (job, err) => {
    logger.error('Video processing job failed', {
      jobId: job?.id,
      mediaId: job?.data?.mediaId,
      error: err.message,
    });
  });
  
  worker.on('error', (err) => {
    logger.error('Video processing worker error', { error: err.message });
  });
  
  logger.info(`Video processing worker started for queue: ${queueName}`);
  
  return worker;
};

module.exports = {
  createVideoProcessingWorker,
  processVideoJob,
};
