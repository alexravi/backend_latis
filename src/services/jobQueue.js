// Job queue service using BullMQ
const { Queue, Worker, QueueEvents } = require('bullmq');
const { redisClient, getRedisConnectionConfig } = require('../config/redis');
const logger = require('../utils/logger');

// Create connection for BullMQ (uses existing Redis client config)
const connection = getRedisConnectionConfig();

// Job queue instances
const queues = {};
// QueueEvents instances (for tracking and cleanup)
const queueEventsMap = new Map();

// Queue names
const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  CLEANUP: 'cleanup',
  IMAGE_PROCESSING: process.env.IMAGE_PROCESSING_QUEUE || 'image-processing',
  VIDEO_PROCESSING: process.env.VIDEO_PROCESSING_QUEUE || 'video-processing',
};

/**
 * Get or create a queue
 */
const getQueue = (queueName) => {
  if (!queues[queueName]) {
    queues[queueName] = new Queue(queueName, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });
    
    // Setup queue event listeners
    const queueEvents = new QueueEvents(queueName, { connection });
    queueEventsMap.set(queueName, queueEvents);
    
    queueEvents.on('completed', ({ jobId }) => {
      logger.debug(`Job ${jobId} completed in queue ${queueName}`);
    });
    
    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job ${jobId} failed in queue ${queueName}`, {
        reason: failedReason,
      });
    });
    
    logger.info(`Queue ${queueName} initialized`);
  }
  
  return queues[queueName];
};

/**
 * Add job to queue
 */
const addJob = async (queueName, jobName, jobData, options = {}) => {
  try {
    const queue = getQueue(queueName);
    const job = await queue.add(jobName || 'default', jobData, options);
    logger.debug(`Job added to queue ${queueName}`, { jobId: job.id });
    return job;
  } catch (error) {
    logger.logError(error, { context: 'addJob', queueName });
    throw error;
  }
};

/**
 * Add email job
 */
const addEmailJob = async (emailData, options = {}) => {
  return addJob(QUEUE_NAMES.EMAIL, 'send-email', emailData, {
    priority: options.priority || 1,
    delay: options.delay || 0,
    ...options,
  });
};

/**
 * Add notification job
 */
const addNotificationJob = async (notificationData, options = {}) => {
  return addJob(QUEUE_NAMES.NOTIFICATION, 'send-notification', notificationData, options);
};

/**
 * Add cleanup job
 */
const addCleanupJob = async (cleanupData, options = {}) => {
  return addJob(QUEUE_NAMES.CLEANUP, 'cleanup', cleanupData, {
    priority: 10, // Lower priority for cleanup jobs
    ...options,
  });
};

/**
 * Add image processing job
 */
const addImageProcessingJob = async (imageData, options = {}) => {
  return addJob(QUEUE_NAMES.IMAGE_PROCESSING, 'process-image', imageData, {
    priority: options.priority || 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    ...options,
  });
};

/**
 * Add video processing job
 */
const addVideoProcessingJob = async (videoData, options = {}) => {
  return addJob(QUEUE_NAMES.VIDEO_PROCESSING, 'process-video', videoData, {
    priority: options.priority || 5,
    attempts: 2, // Fewer attempts for video (takes longer)
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    ...options,
  });
};

/**
 * Get queue statistics
 */
const getQueueStats = async (queueName) => {
  try {
    const queue = getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  } catch (error) {
    logger.logError(error, { context: 'getQueueStats', queueName });
    return null;
  }
};

/**
 * Clean up old jobs
 */
const cleanQueue = async (queueName, grace = 1000) => {
  try {
    const queue = getQueue(queueName);
    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace, 100, 'failed');
    logger.info(`Cleaned queue ${queueName}`);
  } catch (error) {
    logger.logError(error, { context: 'cleanQueue', queueName });
  }
};

/**
 * Close all queues (for graceful shutdown)
 */
const closeAllQueues = async () => {
  // Close all QueueEvents instances first
  const closePromises = [];
  for (const [queueName, queueEvents] of queueEventsMap.entries()) {
    try {
      closePromises.push(queueEvents.close());
    } catch (error) {
      logger.error(`Error closing QueueEvents for ${queueName}`, { error: error.message });
    }
  }
  
  await Promise.all(closePromises);
  queueEventsMap.clear();
  
  // Close all Queue instances
  await Promise.all(
    Object.values(queues).map(queue => queue.close())
  );
  logger.info('All queues and queue events closed');
};

module.exports = {
  getQueue,
  addJob,
  addEmailJob,
  addNotificationJob,
  addCleanupJob,
  addImageProcessingJob,
  addVideoProcessingJob,
  getQueueStats,
  cleanQueue,
  closeAllQueues,
  QUEUE_NAMES,
};
