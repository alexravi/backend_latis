// Email job processor
const { Worker } = require('bullmq');
const { getQueue, QUEUE_NAMES } = require('../services/jobQueue');
const logger = require('../utils/logger');

// Helper to mask email addresses for logging
const maskEmail = (email) => {
  if (!email) return 'N/A';
  const [localPart, domain] = email.split('@');
  if (!domain) return email; // Invalid email format
  const maskedLocal = localPart.length > 2 
    ? `${localPart.substring(0, 2)}***` 
    : '***';
  return `${maskedLocal}@${domain}`;
};

// Email service will be implemented separately
// For now, this is a placeholder that logs the email job
const sendEmail = async (emailData) => {
  // TODO: Implement actual email sending (nodemailer, SendGrid, etc.)
  logger.info('Email job processed', {
    to: maskEmail(emailData.to),
    subject: emailData.subject,
    type: emailData.type,
  });
  
  // Simulate email sending
  return { success: true, messageId: `mock-${Date.now()}` };
};

/**
 * Create email worker
 */
const createEmailWorker = () => {
  getQueue(QUEUE_NAMES.EMAIL); // Initialize queue
  
  const worker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      logger.info(`Processing email job ${job.id}`, {
        id: job.id,
        name: job.name,
      });
      
      try {
        const result = await sendEmail(job.data);
        logger.info(`Email job ${job.id} completed`, { result });
        return result;
      } catch (error) {
        logger.logError(error, {
          context: 'emailWorker',
          jobId: job.id,
          jobData: job.data,
        });
        throw error; // Will trigger retry
      }
    },
    {
      connection: require('../config/redis').getRedisConnectionConfig(),
      concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY) || 5,
      limiter: {
        max: 10, // Max 10 emails per
        duration: 1000, // per second
      },
    }
  );
  
  worker.on('completed', (job) => {
    logger.info(`Email job ${job.id} completed successfully`);
  });
  
  worker.on('failed', (job, err) => {
    logger.error(`Email job ${job.id} failed`, {
      error: err.message,
      attempts: job.attemptsMade,
    });
  });
  
  worker.on('error', (err) => {
    logger.logError(err, { context: 'emailWorker' });
  });
  
  logger.info('Email worker started');
  return worker;
};

module.exports = {
  createEmailWorker,
  sendEmail,
};
