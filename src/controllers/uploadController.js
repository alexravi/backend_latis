// Upload controller
const { authenticateToken } = require('../middleware/authMiddleware');
const { getFileUrl } = require('../services/fileUploadService');
const { generateUploadToken, validateUploadRequest } = require('../services/sasTokenService');
const { addImageProcessingJob, addVideoProcessingJob } = require('../services/jobQueue');
const PostMedia = require('../models/PostMedia');
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

/**
 * Generate SAS token for direct upload
 * POST /api/v1/upload/token
 */
const generateUploadTokenHandler = async (req, res) => {
  try {
    const { content_type, file_size } = req.body;

    if (!content_type) {
      return res.status(400).json({
        success: false,
        message: 'content_type is required',
      });
    }

    // Validate upload request
    const validation = validateUploadRequest(content_type, file_size);
    const { mediaType } = validation;

    // Generate upload token
    const tokenData = await generateUploadToken(mediaType, content_type, file_size);

    res.status(200).json({
      success: true,
      data: tokenData,
    });
  } catch (error) {
    logger.logError(error, { context: 'generateUploadToken' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate upload token',
    });
  }
};

/**
 * Notify upload completion and create PostMedia record
 * POST /api/v1/upload/complete
 */
const completeUploadHandler = async (req, res) => {
  try {
    const { upload_id, blob_name, media_type, content_type, file_size } = req.body;

    if (!upload_id || !blob_name || !media_type) {
      return res.status(400).json({
        success: false,
        message: 'upload_id, blob_name, and media_type are required',
      });
    }

    // Extract media ID from upload_id or generate one
    const mediaId = upload_id.replace('upload_', '');

    // Create PostMedia record with status 'uploaded'
    const postMedia = await PostMedia.create({
      post_id: null, // Will be set when post is created
      media_type: media_type,
      media_url: null, // Will be set after processing
      mime_type: content_type,
      file_size: file_size,
      status: 'uploaded',
      original_blob_name: blob_name,
    });

    // Enqueue processing job
    const jobData = {
      mediaId: mediaId,
      blobName: blob_name,
      postMediaId: postMedia.id,
    };

    if (media_type === 'video') {
      await addVideoProcessingJob(jobData);
    } else {
      await addImageProcessingJob(jobData);
    }

    res.status(200).json({
      success: true,
      message: 'Upload completed, processing started',
      data: {
        media_id: postMedia.id,
        status: 'uploaded',
        processing_status: 'queued',
      },
    });
  } catch (error) {
    logger.logError(error, { context: 'completeUpload' });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete upload',
    });
  }
};

/**
 * Get media status
 * GET /api/v1/media/:id/status
 */
const getMediaStatus = async (req, res) => {
  try {
    const mediaId = parseInt(req.params.id);

    if (isNaN(mediaId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid media ID',
      });
    }

    const media = await PostMedia.findById(mediaId);

    if (!media) {
      return res.status(404).json({
        success: false,
        message: 'Media not found',
      });
    }

    // Parse variants if present
    if (media.variants) {
      media.variants = typeof media.variants === 'string' 
        ? JSON.parse(media.variants) 
        : media.variants;
    }

    res.status(200).json({
      success: true,
      data: {
        id: media.id,
        status: media.status || 'uploaded',
        processing_error: media.processing_error,
        variants: media.variants || {},
        aspect_ratio: media.aspect_ratio,
        dominant_color: media.dominant_color,
      },
    });
  } catch (error) {
    logger.logError(error, { context: 'getMediaStatus' });
    res.status(500).json({
      success: false,
      message: 'Failed to get media status',
    });
  }
};

module.exports = {
  uploadProfileImage,
  uploadCoverImage,
  uploadDocument,
  uploadMultiple,
  generateUploadTokenHandler,
  completeUploadHandler,
  getMediaStatus,
};
