// Upload middleware helpers
const { upload } = require('../services/fileUploadService');
const logger = require('../utils/logger');

/**
 * Middleware for single file upload
 */
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.single(fieldName);
    uploadMiddleware(req, res, (err) => {
      if (err) {
        logger.warn('File upload error', { error: err.message, fieldName });
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }
      next();
    });
  };
};

/**
 * Middleware for multiple files upload
 */
const uploadMultiple = (fieldName, maxCount = 10) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.array(fieldName, maxCount);
    uploadMiddleware(req, res, (err) => {
      if (err) {
        logger.warn('File upload error', { error: err.message, fieldName });
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }
      next();
    });
  };
};

/**
 * Middleware for multiple fields upload
 */
const uploadFields = (fields) => {
  return (req, res, next) => {
    const uploadMiddleware = upload.fields(fields);
    uploadMiddleware(req, res, (err) => {
      if (err) {
        logger.warn('File upload error', { error: err.message });
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
        });
      }
      next();
    });
  };
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadFields,
};
