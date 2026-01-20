// Upload controller
const { authenticateToken } = require('../middleware/authMiddleware');
const { getFileUrl } = require('../services/fileUploadService');
const logger = require('../utils/logger');

/**
 * Handle profile image upload
 */
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const fileUrl = getFileUrl(req.file.path);

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
      },
    });
  } catch (error) {
    logger.logError(error, { context: 'uploadProfileImage' });
    res.status(500).json({
      success: false,
      message: 'File upload failed',
    });
  }
};

/**
 * Handle cover image upload
 */
const uploadCoverImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const fileUrl = getFileUrl(req.file.path);

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
      },
    });
  } catch (error) {
    logger.logError(error, { context: 'uploadCoverImage' });
    res.status(500).json({
      success: false,
      message: 'File upload failed',
    });
  }
};

/**
 * Handle document upload
 */
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const fileUrl = getFileUrl(req.file.path);

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
      },
    });
  } catch (error) {
    logger.logError(error, { context: 'uploadDocument' });
    res.status(500).json({
      success: false,
      message: 'Document upload failed',
    });
  }
};

/**
 * Handle multiple files upload
 */
const uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const files = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: getFileUrl(file.path),
    }));

    res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      data: {
        count: files.length,
        files,
      },
    });
  } catch (error) {
    logger.logError(error, { context: 'uploadMultiple' });
    res.status(500).json({
      success: false,
      message: 'Files upload failed',
    });
  }
};

module.exports = {
  uploadProfileImage,
  uploadCoverImage,
  uploadDocument,
  uploadMultiple,
};
